import crypto from "crypto";
import { db } from "./db.js";
import { logger } from "./logger.js";

// Per-broadcaster timeline of counted contributions (subs, bit/sound alerts,
// TTS, plinko drops, manual timer actions, ...). Backed by the `event_log`
// Postgres table (created at boot in server.js) so it survives restarts and
// crashes. Writes are fire-and-forget — a logging failure must never affect the
// timer or the overlay. Reads are on-demand (an admin opening Log & Debug).
const READ_LIMIT = 500;

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
  ).catch((err) => logger.error("event_log_insert_failed", { message: err?.message }));
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
export async function getLogEntries(userId, { sinceTs } = {}) {
  const since = Number.isFinite(sinceTs) && sinceTs > 0 ? sinceTs : null;
  try {
    const r = userId
      ? since
        ? await db.query(
            "SELECT id, user_id, ts, type, data FROM event_log WHERE user_id = $1 AND ts >= $2 ORDER BY ts DESC LIMIT $3",
            [String(userId), since, READ_LIMIT],
          )
        : await db.query(
            "SELECT id, user_id, ts, type, data FROM event_log WHERE user_id = $1 ORDER BY ts DESC LIMIT $2",
            [String(userId), READ_LIMIT],
          )
      : since
        ? await db.query(
            "SELECT id, user_id, ts, type, data FROM event_log WHERE ts >= $1 ORDER BY ts DESC LIMIT $2",
            [since, READ_LIMIT],
          )
        : await db.query(
            "SELECT id, user_id, ts, type, data FROM event_log ORDER BY ts DESC LIMIT $1",
            [READ_LIMIT],
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
    } else {
      await db.query("DELETE FROM event_log");
    }
  } catch (err) {
    logger.error("event_log_clear_failed", { message: err?.message });
  }
}
