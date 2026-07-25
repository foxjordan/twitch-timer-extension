import fetch from "node-fetch";
import { logger } from "./logger.js";
import { MAX_IMAGE_SIZE } from "./sounds_store.js";

const KLIPY_API_BASE = "https://api.klipy.com/api/v1";

// Klipy returns five sizes (hd/md/sm/xs) x five formats (gif/webp/jpg/mp4/webm)
// per result, each with its actual byte size — gif/mp4/webm blow well past
// our thumbnail cap at any size, so webp is the only animated format that's
// ever viable. But byte size varies a lot per GIF (motion, frame count), not
// just by which size tier it is — a fixed "always use sm" choice will fail
// for some results and never know it until the user clicks. Since Klipy
// already tells us the real size of every variant, pick per-item instead:
// the best (largest) webp that actually fits under the cap, so everything
// shown in the picker is guaranteed attachable.
function pickAttachVariant(file) {
  const candidates = [file?.sm?.webp, file?.xs?.webp];
  for (const c of candidates) {
    if (c?.url && c.size <= MAX_IMAGE_SIZE) return c;
  }
  return null;
}

function normalizeGif(item) {
  const thumb = item?.file?.xs?.webp; // grid preview — always the small one, cheap to load ~24 at once
  const attach = pickAttachVariant(item?.file);
  if (!thumb?.url || !attach) return null;
  return {
    id: item.id,
    title: item.title || "",
    thumbUrl: thumb.url,
    attachUrl: attach.url,
  };
}

// Server-side search, unlike the Giphy integration this replaces — Klipy's
// terms don't require client-side calls, so the API key stays a normal
// backend secret instead of being embedded in the page like GIPHY_SDK_KEY was.
export async function searchKlipyGifs(query, { customerId, page = 1, perPage = 24 } = {}) {
  const apiKey = process.env.KLIPY_API_KEY;
  if (!apiKey) return { gifs: [], hasNext: false };

  const url = `${KLIPY_API_BASE}/${encodeURIComponent(apiKey)}/gifs/search` +
    `?q=${encodeURIComponent(query)}` +
    `&page=${encodeURIComponent(page)}` +
    `&per_page=${encodeURIComponent(perPage)}` +
    `&customer_id=${encodeURIComponent(String(customerId || "anonymous"))}` +
    `&rating=g`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn("klipy_search_failed", { status: res.status, query });
      return { gifs: [], hasNext: false };
    }
    const json = await res.json();
    const items = json?.data?.data || [];
    return {
      gifs: items.map(normalizeGif).filter(Boolean),
      hasNext: Boolean(json?.data?.has_next),
    };
  } catch (err) {
    // node-fetch errors often embed the request URL in their message, and
    // the Klipy key lives in the URL path (not a header) — redact it before
    // this ever reaches logs, since a raw network failure shouldn't leak
    // the key the way a deliberate secret print never would.
    const safeMessage = (err?.message || "").split(apiKey).join("[REDACTED]");
    logger.error("klipy_search_error", { message: safeMessage, query });
    return { gifs: [], hasNext: false };
  }
}
