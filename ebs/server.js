import "dotenv/config";
import express from "express";
import session from "express-session";
import { v4 as uuidv4 } from "uuid";
import { RULES } from "./rules.js";
import { connectEventSubWS } from "./eventsub-ws.js";
import { broadcastToChannel, sendExtensionChatMessage } from "./broadcast.js";
import { fetchUserDisplayName } from "./twitch_api.js";
import fetch from "node-fetch";
import crypto from "crypto";
import path from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import {
  state,
  getRemainingSeconds,
  addSeconds,
  setHype,
  setBonusTime,
  checkBonusSchedule,
  pauseTimer,
  resumeTimer,
  setInitialSeconds,
  setMaxTotalSeconds,
  capReached,
  getTotals,
  loadTimerState,
  clearTimer,
  setCapForcedOn,
  persistTimerState,
} from "./state.js";
import {
  DEFAULT_STYLE,
  normKey,
  getSavedStyle,
  setSavedStyle,
  loadStyles,
} from "./styles.js";
import {
  loadOverlayKeys,
  getOrCreateUserKey,
  rotateUserKey,
  keyIsValid,
  getUserIdForKey,
  getAllUserIds,
} from "./keys.js";
import { loadUserProfiles, getUserProfile, setUserProfile } from "./user_profiles.js";
import { mountTimerRoutes } from "./routes_timer.js";
import { mountAuthRoutes } from "./routes_auth.js";
import { mountOverlayApiRoutes } from "./routes_overlay_api.js";
import { mountOverlayPageRoutes } from "./routes_overlay_page.js";
import { mountHomePageRoutes } from "./routes_home_page.js";
import { mountGoalRoutes } from "./routes_goals.js";
import { logger, requestLogger, setLoggerContext } from "./logger.js";
import { getRules, setRules, loadRules } from "./rules_store.js";
import {
  addLogEntry,
  getLogEntries,
  getLogEntryById,
  clearLogEntries,
} from "./event_log.js";
import {
  loadGoals,
  getPublicGoals,
  listGoals,
  applyAutoContribution as applyGoalAutoContribution,
  syncSubGoals,
} from "./goals_store.js";
import { fetchActiveSubscriberCount } from "./twitch_api.js";
import { mountSoundRoutes } from "./routes_sounds.js";
import { mountAdminRoutes } from "./routes_admin.js";
import { mountAdminSoundRoutes } from "./routes_admin_sounds.js";
import { loadSoundAlerts, listSounds, getSoundSettings, setSoundSettings } from "./sounds_store.js";
import { loadBans, isBanned } from "./bans.js";
import { loadSubscriptions } from "./subscription_store.js";
import { mountStripeWebhookRoute, mountStripeRoutes } from "./routes_stripe.js";
import { mountTtsRoutes, registerAudioFile } from "./routes_tts.js";
import { synthesizeSpeech } from "./tts_provider.js";
import { loadTtsSettings, getTtsSettings } from "./tts_store.js";
import { loadVoices, getVoices } from "./tts_voices.js";
import { persistTokens, loadTokens, getAllTokenUserIds, getUserAccessToken, refreshAccessToken } from "./twitch_tokens.js";
import { mountStreamElementsRoutes } from "./routes_streamelements.js";
import {
  connectStreamElements,
  disconnectStreamElements,
  disconnectAllStreamElements,
  getStreamElementsStatus,
} from "./streamelements.js";

const app = express();
// honor X-Forwarded-* so req.protocol resolves to https behind Fly
app.set("trust proxy", 1);
// Stripe webhook needs raw body — must be before express.json()
mountStripeWebhookRoute(app);
app.use(express.json());
app.use(
  requestLogger({
    resolveMeta: () => {
      // Get first active broadcaster for logging context (multi-user now)
      const ids = getAllActiveBroadcasters();
      if (ids.length > 0) {
        const connection = getBroadcasterConnection(ids[0]);
        return {
          channelId: ids[0],
          channelLogin: connection?.broadcasterLogin || null,
        };
      }
      return { channelId: null, channelLogin: null };
    },
  })
);
app.use(
  session({
    name: "overlay.sid",
    secret:
      process.env.SESSION_SECRET || process.env.TWITCH_CLIENT_SECRET || crypto.randomBytes(16).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: "auto" },
  })
);

// Block banned users from session-based routes
app.use((req, res, next) => {
  const uid = req.session?.twitchUser?.id;
  if (uid && isBanned(String(uid))) {
    // Allow logout so banned users can still sign out
    if (req.path === "/auth/logout") return next();
    return res.status(403).json({ error: "Your account has been suspended" });
  }
  next();
});

const assetCandidates = [
  process.env.ASSETS_DIR,
  path.resolve(process.cwd(), "assets"),
  path.resolve(process.cwd(), "public/assets"),
  path.resolve(process.cwd(), "../assets"),
  path.resolve(process.cwd(), "../public/assets"),
].filter(Boolean);
const assetsDir = assetCandidates.find((dir) => existsSync(dir));
if (assetsDir) {
  app.use(
    "/assets",
    express.static(assetsDir, {
      maxAge: "7d",
      etag: true,
    })
  );
}

// CORS for Twitch extension iframes and local dev
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (
    origin &&
    (origin.endsWith(".ext-twitch.tv") ||
      origin === process.env.PANEL_ORIGIN)
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Unique ID generated each time the server boots – clients compare this to
// detect that a restart happened and re-sync state.
const SERVER_BOOT_ID = uuidv4();

// Environment-based broadcaster (for backward compatibility)
const ENV_BROADCASTER_ID = process.env.BROADCASTER_USER_ID;
const ENV_BROADCASTER_TOKEN = process.env.BROADCASTER_USER_TOKEN || null;

// Per-user EventSub connections
// userId -> { broadcasterId, broadcasterLogin, broadcasterToken, ws, reconnectTimer, lastEventAt }
const broadcasterConnections = new Map();

const OVERLAY_KEY = process.env.OVERLAY_KEY || "";

// Helper to get connection for specific user
function getBroadcasterConnection(userId) {
  return broadcasterConnections.get(String(userId));
}

// Helper to get all active broadcaster IDs
function getAllActiveBroadcasters() {
  return Array.from(broadcasterConnections.keys());
}

// Server-Sent Events (SSE) clients for external overlays
const sseClients = new Set();
const SSE_HEARTBEAT_MS = 30_000; // ping every 30 s

// Periodic heartbeat – detects dead connections and keeps proxies from dropping idle ones
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.res.write(": ping\n\n");
    } catch {
      sseClients.delete(client);
      logger.info("sse_client_heartbeat_failed", {
        key: client.key,
        activeClients: sseClients.size,
      });
    }
  }
}, SSE_HEARTBEAT_MS);
const lastWheelSpinByKey = new Map();
const DEFAULT_WHEEL_OPTIONS = [
  { label: "Heads", color: "#9146FF" },
  { label: "Tails", color: "#F97316" },
  { label: "Chat Pick", color: "#3B82F6" },
  { label: "Streamer Pick", color: "#10B981" },
];
const TWO_PI = Math.PI * 2;
const WHEEL_POINTER_ANGLE = Math.PI * 1.5;
const observability = {
  lastEventSubEventAt: null,
  lastEventSubType: null,
  lastEventSubKeepaliveAt: null,
  lastEventSubSessionId: null,
  lastEventSubReconnectAt: null,
  lastEventSubReconnectReason: null,
  lastEventSubReconnectUrl: null,
  lastEventSubErrorAt: null,
  lastEventSubErrorMessage: null,
  lastEventSubConnectedAt: null,
  totalEventSubReconnects: 0,
  lastTimerMutationAt: null,
  lastBroadcastErrorAt: null,
  totalSseClientsServed: 0,
  lastGoalMutationAt: null,
};

// Default logging context for Grafana filters (will be multi-user after login)
setLoggerContext({
  channelId: null,
  channelLogin: null,
});

// Load keys + styles at startup
loadOverlayKeys().catch(() => {});
loadUserProfiles().catch(() => {});
loadStyles().catch(() => {});
loadRules().catch(() => {});
loadTimerState().catch(() => {});
loadGoals().catch(() => {});
loadSoundAlerts().catch(() => {});
loadBans().catch(() => {});
loadSubscriptions().catch(() => {});
loadTtsSettings().catch(() => {});
loadVoices().catch(() => {});
loadTokens().catch(() => {});

// ===== Per-user settings (persisted) =====
const DATA_DIR = process.env.DATA_DIR || process.cwd();
const SETTINGS_PATH = path.resolve(DATA_DIR, "overlay-user-settings.json");
const userSettings = new Map(); // userId -> { defaultInitialSeconds?: number }

async function loadUserSettings() {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf-8");
    const obj = JSON.parse(raw);
    for (const [uid, val] of Object.entries(obj))
      userSettings.set(String(uid), val || {});
  } catch {}
}
async function persistUserSettings() {
  try {
    const obj = {};
    for (const [uid, val] of userSettings.entries()) obj[uid] = val;
    await writeFile(SETTINGS_PATH, JSON.stringify(obj, null, 2), "utf-8");
  } catch {}
}
function getUserSettings(uid) {
  return userSettings.get(String(uid)) || {};
}
function setUserSettings(uid, patch) {
  const id = String(uid);
  const curr = userSettings.get(id) || {};
  const next = { ...curr };
  if (patch && typeof patch.defaultInitialSeconds !== "undefined") {
    const v = Number(patch.defaultInitialSeconds);
    if (!Number.isNaN(v) && v >= 0) next.defaultInitialSeconds = v;
  }
  if (patch && typeof patch.maxTotalSeconds !== "undefined") {
    const v = Number(patch.maxTotalSeconds);
    if (!Number.isNaN(v) && v >= 0) next.maxTotalSeconds = v;
  }
  if (patch && typeof patch.showCapMessage !== "undefined") {
    next.showCapMessage = Boolean(patch.showCapMessage);
  }
  if (patch && typeof patch.capMessage !== "undefined") {
    next.capMessage = String(patch.capMessage || "").slice(0, 200);
  }
  if (patch && typeof patch.capMessageColor !== "undefined") {
    next.capMessageColor = String(patch.capMessageColor || "").slice(0, 20);
  }
  if (patch && typeof patch.capMessagePosition !== "undefined") {
    const pos = String(patch.capMessagePosition);
    if (pos === "above" || pos === "below") next.capMessagePosition = pos;
  }
  if (patch && typeof patch.capMessageSize !== "undefined") {
    const sz = String(patch.capMessageSize);
    if (sz === "larger" || sz === "smaller" || sz === "same") next.capMessageSize = sz;
  }
  if (patch && typeof patch.seJwtToken !== "undefined") {
    next.seJwtToken = String(patch.seJwtToken || "").slice(0, 2000);
  }
  if (
    patch &&
    patch.panelCollapsedSections &&
    typeof patch.panelCollapsedSections === "object"
  ) {
    const prev =
      (typeof next.panelCollapsedSections === "object" &&
        next.panelCollapsedSections) ||
      {};
    const sanitized = {};
    for (const [key, val] of Object.entries(patch.panelCollapsedSections)) {
      if (!key) continue;
      sanitized[String(key)] = Boolean(val);
    }
    next.panelCollapsedSections = { ...prev, ...sanitized };
  }
  userSettings.set(id, next);
  persistUserSettings().catch(() => {});
  return next;
}

// Load settings at startup
loadUserSettings().catch(() => {});

// cleanup loop for dedupe map (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [k, exp] of state.seen.entries()) {
    if (exp <= now) state.seen.delete(k);
  }
}, 10 * 60 * 1000);

// Basic health endpoint
app.get("/healthz", (_req, res) => {
  // Check if ANY EventSub connections are active
  const activeConnections = Array.from(broadcasterConnections.entries()).filter(
    ([_, conn]) => conn.ws && typeof conn.ws.readyState === "number" && conn.ws.readyState === 1
  );
  const eventSubReady = activeConnections.length > 0;

  res.json({
    ok: true,
    activeBroadcasters: getAllActiveBroadcasters().length,
    broadcasterIds: getAllActiveBroadcasters(),
    sseClients: sseClients.size,
    eventSubConnected: eventSubReady,
    eventSubActiveConnections: activeConnections.length,
    observability,
  });
});

// ---- Helpers ----

// ---- Routes mounting ----
mountTimerRoutes(app, {
  sseClients,
  requireOverlayAuth,
  state,
  getRemainingSeconds,
  addSeconds,
  setHype,
  setBonusTime,
  pauseTimer,
  resumeTimer,
  getUserSettings,
  setInitialSeconds,
  setMaxTotalSeconds,
  capReached,
  getTotals,
  clearTimer,
  setCapForcedOn,
  bootId: SERVER_BOOT_ID,
  onBroadcastError: () => {
    observability.lastBroadcastErrorAt = new Date().toISOString();
  },
  onTimerMutation: () => {
    observability.lastTimerMutationAt = new Date().toISOString();
  },
  resolveTimerUserId: resolveTimerUserIdFromRequest,
});

// Admin-only: event log for counted contributions (per-user)
app.get("/api/events/log", (req, res) => {
  if (!req?.session?.isAdmin)
    return res.status(401).json({ error: "Admin login required" });
  const uid = req.session?.twitchUser?.id;
  res.json({ entries: getLogEntries(uid ? String(uid) : null) });
});

app.post("/api/events/log/clear", (req, res) => {
  if (!req?.session?.isAdmin)
    return res.status(401).json({ error: "Admin login required" });
  const uid = req.session?.twitchUser?.id;
  clearLogEntries(uid ? String(uid) : null);
  res.json({ ok: true });
});

// Overlay connection status — lets broadcaster/viewers know if overlay can receive alerts
app.get("/api/overlay/status", (req, res) => {
  // Support both session auth (dashboard) and channelId query param (extension panel)
  const uid = req.session?.twitchUser?.id || req.query.channelId;
  if (!uid) return res.json({ connected: false, clients: 0 });
  let count = 0;
  for (const client of sseClients) {
    if (String(client.timerUserId) === String(uid)) count++;
  }
  res.json({ connected: count > 0, clients: count });
});

// Replay a previous alert from the event log
const TTS_AUDIO_DIR = path.resolve(process.env.DATA_DIR || process.cwd(), "tts_audio");

app.post("/api/alerts/replay/:alertId", async (req, res) => {
  if (!req?.session?.isAdmin)
    return res.status(401).json({ error: "Admin login required" });
  const uid = req.session?.twitchUser?.id;
  if (!uid) return res.status(401).json({ error: "Not authenticated" });

  const entry = getLogEntryById(req.params.alertId);
  if (!entry) return res.status(404).json({ error: "Alert not found" });
  if (entry.userId !== String(uid)) return res.status(403).json({ error: "Not your alert" });

  try {
    if (entry.type === "sound_alert") {
      // Re-send the sound alert SSE event
      const payload = JSON.stringify({
        soundId: entry.soundId,
        soundName: entry.soundName,
        channelId: uid,
        txId: null,
        ts: Date.now(),
        type: entry.alertType || "sound",
        clipSlug: "",
        volume: entry.volume || 80,
        replay: true,
      });
      let sent = 0;
      for (const client of Array.from(sseClients)) {
        if (client.timerUserId && String(client.timerUserId) !== String(uid)) continue;
        try {
          client.res.write("event: sound_alert\n");
          client.res.write(`data: ${payload}\n\n`);
          sent++;
        } catch { sseClients.delete(client); }
      }
      logger.info("alert_replayed", { type: "sound_alert", alertId: entry.id, userId: uid, sent });
      return res.json({ ok: true, type: "sound_alert", sent });

    } else if (entry.type === "tts_alert") {
      // Re-synthesize TTS audio (original file will have expired)
      const voiceId = entry.voiceId;
      if (!voiceId || !entry.message) {
        return res.status(400).json({ error: "Alert missing voice or message data for replay" });
      }

      const audioBuffer = await synthesizeSpeech(entry.message, voiceId);
      const fileId = `tts_replay_${crypto.randomUUID().slice(0, 12)}`;
      await mkdir(TTS_AUDIO_DIR, { recursive: true });
      const filePath = path.resolve(TTS_AUDIO_DIR, `${fileId}.mp3`);
      await writeFile(filePath, audioBuffer);
      registerAudioFile(fileId, filePath);

      const voice = getVoices().find((v) => v.id === voiceId);
      const payload = JSON.stringify({
        type: "tts",
        message: entry.message,
        voiceName: voice?.name || entry.voiceName || voiceId,
        channelId: uid,
        txId: null,
        viewerDisplayName: entry.viewerDisplayName || null,
        audioUrl: `/api/tts/audio/${fileId}`,
        volume: entry.volume || 80,
        ts: Date.now(),
        replay: true,
      });
      let sent = 0;
      for (const client of Array.from(sseClients)) {
        if (client.timerUserId && String(client.timerUserId) !== String(uid)) continue;
        try {
          client.res.write("event: tts_alert\n");
          client.res.write(`data: ${payload}\n\n`);
          sent++;
        } catch { sseClients.delete(client); }
      }
      logger.info("alert_replayed", { type: "tts_alert", alertId: entry.id, userId: uid, sent });
      return res.json({ ok: true, type: "tts_alert", sent });

    } else {
      return res.status(400).json({ error: "Unknown alert type" });
    }
  } catch (err) {
    logger.error("alert_replay_failed", { alertId: entry.id, userId: uid, message: err?.message });
    return res.status(500).json({ error: "Replay failed" });
  }
});

// Get/Set overlay style linked to overlay key
app.get("/api/overlay/style", (req, res) => {
  if (!requireOverlayAuth(req, res)) return;
  const key = normKey(req.query.key);
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.json(getSavedStyle(key));
});

// Admin-only edit
app.post("/api/overlay/style", (req, res) => {
  if (!req?.session?.isAdmin) {
    return res.status(401).json({ error: "Admin login required" });
  }
  const key = normKey(req.query.key);
  const saved = setSavedStyle(key, req.body || {});

  // Fan-out style update to SSE clients for this key
  for (const client of Array.from(sseClients)) {
    if (client.key !== key) continue;
    try {
      client.res.write("event: style_update\n");
      client.res.write(`data: ${JSON.stringify(saved)}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
  res.json(saved);
});

app.post("/api/wheel/spin", (req, res) => {
  if (!req?.session?.isAdmin)
    return res.status(401).json({ error: "Admin login required" });
  const overlayKey = normKey(
    req.body?.overlayKey || req.query.key || req.session?.userOverlayKey || ""
  );
  if (!overlayKey)
    return res.status(400).json({ error: "Overlay key is required" });
  const providedOptions = sanitizeWheelOptions(req.body?.options || []);
  const wheelOptions = providedOptions.length
    ? providedOptions
    : DEFAULT_WHEEL_OPTIONS;
  const durationSeconds = Number(req.body?.durationSeconds);
  const durationMs = Math.max(
    1000,
    Math.min(15000, Number.isFinite(durationSeconds) ? durationSeconds * 1000 : 4000)
  );
  const winnerIndex = Math.min(
    wheelOptions.length - 1,
    Math.max(0, Math.floor(Math.random() * wheelOptions.length))
  );
  const slice = wheelOptions.length ? TWO_PI / wheelOptions.length : TWO_PI;
  const pointerOffset = WHEEL_POINTER_ANGLE - (winnerIndex * slice + slice / 2);
  const normalizedTarget = ((pointerOffset % TWO_PI) + TWO_PI) % TWO_PI;
  const lapCount = Math.max(2, Math.floor(durationMs / 800));
  const wheelId = typeof req.body?.wheelId === "string" ? req.body.wheelId.trim() : "";
  const payload = {
    spinId: uuidv4(),
    wheelId,
    options: wheelOptions,
    winnerIndex,
    winnerLabel: wheelOptions[winnerIndex]?.label || "",
    targetNormalized: normalizedTarget,
    lapCount,
    durationMs,
    durationSeconds: Number(durationMs / 1000),
    triggeredAt: new Date().toISOString(),
  };
  const cacheKey = wheelId ? `${overlayKey}:${wheelId}` : overlayKey;
  lastWheelSpinByKey.set(cacheKey, payload);
  for (const client of Array.from(sseClients)) {
    if (!client || client.key !== overlayKey) continue;
    if (wheelId && client.wheelId && client.wheelId !== wheelId) continue;
    try {
      client.res.write("event: wheel_spin\n");
      client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
  res.json(payload);
});

// moved to routes_overlay_api.js

// Timer pause/resume (admin only)
// moved: timer routes mounted via routes_timer.js

// Simple auth for overlay endpoints (optional)
function requireOverlayAuth(req, res) {
  // Admin sessions can bypass key for management/preview
  if (req?.session?.isAdmin) return true;
  if (!OVERLAY_KEY) return true; // no auth required when unset
  if (keyIsValid(OVERLAY_KEY, req.query.key)) return true;
  res.status(401).json({ error: "Unauthorized overlay request" });
  return false;
}

function sanitizeWheelOptions(list) {
  return (Array.isArray(list) ? list : [])
    .map((opt, idx) => {
      const label = String(opt && opt.label ? opt.label : "").trim();
      const color = String(opt && opt.color ? opt.color : "").trim() ||
        DEFAULT_WHEEL_OPTIONS[idx % DEFAULT_WHEEL_OPTIONS.length].color;
      return { label: label || `Option ${idx + 1}`, color };
    })
    .filter((opt) => Boolean(opt.label));
}

function resolveGoalUserIdFromRequest(req) {
  if (req?.session?.twitchUser?.id) return String(req.session.twitchUser.id);
  const key =
    req?.query && typeof req.query.key !== "undefined"
      ? normKey(req.query.key)
      : null;
  if (key) {
    const owner = getUserIdForKey(key);
    if (owner) return String(owner);
  }
  return null;
}

function resolveTimerUserIdFromRequest(req) {
  if (req?.session?.twitchUser?.id) return String(req.session.twitchUser.id);
  const key =
    req?.query && typeof req.query.key !== "undefined"
      ? normKey(req.query.key)
      : null;
  if (key) {
    const owner = getUserIdForKey(key);
    if (owner) return String(owner);
  }
  // No fallback — without a session or valid key, return null so callers
  // can reject the request instead of silently routing to the wrong timer.
  return null;
}

function broadcastGoalSnapshot(userId, specificClients = null) {
  const uid = userId ? String(userId) : "default";
  let goals = [];
  try {
    goals = getPublicGoals(uid, { includeInactive: true });
  } catch {}
  const payload = JSON.stringify({ userId: uid, goals });
  const recipients = specificClients
    ? Array.isArray(specificClients)
      ? specificClients
      : [specificClients]
    : Array.from(sseClients);
  for (const client of recipients) {
    if (!client) continue;
    if (!specificClients && client.goalUserId && client.goalUserId !== uid)
      continue;
    try {
      client.res.write("event: goal_snapshot\n");
      client.res.write(`data: ${payload}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
  observability.lastGoalMutationAt = new Date().toISOString();
}

async function refreshSubGoalCounts() {
  const ids = getAllActiveBroadcasters();
  if (!ids.length) return;
  for (const broadcasterId of ids) {
    try {
      const total = await fetchActiveSubscriberCount({ broadcasterId });
      if (typeof total !== "number") continue;
      const changed = syncSubGoals(broadcasterId, total);
      if (changed) broadcastGoalSnapshot(broadcasterId);
    } catch (err) {
      logger.error("sub_goal_refresh_failed", { broadcasterId, message: err?.message });
    }
  }
}

// SSE stream for external overlays (OBS/Streamlabs browser source)
app.get("/api/overlay/stream", (req, res) => {
  if (!requireOverlayAuth(req, res)) return;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const key = normKey(req.query.key);
  const goalUserId = resolveGoalUserIdFromRequest(req);
  const timerUserId = resolveTimerUserIdFromRequest(req);
  const wheelId = typeof req.query.wheelId === "string" ? req.query.wheelId.trim() : "";
  const client = { res, key, goalUserId, timerUserId, wheelId };
  sseClients.add(client);
  observability.totalSseClientsServed += 1;
  logger.info("sse_client_connected", {
    requestId: req.requestId,
    key,
    activeClients: sseClients.size,
  });

  // Send a ping comment so OBS marks as connected
  res.write(": connected\n\n");

  // Send initial snapshot as an event (includes bootId so clients detect restarts)
  const snapshot = {
    userId: timerUserId,
    remaining: getRemainingSeconds(timerUserId),
    hype: state.users.get(String(timerUserId))?.hypeActive,
    paused: state.users.get(String(timerUserId))?.paused,
    bootId: SERVER_BOOT_ID,
  };
  res.write(`event: timer_tick\n`);
  res.write(`data: ${JSON.stringify(snapshot)}\n\n`);

  // Send current style for this key
  const style = getSavedStyle(key);
  res.write("event: style_update\n");
  res.write(`data: ${JSON.stringify(style)}\n\n`);

  if (goalUserId) {
    broadcastGoalSnapshot(goalUserId, client);
  }

  const wheelCacheKey = wheelId ? `${key}:${wheelId}` : key;
  const lastWheel = lastWheelSpinByKey.get(wheelCacheKey);
  if (lastWheel) {
    res.write("event: wheel_spin\n");
    res.write(`data: ${JSON.stringify(lastWheel)}\n\n`);
  }

  req.on("close", () => {
    sseClients.delete(client);
    logger.info("sse_client_disconnected", {
      key,
      activeClients: sseClients.size,
    });
  });
});

// Mount auth routes (notify on admin login to rewire EventSub + broadcaster)
mountAuthRoutes(app, {
  onAdminLogin: ({ user, accessToken }) => {
    try {
      const userId = String(user.id);
      const userLogin = String(user.login || '').toLowerCase();

      // Don't start EventSub for banned users
      if (isBanned(userId)) {
        logger.info("user_login_blocked_banned", { userId, userLogin });
        return;
      }

      logger.info("user_login", { userId, userLogin });

      // Persist display name so admin dashboard shows it even when offline
      setUserProfile(userId, userLogin, user.display_name || userLogin);

      // Add or update this user's connection info
      let connection = broadcasterConnections.get(userId);
      if (!connection) {
        connection = {
          broadcasterId: userId,
          broadcasterLogin: userLogin,
          broadcasterToken: accessToken,
          ws: null,
          reconnectTimer: null,
          lastEventAt: null,
          lastWsMessageAt: null,
        };
        broadcasterConnections.set(userId, connection);
      } else {
        // Update existing connection
        connection.broadcasterLogin = userLogin;
        connection.broadcasterToken = accessToken;
      }

      // Start EventSub connection for THIS user only (doesn't affect others)
      if (accessToken && process.env.TWITCH_CLIENT_ID) {
        startEventSubForUser(userId);
      }

      // Auto-reconnect StreamElements if user has a stored JWT token
      try {
        const us = getUserSettings(userId);
        if (us.seJwtToken) {
          connectStreamElements(userId, us.seJwtToken, (tip) => {
            handleStreamElementsTip(userId, tip);
          });
          logger.info("se_auto_reconnect_on_login", { userId });
        }
      } catch (seErr) {
        logger.error("se_auto_reconnect_failed", { userId, message: seErr?.message });
      }
    } catch (e) {
      logger.error("admin_login_handler_failed", { message: e?.message });
    }
  },
  onUserLogout: (userId) => {
    try {
      logger.info("user_logout", { userId });
      closeEventSubForUser(userId);
      disconnectStreamElements(userId);
    } catch (e) {
      logger.error("logout_handler_failed", { userId, message: e?.message });
    }
  },
});

// Start EventSub WebSocket for specific user
async function startEventSubForUser(userId) {
  const connection = broadcasterConnections.get(String(userId));
  if (!connection) {
    logger.error("start_eventsub_no_connection", { userId });
    return;
  }

  // Close existing connection if any
  if (connection.ws && typeof connection.ws.close === "function") {
    try {
      connection.ws.close();
    } catch {}
  }

  // Clear existing reconnect timer
  if (connection.reconnectTimer) {
    clearTimeout(connection.reconnectTimer);
    connection.reconnectTimer = null;
  }

  try {
    // Start new WebSocket connection for this broadcaster
    const ws = await startEventSubWS(
      connection.broadcasterId,
      connection.broadcasterToken,
      (notification) => handleEventSub(notification, userId)
    );
    connection.ws = ws;
    logger.info("eventsub_started", { userId, broadcasterId: connection.broadcasterId });
  } catch (e) {
    logger.error("eventsub_start_failed", { userId, message: e?.message });

    // Retry after delay
    connection.reconnectTimer = setTimeout(() => {
      startEventSubForUser(userId);
    }, 30000);
  }
}

// Close EventSub connection for specific user
function closeEventSubForUser(userId) {
  const connection = broadcasterConnections.get(String(userId));
  if (!connection) return;

  if (connection.ws && typeof connection.ws.close === "function") {
    try {
      connection.ws.close();
    } catch {}
  }

  if (connection.reconnectTimer) {
    clearTimeout(connection.reconnectTimer);
  }

  // Only remove if NOT the environment broadcaster
  if (userId !== ENV_BROADCASTER_ID) {
    broadcasterConnections.delete(String(userId));
  }

  logger.info("eventsub_closed", { userId });
}

// Mount overlay API routes (style, keys, user settings)
mountOverlayApiRoutes(app, {
  requireOverlayAuth,
  normKey,
  getSavedStyle,
  setSavedStyle,
  getOrCreateUserKey,
  rotateUserKey,
  getUserSettings,
  setUserSettings,
  sseClients,
  getRules,
  setRules,
  setMaxTotalSeconds,
  resolveTimerUserId: resolveTimerUserIdFromRequest,
});

mountGoalRoutes(app, {
  requireOverlayAuth,
  resolveOverlayUserId: resolveGoalUserIdFromRequest,
  getSessionUserId: (req) => req.session?.twitchUser?.id,
  onGoalsChanged: (uid) => broadcastGoalSnapshot(uid),
});

mountSoundRoutes(app, {
  requireOverlayAuth,
  getSessionUserId: (req) => req.session?.twitchUser?.id,
  getUserIdForKey,
  onSoundAlert: ({ channelId, soundId, soundName, tier, txId, viewerUserId, type, clipSlug, volume }) => {
    addLogEntry({
      type: "sound_alert",
      userId: String(channelId),
      soundId,
      soundName,
      alertType: type || "sound",
      volume: volume || 80,
      viewerUserId: viewerUserId || undefined,
      txId: txId || undefined,
    });
    const payload = JSON.stringify({
      soundId,
      soundName,
      channelId,
      txId,
      ts: Date.now(),
      type: type || "sound",
      clipSlug: clipSlug || "",
      volume: volume || 80,
    });
    for (const client of Array.from(sseClients)) {
      if (
        client.timerUserId &&
        String(client.timerUserId) !== String(channelId)
      )
        continue;
      try {
        client.res.write("event: sound_alert\n");
        client.res.write(`data: ${payload}\n\n`);
      } catch (e) {
        sseClients.delete(client);
      }
    }
    broadcastToChannel({
      broadcasterId: channelId,
      type: "sound_alert",
      payload: { soundId, soundName },
    }).catch(() => {});

    // Add timer time for Bits-in-Extensions usage (same rules as cheers)
    if (tier) {
      const bits = Number(tier.replace("sound_", "")) || 0;
      if (bits > 0) {
        const timerUid = String(channelId);
        const RULES = getRules(timerUid);
        const per = Math.max(1, Number(RULES.bits?.per || 0));
        const addSec = Math.max(0, Number(RULES.bits?.add_seconds || 0));
        if (addSec > 0) {
          const userState = state.users.get(timerUid) || { bitsCarry: 0 };
          userState.bitsCarry = Math.max(0, Math.floor((userState.bitsCarry || 0) + bits));
          state.users.set(timerUid, userState);
          const units = Math.floor(userState.bitsCarry / per);
          userState.bitsCarry = userState.bitsCarry % per;
          if (units > 0) {
            const secs = units * addSec;
            addSeconds(timerUid, secs);
            logger.info("bits_in_ext_timer_add", { userId: timerUid, bits, seconds: secs, source: "sound_alert" });
          }
        }
      }
    }

    // Post to chat (async, best-effort)
    if (viewerUserId && tier) {
      const bits = tier.replace("sound_", "");
      (async () => {
        const displayName = await fetchUserDisplayName(viewerUserId);
        const who = displayName || `User ${viewerUserId}`;
        await sendExtensionChatMessage({
          broadcasterId: channelId,
          text: `${who} played "${soundName}" for ${bits} Bits!`,
        });
      })().catch(() => {});
    }
  },
  deduplicateTx: (txId) => {
    const key = `soundtx:${txId}`;
    if (state.seen.has(key)) return true;
    state.seen.set(key, Date.now() + 24 * 3600 * 1000);
    return false;
  },
});

mountTtsRoutes(app, {
  requireOverlayAuth,
  getSessionUserId: (req) => req.session?.twitchUser?.id,
  getUserIdForKey,
  onTtsAlert: ({ channelId, message, voiceName, voiceId, fileId, volume, txId, viewerUserId, viewerDisplayName, tier }) => {
    addLogEntry({
      type: "tts_alert",
      userId: String(channelId),
      message,
      voiceName,
      voiceId: voiceId || undefined,
      volume: volume || 80,
      viewerUserId: viewerUserId || undefined,
      viewerDisplayName: viewerDisplayName || undefined,
      txId: txId || undefined,
    });
    const payload = JSON.stringify({
      type: "tts",
      message,
      voiceName,
      channelId,
      txId,
      viewerDisplayName: viewerDisplayName || null,
      audioUrl: `/api/tts/audio/${fileId}`,
      volume: volume || 80,
      ts: Date.now(),
    });
    for (const client of Array.from(sseClients)) {
      if (
        client.timerUserId &&
        String(client.timerUserId) !== String(channelId)
      )
        continue;
      try {
        client.res.write("event: tts_alert\n");
        client.res.write(`data: ${payload}\n\n`);
      } catch (e) {
        sseClients.delete(client);
      }
    }
    broadcastToChannel({
      broadcasterId: channelId,
      type: "tts_alert",
      payload: { message, voiceName },
    }).catch(() => {});

    // Add timer time for Bits-in-Extensions usage (same rules as cheers)
    if (tier) {
      const bits = Number(tier.replace("sound_", "")) || 0;
      if (bits > 0) {
        const timerUid = String(channelId);
        const RULES = getRules(timerUid);
        const per = Math.max(1, Number(RULES.bits?.per || 0));
        const addSec = Math.max(0, Number(RULES.bits?.add_seconds || 0));
        if (addSec > 0) {
          const userState = state.users.get(timerUid) || { bitsCarry: 0 };
          userState.bitsCarry = Math.max(0, Math.floor((userState.bitsCarry || 0) + bits));
          state.users.set(timerUid, userState);
          const units = Math.floor(userState.bitsCarry / per);
          userState.bitsCarry = userState.bitsCarry % per;
          if (units > 0) {
            const secs = units * addSec;
            addSeconds(timerUid, secs);
            logger.info("bits_in_ext_timer_add", { userId: timerUid, bits, seconds: secs, source: "tts_alert" });
          }
        }
      }
    }

    // Post to chat (async, best-effort)
    if (viewerUserId && tier) {
      const bits = tier.replace("sound_", "");
      (async () => {
        const displayName = await fetchUserDisplayName(viewerUserId);
        const who = displayName || `User ${viewerUserId}`;
        const voice = voiceName ? ` (${voiceName})` : "";
        await sendExtensionChatMessage({
          broadcasterId: channelId,
          text: `${who} used ${bits} Bits to say${voice}: "${message}"`,
        });
      })().catch(() => {});
    }
  },
  onSkipAlert: ({ channelId }) => {
    const payload = JSON.stringify({ ts: Date.now() });
    for (const client of Array.from(sseClients)) {
      if (client.timerUserId && String(client.timerUserId) !== String(channelId)) continue;
      try {
        client.res.write("event: skip_alert\n");
        client.res.write(`data: ${payload}\n\n`);
      } catch {
        sseClients.delete(client);
      }
    }
  },
  deduplicateTx: (txId) => {
    const key = `ttstx:${txId}`;
    if (state.seen.has(key)) return true;
    state.seen.set(key, Date.now() + 24 * 3600 * 1000);
    return false;
  },
});

// Overlay Configurator (no auth; generates URL and previews)
function requireAdmin(req, res, next) {
  if (req?.session?.isAdmin) return next();
  const nextUrl = encodeURIComponent(req.originalUrl || "/overlay/config");
  return res.redirect(`/auth/login?next=${nextUrl}`);
}

mountOverlayPageRoutes(app, {
  requireOverlayAuth,
  requireAdmin,
  getUserSettings,
  getRules,
  getSavedStyle,
});

mountHomePageRoutes(app);

mountAdminRoutes(app, {
  getAllActiveBroadcasters,
  getBroadcasterConnection,
  sseClients,
  getAllUserIds,
  getUserSettings,
  getRemainingSeconds,
  getTotals,
  capReached,
  listSounds,
  getSoundSettings,
  setSoundSettings,
  listGoals,
  getSavedStyle,
  DEFAULT_STYLE,
  observability,
  getUserProfile,
  onSoundAlert: ({ channelId, soundId, soundName, tier, txId, viewerUserId, type, clipSlug, volume }) => {
    addLogEntry({ type: "sound_alert", userId: String(channelId), soundId, soundName, alertType: type || "sound", volume: volume || 80, txId: txId || undefined });
    const payload = JSON.stringify({ soundId, soundName, channelId, txId, ts: Date.now(), type: type || "sound", clipSlug: clipSlug || "", volume: volume || 80 });
    for (const client of Array.from(sseClients)) {
      if (client.timerUserId && String(client.timerUserId) !== String(channelId)) continue;
      try { client.res.write("event: sound_alert\n"); client.res.write(`data: ${payload}\n\n`); } catch { sseClients.delete(client); }
    }
    broadcastToChannel({ broadcasterId: channelId, type: "sound_alert", payload: { soundId, soundName } }).catch(() => {});
  },
  onTtsAlert: ({ channelId, message, voiceName, voiceId, fileId, volume, txId, viewerDisplayName }) => {
    addLogEntry({ type: "tts_alert", userId: String(channelId), message, voiceName, voiceId: voiceId || undefined, volume: volume || 80, viewerDisplayName: viewerDisplayName || undefined, txId: txId || undefined });
    const payload = JSON.stringify({ type: "tts", message, voiceName, channelId, txId, viewerDisplayName: viewerDisplayName || null, audioUrl: `/api/tts/audio/${fileId}`, volume: volume || 80, ts: Date.now() });
    for (const client of Array.from(sseClients)) {
      if (client.timerUserId && String(client.timerUserId) !== String(channelId)) continue;
      try { client.res.write("event: tts_alert\n"); client.res.write(`data: ${payload}\n\n`); } catch { sseClients.delete(client); }
    }
    broadcastToChannel({ broadcasterId: channelId, type: "tts_alert", payload: { message, voiceName, viewerDisplayName: viewerDisplayName || null } }).catch(() => {});
  },
  onUserBanned: (uid) => {
    // Disconnect their EventSub WebSocket
    closeEventSubForUser(uid);
    // Close any active SSE connections for this user
    for (const client of Array.from(sseClients)) {
      if (String(client.timerUserId) === String(uid)) {
        try { client.res.end(); } catch {}
        sseClients.delete(client);
      }
    }
    logger.info("user_banned_disconnected", { userId: uid });
  },
  deletionCtx: {
    userSettings,
    persistUserSettings,
    broadcasterConnections,
    sseClients,
    closeEventSubForUser,
  },
});

mountAdminSoundRoutes(app, {
  onSoundAlert: ({ channelId, soundId, soundName, tier, txId, type, clipSlug, volume }) => {
    addLogEntry({ type: "sound_alert", userId: String(channelId), soundId, soundName, alertType: type || "sound", volume: volume || 80, txId: txId || undefined });
    const payload = JSON.stringify({ soundId, soundName, channelId, txId, ts: Date.now(), type: type || "sound", clipSlug: clipSlug || "", volume: volume || 80 });
    for (const client of Array.from(sseClients)) {
      if (client.timerUserId && String(client.timerUserId) !== String(channelId)) continue;
      try { client.res.write("event: sound_alert\n"); client.res.write(`data: ${payload}\n\n`); } catch { sseClients.delete(client); }
    }
    broadcastToChannel({ broadcasterId: channelId, type: "sound_alert", payload: { soundId, soundName } }).catch(() => {});
  },
});

mountStripeRoutes(app);

mountStreamElementsRoutes(app, {
  getUserSettings,
  setUserSettings,
  handleStreamElementsTip,
});

// ---- Self-service account deletion ----
import { deleteAllUserData } from "./user_data_deletion.js";

app.delete("/api/account", async (req, res) => {
  if (!req.session?.isAdmin || !req.session?.twitchUser?.id) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const uid = String(req.session.twitchUser.id);

  const result = await deleteAllUserData(uid, {
    userSettings,
    persistUserSettings,
    broadcasterConnections,
    sseClients,
    closeEventSubForUser,
  });

  // Destroy the session after deletion
  req.session.destroy(() => {});

  res.json({ ok: true, userId: uid, deleted: result.deleted });
});

// ---- EventSub integration ----
function secondsFromEvent(notification, uid = "default") {
  const subType = notification?.payload?.subscription?.type;
  const e = notification?.payload?.event ?? {};
  const RULES = getRules(uid);
  const userState = state.users.get(String(uid)) || { bitsCarry: 0 };
  switch (subType) {
    case "channel.bits.use":
      // Bits-in-Extensions fires alongside channel.cheer for standard cheers,
      // causing double-counting. Ignore it for timer math; channel.cheer alone
      // handles all standard bit cheers reliably with no overlap.
      return 0;
    case "channel.cheer": {
      const bits = e.bits ?? 0;
      if (!bits) return 0;
      const per = Math.max(1, Number(RULES.bits?.per || 0));
      const addSec = Math.max(0, Number(RULES.bits?.add_seconds || 0));
      // Pool partial bits across events
      userState.bitsCarry = Math.max(0, Math.floor((userState.bitsCarry || 0) + (Number(bits) || 0)));
      state.users.set(String(uid), userState);
      const units = Math.floor(userState.bitsCarry / per);
      userState.bitsCarry = userState.bitsCarry % per;
      return units * addSec;
    }
    case "channel.subscribe": {
      // If Twitch marks this as a gifted sub, ignore; gift events are handled separately.
      if (e.is_gift || e.was_gift) return 0;
      const tier = e.tier || "1000";
      return RULES.sub[tier] || RULES.sub["1000"];
    }
    case "channel.subscription.message": {
      if (e.is_gift || e.was_gift) return 0;
      const resubTier = e.tier || "1000";
      return RULES.sub[resubTier] || RULES.resub?.base_seconds || RULES.sub["1000"] || 0;
    }
    case "channel.subscription.gift": {
      // For gift subs, use the per-event total (number of subs in this gift).
      // Do not use lifetime cumulative totals, or we will miscount.
      let count = Number(
        typeof e.total !== "undefined" ? e.total : e.total_count ?? 1
      );
      if (!Number.isFinite(count) || count <= 0) count = 1;
      const giftTier = e.tier || "1000";
      // When matchSubTiers is on, use regular sub tier values for gift subs
      const giftSource = RULES.gift_sub?.matchSubTiers ? RULES.sub : RULES.gift_sub;
      const perGift = Math.max(
        0,
        Number(giftSource?.[giftTier] || giftSource?.["1000"] || 0)
      );
      return count * perGift;
    }
    case "channel.charity_campaign.donate": {
      const amount = e.amount?.value ?? 0; // in minor units
      const decimals = e.amount?.decimal_places ?? 2;
      const usd = amount / Math.pow(10, decimals);
      return Math.floor(usd * RULES.charity.per_usd);
    }
    case "channel.hype_train.begin":
    case "channel.hype_train.progress":
    case "channel.hype_train.end":
      return 0;
    case "channel.follow": {
      if (RULES.follow?.enabled) return Number(RULES.follow.add_seconds || 0) | 0;
      return 0;
    }
    default:
      return 0;
  }
}

async function handleEventSub(notification, expectedUserId = null) {
  const id = notification?.metadata?.message_id || uuidv4();
  const now = Date.now();
  if (state.seen.has(id)) return; // idempotent
  state.seen.set(id, now + 24 * 3600 * 1000);

  const subType = notification?.payload?.subscription?.type;
  const e = notification?.payload?.event ?? {};

  // CRITICAL FIX: Extract broadcaster ID from event payload
  const broadcasterId = notification?.payload?.subscription?.condition?.broadcaster_user_id;

  if (!broadcasterId) {
    logger.warn("eventsub_missing_broadcaster_id", { type: subType });
    return;
  }

  // Verify this broadcaster has an active connection
  const connection = broadcasterConnections.get(String(broadcasterId));
  if (!connection) {
    logger.warn("eventsub_unknown_broadcaster", { broadcasterId, type: subType });
    return;
  }

  // Route event to correct user's timer
  const timerUid = String(broadcasterId);

  // Update last event timestamp
  connection.lastEventAt = new Date().toISOString();

  observability.lastEventSubEventAt = connection.lastEventAt;
  observability.lastEventSubType = subType || "unknown";

  logger.info("eventsub_notification", {
    eventId: id,
    type: subType,
    broadcasterId: timerUid,
    broadcasterLogin: connection.broadcasterLogin,
    logger: "eventsub",
  });

  if (
    subType === "channel.hype_train.begin" ||
    subType === "channel.hype_train.progress"
  ) {
    setHype(timerUid, true);
  }
  if (subType === "channel.hype_train.end") {
    setHype(timerUid, false);
  }

  if (subType === "channel.hype_train.begin" || subType === "channel.hype_train.end") {
    addLogEntry({
      type: subType,
      userId: timerUid,
      baseSeconds: 0,
      appliedSeconds: 0,
      actualSeconds: 0,
      hypeMultiplier: 1,
      hypeLevel: e.level,
      hypeTotal: e.total,
      hypeGoal: e.goal,
      // v2-specific fields (optional, gracefully handle if missing)
      isSharedTrain: e.is_shared_train ?? null,
      trainType: e.type ?? null,
      allTimeHighLevel: e.all_time_high_level ?? null,
      allTimeHighTotal: e.all_time_high_total ?? null,
      sharedTrainParticipants: e.shared_train_participants?.length ?? null,
    });
  }

  // ---- Sub dedup: channel.subscribe vs channel.subscription.message ----
  // Twitch behaviour is inconsistent: resubs sometimes fire BOTH events
  // (causing double time), sometimes only channel.subscription.message.
  // Defer channel.subscribe by 5s. If channel.subscription.message arrives
  // in that window for the same user, cancel the deferred subscribe and
  // only count the message. If no message arrives, the deferred subscribe
  // processes normally.
  const subUserId = e.user_id || e.user_login || "";
  if (subType === "channel.subscribe" && subUserId && !(e.is_gift || e.was_gift)) {
    const dedupKey = `${timerUid}:${subUserId}`;
    const existing = pendingSubscribes.get(dedupKey);
    if (existing) clearTimeout(existing.timer);
    pendingSubscribes.set(dedupKey, {
      timer: setTimeout(() => {
        pendingSubscribes.delete(dedupKey);
        processEventTimer(notification, timerUid, id, now);
      }, 5000),
    });
    return;
  }
  if (subType === "channel.subscription.message" && subUserId) {
    const dedupKey = `${timerUid}:${subUserId}`;
    const existing = pendingSubscribes.get(dedupKey);
    if (existing) {
      clearTimeout(existing.timer);
      pendingSubscribes.delete(dedupKey);
      logger.info("sub_dedup_cancelled", { broadcasterId: timerUid, userId: subUserId });
    }
  }

  processEventTimer(notification, timerUid, id, now);
}

// Pending channel.subscribe events awaiting possible channel.subscription.message dedup
const pendingSubscribes = new Map();

async function processEventTimer(notification, timerUid, id, now) {
  const subType = notification?.payload?.subscription?.type;
  const e = notification?.payload?.event ?? {};

  const baseSeconds = secondsFromEvent(notification, timerUid);
  let appliedSeconds = baseSeconds;
  let hypeMultiplier = 1;
  let bonusMultiplier = 1;
  const userState = state.users.get(String(timerUid));
  if (baseSeconds > 0) {
    const R = getRules(timerUid);
    if (userState?.hypeActive) {
      hypeMultiplier = Number(R.hypeTrain?.multiplier || 1);
    }
    if (userState?.bonusActive) {
      bonusMultiplier = Number(R.bonusTime?.multiplier || 1);
    }
    let totalMultiplier;
    if (R.bonusTime?.stackWithHype) {
      totalMultiplier = hypeMultiplier * bonusMultiplier;
    } else {
      totalMultiplier = Math.max(hypeMultiplier, bonusMultiplier);
    }
    appliedSeconds = Math.floor(baseSeconds * totalMultiplier);
  }

  if (baseSeconds > 0) {
    const before = getRemainingSeconds(timerUid);
    const remaining = addSeconds(timerUid, appliedSeconds);
    const actual = Math.max(0, remaining - before);
    observability.lastTimerMutationAt = new Date().toISOString();

    addLogEntry({
      type: subType,
      baseSeconds,
      hypeMultiplier,
      bonusMultiplier,
      appliedSeconds,
      actualSeconds: actual,
      bits: e.bits ?? e.total_bits_used ?? e.total_bits ?? undefined,
      subTier: e.tier,
      giftCount: e.total ?? e.cumulative_total ?? e.total_count,
      charityAmount: e.amount?.value,
      charityDecimals: e.amount?.decimal_places,
      userId: timerUid,
      userName: e.is_anonymous ? "Anonymous" : (e.user_name || e.user_login || undefined),
      isAnonymous: e.is_anonymous || false,
    });

    if (appliedSeconds > 0) {
      try {
        await broadcastToChannel({
          broadcasterId: timerUid,
          type: "timer_add",
          payload: {
            userId: timerUid,
            secondsAdded: actual,
            newRemaining: remaining,
            hype: state.users.get(String(timerUid))?.hypeActive,
          },
        });
      } catch (err) {
        observability.lastBroadcastErrorAt = new Date().toISOString();
        logger.error("broadcast_failed", {
          reason: err?.message,
          type: "timer_add",
          eventId: id,
        });
      }
    }
  }

  try {
    const goalOwnerId = timerUid;
    const applied = applyGoalAutoContribution({
      uid: goalOwnerId,
      type: subType,
      event: e,
      timestamp: now,
    });
    if (applied && applied.length) {
      broadcastGoalSnapshot(goalOwnerId);
    }
  } catch (err) {
    logger.error("goal_auto_apply_failed", { message: err?.message });
  }
}

// ---- StreamElements tip handler ----
function handleStreamElementsTip(uid, tip) {
  const timerUid = String(uid);
  const R = getRules(timerUid);
  const tipRules = R.thirdPartyTip || {};
  const minAmount = Number(tipRules.min_amount || 1);
  const perUnit = Number(tipRules.per_unit || 60);

  if (tip.amount < minAmount) {
    logger.info("se_tip_below_minimum", { userId: timerUid, amount: tip.amount, min: minAmount });
    return;
  }

  let baseSeconds = Math.floor(tip.amount * perUnit);
  let appliedSeconds = baseSeconds;
  let hypeMultiplier = 1;
  let bonusMultiplier = 1;

  const userState = state.users.get(timerUid);
  if (userState?.hypeActive) {
    hypeMultiplier = Number(R.hypeTrain?.multiplier || 1);
  }
  if (userState?.bonusActive) {
    bonusMultiplier = Number(R.bonusTime?.multiplier || 1);
  }
  let totalMultiplier;
  if (R.bonusTime?.stackWithHype) {
    totalMultiplier = hypeMultiplier * bonusMultiplier;
  } else {
    totalMultiplier = Math.max(hypeMultiplier, bonusMultiplier);
  }
  appliedSeconds = Math.floor(baseSeconds * totalMultiplier);

  if (appliedSeconds > 0) {
    const before = getRemainingSeconds(timerUid);
    const remaining = addSeconds(timerUid, appliedSeconds);
    const actual = Math.max(0, remaining - before);
    observability.lastTimerMutationAt = new Date().toISOString();

    addLogEntry({
      type: "streamelements_tip",
      baseSeconds,
      hypeMultiplier,
      bonusMultiplier,
      appliedSeconds,
      actualSeconds: actual,
      tipAmount: tip.amount,
      tipCurrency: tip.currency,
      tipUsername: tip.username,
      tipMessage: tip.message,
      userId: timerUid,
    });

    broadcastToChannel({
      broadcasterId: timerUid,
      type: "timer_add",
      payload: {
        userId: timerUid,
        secondsAdded: actual,
        newRemaining: remaining,
        hype: userState?.hypeActive,
      },
    }).catch((err) => {
      observability.lastBroadcastErrorAt = new Date().toISOString();
      logger.error("broadcast_failed", { reason: err?.message, type: "timer_add" });
    });
  }

  // Apply to goals
  try {
    const applied = applyGoalAutoContribution({
      uid: timerUid,
      type: "streamelements.tip",
      event: { amount: { value: Math.round(tip.amount * 100), decimal_places: 2 }, currency: tip.currency },
      timestamp: Date.now(),
    });
    if (applied && applied.length) {
      broadcastGoalSnapshot(timerUid);
    }
  } catch (err) {
    logger.error("goal_auto_apply_failed", { message: err?.message, source: "streamelements" });
  }
}

function startEventSubWS(broadcasterId, accessToken, onNotification, urlOverride = null) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!accessToken || !clientId || !broadcasterId) {
    return Promise.reject(new Error("Missing required parameters"));
  }

  // Find the userId key for this broadcaster so we can trigger reconnection
  let ownerUserId = null;
  for (const [uid, conn] of broadcasterConnections) {
    if (conn.broadcasterId === broadcasterId) { ownerUserId = uid; break; }
  }

  // Track last message time on the connection object for the keepalive watchdog
  const ownerConn = ownerUserId ? broadcasterConnections.get(ownerUserId) : null;

  return connectEventSubWS({
    userAccessToken: accessToken,
    clientId,
    broadcasterId,
    url: urlOverride || undefined,
    onEvent: (msg) => {
      if (ownerConn) ownerConn.lastWsMessageAt = Date.now();
      onNotification(msg);
    },
    onStatus: (status = {}) => {
      const nowIso = new Date().toISOString();
      switch (status.type) {
        case "keepalive":
          if (ownerConn) ownerConn.lastWsMessageAt = Date.now();
          observability.lastEventSubKeepaliveAt = nowIso;
          break;
        case "welcome":
          if (ownerConn) ownerConn.lastWsMessageAt = Date.now();
          observability.lastEventSubSessionId = status.sessionId || null;
          observability.lastEventSubConnectedAt = nowIso;
          break;
        case "open":
          observability.lastEventSubConnectedAt = nowIso;
          break;
        case "session_reconnect": {
          // Twitch is telling us to move to a new URL before killing this session
          observability.lastEventSubReconnectAt = nowIso;
          observability.lastEventSubReconnectUrl = status.reconnectUrl || null;
          observability.totalEventSubReconnects++;
          logger.warn("eventsub_reconnect_requested", { broadcasterId, reconnectUrl: status.reconnectUrl });

          if (ownerUserId && status.reconnectUrl) {
            // Connect to the new URL provided by Twitch. The old socket stays open
            // until the new one sends session_welcome, then Twitch closes the old one.
            const conn = broadcasterConnections.get(ownerUserId);
            if (conn) {
              logger.info("eventsub_reconnecting_to_new_url", { userId: ownerUserId, reconnectUrl: status.reconnectUrl });
              startEventSubWS(broadcasterId, accessToken, onNotification, status.reconnectUrl)
                .then((newWs) => {
                  // Swap to new socket first, so old socket's 'close' handler
                  // sees conn.ws !== oldWs and skips redundant reconnect
                  const oldWs = conn.ws;
                  conn.ws = newWs;
                  try { oldWs?.close(); } catch {}
                  logger.info("eventsub_reconnect_success", { userId: ownerUserId });
                })
                .catch((err) => {
                  logger.error("eventsub_reconnect_to_url_failed", { userId: ownerUserId, message: err?.message });
                  // The old socket will close soon; the 'closed' handler below will retry
                });
            }
          }
          break;
        }
        case "revocation":
          observability.lastEventSubErrorAt = nowIso;
          observability.lastEventSubErrorMessage = "subscription_revoked";
          logger.error("eventsub_subscription_revoked", { broadcasterId });
          break;
        case "subscription_failed":
        case "subscription_exception":
          observability.lastEventSubErrorAt = nowIso;
          observability.lastEventSubErrorMessage =
            status?.info?.message ||
            status?.info?.body ||
            status?.info?.status ||
            String(status.type);
          break;
        case "socket_error":
          observability.lastEventSubErrorAt = nowIso;
          observability.lastEventSubErrorMessage =
            status.message || "socket_error";
          logger.error("eventsub_socket_error", { broadcasterId, message: status.message });
          break;
        case "closed": {
          observability.lastEventSubErrorAt = nowIso;
          observability.lastEventSubErrorMessage = "socket_closed";
          logger.warn("eventsub_socket_closed", { broadcasterId, code: status.code });

          // AUTO-RECONNECT: Schedule reconnection with jittered delay.
          // Skip if the connection already has a newer working WS (session_reconnect swap).
          if (ownerUserId) {
            const conn = broadcasterConnections.get(ownerUserId);
            const alreadyReplaced = conn?.ws && conn.ws.readyState === 1;
            if (conn && !conn.reconnectTimer && !alreadyReplaced) {
              const delay = 5000 + Math.random() * 5000; // 5-10s jittered initial delay
              logger.info("eventsub_scheduling_reconnect", { userId: ownerUserId, delayMs: Math.round(delay) });
              conn.reconnectTimer = setTimeout(() => {
                conn.reconnectTimer = null;
                startEventSubForUser(ownerUserId);
              }, delay);
            }
          }
          break;
        }
        default:
          break;
      }
    },
  });
}

// Keepalive watchdog: if no message received within 60s (2x the 30s keepalive),
// the connection is likely dead. Force-close it so the 'closed' handler reconnects.
const EVENTSUB_WATCHDOG_INTERVAL_MS = 30_000;
const EVENTSUB_WATCHDOG_TIMEOUT_MS = 60_000;
setInterval(() => {
  for (const [userId, conn] of broadcasterConnections) {
    if (!conn.ws || conn.ws.readyState !== 1 /* WebSocket.OPEN */) continue;
    if (!conn.lastWsMessageAt) continue;
    const elapsed = Date.now() - conn.lastWsMessageAt;
    if (elapsed > EVENTSUB_WATCHDOG_TIMEOUT_MS) {
      logger.warn("eventsub_watchdog_timeout", { userId, elapsedMs: elapsed });
      try { conn.ws.close(); } catch {}
    }
  }
}, EVENTSUB_WATCHDOG_INTERVAL_MS);

// Server tick → broadcast remaining once per second per user/key
setInterval(async () => {
  // Check bonus time schedules for all users
  for (const uid of state.users.keys()) {
    checkBonusSchedule(uid);
  }

  // Broadcast to Twitch Extension PubSub for ALL active broadcasters
  for (const [userId, connection] of broadcasterConnections) {
    try {
      const remaining = getRemainingSeconds(userId);
      const hype = state.users.get(String(userId))?.hypeActive;

      await broadcastToChannel({
        broadcasterId: userId,
        type: "timer_tick",
        payload: { userId, remaining, hype, capReached: capReached(userId) },
      });
    } catch (err) {
      observability.lastBroadcastErrorAt = new Date().toISOString();
      logger.error("broadcast_failed", {
        broadcasterId: userId,
        reason: err?.message,
        type: "timer_tick",
      });
    }
  }

  // Fan-out to SSE clients (already handles per-user correctly!)
  for (const client of Array.from(sseClients)) {
    try {
      const tid = client.timerUserId || "default";
      const rem = getRemainingSeconds(tid);
      const hyp = state.users.get(String(tid))?.hypeActive;
      const bonus = state.users.get(String(tid))?.bonusActive;
      const paused = state.users.get(String(tid))?.paused;
      const cap = capReached(tid);
      let capMsg = null;
      let capStyle = null;
      if (cap) {
        const us = getUserSettings(tid);
        if (us.showCapMessage && us.capMessage) {
          capMsg = us.capMessage;
          capStyle = {
            color: us.capMessageColor || '',
            position: us.capMessagePosition || 'below',
            size: us.capMessageSize || 'larger',
          };
        }
      }
      const payload = JSON.stringify({
        userId: tid,
        remaining: rem,
        hype: hyp,
        bonus,
        paused,
        capReached: cap,
        capMessage: capMsg,
        capStyle,
        bootId: SERVER_BOOT_ID,
      });
      client.res.write("event: timer_tick\n");
      client.res.write(`data: ${payload}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}, 1000);

setInterval(refreshSubGoalCounts, 60 * 1000);

// Periodic state persistence every 5 minutes (crash protection)
setInterval(async () => {
  try {
    await Promise.all([persistTimerState(), persistUserSettings(), persistTokens()]);
    if (process.env.DEBUG) logger.debug("periodic_state_persisted");
  } catch (e) {
    logger.error("periodic_persist_failed", { message: e?.message });
  }
}, 5 * 60 * 1000);

// Initialize environment broadcaster on startup if configured
if (ENV_BROADCASTER_ID && ENV_BROADCASTER_TOKEN) {
  logger.info("initializing_env_broadcaster", { broadcasterId: ENV_BROADCASTER_ID });

  broadcasterConnections.set(ENV_BROADCASTER_ID, {
    broadcasterId: ENV_BROADCASTER_ID,
    broadcasterLogin: 'env-broadcaster',
    broadcasterToken: ENV_BROADCASTER_TOKEN,
    ws: null,
    reconnectTimer: null,
    lastEventAt: null,
    lastWsMessageAt: null,
  });

  startEventSubForUser(ENV_BROADCASTER_ID);
}

// Restore EventSub connections for users whose tokens survived the restart.
// Runs after a short delay to let loadTokens() and loadUserProfiles() finish.
setTimeout(async () => {
  const tokenUserIds = getAllTokenUserIds();
  for (const uid of tokenUserIds) {
    // Skip env broadcaster (already handled above) and banned users
    if (uid === ENV_BROADCASTER_ID) continue;
    if (isBanned(uid)) continue;
    if (broadcasterConnections.has(uid)) continue;

    let token = getUserAccessToken(uid);
    // If token is expired, try to refresh it
    if (!token) {
      try {
        token = await refreshAccessToken(uid);
      } catch (e) {
        logger.error("token_refresh_on_startup_failed", { userId: uid, message: e?.message });
      }
    }
    if (!token) continue;

    const profile = getUserProfile(uid);
    broadcasterConnections.set(uid, {
      broadcasterId: uid,
      broadcasterLogin: profile?.login || 'restored',
      broadcasterToken: token,
      ws: null,
      reconnectTimer: null,
      lastEventAt: null,
      lastWsMessageAt: null,
    });
    startEventSubForUser(uid);
    logger.info("eventsub_restored_from_token", { userId: uid, login: profile?.login });

    // Also restore StreamElements connection if user has a stored token
    try {
      const us = getUserSettings(uid);
      if (us.seJwtToken) {
        connectStreamElements(uid, us.seJwtToken, (tip) => {
          handleStreamElementsTip(uid, tip);
        });
        logger.info("se_restored_from_settings", { userId: uid });
      }
    } catch {}
  }
}, 2000);

// Graceful shutdown – persist all state before Fly.io kills the process
async function gracefulShutdown(signal) {
  logger.info("shutdown_signal", { signal, bootId: SERVER_BOOT_ID });
  disconnectAllStreamElements();
  try {
    await Promise.all([
      persistTimerState(),
      persistUserSettings(),
      persistTokens(),
    ]);
    logger.info("shutdown_state_persisted");
  } catch (e) {
    logger.error("shutdown_persist_failed", { message: e?.message });
  }
  process.exit(0);
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`EBS listening on :${port} (boot ${SERVER_BOOT_ID})`));
