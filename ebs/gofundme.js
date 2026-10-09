import { logger } from "./logger.js";

// EXPERIMENTAL. Personal gofundme.com fundraisers have no official API — this
// polls the same unauthenticated JSON feed the public fundraiser page uses.
// It's undocumented and may change or rate-limit without notice, so keep
// polling tightly gated (see shouldPoll in server.js) and fail soft.
const FEED_BASE = "https://gateway.gofundme.com/web-gateway/v1/feed";
const POLL_INTERVAL_MS = 20 * 1000;
const PAGE_SIZE = 20;
const MAX_PAGES = 5;
const MAX_BACKOFF_MS = 2 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10 * 1000;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,150}$/;

// Per-user watchers: userId -> { watcher, interval }
const watchers = new Map();

/**
 * Pull the fundraiser slug out of a pasted URL (www.gofundme.com/f/<slug>,
 * with or without scheme, locale prefix, query or hash) or a bare slug.
 * Returns null for anything that isn't clearly a gofundme.com fundraiser.
 */
export function parseFundraiserSlug(input) {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  let candidate = raw;
  if (raw.includes("/")) {
    let url;
    try {
      url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      return null;
    }
    const host = url.hostname.toLowerCase();
    if (host !== "gofundme.com" && !host.endsWith(".gofundme.com")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const fIdx = parts.indexOf("f");
    if (fIdx === -1 || !parts[fIdx + 1]) return null;
    candidate = parts[fIdx + 1];
  }

  candidate = candidate.toLowerCase();
  return SLUG_RE.test(candidate) ? candidate : null;
}

/**
 * Map one raw feed entry to { id, amount, currency, username, isOffline, createdAt },
 * or null if it has no usable id/amount.
 */
export function normalizeDonation(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = Number(raw.donation_id);
  const amount = Number(raw.amount);
  if (!Number.isFinite(id) || id <= 0) return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    id,
    amount,
    currency: raw.currencycode || "USD",
    username: raw.is_anonymous ? "Anonymous" : (raw.name || "Anonymous"),
    isOffline: Boolean(raw.is_offline),
    createdAt: raw.created_at || null,
  };
}

/**
 * Coerce a stored cursor (highest donation id seen) to a number, or null for
 * "no cursor yet". Must NOT go through a bare Number(): Number(null) and
 * Number("") are 0, and a cursor of 0 means "every donation is new" — which
 * credits the fundraiser's entire history at once.
 */
export function normalizeCursor(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function gfmFetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; TwitchTimerExtension)" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** One page of the donations feed, newest first. */
export async function fetchDonationsPage(slug, offset = 0, limit = PAGE_SIZE) {
  const url = `${FEED_BASE}/${encodeURIComponent(slug)}/donations?limit=${limit}&offset=${offset}&sort=recent`;
  const body = await gfmFetchJson(url);
  const list = body?.references?.donations;
  if (!Array.isArray(list)) throw new Error("Unexpected feed response");
  return { donations: list, hasNext: Boolean(body?.meta?.has_next) };
}

/**
 * Confirm a slug is a real fundraiser. The feed answers an unknown slug with
 * a 500, so any failure here is reported to the streamer as "not found".
 */
export async function fetchFundraiserCounts(slug) {
  const body = await gfmFetchJson(`${FEED_BASE}/${encodeURIComponent(slug)}/counts`);
  const counts = body?.references?.counts;
  if (!counts) throw new Error("Unexpected counts response");
  return { totalDonations: Number(counts.total_donations || 0) };
}

/**
 * The polling state machine for one fundraiser, independent of timers and
 * network so it can be unit tested. Call tick() on an interval.
 *
 * Donation ids increase over time, so `cursor` (the highest id seen) is all
 * that's needed to tell new donations from old. Whenever polling (re)starts —
 * first connect, or the gate reopening after the stream was offline or the
 * timer paused — the first fetch just re-baselines the cursor, so donations
 * made while stopped never add time. A cursor restored from settings is
 * trusted only if the very first tick finds the gate open (i.e. a server
 * restart mid-stream).
 */
export function createGoFundMeWatcher({
  slug,
  lastDonationId = null,
  fetchPage = fetchDonationsPage,
  pageSize = PAGE_SIZE,
  maxPages = MAX_PAGES,
  shouldPoll,
  onDonation,
  onCursor,
  now = Date.now,
}) {
  const savedCursor = normalizeCursor(lastDonationId);
  const s = {
    cursor: savedCursor,
    gateOpen: savedCursor !== null,
    status: "idle",
    idleReason: null,
    error: null,
    failures: 0,
    nextAttemptAt: 0,
    lastCheckedAt: null,
    lastDonationAt: null,
    donationCount: 0,
    inFlight: false,
    stopped: false,
  };

  function setCursor(id) {
    if (s.cursor === id) return;
    s.cursor = id;
    try { onCursor(id); } catch {}
  }

  async function tick() {
    if (s.stopped || s.inFlight) return;
    const gate = shouldPoll() || { ok: false };
    if (!gate.ok) {
      s.gateOpen = false;
      s.status = "idle";
      s.idleReason = gate.reason || "stopped";
      return;
    }
    if (now() < s.nextAttemptAt) return;

    const rebaseline = !s.gateOpen || s.cursor === null;
    s.gateOpen = true;
    s.inFlight = true;
    try {
      const fresh = [];
      let highest = s.cursor ?? 0;
      for (let page = 0; page < maxPages; page++) {
        const { donations, hasNext } = await fetchPage(slug, page * pageSize, pageSize);
        const normalized = donations.map(normalizeDonation).filter(Boolean);
        for (const don of normalized) highest = Math.max(highest, don.id);
        if (rebaseline) break;
        const newOnPage = normalized.filter((don) => don.id > s.cursor);
        fresh.push(...newOnPage);
        // Keep paging only while the whole page was new — otherwise we've
        // reached donations we've already seen.
        if (!hasNext || newOnPage.length < normalized.length || normalized.length === 0) break;
      }

      // Replaced (reconnect / dashboard login) while the request was in
      // flight: the replacement watcher started from the saved cursor and
      // will credit these itself, so crediting here would double-count.
      if (s.stopped) return;

      if (!rebaseline) {
        fresh.sort((a, b) => a.id - b.id);
        for (const don of fresh) {
          if (don.isOffline) continue;
          s.donationCount++;
          s.lastDonationAt = new Date(now()).toISOString();
          try {
            onDonation(don);
          } catch (err) {
            logger.error("gfm_donation_handler_error", { slug, error: err?.message });
          }
        }
      }
      setCursor(highest);

      s.status = "watching";
      s.idleReason = null;
      s.error = null;
      s.failures = 0;
      s.nextAttemptAt = 0;
    } catch (err) {
      if (s.stopped) return;
      s.failures++;
      s.status = "error";
      s.error = err?.message || "Fetch failed";
      s.nextAttemptAt = now() + Math.min(POLL_INTERVAL_MS * 2 ** (s.failures - 1), MAX_BACKOFF_MS);
      logger.warn("gfm_poll_failed", { slug, error: s.error, failures: s.failures });
    } finally {
      s.lastCheckedAt = new Date(now()).toISOString();
      s.inFlight = false;
    }
  }

  function status() {
    return {
      slug,
      status: s.status,
      idleReason: s.idleReason,
      error: s.error,
      lastCheckedAt: s.lastCheckedAt,
      lastDonationAt: s.lastDonationAt,
      donationCount: s.donationCount,
    };
  }

  function stop() {
    s.stopped = true;
  }

  return { tick, status, stop };
}

/**
 * Start watching a fundraiser for a user. `shouldPoll()` is checked on every
 * tick before any network request, so an offline/paused channel costs nothing
 * beyond a few in-memory lookups every POLL_INTERVAL_MS.
 */
export function connectGoFundMe(userId, { slug, lastDonationId, shouldPoll, onDonation, onCursor }) {
  const uid = String(userId);
  disconnectGoFundMe(uid);
  const watcher = createGoFundMeWatcher({ slug, lastDonationId, shouldPoll, onDonation, onCursor });
  const run = () => watcher.tick().catch((err) => logger.error("gfm_tick_failed", { userId: uid, error: err?.message }));
  const interval = setInterval(run, POLL_INTERVAL_MS);
  interval.unref?.();
  watchers.set(uid, { watcher, interval });
  run();
  logger.info("gfm_connected", { userId: uid, slug });
  return watcher.status();
}

export function disconnectGoFundMe(userId) {
  const uid = String(userId);
  const entry = watchers.get(uid);
  if (!entry) return false;
  clearInterval(entry.interval);
  entry.watcher.stop();
  watchers.delete(uid);
  logger.info("gfm_disconnected", { userId: uid });
  return true;
}

export function getGoFundMeStatus(userId) {
  const entry = watchers.get(String(userId));
  if (!entry) return { connected: false, status: "disconnected" };
  return { connected: true, ...entry.watcher.status() };
}

export function disconnectAllGoFundMe() {
  for (const [uid] of watchers) disconnectGoFundMe(uid);
}
