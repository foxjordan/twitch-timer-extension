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
const { addLogEntry, entryToRow, rowToEntry, getLogEntries, clearLogEntries } = await import("./event_log.js");
const { db } = await import("./db.js");

// getLogEntries just shapes a query for db.query and maps rows back — stub
// db.query to inspect what was asked for without needing a real database.
function stubDbQuery(rows) {
  const calls = [];
  const original = db.query;
  db.query = async (text, params) => {
    calls.push({ text, params });
    return { rows };
  };
  return { calls, restore: () => { db.query = original; } };
}

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

test("getLogEntries with no sinceTs reads the plain most-recent window, scoped to userId", async () => {
  const stub = stubDbQuery([]);
  try {
    await getLogEntries("42");
    assert.equal(stub.calls.length, 1);
    assert.match(stub.calls[0].text, /WHERE user_id = \$1 ORDER BY ts DESC/);
    assert.deepEqual(stub.calls[0].params, ["42", 500]);
  } finally {
    stub.restore();
  }
});

test("getLogEntries with sinceTs adds an inclusive ts >= filter, userId scoped", async () => {
  const stub = stubDbQuery([]);
  try {
    await getLogEntries("42", { sinceTs: 1700000000000 });
    assert.equal(stub.calls.length, 1);
    assert.match(stub.calls[0].text, /WHERE user_id = \$1 AND ts >= \$2 ORDER BY ts DESC/);
    assert.deepEqual(stub.calls[0].params, ["42", 1700000000000, 500]);
  } finally {
    stub.restore();
  }
});

test("getLogEntries with sinceTs but no userId scopes across users (super-admin) with the ts filter", async () => {
  const stub = stubDbQuery([]);
  try {
    await getLogEntries(null, { sinceTs: 1700000000000 });
    assert.equal(stub.calls.length, 1);
    assert.match(stub.calls[0].text, /FROM event_log WHERE ts >= \$1 ORDER BY ts DESC/);
    assert.deepEqual(stub.calls[0].params, [1700000000000, 500]);
  } finally {
    stub.restore();
  }
});

for (const bad of [0, -5, NaN, undefined]) {
  // Distinct uid per case (not "42") — the plain-window path is cached per
  // uid (see below), and reusing "42" here would hit that cache instead of
  // exercising db.query, since node:test runs a file's tests in order.
  const uid = `badsince-${bad}`;
  test(`getLogEntries ignores a non-positive/invalid sinceTs (${bad}) and falls back to the plain window`, async () => {
    const stub = stubDbQuery([]);
    try {
      await getLogEntries(uid, { sinceTs: bad });
      assert.doesNotMatch(stub.calls[0].text, /ts >=/);
      assert.deepEqual(stub.calls[0].params, [uid, 500]);
    } finally {
      stub.restore();
    }
  });
}

test("getLogEntries caches the plain (no-sinceTs) window per uid — a second call doesn't re-query", async () => {
  const stub = stubDbQuery([{ id: "a", user_id: "cacheuser", ts: "1", type: "manual_add", data: {} }]);
  try {
    const first = await getLogEntries("cacheuser");
    const second = await getLogEntries("cacheuser");
    assert.equal(stub.calls.length, 1, "second call should be served from cache, not re-query");
    assert.deepEqual(second, first);
  } finally {
    stub.restore();
  }
});

test("getLogEntries reports cacheHit via the optional cacheInfo hook", async () => {
  const stub = stubDbQuery([]);
  try {
    const miss = {};
    await getLogEntries("cacheinfouser", { cacheInfo: miss });
    assert.equal(miss.cacheHit, false);

    const hit = {};
    await getLogEntries("cacheinfouser", { cacheInfo: hit });
    assert.equal(hit.cacheHit, true);

    // The incremental path is never cached, so cacheInfo is left untouched.
    const skipped = {};
    await getLogEntries("cacheinfouser", { sinceTs: 1, cacheInfo: skipped });
    assert.equal(skipped.cacheHit, undefined);
  } finally {
    stub.restore();
  }
});

test("addLogEntry invalidates that uid's cached plain window", async () => {
  const stub = stubDbQuery([]);
  try {
    await getLogEntries("invalidateuser"); // populate the cache
    addLogEntry({ userId: "invalidateuser", type: "manual_add" });
    // addLogEntry's own insert + cache invalidation happen in a
    // fire-and-forget promise chain — let the microtask queue drain.
    await new Promise((resolve) => setImmediate(resolve));
    await getLogEntries("invalidateuser");
    assert.equal(stub.calls.length, 3, "insert + two real reads (cache invalidated in between)");
  } finally {
    stub.restore();
  }
});

test("clearLogEntries invalidates that uid's cached plain window", async () => {
  const stub = stubDbQuery([]);
  try {
    await getLogEntries("clearuser"); // populate the cache
    await clearLogEntries("clearuser");
    await getLogEntries("clearuser");
    assert.equal(stub.calls.length, 3, "read + delete + a fresh read (cache invalidated by the clear)");
  } finally {
    stub.restore();
  }
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
