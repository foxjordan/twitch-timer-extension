import { test } from "node:test";
import assert from "node:assert/strict";
import { overlayClientMeta, describeOverlayClients } from "./overlay_clients.js";

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
