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
import { logger, requestLogger } from "./logger.js";
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

const app = express();
// honor X-Forwarded-* so req.protocol resolves to https behind Fly
app.set("trust proxy", 1);
app.use(express.json());
app.use(requestLogger());
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

// CORS for local panel dev
if (process.env.PANEL_ORIGIN) {
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", process.env.PANEL_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
}

const BROADCASTER_ID = process.env.BROADCASTER_USER_ID;
let CURRENT_BROADCASTER_ID = BROADCASTER_ID || null;
let CURRENT_BROADCASTER_LOGIN = null;
let eventSubWS = null;
const OVERLAY_KEY = process.env.OVERLAY_KEY || "";
const getBroadcasterId = () =>
  String(CURRENT_BROADCASTER_ID || BROADCASTER_ID || "");

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
  lastTimerMutationAt: null,
  lastBroadcastErrorAt: null,
  totalSseClientsServed: 0,
  lastGoalMutationAt: null,
};

// Load keys + styles at startup
loadOverlayKeys().catch(() => {});
loadStyles().catch(() => {});
loadRules().catch(() => {});
loadTimerState().catch(() => {});
loadGoals().catch(() => {});

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
  const eventSubReady =
    eventSubWS && typeof eventSubWS.readyState === "number"
      ? eventSubWS.readyState === 1
      : Boolean(eventSubWS);
  res.json({
    ok: true,
    broadcasterId: getBroadcasterId(),
    sseClients: sseClients.size,
    eventSubConnected: eventSubReady,
    observability,
  });
});

// ---- Helpers ----

// ---- Routes mounting ----
mountTimerRoutes(app, {
  BROADCASTER_ID,
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
  if (CURRENT_BROADCASTER_ID) return String(CURRENT_BROADCASTER_ID);
  if (BROADCASTER_ID) return String(BROADCASTER_ID);
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
  const client = { res, key, goalUserId };
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
    remaining: getRemainingSeconds(),
    hype: state.hypeActive,
    paused: state.paused,
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
      CURRENT_BROADCASTER_ID = String(user.id);
      CURRENT_BROADCASTER_LOGIN = String(user.login || '').toLowerCase();
      if (eventSubWS && typeof eventSubWS.close === "function") {
        try {
          eventSubWS.close();
        } catch {}
      }
      if (accessToken && process.env.TWITCH_CLIENT_ID) {
        connectEventSubWS({
          userAccessToken: accessToken,
          clientId: process.env.TWITCH_CLIENT_ID,
          broadcasterId: CURRENT_BROADCASTER_ID,
          onEvent: handleEventSub,
        })
          .then((ws) => {
            eventSubWS = ws;
             logger.info("eventsub_ws_connected", {
               broadcasterId: CURRENT_BROADCASTER_ID,
             });
          })
          .catch((err) => {
            logger.error("eventsub_ws_error", { message: err?.message });
          });
      }
    } catch (e) {
      logger.error("admin_login_handler_failed", { message: e?.message });
    }
  },
});
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
});

mountGoalRoutes(app, {
  requireOverlayAuth,
  resolveOverlayUserId: resolveGoalUserIdFromRequest,
  getSessionUserId: (req) => req.session?.twitchUser?.id,
  onGoalsChanged: (uid) => broadcastGoalSnapshot(uid),
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
function secondsFromEvent(notification) {
  const subType = notification?.payload?.subscription?.type;
  const e = notification?.payload?.event ?? {};
  const RULES = getRules(CURRENT_BROADCASTER_ID);
  switch (subType) {
    case "channel.bits.use": // Bits in Extensions
    case "channel.cheer": {  // Standard Bits cheers
      const bits = e.bits ?? e.total_bits_used ?? e.total_bits ?? 0;
      const per = Math.max(1, Number(RULES.bits?.per || 0));
      const addSec = Math.max(0, Number(RULES.bits?.add_seconds || 0));
      // Pool partial bits across events
      state.bitsCarry = Math.max(0, Math.floor((state.bitsCarry || 0) + (Number(bits) || 0)));
      const units = Math.floor(state.bitsCarry / per);
      state.bitsCarry = state.bitsCarry % per;
      return units * addSec;
    }
    case "channel.subscribe": {
      const tier = e.tier || "1000";
      return RULES.sub[tier] || RULES.sub["1000"];
    }
    case "channel.subscription.message": {
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

async function handleEventSub(notification) {
  const id = notification?.metadata?.message_id || uuidv4();
  const now = Date.now();
  if (state.seen.has(id)) return; // idempotent
  state.seen.set(id, now + 24 * 3600 * 1000);

  const subType = notification?.payload?.subscription?.type;
  const e = notification?.payload?.event ?? {};
  observability.lastEventSubEventAt = new Date().toISOString();
  observability.lastEventSubType = subType || "unknown";
  logger.info("eventsub_notification", {
    eventId: id,
    type: subType,
    broadcasterId: getBroadcasterId(),
  });

  if (
    subType === "channel.hype_train.begin" ||
    subType === "channel.hype_train.progress"
  ) {
    setHype(true);
  }
  if (subType === "channel.hype_train.end") {
    setHype(false);
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
    });
  }

  const baseSeconds = secondsFromEvent(notification);
  let appliedSeconds = baseSeconds;
  let hypeMultiplier = 1;
  if (baseSeconds > 0 && state.hypeActive) {
    const R = getRules(CURRENT_BROADCASTER_ID);
    hypeMultiplier = Number(R.hypeTrain.multiplier || 1);
    appliedSeconds = Math.floor(baseSeconds * hypeMultiplier);
  }

  if (baseSeconds > 0) {
    const before = getRemainingSeconds();
    const remaining = addSeconds(appliedSeconds);
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
    });

    if (appliedSeconds > 0) {
      try {
        await broadcastToChannel({
          broadcasterId: getBroadcasterId(),
          type: "timer_add",
          payload: {
            secondsAdded: actual,
            newRemaining: remaining,
            hype: state.hypeActive,
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
    const goalOwnerId = getBroadcasterId() || "default";
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

// Connect to EventSub WS (single channel dev)
if (process.env.BROADCASTER_USER_TOKEN) {
  connectEventSubWS({
    userAccessToken: process.env.BROADCASTER_USER_TOKEN,
    clientId: process.env.TWITCH_CLIENT_ID,
    broadcasterId: getBroadcasterId(),
    onEvent: handleEventSub,
  })
    .then((ws) => {
      eventSubWS = ws;
      logger.info("eventsub_ws_connected", {
        broadcasterId: getBroadcasterId(),
      });
    })
    .catch((err) => {
      logger.error("eventsub_ws_error", { message: err?.message });
    });
}

// Server tick → broadcast remaining once per second
setInterval(async () => {
  const remaining = getRemainingSeconds();
  await broadcastToChannel({
    broadcasterId: getBroadcasterId(),
    type: "timer_tick",
    payload: { remaining, hype: state.hypeActive },
  }).catch((err) => {
    observability.lastBroadcastErrorAt = new Date().toISOString();
    logger.error("broadcast_failed", {
      reason: err?.message,
      type: "timer_tick",
    });
  });

  // Fan-out to SSE clients
  const payload = JSON.stringify({
    remaining,
    hype: state.hypeActive,
    paused: state.paused,
    capReached:
      (state.maxTotalSeconds | 0) > 0
        ? Math.max(
            0,
            (state.initialSeconds | 0) + (state.additionsTotal | 0)
          ) >=
          (state.maxTotalSeconds | 0)
          ? true
          : false
        : false,
  });
  for (const client of Array.from(sseClients)) {
    try {
      client.res.write("event: timer_tick\n");
      client.res.write(`data: ${payload}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}, 1000);

setInterval(refreshSubGoalCounts, 60 * 1000);

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`EBS listening on :${port}`));
