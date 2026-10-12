import { test } from "node:test";
import assert from "node:assert/strict";
import { overlayClientMeta, describeOverlayClients, sendToSoundOverlays, countSoundOverlays } from "./overlay_clients.js";

function fakeReq({ session, key, referer, ua } = {}) {
  return {
    session,
    query: key ? { key } : {},
    get: (h) => ({ referer, "user-agent": ua })[h.toLowerCase()],
  };
}

test("overlayClientMeta: classifies page from referer and drops the query string", () => {
  const meta = overlayClientMeta(
    fakeReq({ key: "abc", referer: "https://x.dev/overlay/sounds?key=SECRET", ua: "Mozilla/5.0 OBS/31.0.1" }),
    { keyOwner: "1" },
  );
  assert.equal(meta.page, "/overlay/sounds");
  assert.equal(meta.pageKind, "sound_alerts");
  assert.equal(meta.app, "obs");
  assert.ok(!JSON.stringify(meta).includes("SECRET"));
});

test("overlayClientMeta: records whether the session or the key decided the channel", () => {
  const viaManage = overlayClientMeta(
    fakeReq({ session: { twitchUser: { id: "9" }, managingAs: "1" }, key: "k" }),
    { keyOwner: "9" },
  );
  assert.equal(viaManage.resolvedVia, "session_managing_as");
  assert.equal(viaManage.keyOwner, "9");

  assert.equal(overlayClientMeta(fakeReq({ session: { twitchUser: { id: "9" } } }), {}).resolvedVia, "session");
  assert.equal(overlayClientMeta(fakeReq({ key: "k" }), { keyOwner: "1" }).resolvedVia, "key");
  assert.equal(overlayClientMeta(fakeReq({}), {}).resolvedVia, "none");
});

test("overlayClientMeta: page kinds", () => {
  const kind = (p) => overlayClientMeta(fakeReq({ referer: "https://x.dev" + p }), {}).pageKind;
  assert.equal(kind("/overlay"), "timer");
  assert.equal(kind("/overlay/goals"), "goals");
  assert.equal(kind("/sounds/config"), "dashboard_live_preview");
  assert.equal(overlayClientMeta(fakeReq({}), {}).pageKind, "unknown");
});

test("describeOverlayClients: only the requested channel, sound-capable count, no keys", () => {
  const now = 10_000;
  const clients = [
    { timerUserId: "1", key: "k1", meta: { pageKind: "sound_alerts", connectedAt: 4_000 } },
    { timerUserId: "1", key: "k1", meta: { pageKind: "timer", connectedAt: 9_000 } },
    { timerUserId: "1", key: "k1", meta: { pageKind: "dashboard_live_preview", connectedAt: 9_500 } },
    { timerUserId: "2", key: "k2", meta: { pageKind: "sound_alerts", connectedAt: 1 } },
  ];
  const out = describeOverlayClients(clients, "1", now);
  assert.equal(out.total, 3);
  assert.equal(out.soundCapable, 2);
  assert.equal(out.clients[0].connectedForSec, 6);
  assert.ok(!JSON.stringify(out).includes("k1"));
});

function sink() {
  const frames = [];
  return { frames, res: { write: (f) => frames.push(f) } };
}

test("sendToSoundOverlays: only the channel's sound overlays, never timer/goals or other channels", () => {
  const obs = sink(), timer = sink(), other = sink(), unresolved = sink(), legacy = sink(), preview = sink();
  const clients = new Set([
    { timerUserId: "1", res: obs.res, meta: { role: "sounds", pageKind: "sound_alerts" } },
    { timerUserId: "1", res: timer.res, meta: { role: null, pageKind: "timer" } },
    { timerUserId: "2", res: other.res, meta: { role: "sounds" } },
    { timerUserId: null, res: unresolved.res, meta: { role: "sounds" } },
    { timerUserId: "1", res: legacy.res, meta: { pageKind: "sound_alerts" } },
    { timerUserId: "1", res: preview.res, meta: { role: "sounds", preview: true } },
  ]);
  const sent = sendToSoundOverlays(clients, "1", "sound_alert", { soundId: "s" });
  assert.deepEqual(sent, { overlays: 2, previews: 0 });
  assert.equal(obs.frames.length, 1);
  assert.equal(legacy.frames.length, 1);
  assert.equal(timer.frames.length, 0);
  assert.equal(other.frames.length, 0);
  assert.equal(unresolved.frames.length, 0);
  assert.equal(preview.frames.length, 0);
  assert.equal(obs.frames[0], 'event: sound_alert\ndata: {"soundId":"s"}\n\n');

  assert.deepEqual(sendToSoundOverlays(clients, "1", "sound_alert", "{}", { includePreview: true }), { overlays: 2, previews: 1 });
  assert.deepEqual(countSoundOverlays(clients, "1"), { overlays: 2, previews: 1 });
});

test("sendToSoundOverlays: drops a client whose write throws", () => {
  const dead = { timerUserId: "1", res: { write: () => { throw new Error("gone"); } }, meta: { role: "sounds" } };
  const clients = new Set([dead]);
  assert.deepEqual(sendToSoundOverlays(clients, "1", "sound_alert", "{}"), { overlays: 0, previews: 0 });
  assert.equal(clients.size, 0);
});

test("overlayClientMeta: reads role and preview from the stream URL", () => {
  const m = overlayClientMeta({ query: { key: "k", role: "sounds", preview: "1" }, get: () => "" }, { keyOwner: "1" });
  assert.equal(m.role, "sounds");
  assert.equal(m.preview, true);
  const t = overlayClientMeta({ query: { key: "k", role: "evil" }, get: () => "" }, {});
  assert.equal(t.role, null);
});

test("sendToSoundOverlays: pre-role pages with no referer still get alerts; known non-sound pages don't", () => {
  const noRef = sink(), goals = sink();
  const clients = new Set([
    { timerUserId: "1", res: noRef.res, meta: { role: null, pageKind: "unknown" } },
    { timerUserId: "1", res: goals.res, meta: { role: null, pageKind: "goals" } },
  ]);
  assert.deepEqual(sendToSoundOverlays(clients, "1", "sound_alert", "{}"), { overlays: 1, previews: 0 });
  assert.equal(goals.frames.length, 0);
});
