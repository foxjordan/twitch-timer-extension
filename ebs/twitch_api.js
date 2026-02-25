import fetch from "node-fetch";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { getUserAccessToken } from "./twitch_tokens.js";
import { logger } from "./logger.js";

// Simple in-memory cache for display names (5 min TTL)
const displayNameCache = new Map();
const DISPLAY_NAME_TTL = 5 * 60 * 1000;

// App access token cache (client credentials flow)
let appToken = null;
let appTokenExpiresAt = 0;

async function getAppAccessToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  // Return cached token if still valid (with 60s buffer)
  if (appToken && Date.now() < appTokenExpiresAt - 60000) return appToken;

  try {
    const res = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });
    if (!res.ok) {
      logger.warn("app_token_fetch_failed", { status: res.status });
      return null;
    }
    const json = await res.json();
    appToken = json.access_token;
    appTokenExpiresAt = Date.now() + (json.expires_in || 3600) * 1000;
    return appToken;
  } catch (err) {
    logger.error("app_token_fetch_error", { message: err?.message });
    return null;
  }
}

/**
 * Resolve the best available Twitch API token.
 * Tries: user token → env token → app access token (client credentials).
 */
async function resolveHelixToken(userId) {
  const uid = userId || process.env.BROADCASTER_USER_ID;
  const userToken = uid ? getUserAccessToken(String(uid)) : null;
  if (userToken) return userToken;
  if (process.env.BROADCASTER_USER_TOKEN) return process.env.BROADCASTER_USER_TOKEN;
  return getAppAccessToken();
}

export async function fetchUserDisplayName(userId) {
  if (!userId) return null;
  const uid = String(userId);

  // Check cache
  const cached = displayNameCache.get(uid);
  if (cached && Date.now() < cached.expiresAt) return cached.name;

  const clientId = process.env.TWITCH_CLIENT_ID;
  // Use broadcaster token or any available app token
  const broadcasterId = process.env.BROADCASTER_USER_ID;
  const token =
    (broadcasterId && getUserAccessToken(broadcasterId)) ||
    process.env.BROADCASTER_USER_TOKEN ||
    null;
  if (!clientId || !token) return null;

  try {
    const res = await fetch(
      `https://api.twitch.tv/helix/users?id=${encodeURIComponent(uid)}`,
      {
        headers: {
          "Client-Id": clientId,
          Authorization: `Bearer ${token}`,
        },
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const name = json.data?.[0]?.display_name || json.data?.[0]?.login || null;
    if (name) {
      displayNameCache.set(uid, { name, expiresAt: Date.now() + DISPLAY_NAME_TTL });
    }
    return name;
  } catch (err) {
    logger.warn("display_name_fetch_error", { userId: uid, message: err?.message });
    return null;
  }
}

export async function fetchActiveSubscriberCount({ broadcasterId }) {
  const id = broadcasterId ? String(broadcasterId) : null;
  if (!id) return null;
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) return null;
  const token =
    getUserAccessToken(id) || process.env.BROADCASTER_USER_TOKEN || null;
  if (!token) return null;
  const url = new URL("https://api.twitch.tv/helix/subscriptions");
  url.searchParams.set("broadcaster_id", id);
  url.searchParams.set("first", "1");
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "Client-Id": clientId,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      logger.warn("twitch_subs_fetch_failed", {
        status: res.status,
        body,
      });
      return null;
    }
    const json = await res.json();
    if (typeof json.total === "number") return json.total;
    return null;
  } catch (err) {
    logger.error("twitch_subs_fetch_error", { message: err?.message });
    return null;
  }
}

export async function fetchFollowerCount({ broadcasterId }) {
  const id = broadcasterId ? String(broadcasterId) : null;
  if (!id) return null;
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) return null;
  const token =
    getUserAccessToken(id) || process.env.BROADCASTER_USER_TOKEN || null;
  if (!token) return null;
  const url = new URL("https://api.twitch.tv/helix/channels/followers");
  url.searchParams.set("broadcaster_id", id);
  url.searchParams.set("first", "1");
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "Client-Id": clientId,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      logger.warn("twitch_followers_fetch_failed", {
        status: res.status,
        body,
      });
      return null;
    }
    const json = await res.json();
    if (typeof json.total === "number") return json.total;
    return null;
  } catch (err) {
    logger.error("twitch_followers_fetch_error", { message: err?.message });
    return null;
  }
}

/**
 * Fetch the clip video source URL via Twitch's GQL API.
 * Returns the highest-quality MP4 URL or null.
 */
async function fetchClipVideoUrl(clipSlug) {
  // Twitch's public web client ID (used by the web player)
  const GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
  try {
    const res = await fetch("https://gql.twitch.tv/gql", {
      method: "POST",
      headers: {
        "Client-Id": GQL_CLIENT_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          operationName: "VideoAccessToken_Clip",
          variables: { slug: clipSlug },
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash:
                "36b89d2507fce29e5ca551df756d27c1cfe079e2609642b4390aa4c35796eb11",
            },
          },
        },
      ]),
    });
    if (!res.ok) {
      logger.warn("clip_gql_failed", { status: res.status, slug: clipSlug });
      return null;
    }
    const json = await res.json();
    const clip = json?.[0]?.data?.clip;
    if (!clip?.videoQualities?.length) {
      logger.warn("clip_gql_no_qualities", { slug: clipSlug });
      return null;
    }

    // Pick the highest quality (source) — sorted by quality desc
    const qualities = clip.videoQualities.sort(
      (a, b) => Number(b.quality) - Number(a.quality)
    );
    const best = qualities[0];

    // Build the signed URL with the playback access token
    const token = clip.playbackAccessToken;
    if (!token) {
      logger.warn("clip_gql_no_token", { slug: clipSlug });
      return best.sourceURL || null;
    }

    const videoUrl =
      best.sourceURL +
      "?sig=" +
      encodeURIComponent(token.signature) +
      "&token=" +
      encodeURIComponent(token.value);

    return videoUrl;
  } catch (err) {
    logger.error("clip_gql_error", { slug: clipSlug, message: err?.message });
    return null;
  }
}

/**
 * Fetch clip metadata from the Twitch Helix API + video URL from GQL.
 * Returns { id, title, duration, thumbnail_url, video_url } or null.
 */
export async function fetchClipInfo(clipSlug, { userId } = {}) {
  if (!clipSlug) return null;
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) {
    logger.warn("clip_fetch_no_client_id");
    return null;
  }
  const token = await resolveHelixToken(userId);
  if (!token) {
    logger.warn("clip_fetch_no_token", { userId });
    return null;
  }

  try {
    // Fetch metadata from Helix API
    const url = `https://api.twitch.tv/helix/clips?id=${encodeURIComponent(clipSlug)}`;
    const res = await fetch(url, {
      headers: {
        "Client-Id": clientId,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      logger.warn("clip_fetch_failed", { status: res.status, slug: clipSlug });
      return null;
    }
    const json = await res.json();
    const clip = json.data?.[0];
    if (!clip) return null;

    // Fetch actual video URL from GQL
    const videoUrl = await fetchClipVideoUrl(clipSlug);

    return {
      id: clip.id,
      title: clip.title,
      duration: clip.duration,
      thumbnail_url: clip.thumbnail_url,
      video_url: videoUrl,
    };
  } catch (err) {
    logger.error("clip_fetch_error", { slug: clipSlug, message: err?.message });
    return null;
  }
}

/**
 * Download a clip's MP4 video to a local file path.
 * Returns { ok, contentType, size, error } with details.
 */
export async function downloadClipVideo(videoUrl, destPath) {
  if (!videoUrl || !destPath) return { ok: false, error: "Missing url or path" };
  try {
    logger.info("clip_download_start", { url: videoUrl, destPath });
    const res = await fetch(videoUrl);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn("clip_download_failed", { status: res.status, url: videoUrl, body: body.slice(0, 200) });
      return { ok: false, error: `HTTP ${res.status}`, body: body.slice(0, 200) };
    }
    const contentType = res.headers.get("content-type") || "";
    const contentLength = res.headers.get("content-length");

    // Reject non-video responses (HTML error pages, images, etc.)
    if (contentType.includes("text/html") || contentType.includes("application/json") || contentType.includes("image/")) {
      const body = await res.text().catch(() => "");
      logger.warn("clip_download_not_video", { url: videoUrl, contentType, body: body.slice(0, 200) });
      return { ok: false, error: `Response is ${contentType}, not video`, contentType };
    }

    await pipeline(res.body, createWriteStream(destPath));
    logger.info("clip_download_complete", { url: videoUrl, destPath, contentType, contentLength });
    return { ok: true, contentType, size: contentLength ? Number(contentLength) : undefined };
  } catch (err) {
    logger.error("clip_download_error", { url: videoUrl, message: err?.message });
    return { ok: false, error: err?.message };
  }
}
