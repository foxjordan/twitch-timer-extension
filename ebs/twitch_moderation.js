import { getValidAccessToken } from "./twitch_tokens.js";
import { logger } from "./logger.js";

const TWITCH_CLIENT_ID = () => process.env.TWITCH_CLIENT_ID;

// ===== Caches =====

// broadcasterId -> { terms: string[], fetchedAt: number }
const blockedTermsCache = new Map();
const BLOCKED_TERMS_TTL = 5 * 60 * 1000; // 5 minutes

// broadcasterId -> { bannedIds: Set<string>, fetchedAt: number }
const bannedUsersCache = new Map();
const BANNED_USERS_TTL = 2 * 60 * 1000; // 2 minutes

// Cleanup stale caches every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of blockedTermsCache) {
    if (now - entry.fetchedAt > BLOCKED_TERMS_TTL * 3) blockedTermsCache.delete(id);
  }
  for (const [id, entry] of bannedUsersCache) {
    if (now - entry.fetchedAt > BANNED_USERS_TTL * 3) bannedUsersCache.delete(id);
  }
}, 10 * 60 * 1000);

/**
 * Resolve a broadcaster's user access token for moderation API calls.
 * Requires `moderation:read` scope.
 */
async function getToken(broadcasterId) {
  return getValidAccessToken(String(broadcasterId));
}

/**
 * Fetch the broadcaster's blocked terms from the Twitch Moderation API.
 * Returns an array of blocked term strings (lowercased).
 * Caches results for 5 minutes per broadcaster.
 */
export async function getBlockedTerms(broadcasterId) {
  const uid = String(broadcasterId);
  const cached = blockedTermsCache.get(uid);
  if (cached && Date.now() - cached.fetchedAt < BLOCKED_TERMS_TTL) {
    return cached.terms;
  }

  const token = await getToken(uid);
  const clientId = TWITCH_CLIENT_ID();
  if (!token || !clientId) {
    // Can't fetch — return cached if available, otherwise empty
    return cached?.terms || [];
  }

  try {
    const allTerms = [];
    let cursor = null;

    // Paginate through all blocked terms
    do {
      const url = new URL("https://api.twitch.tv/helix/moderation/blocked_terms");
      url.searchParams.set("broadcaster_id", uid);
      url.searchParams.set("moderator_id", uid);
      url.searchParams.set("first", "100");
      if (cursor) url.searchParams.set("after", cursor);

      const res = await fetch(url.toString(), {
        headers: {
          "Client-Id": clientId,
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        logger.warn("blocked_terms_fetch_failed", { broadcasterId: uid, status: res.status, body: body.slice(0, 200) });
        return cached?.terms || [];
      }

      const json = await res.json();
      for (const term of json.data || []) {
        if (term.text) allTerms.push(term.text.toLowerCase());
      }
      cursor = json.pagination?.cursor || null;
    } while (cursor);

    blockedTermsCache.set(uid, { terms: allTerms, fetchedAt: Date.now() });
    logger.info("blocked_terms_fetched", { broadcasterId: uid, count: allTerms.length });
    return allTerms;
  } catch (err) {
    logger.error("blocked_terms_fetch_error", { broadcasterId: uid, message: err?.message });
    return cached?.terms || [];
  }
}

/**
 * Fetch the broadcaster's banned/timed-out users from the Twitch Moderation API.
 * Returns a Set of banned user ID strings.
 * Caches results for 2 minutes per broadcaster.
 */
export async function getBannedUserIds(broadcasterId) {
  const uid = String(broadcasterId);
  const cached = bannedUsersCache.get(uid);
  if (cached && Date.now() - cached.fetchedAt < BANNED_USERS_TTL) {
    return cached.bannedIds;
  }

  const token = await getToken(uid);
  const clientId = TWITCH_CLIENT_ID();
  if (!token || !clientId) {
    return cached?.bannedIds || new Set();
  }

  try {
    const bannedIds = new Set();
    let cursor = null;

    // Paginate — but cap at 500 entries to avoid excessive API calls
    let pages = 0;
    const MAX_PAGES = 5;

    do {
      const url = new URL("https://api.twitch.tv/helix/moderation/banned");
      url.searchParams.set("broadcaster_id", uid);
      url.searchParams.set("first", "100");
      if (cursor) url.searchParams.set("after", cursor);

      const res = await fetch(url.toString(), {
        headers: {
          "Client-Id": clientId,
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        logger.warn("banned_users_fetch_failed", { broadcasterId: uid, status: res.status, body: body.slice(0, 200) });
        return cached?.bannedIds || new Set();
      }

      const json = await res.json();
      for (const user of json.data || []) {
        if (user.user_id) bannedIds.add(String(user.user_id));
      }
      cursor = json.pagination?.cursor || null;
      pages++;
    } while (cursor && pages < MAX_PAGES);

    bannedUsersCache.set(uid, { bannedIds, fetchedAt: Date.now() });
    logger.info("banned_users_fetched", { broadcasterId: uid, count: bannedIds.size });
    return bannedIds;
  } catch (err) {
    logger.error("banned_users_fetch_error", { broadcasterId: uid, message: err?.message });
    return cached?.bannedIds || new Set();
  }
}

/**
 * Check if a specific viewer is banned/timed-out in the broadcaster's channel.
 */
export async function isViewerBanned(broadcasterId, viewerUserId) {
  const bannedIds = await getBannedUserIds(broadcasterId);
  return bannedIds.has(String(viewerUserId));
}

/**
 * Check a message against the broadcaster's Twitch blocked terms.
 * Returns { blocked: true, term } if a match is found, or { blocked: false }.
 */
export async function checkBlockedTerms(broadcasterId, message) {
  const terms = await getBlockedTerms(broadcasterId);
  if (terms.length === 0) return { blocked: false };

  const lower = message.toLowerCase();
  for (const term of terms) {
    if (lower.includes(term)) {
      return { blocked: true, term };
    }
  }
  return { blocked: false };
}

/**
 * Invalidate caches for a broadcaster (e.g., on settings change).
 */
export function invalidateCache(broadcasterId) {
  const uid = String(broadcasterId);
  blockedTermsCache.delete(uid);
  bannedUsersCache.delete(uid);
}
