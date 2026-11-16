const API_URL = "https://ws.audioscrobbler.com/2.0/";
// Last.fm serves this grey star whenever it has no artwork
const PLACEHOLDER_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const DAY = 24 * 60 * MINUTE;

const STATS_TTL = 5 * MINUTE;
const RECENT_TTL = 20 * SECOND;
const ART_TTL = DAY;
const MAX_CACHE_ENTRIES = 300;
const MAX_CONCURRENT_ART_LOOKUPS = 4;

export const RECENT_REFRESH_INTERVAL = 30 * SECOND;

export const PERIODS = [
    { value: "7day", label: "7 days" },
    { value: "1month", label: "1 month" },
    { value: "3month", label: "3 months" },
    { value: "6month", label: "6 months" },
    { value: "12month", label: "1 year" },
    { value: "overall", label: "All time" }
] as const;

export type Period = typeof PERIODS[number]["value"];
export type ImageSize = "large" | "extralarge";

export interface Credentials {
    username: string;
    apiKey: string;
}

export interface UserInfo {
    name: string;
    realname: string;
    playcount: number;
    artistCount: number;
    trackCount: number;
    albumCount: number;
    registered: number;
    image: string;
    url: string;
}

export interface RecentTrack {
    name: string;
    artist: string;
    album: string;
    image: string;
    url: string;
    nowPlaying: boolean;
    date: number;
}

export interface TopItem {
    name: string;
    artist: string;
    playcount: number;
    image: string;
    url: string;
}

export interface LovedTrack {
    name: string;
    artist: string;
    image: string;
    url: string;
    date: number;
}

export interface Friend {
    name: string;
    realname: string;
    image: string;
    url: string;
}

interface CacheEntry {
    expires: number;
    promise: Promise<any>;
}

const cache = new Map<string, CacheEntry>();

function pruneCache() {
    if (cache.size < MAX_CACHE_ENTRIES) return;

    const now = Date.now();
    for (const [key, entry] of cache) {
        if (entry.expires <= now) cache.delete(key);
    }
    // Still full of live entries: drop the oldest insertions
    for (const key of cache.keys()) {
        if (cache.size < MAX_CACHE_ENTRIES) break;
        cache.delete(key);
    }
}

// Identical requests share one in-flight promise and are reused until the ttl runs out
function request(params: Record<string, string>, ttl: number, force = false): Promise<any> {
    const query = new URLSearchParams({ ...params, format: "json" }).toString();

    const cached = cache.get(query);
    if (cached && !force && cached.expires > Date.now()) return cached.promise;

    const promise = (async () => {
        const res = await fetch(`${API_URL}?${query}`);
        // Last.fm reports errors as json alongside a 4xx status
        const json = await res.json().catch(() => null);
        if (json?.error) throw new Error(json.message || `Last.fm error ${json.error}`);
        if (!res.ok || !json) throw new Error(`Last.fm request failed (${res.status})`);
        return json;
    })();

    pruneCache();
    cache.set(query, { expires: Date.now() + ttl, promise });
    promise.catch(() => {
        if (cache.get(query)?.promise === promise) cache.delete(query);
    });

    return promise;
}

let activeArtLookups = 0;
const artQueue: Array<() => void> = [];

async function limitArtLookups<T>(task: () => Promise<T>): Promise<T> {
    if (activeArtLookups >= MAX_CONCURRENT_ART_LOOKUPS)
        await new Promise<void>(resolve => artQueue.push(resolve));

    activeArtLookups++;
    try {
        return await task();
    } finally {
        activeArtLookups--;
        artQueue.shift()?.();
    }
}

function pickImage(images: any, size: ImageSize): string {
    if (!Array.isArray(images)) return "";

    const preferred = size === "extralarge" ? ["extralarge", "large", "medium"] : ["large", "extralarge", "medium"];
    for (const name of preferred) {
        const url = images.find(image => image.size === name)?.["#text"];
        if (url) return url.includes(PLACEHOLDER_HASH) ? "" : url;
    }
    return "";
}

function toList(value: any): any[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

export async function getUserInfo({ username, apiKey }: Credentials): Promise<UserInfo> {
    const { user } = await request({ method: "user.getinfo", api_key: apiKey, user: username }, STATS_TTL);

    return {
        name: user.name,
        realname: user.realname || "",
        playcount: Number(user.playcount) || 0,
        artistCount: Number(user.artist_count) || 0,
        trackCount: Number(user.track_count) || 0,
        albumCount: Number(user.album_count) || 0,
        registered: Number(user.registered?.unixtime) || 0,
        image: pickImage(user.image, "large"),
        url: user.url
    };
}

export async function getRecentTracks({ username, apiKey }: Credentials, limit: number, force = false): Promise<RecentTrack[]> {
    const json = await request({
        method: "user.getrecenttracks",
        api_key: apiKey,
        user: username,
        limit: String(limit)
    }, RECENT_TTL, force);

    return toList(json.recenttracks?.track).map(track => ({
        name: track.name || "Unknown",
        artist: track.artist?.["#text"] || track.artist?.name || "Unknown",
        album: track.album?.["#text"] || "",
        image: pickImage(track.image, "large"),
        url: track.url || "",
        nowPlaying: track["@attr"]?.nowplaying === "true",
        date: Number(track.date?.uts) || 0
    }));
}

function getTop(method: string, { username, apiKey }: Credentials, period: Period, limit: number) {
    return request({ method, api_key: apiKey, user: username, period, limit: String(limit) }, STATS_TTL);
}

function toTopItem(item: any, size: ImageSize): TopItem {
    return {
        name: item.name || "Unknown",
        artist: item.artist?.name || "",
        playcount: Number(item.playcount) || 0,
        image: pickImage(item.image, size),
        url: item.url || ""
    };
}

export async function getTopTracks(creds: Credentials, period: Period, limit: number): Promise<TopItem[]> {
    const json = await getTop("user.gettoptracks", creds, period, limit);
    return toList(json.toptracks?.track).map(track => toTopItem(track, "large"));
}

export async function getTopAlbums(creds: Credentials, period: Period, limit: number): Promise<TopItem[]> {
    const json = await getTop("user.gettopalbums", creds, period, limit);
    return toList(json.topalbums?.album).map(album => toTopItem(album, "extralarge"));
}

export async function getTopArtists(creds: Credentials, period: Period, limit: number): Promise<TopItem[]> {
    const json = await getTop("user.gettopartists", creds, period, limit);
    return toList(json.topartists?.artist).map(artist => toTopItem(artist, "extralarge"));
}

export async function getLovedTracks({ username, apiKey }: Credentials, limit: number): Promise<LovedTrack[]> {
    const json = await request({
        method: "user.getlovedtracks",
        api_key: apiKey,
        user: username,
        limit: String(limit)
    }, STATS_TTL);

    return toList(json.lovedtracks?.track).map(track => ({
        name: track.name || "Unknown",
        artist: track.artist?.name || "Unknown",
        image: pickImage(track.image, "large"),
        url: track.url || "",
        date: Number(track.date?.uts) || 0
    }));
}

export async function getFriends({ username, apiKey }: Credentials, limit: number): Promise<Friend[]> {
    const json = await request({
        method: "user.getfriends",
        api_key: apiKey,
        user: username,
        limit: String(limit)
    }, STATS_TTL);

    return toList(json.friends?.user).map(friend => ({
        name: friend.name || "Unknown",
        realname: friend.realname || "",
        image: pickImage(friend.image, "large"),
        url: friend.url || ""
    }));
}

// Last.fm no longer returns artwork for tracks, so borrow the cover of the album the track is on
export function getTrackArt(apiKey: string, artist: string, track: string): Promise<string> {
    return limitArtLookups(async () => {
        const json = await request({ method: "track.getInfo", api_key: apiKey, artist, track, autocorrect: "1" }, ART_TTL);
        return pickImage(json.track?.album?.image, "large");
    }).catch(() => "");
}

// Last.fm no longer returns artist photos either, so borrow the cover of the artist's most played album
export function getArtistArt(apiKey: string, artist: string): Promise<string> {
    return limitArtLookups(async () => {
        const json = await request({ method: "artist.gettopalbums", api_key: apiKey, artist, limit: "3", autocorrect: "1" }, ART_TTL);
        for (const album of toList(json.topalbums?.album)) {
            const url = pickImage(album.image, "extralarge");
            if (url) return url;
        }
        return "";
    }).catch(() => "");
}
