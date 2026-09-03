import { test } from "node:test";
import assert from "node:assert/strict";

// event_log.js imports ./db.js, which throws unless DATABASE_URL is set. The pg
// Pool is lazy (no connection until a query runs), so a dummy URL is enough to
// exercise the pure row<->entry mappers. Set before the dynamic import.
// The addLogEntry test below deliberately fires one insert at the dummy DB; its
// swallowed failure prints a single expected `event_log_insert_failed` line —
// that is the fire-and-forget contract working, not a test failure.
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://u:p@localhost:5432/db";
const { addLogEntry, entryToRow, rowToEntry } = await import("./event_log.js");

test("entryToRow keeps id/user_id/ts/type as columns and nests the rest in data", () => {
  const row = entryToRow({
    id: "abc",
    userId: 123,
    ts: 1700000000000,
    type: "sound_alert",
    soundName: "airhorn",
    volume: 80,
    txId: "t1",
  });
  assert.deepEqual(row, {
    id: "abc",
    user_id: "123",
    ts: 1700000000000,
    type: "sound_alert",
    data: { soundName: "airhorn", volume: 80, txId: "t1" },
  });
});

test("rowToEntry flattens data and coerces the bigint ts (returned as a string by pg)", () => {
  const entry = rowToEntry({
    id: "abc",
    user_id: "123",
    ts: "1700000000000",
    type: "sub_deduped",
    data: { subType: "channel.subscribe", subTier: "1000" },
  });
  assert.deepEqual(entry, {
    id: "abc",
    ts: 1700000000000,
    userId: "123",
    type: "sub_deduped",
    subType: "channel.subscribe",
    subTier: "1000",
  });
});

test("rowToEntry tolerates null / non-object data", () => {
  assert.deepEqual(rowToEntry({ id: "x", user_id: "1", ts: "5", type: "manual_add", data: null }), {
    id: "x",
    ts: 5,
    userId: "1",
    type: "manual_add",
  });
});

test("rowToEntry returns null for a missing row", () => {
  assert.equal(rowToEntry(null), null);
  assert.equal(rowToEntry(undefined), null);
});

test("an entry round-trips entryToRow -> (pg bigint string) -> rowToEntry", () => {
  const original = {
    id: "id1",
    userId: "999",
    ts: 42,
    type: "plinko_drop",
    multiplier: 4,
    secondsAdded: 240,
  };
  const row = entryToRow(original);
  // simulate pg returning bigint as a string and jsonb as a parsed object
  const back = rowToEntry({ ...row, ts: String(row.ts) });
  assert.deepEqual(back, original);
});

test("addLogEntry returns the full entry synchronously with a fresh id + ts", () => {
  const before = Date.now();
  const e = addLogEntry({ userId: "1", type: "tts_alert", message: "hi" });
  const after = Date.now();
  assert.equal(typeof e.id, "string");
  assert.ok(e.id.length >= 16, "id looks like a uuid");
  assert.ok(e.ts >= before && e.ts <= after, "ts is now");
  assert.equal(e.userId, "1");
  assert.equal(e.type, "tts_alert");
  assert.equal(e.message, "hi");
});
