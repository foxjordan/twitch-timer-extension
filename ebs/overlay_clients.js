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
    // Set by the sound overlay page itself (?role=sounds on its stream URL);
    // the hub's Live Preview iframe adds ?preview=1. Only these pages are sent
    // alert audio — see sendToSoundOverlays.
    role: req.query?.role === "sounds" ? "sounds" : null,
    preview: req.query?.preview === "1",
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
      role: m.role || null,
      preview: Boolean(m.preview),
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
    soundOverlays: countSoundOverlays(clients, userId),
    clients: list,
  };
}

// A connection that should receive alert audio. Pages loaded before ?role=
// existed (still open in OBS until it reloads them) are recognised by path;
// one with no usable referer is given the benefit of the doubt so an old
// sound overlay never goes silent after a deploy. Known non-sound pages
// (timer, goals, games) are always excluded.
export function isSoundOverlayClient(client) {
  const m = client?.meta || {};
  if (m.role) return m.role === "sounds";
  return m.pageKind === "sound_alerts" || !m.pageKind || m.pageKind === "unknown";
}

function belongsTo(client, userId) {
  // Strict: a connection whose key didn't resolve to a channel has a null
  // timerUserId and must never receive anyone's alerts.
  return client?.timerUserId != null && userId != null && String(client.timerUserId) === String(userId);
}

export function countSoundOverlays(clients, userId) {
  let overlays = 0;
  let previews = 0;
  for (const c of clients) {
    if (!belongsTo(c, userId) || !isSoundOverlayClient(c)) continue;
    if (c.meta?.preview) previews++;
    else overlays++;
  }
  return { overlays, previews };
}

// The only path alert audio events (sound_alert, tts_alert, skip_alert,
// remove_alert, sound_settings) take to the browser. Goes to that channel's
// sound overlay pages and nothing else — never the timer, goals or games
// overlays. The hub's Live Preview gets an event only with includePreview
// (tests and controls), so a real redeem can't also play out of the
// streamer's dashboard and get picked up by Desktop Audio.
export function sendToSoundOverlays(clients, userId, event, data, { includePreview = false } = {}) {
  const frame = `event: ${event}\ndata: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
  let overlays = 0;
  let previews = 0;
  for (const c of Array.from(clients)) {
    if (!belongsTo(c, userId) || !isSoundOverlayClient(c)) continue;
    const isPreview = Boolean(c.meta?.preview);
    if (isPreview && !includePreview) continue;
    try {
      c.res.write(frame);
      if (isPreview) previews++;
      else overlays++;
    } catch {
      clients.delete?.(c);
    }
  }
  return { overlays, previews };
}
