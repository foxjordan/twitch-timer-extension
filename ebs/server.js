import "dotenv/config";
import express from "express";
import session from "express-session";
import { v4 as uuidv4 } from "uuid";
import { RULES } from "./rules.js";
import { connectEventSubWS } from "./eventsub-ws.js";
import { broadcastToChannel } from "./broadcast.js";
import fetch from "node-fetch";
import crypto from "crypto";
import path from "path";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import {
  state,
  getRemainingSeconds,
  addSeconds,
  setHype,
  pauseTimer,
  resumeTimer,
  setInitialSeconds,
  setMaxTotalSeconds,
  capReached,
  getTotals,
  loadTimerState,
  clearTimer,
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
} from "./keys.js";
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
  clearLogEntries,
} from "./event_log.js";
import {
  loadGoals,
  getPublicGoals,
  applyAutoContribution as applyGoalAutoContribution,
  syncSubGoals,
} from "./goals_store.js";
import { fetchActiveSubscriberCount } from "./twitch_api.js";
import { mountSoundRoutes } from "./routes_sounds.js";
import { loadSoundAlerts } from "./sounds_store.js";

const app = express();
// honor X-Forwarded-* so req.protocol resolves to https behind Fly
app.set("trust proxy", 1);
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
      process.env.SESSION_SECRET || crypto.randomBytes(16).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: "auto" },
  })
);

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

// Deprecated: for backward compatibility during migration
const getBroadcasterId = () => {
  // Try to get first available broadcaster from connections
  const ids = getAllActiveBroadcasters();
  if (ids.length > 0) return String(ids[0]);
  return String(ENV_BROADCASTER_ID || "");
};

// Server-Sent Events (SSE) clients for external overlays
const sseClients = new Set();
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
loadStyles().catch(() => {});
loadRules().catch(() => {});
loadTimerState().catch(() => {});
loadGoals().catch(() => {});
loadSoundAlerts().catch(() => {});

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
  BROADCASTER_ID: ENV_BROADCASTER_ID,
  getBroadcasterId,
  sseClients,
  requireOverlayAuth,
  state,
  getRemainingSeconds,
  addSeconds,
  setHype,
  pauseTimer,
  resumeTimer,
  getUserSettings,
  setInitialSeconds,
  setMaxTotalSeconds,
  capReached,
  getTotals,
  clearTimer,
  onBroadcastError: () => {
    observability.lastBroadcastErrorAt = new Date().toISOString();
  },
  onTimerMutation: () => {
    observability.lastTimerMutationAt = new Date().toISOString();
  },
  resolveTimerUserId: resolveTimerUserIdFromRequest,
});

// Admin-only: event log for counted contributions
app.get("/api/events/log", (req, res) => {
  if (!req?.session?.isAdmin)
    return res.status(401).json({ error: "Admin login required" });
  res.json({ entries: getLogEntries() });
});

app.post("/api/events/log/clear", (req, res) => {
  if (!req?.session?.isAdmin)
    return res.status(401).json({ error: "Admin login required" });
  clearLogEntries();
  res.json({ ok: true });
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
  const payload = {
    spinId: uuidv4(),
    options: wheelOptions,
    winnerIndex,
    winnerLabel: wheelOptions[winnerIndex]?.label || "",
    targetNormalized: normalizedTarget,
    lapCount,
    durationMs,
    durationSeconds: Number(durationMs / 1000),
    triggeredAt: new Date().toISOString(),
  };
  lastWheelSpinByKey.set(overlayKey, payload);
  for (const client of Array.from(sseClients)) {
    if (!client || client.key !== overlayKey) continue;
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
  // Fallback to environment broadcaster if configured
  if (ENV_BROADCASTER_ID) return String(ENV_BROADCASTER_ID);
  return "default";
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
  // Fallback to environment broadcaster if configured
  if (ENV_BROADCASTER_ID) return String(ENV_BROADCASTER_ID);
  return "default";
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
  const broadcasterId = getBroadcasterId();
  if (!broadcasterId) return;
  try {
    const total = await fetchActiveSubscriberCount({ broadcasterId });
    if (typeof total !== "number") return;
    const changed = syncSubGoals(broadcasterId, total);
    if (changed) broadcastGoalSnapshot(broadcasterId);
  } catch (err) {
    logger.error("sub_goal_refresh_failed", { message: err?.message });
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
  const client = { res, key, goalUserId, timerUserId };
  sseClients.add(client);
  observability.totalSseClientsServed += 1;
  logger.info("sse_client_connected", {
    requestId: req.requestId,
    key,
    activeClients: sseClients.size,
  });

  // Send a ping comment so OBS marks as connected
  res.write(": connected\n\n");

  // Send initial snapshot as an event
  const snapshot = {
    userId: timerUserId,
    remaining: getRemainingSeconds(timerUserId),
    hype: state.users.get(String(timerUserId))?.hypeActive,
    paused: state.users.get(String(timerUserId))?.paused,
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

  const lastWheel = lastWheelSpinByKey.get(key);
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

      logger.info("user_login", { userId, userLogin });

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
    } catch (e) {
      logger.error("admin_login_handler_failed", { message: e?.message });
    }
  },
  onUserLogout: (userId) => {
    try {
      logger.info("user_logout", { userId });
      closeEventSubForUser(userId);
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
  onSoundAlert: ({ channelId, soundId, soundName, txId, viewerUserId }) => {
    addLogEntry({
      type: "sound_alert",
      soundId,
      soundName,
      viewerUserId: viewerUserId || undefined,
      txId: txId || undefined,
    });
    const payload = JSON.stringify({
      soundId,
      soundName,
      channelId,
      txId,
      ts: Date.now(),
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
  },
  deduplicateTx: (txId) => {
    const key = `soundtx:${txId}`;
    if (state.seen.has(key)) return true;
    state.seen.set(key, Date.now() + 24 * 3600 * 1000);
    return false;
  },
});

// Overlay Configurator (no auth; generates URL and previews)
function requireAdmin(req, res, next) {
  if (req?.session?.isAdmin) return next();
  const base =
    process.env.SERVER_BASE_URL || `${req.protocol}://${req.get("host")}`;
  const nextUrl = encodeURIComponent(req.originalUrl || "/overlay/config");
  return res.redirect(`${base}/auth/login?next=${nextUrl}`);
}

mountOverlayPageRoutes(app, {
  requireOverlayAuth,
  requireAdmin,
  getUserSettings,
  getRules,
});

mountHomePageRoutes(app);



// ---- EventSub integration ----
function secondsFromEvent(notification, uid = "default") {
  const subType = notification?.payload?.subscription?.type;
  const e = notification?.payload?.event ?? {};
  const RULES = getRules(uid);
  const userState = state.users.get(String(uid)) || { bitsCarry: 0 };
  switch (subType) {
    case "channel.bits.use": {
      // Bits in Extensions (disabled by default to avoid double-counting cheers)
      // If enabled later, de-dupe by transaction id.
      const tx =
        e.transaction_id ||
        e.transactionId ||
        e.message_id ||
        e.id ||
        null;
      if (tx) {
        const k = `bitstx:${tx}`;
        if (state.seen.has(k)) return 0;
        state.seen.set(k, Date.now() + 24 * 3600 * 1000);
      }
      // fallthrough to cheer math
    }
    case "channel.cheer": {  // Standard Bits cheers
      const bits = e.bits ?? e.total_bits_used ?? e.total_bits ?? 0;
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
      return RULES.resub.base_seconds;
    }
    case "channel.subscription.gift": {
      // For gift subs, use the per-event total (number of subs in this gift).
      // Do not use lifetime cumulative totals, or we will miscount.
      let count = Number(
        typeof e.total !== "undefined" ? e.total : e.total_count ?? 1
      );
      if (!Number.isFinite(count) || count <= 0) count = 1;
      const perGift = Math.max(
        0,
        Number(RULES.gift_sub?.per_sub_seconds || 0)
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

  const baseSeconds = secondsFromEvent(notification, timerUid);
  let appliedSeconds = baseSeconds;
  let hypeMultiplier = 1;
  if (baseSeconds > 0 && state.users.get(String(timerUid))?.hypeActive) {
    const R = getRules(timerUid);
    hypeMultiplier = Number(R.hypeTrain.multiplier || 1);
    appliedSeconds = Math.floor(baseSeconds * hypeMultiplier);
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
      appliedSeconds,
      actualSeconds: actual,
      bits: e.bits ?? e.total_bits_used ?? e.total_bits ?? undefined,
      subTier: e.tier,
      giftCount: e.total ?? e.cumulative_total ?? e.total_count,
      charityAmount: e.amount?.value,
      charityDecimals: e.amount?.decimal_places,
      userId: timerUid,
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

function scheduleEventSubReconnect(reason, url) {
  if (eventSubReconnectTimer) return;
  eventSubReconnectTimer = setTimeout(() => {
    eventSubReconnectTimer = null;
    startEventSubWS(url);
  }, 5000);
  observability.lastEventSubReconnectAt = new Date().toISOString();
  observability.lastEventSubReconnectReason = reason;
  observability.lastEventSubReconnectUrl = url || null;
  observability.totalEventSubReconnects += 1;
  if (eventSubWS && reason === "session_reconnect") {
    try {
      eventSubWS.close();
    } catch {}
  }
}

function startEventSubWS(broadcasterId, accessToken, onNotification, urlOverride = null) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!accessToken || !clientId || !broadcasterId) {
    return Promise.reject(new Error("Missing required parameters"));
  }

  return connectEventSubWS({
    userAccessToken: accessToken,
    clientId,
    broadcasterId,
    url: urlOverride || undefined,
    onEvent: onNotification,
    onStatus: (status = {}) => {
      const nowIso = new Date().toISOString();
      switch (status.type) {
        case "keepalive":
          observability.lastEventSubKeepaliveAt = nowIso;
          break;
        case "welcome":
          observability.lastEventSubSessionId = status.sessionId || null;
          observability.lastEventSubConnectedAt = nowIso;
          break;
        case "open":
          observability.lastEventSubConnectedAt = nowIso;
          break;
        case "session_reconnect":
          observability.lastEventSubErrorAt = nowIso;
          observability.lastEventSubErrorMessage = "session_reconnect_requested";
          logger.warn("eventsub_reconnect_requested", { broadcasterId, reconnectUrl: status.reconnectUrl });
          break;
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
        case "closed":
          observability.lastEventSubErrorAt = nowIso;
          observability.lastEventSubErrorMessage = "socket_closed";
          logger.warn("eventsub_socket_closed", { broadcasterId });
          break;
        default:
          break;
      }
    },
  });
}

// Server tick → broadcast remaining once per second per user/key
setInterval(async () => {
  // Broadcast to Twitch Extension PubSub for ALL active broadcasters
  for (const [userId, connection] of broadcasterConnections) {
    try {
      const remaining = getRemainingSeconds(userId);
      const hype = state.users.get(String(userId))?.hypeActive;

      await broadcastToChannel({
        broadcasterId: userId,
        type: "timer_tick",
        payload: { userId, remaining, hype },
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
      const paused = state.users.get(String(tid))?.paused;
      const cap = capReached(tid);
      const payload = JSON.stringify({
        userId: tid,
        remaining: rem,
        hype: hyp,
        paused,
        capReached: cap,
      });
      client.res.write("event: timer_tick\n");
      client.res.write(`data: ${payload}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}, 1000);

setInterval(refreshSubGoalCounts, 60 * 1000);

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
  });

  startEventSubForUser(ENV_BROADCASTER_ID);
}

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`EBS listening on :${port}`));
