import fetch from "node-fetch";
import { getUserAccessToken } from "./twitch_tokens.js";
import { logger } from "./logger.js";

// Simple in-memory cache for display names (5 min TTL)
const displayNameCache = new Map();
const DISPLAY_NAME_TTL = 5 * 60 * 1000;

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
