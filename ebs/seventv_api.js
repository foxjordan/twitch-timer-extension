import fetch from "node-fetch";
import { logger } from "./logger.js";

const SEVENTV_API_BASE = "https://7tv.io/v3";

// PNG isn't reliably present (animated emotes only offer WEBP/AVIF/GIF), and
// AVIF isn't in our allowed image types, so this order is what's actually
// available in practice, not a stylistic preference.
const PREFERRED_FORMATS = ["WEBP", "GIF"];

function pickBestFile(files) {
  if (!Array.isArray(files) || !files.length) return null;
  for (const fmt of PREFERRED_FORMATS) {
    const candidates = files.filter((f) => f.format === fmt);
    if (!candidates.length) continue;
    // 2x is plenty crisp for a small card thumbnail and stays tiny —
    // fall back to the smallest available size if 2x isn't offered.
    const twoX = candidates.find((f) => f.name === `2x.${fmt.toLowerCase()}`);
    if (twoX) return twoX;
    return candidates.sort((a, b) => (a.width || 0) - (b.width || 0))[0];
  }
  return null;
}

// Always resolves to the *static* file variant (7TV provides one alongside
// the animated one for every emote) — a Bits card thumbnail doesn't need
// motion, and it keeps every emote covered by the same static image types
// the rest of the thumbnail-upload flow already validates against.
function normalizeEmote(entry) {
  const host = entry?.data?.host;
  const file = host ? pickBestFile(host.files) : null;
  if (!host?.url || !file) return null;
  const filename = file.static_name || file.name;
  return { id: entry.id, name: entry.name, url: `https:${host.url}/${filename}` };
}

export async function fetchSevenTvChannelEmotes(twitchUserId) {
  if (!twitchUserId) return [];
  try {
    const res = await fetch(`${SEVENTV_API_BASE}/users/twitch/${encodeURIComponent(twitchUserId)}`);
    if (res.status === 404) return []; // channel has no 7TV connection — normal, not an error
    if (!res.ok) {
      logger.warn("seventv_channel_emotes_fetch_failed", { status: res.status, twitchUserId });
      return [];
    }
    const json = await res.json();
    return (json?.emote_set?.emotes || []).map(normalizeEmote).filter(Boolean);
  } catch (err) {
    logger.error("seventv_channel_emotes_fetch_error", { message: err?.message, twitchUserId });
    return [];
  }
}

// The global set is identical for every request, so it's cached briefly
// rather than hitting 7TV on every streamer's first emote-panel open.
let globalCache = null; // { emotes, expiresAt }
const GLOBAL_CACHE_TTL_MS = 60 * 60 * 1000;

export async function fetchSevenTvGlobalEmotes() {
  if (globalCache && Date.now() < globalCache.expiresAt) return globalCache.emotes;
  try {
    const res = await fetch(`${SEVENTV_API_BASE}/emote-sets/global`);
    if (!res.ok) {
      logger.warn("seventv_global_emotes_fetch_failed", { status: res.status });
      return globalCache?.emotes || [];
    }
    const json = await res.json();
    const emotes = (json?.emotes || []).map(normalizeEmote).filter(Boolean);
    globalCache = { emotes, expiresAt: Date.now() + GLOBAL_CACHE_TTL_MS };
    return emotes;
  } catch (err) {
    logger.error("seventv_global_emotes_fetch_error", { message: err?.message });
    return globalCache?.emotes || [];
  }
}
