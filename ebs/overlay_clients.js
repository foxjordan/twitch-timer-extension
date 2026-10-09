// Diagnostics for live overlay (SSE) connections — answers "what does this
// channel actually have open?" when a streamer reports doubled/echoing alerts
// or a "not connected" status that doesn't match what's in OBS. Never exposes
// overlay keys: the referer is reduced to its path and keys are dropped.

// Pages that play sound_alert / tts_alert audio. Everything else (timer,
// goals, games) only listens for its own events.
const SOUND_PAGE_KINDS = new Set(["sound_alerts", "dashboard_live_preview"]);

const PAGE_KINDS = {
  "/overlay": "timer",
  "/overlay/sounds": "sound_alerts",
  "/overlay/goal": "goals",
  "/overlay/goals": "goals",
  "/overlay/wheel": "wheel",
  "/overlay/plinko": "plinko",
  "/overlay/slots": "slots",
  "/overlay/prompt": "prompt",
  "/sounds/config": "dashboard_live_preview",
  "/overlay/config": "dashboard_timer_preview",
};

function refererPath(referer) {
  if (!referer) return null;
  try {
    return new URL(referer).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

function detectApp(ua) {
  if (/OBS\//i.test(ua)) return "obs";
  if (/Streamlabs/i.test(ua)) return "streamlabs";
  if (/XSplit/i.test(ua)) return "xsplit";
  if (/Meld/i.test(ua)) return "meld";
  return ua ? "browser" : "unknown";
}

// keyOwner: the user the ?key= belongs to, if any — compared against the
// resolved channel it shows when a session overrode the key.
export function overlayClientMeta(req, { keyOwner = null } = {}) {
  const ua = String(req.get?.("user-agent") || "").slice(0, 300);
  const page = refererPath(req.get?.("referer"));
  let resolvedVia = "none";
  if (req.session?.managingAs) resolvedVia = "session_managing_as";
  else if (req.session?.twitchUser?.id) resolvedVia = "session";
  else if (keyOwner) resolvedVia = "key";
  return {
    connectedAt: Date.now(),
    page,
    pageKind: (page && PAGE_KINDS[page]) || "unknown",
    app: detectApp(ua),
    userAgent: ua,
    resolvedVia,
    keyOwner: keyOwner ? String(keyOwner) : null,
  };
}

export function describeOverlayClients(clients, userId, now = Date.now()) {
  const list = [];
  for (const c of clients) {
    if (String(c.timerUserId) !== String(userId)) continue;
    const m = c.meta || {};
    list.push({
      pageKind: m.pageKind || "unknown",
      page: m.page || null,
      app: m.app || "unknown",
      userAgent: m.userAgent || "",
      resolvedVia: m.resolvedVia || "unknown",
      keyOwner: m.keyOwner || null,
      connectedAt: m.connectedAt || null,
      connectedForSec: m.connectedAt ? Math.round((now - m.connectedAt) / 1000) : null,
    });
  }
  list.sort((a, b) => (a.connectedAt || 0) - (b.connectedAt || 0));
  return {
    userId: String(userId),
    total: list.length,
    soundCapable: list.filter((c) => SOUND_PAGE_KINDS.has(c.pageKind)).length,
    clients: list,
  };
}
