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

// userId omitted -> the super-admin cross-user read (still capped).
export async function getLogEntries(userId) {
  try {
    const r = userId
      ? await db.query(
          "SELECT id, user_id, ts, type, data FROM event_log WHERE user_id = $1 ORDER BY ts DESC LIMIT $2",
          [String(userId), READ_LIMIT],
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
