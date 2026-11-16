import "./styles.css";

import { addServerListElement, removeServerListElement, ServerListRenderPosition } from "@api/ServerList";
import ErrorBoundary from "@components/ErrorBoundary";
import { classNameFactory } from "@utils/css";
import definePlugin from "@utils/types";
import { Modal, openModal, Tooltip, useEffect, useMemo, useState } from "@webpack/common";
import { ReactNode } from "react";

import {
    Credentials,
    getArtistArt,
    getFriends,
    getLovedTracks,
    getRecentTracks,
    getTopAlbums,
    getTopArtists,
    getTopTracks,
    getTrackArt,
    getUserInfo,
    Period,
    PERIODS,
    RECENT_REFRESH_INTERVAL,
    RecentTrack,
    UserInfo
} from "./api";
import { settings } from "./settings";

const cl = classNameFactory("vc-lastfm-stats-");

const TABS = [
    { id: "recent", label: "Recent" },
    { id: "tracks", label: "Top Tracks" },
    { id: "albums", label: "Top Albums" },
    { id: "artists", label: "Top Artists" },
    { id: "loved", label: "Loved" },
    { id: "friends", label: "Friends" }
] as const;

type TabId = typeof TABS[number]["id"];

const PERIOD_TABS: TabId[] = ["tracks", "albums", "artists"];
const SKELETON_COUNT = 8;

const numberFormat = new Intl.NumberFormat();
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function formatDate(unix: number) {
    return dateFormat.format(unix * 1000);
}

function timeAgo(unix: number) {
    const minutes = Math.floor((Date.now() / 1000 - unix) / 60);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;
    if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / 60 / 24)}d ago`;
    return formatDate(unix);
}

function plays(count: number) {
    return `${numberFormat.format(count)} ${count === 1 ? "play" : "plays"}`;
}

function trackKey(artist: string, name: string) {
    return `${artist}\n${name}`.toLowerCase();
}

interface AsyncState<T> {
    data?: T;
    error?: string;
    loading: boolean;
}

// Keeps showing the previous data while a newer request is running
function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
    const [state, setState] = useState<AsyncState<T>>({ loading: true });

    useEffect(() => {
        let alive = true;
        setState(prev => ({ ...prev, loading: true }));

        load().then(
            data => alive && setState({ data, loading: false }),
            error => alive && setState(prev => ({ data: prev.data, error: error?.message || String(error), loading: false }))
        );

        return () => { alive = false; };
    }, deps);

    return state;
}

function LastFMLogo({ size }: { size: number; }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.42 0 3.189 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.285 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.629-3.931l-1.759-.385c-1.21-.275-1.567-.77-1.567-1.595 0-.934.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.601l1.87.44c1.402.33 1.869.907 1.869 1.704 0 1.017-.99 1.43-2.86 1.43-2.776 0-3.932-1.457-4.591-3.464l-.907-2.749c-1.155-3.574-2.997-4.894-6.653-4.894C2.144 5.333 0 7.89 0 12.233c0 4.18 2.144 6.434 5.993 6.434 3.106 0 4.591-1.457 4.591-1.457z" />
        </svg>
    );
}

interface ArtProps {
    src: string;
    glyph: string;
    round?: boolean;
    /** Looked up only when src is empty */
    fallback?: () => Promise<string>;
}

function Art({ src, glyph, round, fallback }: ArtProps) {
    const [resolved, setResolved] = useState(src);

    useEffect(() => {
        setResolved(src);
        if (src || !fallback) return;

        let alive = true;
        fallback().then(url => alive && url && setResolved(url));
        return () => { alive = false; };
    }, [src]);

    return (
        <div className={cl("art", { "art-round": round })}>
            {resolved
                ? <img src={resolved} alt="" loading="lazy" decoding="async" onError={() => setResolved("")} />
                : <span aria-hidden="true">{glyph}</span>}
        </div>
    );
}

interface ItemProps {
    url: string;
    art: ReactNode;
    title: string;
    subtitle?: string;
    meta?: ReactNode;
}

function Row({ url, art, title, subtitle, meta, rank, share }: ItemProps & { rank?: number; share?: number; }) {
    return (
        <a className={cl("row")} href={url || undefined} target="_blank" rel="noreferrer">
            {share !== undefined && <div className={cl("row-bar")} style={{ width: `${share * 100}%` }} />}
            {rank !== undefined && <div className={cl("rank")}>{rank}</div>}
            {art}
            <div className={cl("text")}>
                <div className={cl("title")}>{title}</div>
                {subtitle && <div className={cl("subtitle")}>{subtitle}</div>}
            </div>
            {meta && <div className={cl("meta")}>{meta}</div>}
        </a>
    );
}

function Card({ url, art, title, subtitle, meta, rank }: ItemProps & { rank: number; }) {
    return (
        <a className={cl("card")} href={url || undefined} target="_blank" rel="noreferrer">
            <div className={cl("card-art")}>
                {art}
                <div className={cl("card-rank")}>{rank}</div>
            </div>
            <div className={cl("title")}>{title}</div>
            {subtitle && <div className={cl("subtitle")}>{subtitle}</div>}
            {meta && <div className={cl("meta")}>{meta}</div>}
        </a>
    );
}

interface ListProps<T> {
    state: AsyncState<T[]>;
    layout: "rows" | "cards" | "friends";
    empty: string;
    render(item: T, index: number, items: T[]): ReactNode;
}

function List<T>({ state, layout, empty, render }: ListProps<T>) {
    const { data, error, loading } = state;

    if (!data) {
        if (error) return <div className={cl("message", "error")}>{error}</div>;

        return (
            <div className={cl("list", layout)} aria-busy="true">
                {Array.from({ length: SKELETON_COUNT }, (_, i) => <div key={i} className={cl("skeleton")} />)}
            </div>
        );
    }

    if (!data.length) return <div className={cl("message")}>{empty}</div>;

    return (
        <div className={cl("list", layout, { stale: loading })}>
            {data.map(render)}
        </div>
    );
}

interface TabProps {
    creds: Credentials;
    limit: number;
}

interface PeriodTabProps extends TabProps {
    period: Period;
}

function RecentTab({ state }: { state: AsyncState<RecentTrack[]>; }) {
    return (
        <List
            state={state}
            layout="rows"
            empty="No recent tracks"
            render={(track, i) => (
                <Row
                    key={`${track.date}-${i}`}
                    url={track.url}
                    art={<Art src={track.image} glyph="🎵" />}
                    title={track.name}
                    subtitle={track.album ? `${track.artist} · ${track.album}` : track.artist}
                    meta={track.nowPlaying
                        ? <span className={cl("now-playing")}>Now playing</span>
                        : track.date ? timeAgo(track.date) : null}
                />
            )}
        />
    );
}

function TopTracksTab({ creds, limit, period, knownArt }: PeriodTabProps & { knownArt: Map<string, string>; }) {
    const state = useAsync(() => getTopTracks(creds, period, limit), [creds, period, limit]);

    return (
        <List
            state={state}
            layout="rows"
            empty="No tracks in this period"
            render={(track, i, tracks) => (
                <Row
                    key={track.url || i}
                    rank={i + 1}
                    share={track.playcount / (tracks[0].playcount || 1)}
                    url={track.url}
                    art={
                        <Art
                            src={track.image || knownArt.get(trackKey(track.artist, track.name)) || ""}
                            glyph="🎵"
                            fallback={() => getTrackArt(creds.apiKey, track.artist, track.name)}
                        />
                    }
                    title={track.name}
                    subtitle={track.artist}
                    meta={plays(track.playcount)}
                />
            )}
        />
    );
}

function TopAlbumsTab({ creds, limit, period }: PeriodTabProps) {
    const state = useAsync(() => getTopAlbums(creds, period, limit), [creds, period, limit]);

    return (
        <List
            state={state}
            layout="cards"
            empty="No albums in this period"
            render={(album, i) => (
                <Card
                    key={album.url || i}
                    rank={i + 1}
                    url={album.url}
                    art={<Art src={album.image} glyph="💿" />}
                    title={album.name}
                    subtitle={album.artist}
                    meta={plays(album.playcount)}
                />
            )}
        />
    );
}

function TopArtistsTab({ creds, limit, period }: PeriodTabProps) {
    const state = useAsync(() => getTopArtists(creds, period, limit), [creds, period, limit]);

    return (
        <List
            state={state}
            layout="cards"
            empty="No artists in this period"
            render={(artist, i) => (
                <Card
                    key={artist.url || i}
                    rank={i + 1}
                    url={artist.url}
                    art={
                        <Art
                            src={artist.image}
                            glyph="🎤"
                            round
                            fallback={() => getArtistArt(creds.apiKey, artist.name)}
                        />
                    }
                    title={artist.name}
                    meta={plays(artist.playcount)}
                />
            )}
        />
    );
}

function LovedTab({ creds, limit, knownArt }: TabProps & { knownArt: Map<string, string>; }) {
    const state = useAsync(() => getLovedTracks(creds, limit), [creds, limit]);

    return (
        <List
            state={state}
            layout="rows"
            empty="No loved tracks"
            render={(track, i) => (
                <Row
                    key={track.url || i}
                    url={track.url}
                    art={
                        <Art
                            src={track.image || knownArt.get(trackKey(track.artist, track.name)) || ""}
                            glyph="🎵"
                            fallback={() => getTrackArt(creds.apiKey, track.artist, track.name)}
                        />
                    }
                    title={track.name}
                    subtitle={track.artist}
                    meta={track.date ? `❤️ ${formatDate(track.date)}` : "❤️"}
                />
            )}
        />
    );
}

function FriendsTab({ creds, limit }: TabProps) {
    const state = useAsync(() => getFriends(creds, limit), [creds, limit]);

    return (
        <List
            state={state}
            layout="friends"
            empty="No friends found"
            render={(friend, i) => (
                <Row
                    key={friend.url || i}
                    url={friend.url}
                    art={<Art src={friend.image} glyph="👤" round />}
                    title={friend.name}
                    subtitle={friend.realname}
                />
            )}
        />
    );
}

function Header({ user, latest }: { user: UserInfo; latest?: RecentTrack; }) {
    const days = Math.max(1, (Date.now() / 1000 - user.registered) / 86400);
    const stats = [
        [numberFormat.format(user.playcount), "scrobbles"],
        [numberFormat.format(user.artistCount), "artists"],
        [numberFormat.format(user.albumCount), "albums"],
        [numberFormat.format(user.trackCount), "tracks"],
        ...(user.registered ? [[numberFormat.format(Math.round(user.playcount / days)), "per day"]] : [])
    ];

    return (
        <div className={cl("header")}>
            <Art src={user.image} glyph="🎵" round />
            <div className={cl("text")}>
                <a className={cl("username")} href={user.url} target="_blank" rel="noreferrer">
                    {user.name}
                </a>
                {user.registered > 0 && (
                    <div className={cl("subtitle")}>Scrobbling since {formatDate(user.registered)}</div>
                )}
                <div className={cl("stats")}>
                    {stats.map(([value, label]) => (
                        <div key={label} className={cl("stat")}>
                            <strong>{value}</strong> {label}
                        </div>
                    ))}
                </div>
            </div>
            {latest && (
                <a className={cl("latest")} href={latest.url || undefined} target="_blank" rel="noreferrer">
                    <div className={cl("latest-label", { "now-playing": latest.nowPlaying })}>
                        {latest.nowPlaying ? "Now playing" : `Last played ${latest.date ? timeAgo(latest.date) : ""}`}
                    </div>
                    <div className={cl("latest-track")}>
                        <Art src={latest.image} glyph="🎵" />
                        <div className={cl("text")}>
                            <div className={cl("title")}>{latest.name}</div>
                            <div className={cl("subtitle")}>{latest.artist}</div>
                        </div>
                    </div>
                </a>
            )}
        </div>
    );
}

function StatsPage({ creds }: { creds: Credentials; }) {
    const { period = "7day", itemLimit: limit } = settings.use(["period", "itemLimit"]);
    const [tab, setTab] = useState<TabId>("recent");
    const [refreshCount, setRefreshCount] = useState(0);

    // Only the recent tracks are polled, and only while Discord is visible
    useEffect(() => {
        const interval = setInterval(() => {
            if (!document.hidden) setRefreshCount(count => count + 1);
        }, RECENT_REFRESH_INTERVAL);

        return () => clearInterval(interval);
    }, []);

    const user = useAsync(() => getUserInfo(creds), [creds]);
    const recent = useAsync(() => getRecentTracks(creds, limit, refreshCount > 0), [creds, limit, refreshCount]);

    // Recent tracks come with covers, which saves an artwork lookup for most top tracks
    const knownArt = useMemo(() => {
        const art = new Map<string, string>();
        for (const track of recent.data ?? []) {
            if (track.image) art.set(trackKey(track.artist, track.name), track.image);
        }
        return art;
    }, [recent.data]);

    if (!user.data) {
        return user.error
            ? <div className={cl("message", "error")}>Failed to load Last.fm data: {user.error}</div>
            : <div className={cl("message")}>Loading…</div>;
    }

    return (
        <div className={cl("page")}>
            <Header user={user.data} latest={recent.data?.[0]} />

            <div className={cl("toolbar")}>
                <div className={cl("tabs")} role="tablist">
                    {TABS.map(({ id, label }) => (
                        <button
                            key={id}
                            role="tab"
                            aria-selected={tab === id}
                            className={cl("tab", { "tab-active": tab === id })}
                            onClick={() => setTab(id)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {PERIOD_TABS.includes(tab) && (
                    <div className={cl("periods")}>
                        {PERIODS.map(({ value, label }) => (
                            <button
                                key={value}
                                aria-pressed={period === value}
                                className={cl("period", { "period-active": period === value })}
                                onClick={() => { settings.store.period = value; }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {tab === "recent" && <RecentTab state={recent} />}
            {tab === "tracks" && <TopTracksTab creds={creds} limit={limit} period={period} knownArt={knownArt} />}
            {tab === "albums" && <TopAlbumsTab creds={creds} limit={limit} period={period} />}
            {tab === "artists" && <TopArtistsTab creds={creds} limit={limit} period={period} />}
            {tab === "loved" && <LovedTab creds={creds} limit={limit} knownArt={knownArt} />}
            {tab === "friends" && <FriendsTab creds={creds} limit={limit} />}
        </div>
    );
}

function StatsModalContent() {
    const { username, apiKey } = settings.use(["username", "apiKey"]);
    const creds = useMemo(
        () => username && apiKey ? { username: username.trim(), apiKey: apiKey.trim() } : null,
        [username, apiKey]
    );

    if (!creds) {
        return (
            <div className={cl("message")}>
                Set your Last.fm username and API key in the LastFMStats plugin settings to see your stats.
            </div>
        );
    }

    return <StatsPage creds={creds} />;
}

function openStatsModal() {
    openModal(props => (
        <Modal {...props} size="xl" title="Last.fm Stats">
            <ErrorBoundary>
                <StatsModalContent />
            </ErrorBoundary>
        </Modal>
    ));
}

function ServerListButton() {
    return (
        <div className={cl("server-item")}>
            <Tooltip text="Last.fm Stats" position="right">
                {tooltipProps => (
                    <button
                        {...tooltipProps}
                        className={cl("server-button")}
                        aria-label="Last.fm Stats"
                        onClick={openStatsModal}
                    >
                        <LastFMLogo size={24} />
                    </button>
                )}
            </Tooltip>
        </div>
    );
}

export default definePlugin({
    name: "LastFMStats",
    description: "Display your Last.fm statistics",
    authors: [{ name: "Veexxar", id: 0n }],
    dependencies: ["ServerListAPI"],
    settings,

    renderServerListButton: ErrorBoundary.wrap(ServerListButton, { noop: true }),

    start() {
        addServerListElement(ServerListRenderPosition.Above, this.renderServerListButton);
    },

    stop() {
        removeServerListElement(ServerListRenderPosition.Above, this.renderServerListButton);
    }
});
