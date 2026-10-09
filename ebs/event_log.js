import crypto from "crypto";
import { db } from "./db.js";
import { logger } from "./logger.js";

// Per-broadcaster timeline of counted contributions (subs, bit/sound alerts,
// TTS, plinko drops, manual timer actions, ...). Backed by the `event_log`
// Postgres table (created at boot in server.js) so it survives restarts and
// crashes. Writes are fire-and-forget — a logging failure must never affect the
// timer or the overlay. Reads are on-demand (an admin opening Log & Debug).
const READ_LIMIT = 500;

// Caches the plain ("give me your most recent window") read per user, since
// that's the one a caller who never sends `since` — whether that's a stale
// browser session, a kiosk display that clears its own storage every reload,
// or a script hitting the endpoint directly with a saved cookie — keeps
// re-running unchanged. Invalidated on every write for that user (see
// addLogEntry/clearLogEntries) so it's never stale beyond "since the last
// actual change"; the TTL below is just a backstop (e.g. multiple server
// instances not sharing this in-memory cache, or a write that reaches the
// table some other way) rather than the normal invalidation path.
// The incremental (`since`) path is deliberately NOT cached — it's already
// cheap (bounded by the user_id/ts index, usually 0 rows), and it's what a
// well-behaved poller uses, so it should always read fresh.
const FULL_WINDOW_BACKSTOP_TTL_MS = 120_000;
const fullWindowCache = new Map(); // cacheKeyFor(userId) -> { rows, computedAt }

function cacheKeyFor(userId) {
  return userId ? String(userId) : "*";
}

// A write for one user can also change what the cross-user ("*") view
// returns, so both keys are dropped together.
function invalidateFullWindow(userId) {
  fullWindowCache.delete(cacheKeyFor(userId));
  fullWindowCache.delete("*");
}

// `info`, if passed, gets a `cacheHit` field set — purely an observability
// hook (see the /api/events/log route) for confirming from the logs alone
// whether a given poll actually reached Postgres, since the row/byte counts
// in that log line look identical either way.
async function getFullWindow(userId, info) {
  const key = cacheKeyFor(userId);
  const cached = fullWindowCache.get(key);
  if (cached && Date.now() - cached.computedAt < FULL_WINDOW_BACKSTOP_TTL_MS) {
    if (info) info.cacheHit = true;
    return cached.rows;
  }
  const r = userId
    ? await db.query(
        "SELECT id, user_id, ts, type, data FROM event_log WHERE user_id = $1 ORDER BY ts DESC LIMIT $2",
        [String(userId), READ_LIMIT],
      )
    : await db.query(
        "SELECT id, user_id, ts, type, data FROM event_log ORDER BY ts DESC LIMIT $1",
        [READ_LIMIT],
      );
  const rows = r.rows.map(rowToEntry);
  fullWindowCache.set(key, { rows, computedAt: Date.now() });
  if (info) info.cacheHit = false;
  return rows;
}

// An entry is a flat object: { id, userId, ts, type, ...whatever the caller
// passed }. The table stores id/user_id/ts/type as columns and the rest as a
// single jsonb `data` blob.
export function entryToRow(entry) {
  const { id, userId, ts, type, ...data } = entry || {};
  return {
    id,
    user_id: String(userId ?? ""),
    ts: Number(ts) || 0,
    type: String(type ?? ""),
    data,
  };
}

export function rowToEntry(row) {
  if (!row) return null;
  const data = row.data && typeof row.data === "object" ? row.data : {};
  return { id: row.id, ts: Number(row.ts) || 0, userId: row.user_id, type: row.type, ...data };
}

export function addLogEntry(entry) {
  const e = { id: crypto.randomUUID(), ts: Date.now(), ...entry };
  const row = entryToRow(e);
  db.query(
    `INSERT INTO event_log (id, user_id, ts, type, data)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [row.id, row.user_id, row.ts, row.type, JSON.stringify(row.data)],
  )
    .then(() => invalidateFullWindow(row.user_id))
    .catch((err) => logger.error("event_log_insert_failed", { message: err?.message }));
  return e;
}

export async function getLogEntryById(alertId) {
  try {
    const r = await db.query(
      "SELECT id, user_id, ts, type, data FROM event_log WHERE id = $1",
      [String(alertId)],
    );
    return r.rows[0] ? rowToEntry(r.rows[0]) : null;
  } catch (err) {
    logger.error("event_log_get_by_id_failed", { message: err?.message });
    return null;
  }
}

// Scoped to one user AND one type — backs "recent Plinko drops"/"recent Slots
// spins" history lists, where pulling the general (mixed-type) log and
// filtering client-side would silently miss older entries once enough other
// event types (cheers, follows, sound alerts, ...) push them past READ_LIMIT.
export async function getLogEntriesByType(userId, type, limit = 20) {
  try {
    const r = await db.query(
      "SELECT id, user_id, ts, type, data FROM event_log WHERE user_id = $1 AND type = $2 ORDER BY ts DESC LIMIT $3",
      [String(userId), String(type), Math.max(1, Math.min(Number(limit) || 20, READ_LIMIT))],
    );
    return r.rows.map(rowToEntry);
  } catch (err) {
    logger.error("event_log_list_by_type_failed", { message: err?.message });
    return [];
  }
}

// userId omitted -> the super-admin cross-user read (still capped).
//
// sinceTs (epoch ms, optional) scopes the read to entries at or after that
// point instead of the usual "most recent READ_LIMIT" window — for a caller
// that already holds everything up to sinceTs and just wants what's new.
// `>=` (not `>`) is deliberate: entries can share a ts down to the
// millisecond (e.g. a gift-sub fan-out writing several rows in one loop), so
// an inclusive bound plus id-based de-dup on the caller's side is what
// avoids silently dropping a same-millisecond row, at the cost of the
// boundary row(s) coming back once more.
export async function getLogEntries(userId, { sinceTs, cacheInfo } = {}) {
  const since = Number.isFinite(sinceTs) && sinceTs > 0 ? sinceTs : null;
  try {
    if (!since) return await getFullWindow(userId, cacheInfo);
    const r = userId
      ? await db.query(
          "SELECT id, user_id, ts, type, data FROM event_log WHERE user_id = $1 AND ts >= $2 ORDER BY ts DESC LIMIT $3",
          [String(userId), since, READ_LIMIT],
        )
      : await db.query(
          "SELECT id, user_id, ts, type, data FROM event_log WHERE ts >= $1 ORDER BY ts DESC LIMIT $2",
          [since, READ_LIMIT],
        );
    return r.rows.map(rowToEntry);
  } catch (err) {
    logger.error("event_log_list_failed", { message: err?.message });
    return [];
  }
}

export async function clearLogEntries(userId) {
  try {
    if (userId) {
      await db.query("DELETE FROM event_log WHERE user_id = $1", [String(userId)]);
      invalidateFullWindow(userId);
    } else {
      await db.query("DELETE FROM event_log");
      fullWindowCache.clear();
    }
  } catch (err) {
    logger.error("event_log_clear_failed", { message: err?.message });
  }
}
