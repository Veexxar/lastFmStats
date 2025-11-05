import { addServerListElement, removeServerListElement, ServerListRenderPosition } from "@api/ServerList";
import { ErrorBoundary } from "@components/index";
import { Logger } from "@utils/Logger";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalRoot, openModal } from "@utils/modal";
import definePlugin, { StartAt } from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { Button, React, useState, useEffect } from "@webpack/common";
import { JSX } from "react";

import "./settings";
import "./styles.css";

interface UserInfo {
    name: string;
    playcount: string;
    image: string;
    url: string;
}

interface RecentTrack {
    name: string;
    artist: string;
    album: string;
    image: string;
    nowplaying?: boolean;
}

interface TopAlbum {
    name: string;
    artist: string;
    playcount: string;
    image: string;
    url: string;
}

interface TopTrack {
    name: string;
    artist: string;
    playcount: string;
    image: string;
    url: string;
}

interface TopArtist {
    name: string;
    playcount: string;
    image: string;
    url: string;
}

interface LovedTrack {
    name: string;
    artist: string;
    image: string;
    url: string;
    lovedDate: string;
}

interface Friend {
    name: string;
    realname: string;
    image: string;
    url: string;
}

const logger = new Logger("LastFMStats");

// Find Discord's components for server list items
const GuildlessServerListItemComponent = findComponentByCodeLazy("tooltip:", "lowerBadgeSize:");
const GuildedServerListItemPillComponent = findComponentByCodeLazy('"pill":"empty"');

function LastFMIcon(height: number, width: number): JSX.Element {
    return (
        <img
            src="https://www.last.fm/static/images/lastfm_logo_facebook.png"
            alt="Last.fm"
            height={height}
            width={width}
            style={{ borderRadius: "4px" }}
        />
    );
}

interface GuildlessServerListItemProps {
    id?: string;
    className?: string;
    icon?: JSX.Element;
    tooltip?: string;
    showPill?: boolean;
    isVisible?: boolean;
    isSelected?: boolean;
    onClick?: ((e: React.MouseEvent) => void);
    onContextMenu?: ((e: React.MouseEvent) => void);
}

function GuildlessServerListItem({
    id,
    className = "vc-lastfm-stats-item",
    icon,
    tooltip,
    showPill = false,
    isVisible = true,
    isSelected = false,
    onClick,
    onContextMenu
}: GuildlessServerListItemProps): JSX.Element {
    const [hovered, setHovered] = useState(false);

    const wrappedIcon = icon ? (
        <div className={`${className}-icon-container`}>
            {icon}
        </div>
    ) : undefined;

    return (
        <ErrorBoundary>
            {isVisible && (
                <div id={id} className={`${className}-container`}>
                    <div className={`${className}-pill-container`}>
                        <GuildedServerListItemPillComponent
                            selected={isSelected && showPill}
                            hovered={hovered && showPill}
                        />
                    </div>
                    <div className={`${className}-button-container`}>
                        <GuildlessServerListItemComponent
                            showPill={false}
                            selected={isSelected}
                            className={`${className}-button`}
                            onMouseEnter={() => setHovered(true)}
                            onMouseLeave={() => setHovered(false)}
                            {...(wrappedIcon && { icon: () => wrappedIcon })}
                            {...(tooltip !== undefined && { tooltip })}
                            {...(onClick !== undefined && { onClick })}
                            {...(onContextMenu !== undefined && { onContextMenu })}
                        />
                    </div>
                </div>
            )}
        </ErrorBoundary>
    );
}



async function fetchUserInfo(username: string, apiKey: string): Promise<UserInfo | null> {
    try {
        const params = new URLSearchParams({
            method: "user.getinfo",
            api_key: apiKey,
            user: username,
            format: "json"
        });

        const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
        if (!res.ok) throw `${res.status} ${res.statusText}`;

        const json = await res.json();
        if (json.error) {
            logger.error("Error from Last.fm API", `${json.error}: ${json.message}`);
            return null;
        }

        const user = json.user;
        const imageUrl = user.image?.find((x: any) => x.size === "large")?.["#text"] || "";
        return {
            name: user.name,
            playcount: user.playcount,
            image: imageUrl,
            url: user.url
        };
    } catch (e) {
        logger.error("Failed to query Last.fm API", e);
        return null;
    }
}

async function fetchRecentTrack(username: string, apiKey: string): Promise<RecentTrack | null> {
    try {
        const params = new URLSearchParams({
            method: "user.getrecenttracks",
            api_key: apiKey,
            user: username,
            limit: "1",
            format: "json"
        });

        const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
        if (!res.ok) throw `${res.status} ${res.statusText}`;

        const json = await res.json();
        if (json.error) {
            logger.error("Error from Last.fm API", `${json.error}: ${json.message}`);
            return null;
        }

        const track = json.recenttracks?.track?.[0];
        if (!track) return null;

        const imageUrl = track.image?.find((x: any) => x.size === "large")?.["#text"] || "";
        return {
            name: track.name || "Unknown",
            artist: track.artist?.["#text"] || "Unknown",
            album: track.album?.["#text"] || "",
            image: imageUrl,
            nowplaying: track["@attr"]?.nowplaying === "true"
        };
    } catch (e) {
        logger.error("Failed to query Last.fm API", e);
        return null;
    }
}

async function fetchTopAlbums(username: string, apiKey: string, limit: number = 10): Promise<TopAlbum[]> {
    try {
        const params = new URLSearchParams({
            method: "user.gettopalbums",
            api_key: apiKey,
            user: username,
            limit: limit.toString(),
            period: "7day",
            format: "json"
        });

        const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
        if (!res.ok) throw `${res.status} ${res.statusText}`;

        const json = await res.json();
        if (json.error) {
            logger.error("Error from Last.fm API", `${json.error}: ${json.message}`);
            return [];
        }

        const albums = json.topalbums?.album || [];
        return albums.map((album: any) => {
            const imageUrl = album.image?.find((x: any) => x.size === "large")?.["#text"] || "";
            return {
                name: album.name || "Unknown",
                artist: album.artist?.name || "Unknown",
                playcount: album.playcount || "0",
                image: imageUrl,
                url: album.url || ""
            };
        });
    } catch (e) {
        logger.error("Failed to query Last.fm API", e);
        return [];
    }
}

async function fetchTopTracks(username: string, apiKey: string, limit: number = 10): Promise<TopTrack[]> {
    try {
        const params = new URLSearchParams({
            method: "user.gettoptracks",
            api_key: apiKey,
            user: username,
            limit: limit.toString(),
            period: "7day",
            format: "json"
        });

        const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
        if (!res.ok) throw `${res.status} ${res.statusText}`;

        const json = await res.json();
        if (json.error) {
            logger.error("Error from Last.fm API", `${json.error}: ${json.message}`);
            return [];
        }

        const tracks = json.toptracks?.track || [];

        // Fetch additional info for each track to get album images
        return await Promise.all(tracks.map(async (track: any) => {
            let imageUrl = track.image?.find((x: any) => x.size === "large")?.["#text"] || "";

            // If no image, try to fetch from track.getInfo
            if (!imageUrl || imageUrl.includes("2a96cbd8b46e442fc41c2b86b821562f")) {
                try {
                    const infoParams = new URLSearchParams({
                        method: "track.getInfo",
                        api_key: apiKey,
                        artist: track.artist?.name || track.artist,
                        track: track.name,
                        format: "json"
                    });
                    const infoRes = await fetch(`https://ws.audioscrobbler.com/2.0/?${infoParams}`);
                    if (infoRes.ok) {
                        const infoJson = await infoRes.json();
                        imageUrl = infoJson.track?.album?.image?.find((x: any) => x.size === "large")?.["#text"] || imageUrl;
                    }
                } catch (e) {
                    // Silently fail and use original image
                }
            }

            return {
                name: track.name || "Unknown",
                artist: track.artist?.name || track.artist || "Unknown",
                playcount: track.playcount || "0",
                image: imageUrl,
                url: track.url || ""
            };
        }));
    } catch (e) {
        logger.error("Failed to query Last.fm API", e);
        return [];
    }
}

async function fetchTopArtists(username: string, apiKey: string, limit: number = 10): Promise<TopArtist[]> {
    try {
        const params = new URLSearchParams({
            method: "user.gettopartists",
            api_key: apiKey,
            user: username,
            limit: limit.toString(),
            period: "7day",
            format: "json"
        });

        const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
        if (!res.ok) throw `${res.status} ${res.statusText}`;

        const json = await res.json();
        if (json.error) {
            logger.error("Error from Last.fm API", `${json.error}: ${json.message}`);
            return [];
        }

        const artists = json.topartists?.artist || [];
        return artists.map((artist: any) => ({
            name: artist.name || "Unknown",
            playcount: artist.playcount || "0",
            image: artist.image?.find((x: any) => x.size === "mega")?.["#text"]
                || artist.image?.find((x: any) => x.size === "extralarge")?.["#text"]
                || artist.image?.find((x: any) => x.size === "large")?.["#text"]
                || "",
            url: artist.url || ""
        }));
    } catch (e) {
        logger.error("Failed to query Last.fm API", e);
        return [];
    }
}

async function fetchLovedTracks(username: string, apiKey: string, limit: number = 10): Promise<LovedTrack[]> {
    try {
        const params = new URLSearchParams({
            method: "user.getlovedtracks",
            api_key: apiKey,
            user: username,
            limit: limit.toString(),
            format: "json"
        });

        const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
        if (!res.ok) throw `${res.status} ${res.statusText}`;

        const json = await res.json();
        if (json.error) {
            logger.error("Error from Last.fm API", `${json.error}: ${json.message}`);
            return [];
        }

        const tracks = json.lovedtracks?.track || [];
        return tracks.map((track: any) => ({
            name: track.name || "Unknown",
            artist: track.artist?.name || "Unknown",
            image: track.image?.find((x: any) => x.size === "large")?.["#text"] || "",
            url: track.url || "",
            lovedDate: track.date?.uts ? new Date(parseInt(track.date.uts) * 1000).toLocaleDateString() : ""
        }));
    } catch (e) {
        logger.error("Failed to query Last.fm API", e);
        return [];
    }
}

async function fetchFriends(username: string, apiKey: string, limit: number = 10): Promise<Friend[]> {
    try {
        const params = new URLSearchParams({
            method: "user.getfriends",
            api_key: apiKey,
            user: username,
            limit: limit.toString(),
            format: "json"
        });

        const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
        if (!res.ok) throw `${res.status} ${res.statusText}`;

        const json = await res.json();
        if (json.error) {
            logger.error("Error from Last.fm API", `${json.error}: ${json.message}`);
            return [];
        }

        const friends = json.friends?.user || [];
        return friends.map((friend: any) => ({
            name: friend.name || "Unknown",
            realname: friend.realname || "",
            image: friend.image?.find((x: any) => x.size === "large")?.["#text"] || "",
            url: friend.url || ""
        }));
    } catch (e) {
        logger.error("Failed to query Last.fm API", e);
        return [];
    }
}

function LastFMStatsPage(): JSX.Element {
    const { username, apiKey } = settings.use(["username", "apiKey"]);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [recentTrack, setRecentTrack] = useState<RecentTrack | null>(null);
    const [topAlbums, setTopAlbums] = useState<TopAlbum[]>([]);
    const [topTracks, setTopTracks] = useState<TopTrack[]>([]);
    const [topArtists, setTopArtists] = useState<TopArtist[]>([]);
    const [lovedTracks, setLovedTracks] = useState<LovedTrack[]>([]);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"tracks" | "albums" | "artists" | "loved" | "friends">("tracks");

    useEffect(() => {
        async function fetchData() {
            if (!username || !apiKey) {
                setLoading(false);
                return;
            }

            setLoading(true);
            const [info, track, albums, tracks, artists, loved, friendsList] = await Promise.all([
                fetchUserInfo(username, apiKey),
                fetchRecentTrack(username, apiKey),
                fetchTopAlbums(username, apiKey, 10),
                fetchTopTracks(username, apiKey, 10),
                fetchTopArtists(username, apiKey, 10),
                fetchLovedTracks(username, apiKey, 10),
                fetchFriends(username, apiKey, 10)
            ]);

            setUserInfo(info);
            setRecentTrack(track);
            setTopAlbums(albums);
            setTopTracks(tracks);
            setTopArtists(artists);
            setLovedTracks(loved);
            setFriends(friendsList);
            setLoading(false);
        }

        fetchData();
        const interval = setInterval(fetchData, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [username, apiKey]);

    if (!username || !apiKey) {
        return (
            <div style={{ padding: "40px", textAlign: "center" }}>
                <h2 style={{ color: "var(--header-primary)", marginBottom: "16px" }}>Last.fm Stats</h2>
                <p style={{ color: "var(--text-muted)" }}>
                    Configure your Last.fm username and API key in plugin settings to view your stats.
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ padding: "40px", textAlign: "center" }}>
                <h2 style={{ color: "var(--header-primary)", marginBottom: "16px" }}>Loading...</h2>
            </div>
        );
    }

    if (!userInfo) {
        return (
            <div style={{ padding: "40px", textAlign: "center" }}>
                <h2 style={{ color: "var(--header-primary)", marginBottom: "16px" }}>Error</h2>
                <p style={{ color: "var(--text-danger)" }}>Failed to load Last.fm data</p>
            </div>
        );
    }

    return (
        <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
            {/* Header Section */}
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "20px",
                marginBottom: "32px",
                padding: "24px",
                backgroundColor: "var(--background-secondary)",
                borderRadius: "8px"
            }}>
                {userInfo.image ? (
                    <img
                        src={userInfo.image}
                        alt={userInfo.name}
                        style={{
                            width: "80px",
                            height: "80px",
                            borderRadius: "50%",
                            objectFit: "cover"
                        }}
                    />
                ) : (
                    <div style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "50%",
                        backgroundColor: "var(--background-tertiary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "32px"
                    }}>🎵</div>
                )}
                <div style={{ flex: 1 }}>
                    <h1 style={{ color: "var(--header-primary)", marginBottom: "8px", fontSize: "24px" }}>
                        {userInfo.name}
                    </h1>
                    <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                        {parseInt(userInfo.playcount).toLocaleString()} total scrobbles
                    </p>
                    <a
                        href={userInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            color: "var(--text-link)",
                            textDecoration: "none",
                            fontSize: "14px"
                        }}
                    >
                        View on Last.fm →
                    </a>
                </div>
                {recentTrack && (
                    <div style={{
                        padding: "16px",
                        backgroundColor: "var(--background-tertiary)",
                        borderRadius: "8px",
                        minWidth: "250px"
                    }}>
                        <div style={{
                            fontSize: "12px",
                            color: "var(--text-muted)",
                            marginBottom: "8px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                        }}>
                            {recentTrack.nowplaying ? (
                                <>
                                    <span style={{
                                        width: "8px",
                                        height: "8px",
                                        borderRadius: "50%",
                                        backgroundColor: "#1db954",
                                        display: "inline-block"
                                    }} />
                                    Now Playing
                                </>
                            ) : "Recently Played"}
                        </div>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                            {recentTrack.image && (
                                <img
                                    src={recentTrack.image}
                                    alt={recentTrack.album}
                                    style={{
                                        width: "48px",
                                        height: "48px",
                                        borderRadius: "4px",
                                        objectFit: "cover"
                                    }}
                                />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    color: "var(--text-normal)",
                                    fontSize: "14px",
                                    fontWeight: "500",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                }}>
                                    {recentTrack.name}
                                </div>
                                <div style={{
                                    color: "var(--text-muted)",
                                    fontSize: "12px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                }}>
                                    {recentTrack.artist}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "24px", borderBottom: "2px solid var(--background-modifier-accent)", flexWrap: "wrap" }}>
                <button
                    onClick={() => setActiveTab("tracks")}
                    style={{
                        padding: "12px 24px",
                        backgroundColor: "transparent",
                        border: "none",
                        color: activeTab === "tracks" ? "var(--text-link)" : "var(--text-muted)",
                        borderBottom: activeTab === "tracks" ? "2px solid var(--text-link)" : "none",
                        marginBottom: "-2px",
                        cursor: "pointer",
                        fontSize: "16px",
                        fontWeight: "600"
                    }}
                >
                    Top Tracks
                </button>
                <button
                    onClick={() => setActiveTab("albums")}
                    style={{
                        padding: "12px 24px",
                        backgroundColor: "transparent",
                        border: "none",
                        color: activeTab === "albums" ? "var(--text-link)" : "var(--text-muted)",
                        borderBottom: activeTab === "albums" ? "2px solid var(--text-link)" : "none",
                        marginBottom: "-2px",
                        cursor: "pointer",
                        fontSize: "16px",
                        fontWeight: "600"
                    }}
                >
                    Top Albums
                </button>
                <button
                    onClick={() => setActiveTab("artists")}
                    style={{
                        padding: "12px 24px",
                        backgroundColor: "transparent",
                        border: "none",
                        color: activeTab === "artists" ? "var(--text-link)" : "var(--text-muted)",
                        borderBottom: activeTab === "artists" ? "2px solid var(--text-link)" : "none",
                        marginBottom: "-2px",
                        cursor: "pointer",
                        fontSize: "16px",
                        fontWeight: "600"
                    }}
                >
                    Top Artists
                </button>
                <button
                    onClick={() => setActiveTab("loved")}
                    style={{
                        padding: "12px 24px",
                        backgroundColor: "transparent",
                        border: "none",
                        color: activeTab === "loved" ? "var(--text-link)" : "var(--text-muted)",
                        borderBottom: activeTab === "loved" ? "2px solid var(--text-link)" : "none",
                        marginBottom: "-2px",
                        cursor: "pointer",
                        fontSize: "16px",
                        fontWeight: "600"
                    }}
                >
                    Loved Tracks
                </button>
                <button
                    onClick={() => setActiveTab("friends")}
                    style={{
                        padding: "12px 24px",
                        backgroundColor: "transparent",
                        border: "none",
                        color: activeTab === "friends" ? "var(--text-link)" : "var(--text-muted)",
                        borderBottom: activeTab === "friends" ? "2px solid var(--text-link)" : "none",
                        marginBottom: "-2px",
                        cursor: "pointer",
                        fontSize: "16px",
                        fontWeight: "600"
                    }}
                >
                    Friends
                </button>
            </div>

            {/* Content */}
            {activeTab === "tracks" && (
                <div style={{ display: "grid", gap: "12px" }}>
                    {topTracks.length === 0 ? (
                        <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px" }}>
                            No tracks found
                        </p>
                    ) : (
                        topTracks.map((track, index) => (
                            <div
                                key={index}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "16px",
                                    padding: "16px",
                                    backgroundColor: "var(--background-secondary)",
                                    borderRadius: "8px",
                                    cursor: track.url ? "pointer" : "default",
                                    transition: "background-color 0.2s"
                                }}
                                onClick={() => track.url && window.open(track.url, "_blank")}
                                onMouseEnter={(e) => {
                                    if (track.url) e.currentTarget.style.backgroundColor = "var(--background-modifier-hover)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "var(--background-secondary)";
                                }}
                            >
                                <div style={{
                                    fontSize: "20px",
                                    fontWeight: "bold",
                                    color: "var(--text-muted)",
                                    minWidth: "32px",
                                    textAlign: "center"
                                }}>
                                    {index + 1}
                                </div>
                                {track.image ? (
                                    <img
                                        src={track.image}
                                        alt={track.name}
                                        style={{
                                            width: "56px",
                                            height: "56px",
                                            borderRadius: "4px",
                                            objectFit: "cover"
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        width: "56px",
                                        height: "56px",
                                        backgroundColor: "var(--background-tertiary)",
                                        borderRadius: "4px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "24px"
                                    }}>
                                        🎵
                                    </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        color: "var(--text-normal)",
                                        fontSize: "16px",
                                        fontWeight: "600",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap"
                                    }}>
                                        {track.name}
                                    </div>
                                    <div style={{
                                        color: "var(--text-muted)",
                                        fontSize: "14px",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap"
                                    }}>
                                        {track.artist}
                                    </div>
                                </div>
                                <div style={{
                                    color: "var(--text-muted)",
                                    fontSize: "14px",
                                    fontWeight: "500"
                                }}>
                                    {parseInt(track.playcount).toLocaleString()} plays
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === "albums" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
                    {topAlbums.length === 0 ? (
                        <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px", gridColumn: "1 / -1" }}>
                            No albums found
                        </p>
                    ) : (
                        topAlbums.map((album, index) => (
                            <div
                                key={index}
                                style={{
                                    backgroundColor: "var(--background-secondary)",
                                    borderRadius: "8px",
                                    padding: "16px",
                                    cursor: "pointer",
                                    transition: "background-color 0.2s"
                                }}
                                onClick={() => window.open(album.url, "_blank")}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "var(--background-modifier-hover)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "var(--background-secondary)";
                                }}
                            >
                                {album.image ? (
                                    <img
                                        src={album.image}
                                        alt={album.name}
                                        style={{
                                            width: "100%",
                                            aspectRatio: "1",
                                            objectFit: "cover",
                                            borderRadius: "4px",
                                            marginBottom: "12px"
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        width: "100%",
                                        aspectRatio: "1",
                                        backgroundColor: "var(--background-tertiary)",
                                        borderRadius: "4px",
                                        marginBottom: "12px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "48px"
                                    }}>
                                        💿
                                    </div>
                                )}
                                <div style={{
                                    color: "var(--text-normal)",
                                    fontSize: "14px",
                                    fontWeight: "600",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    marginBottom: "4px"
                                }}>
                                    {album.name}
                                </div>
                                <div style={{
                                    color: "var(--text-muted)",
                                    fontSize: "12px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    marginBottom: "8px"
                                }}>
                                    {album.artist}
                                </div>
                                <div style={{
                                    color: "var(--text-muted)",
                                    fontSize: "12px",
                                    fontWeight: "500"
                                }}>
                                    {parseInt(album.playcount).toLocaleString()} plays
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === "artists" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
                    {topArtists.length === 0 ? (
                        <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px", gridColumn: "1 / -1" }}>
                            No artists found
                        </p>
                    ) : (
                        topArtists.map((artist, index) => (
                            <div
                                key={index}
                                style={{
                                    backgroundColor: "var(--background-secondary)",
                                    borderRadius: "8px",
                                    padding: "16px",
                                    cursor: "pointer",
                                    transition: "background-color 0.2s"
                                }}
                                onClick={() => window.open(artist.url, "_blank")}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "var(--background-modifier-hover)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "var(--background-secondary)";
                                }}
                            >
                                {artist.image ? (
                                    <img
                                        src={artist.image}
                                        alt={artist.name}
                                        style={{
                                            width: "100%",
                                            aspectRatio: "1",
                                            objectFit: "cover",
                                            borderRadius: "50%",
                                            marginBottom: "12px"
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        width: "100%",
                                        aspectRatio: "1",
                                        backgroundColor: "var(--background-tertiary)",
                                        borderRadius: "50%",
                                        marginBottom: "12px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "48px"
                                    }}>
                                        🎤
                                    </div>
                                )}
                                <div style={{
                                    color: "var(--text-normal)",
                                    fontSize: "14px",
                                    fontWeight: "600",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    marginBottom: "8px",
                                    textAlign: "center"
                                }}>
                                    {artist.name}
                                </div>
                                <div style={{
                                    color: "var(--text-muted)",
                                    fontSize: "12px",
                                    fontWeight: "500",
                                    textAlign: "center"
                                }}>
                                    {parseInt(artist.playcount).toLocaleString()} plays
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === "loved" && (
                <div style={{ display: "grid", gap: "12px" }}>
                    {lovedTracks.length === 0 ? (
                        <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px" }}>
                            No loved tracks found
                        </p>
                    ) : (
                        lovedTracks.map((track, index) => (
                            <div
                                key={index}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "16px",
                                    padding: "16px",
                                    backgroundColor: "var(--background-secondary)",
                                    borderRadius: "8px",
                                    cursor: track.url ? "pointer" : "default",
                                    transition: "background-color 0.2s"
                                }}
                                onClick={() => track.url && window.open(track.url, "_blank")}
                                onMouseEnter={(e) => {
                                    if (track.url) e.currentTarget.style.backgroundColor = "var(--background-modifier-hover)";
                                }}
                                onMouseLeave={(e) => {
                                    if (track.url) e.currentTarget.style.backgroundColor = "var(--background-secondary)";
                                }}
                            >
                                <div style={{
                                    fontSize: "24px",
                                    color: "var(--text-muted)",
                                    width: "40px",
                                    textAlign: "center",
                                    fontWeight: "bold"
                                }}>
                                    {index + 1}
                                </div>
                                {track.image ? (
                                    <img
                                        src={track.image}
                                        alt={track.name}
                                        style={{
                                            width: "64px",
                                            height: "64px",
                                            borderRadius: "4px",
                                            objectFit: "cover"
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        width: "64px",
                                        height: "64px",
                                        backgroundColor: "var(--background-tertiary)",
                                        borderRadius: "4px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "24px"
                                    }}>
                                        🎵
                                    </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        color: "var(--text-normal)",
                                        fontSize: "16px",
                                        fontWeight: "600",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        marginBottom: "4px"
                                    }}>
                                        {track.name}
                                    </div>
                                    <div style={{
                                        color: "var(--text-muted)",
                                        fontSize: "14px",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap"
                                    }}>
                                        {track.artist}
                                    </div>
                                </div>
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px"
                                }}>
                                    <span style={{ fontSize: "20px" }}>❤️</span>
                                    {track.lovedDate && (
                                        <div style={{
                                            color: "var(--text-muted)",
                                            fontSize: "12px"
                                        }}>
                                            {track.lovedDate}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === "friends" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "16px" }}>
                    {friends.length === 0 ? (
                        <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px", gridColumn: "1 / -1" }}>
                            No friends found
                        </p>
                    ) : (
                        friends.map((friend, index) => (
                            <div
                                key={index}
                                style={{
                                    backgroundColor: "var(--background-secondary)",
                                    borderRadius: "8px",
                                    padding: "16px",
                                    cursor: "pointer",
                                    transition: "background-color 0.2s",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px"
                                }}
                                onClick={() => window.open(friend.url, "_blank")}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "var(--background-modifier-hover)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "var(--background-secondary)";
                                }}
                            >
                                {friend.image ? (
                                    <img
                                        src={friend.image}
                                        alt={friend.name}
                                        style={{
                                            width: "48px",
                                            height: "48px",
                                            borderRadius: "50%",
                                            objectFit: "cover"
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        width: "48px",
                                        height: "48px",
                                        backgroundColor: "var(--background-tertiary)",
                                        borderRadius: "50%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "24px"
                                    }}>
                                        👤
                                    </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        color: "var(--header-primary)",
                                        fontSize: "14px",
                                        fontWeight: "600",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap"
                                    }}>
                                        {friend.name}
                                    </div>
                                    {friend.realname && (
                                        <div style={{
                                            color: "var(--text-secondary)",
                                            fontSize: "12px",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap"
                                        }}>
                                            {friend.realname}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

function LastFMStatsModal(props: any): JSX.Element {
    return (
        <ModalRoot {...props} size="large">
            <ModalHeader>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {LastFMIcon(24, 24)}
                    <span style={{ fontSize: "20px", fontWeight: "600", color: "var(--header-primary)" }}>Last.fm Stats</span>
                </div>
                <ModalCloseButton onClick={props.onClose} />
            </ModalHeader>
            <ModalContent style={{ padding: "0", maxHeight: "70vh", overflow: "auto", backgroundColor: "var(--background-primary)" }}>
                <LastFMStatsPage />
            </ModalContent>
        </ModalRoot>
    );
}

function LastFMStatsButton(): JSX.Element {
    function handleClick(event: React.MouseEvent<Element>) {
        event.preventDefault();
        event.stopPropagation();
        openModal(props => <LastFMStatsModal {...props} />);
    }

    return (
        <GuildlessServerListItem
            id="lastfm-stats-button"
            className="vc-lastfm-stats-item"
            tooltip="Last.fm Stats"
            showPill={true}
            isVisible={true}
            isSelected={false}
            onClick={handleClick}
        />
    );
}



export default definePlugin({
    name: "LastFMStats",
    description: "Display your Last.fm statistics",
    authors: [{ name: "Veexxar", id: 0n }],
    dependencies: ["ServerListAPI"],
    startAt: StartAt.Init,
    settings,

    renderLastFMStats: ErrorBoundary.wrap(LastFMStatsButton, { noop: true }),

    start() {
        addServerListElement(ServerListRenderPosition.Above, this.renderLastFMStats);
    },

    stop() {
        removeServerListElement(ServerListRenderPosition.Above, this.renderLastFMStats);
    }
});
