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
} from "./keys.js";
import { mountTimerRoutes } from "./routes_timer.js";
import { mountAuthRoutes } from "./routes_auth.js";
import { mountOverlayApiRoutes } from "./routes_overlay_api.js";
import { mountOverlayPageRoutes } from "./routes_overlay_page.js";
import { mountHomePageRoutes } from "./routes_home_page.js";
import { getRules, setRules, loadRules } from "./rules_store.js";
import {
  addLogEntry,
  getLogEntries,
  clearLogEntries,
} from "./event_log.js";

const app = express();
// honor X-Forwarded-* so req.protocol resolves to https behind Fly
app.set("trust proxy", 1);
app.use(express.json());
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

// Server-Sent Events (SSE) clients for external overlays
const sseClients = new Set();

// Load keys + styles at startup
loadOverlayKeys().catch(() => {});
loadStyles().catch(() => {});
loadRules().catch(() => {});
loadTimerState().catch(() => {});

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
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// ---- Helpers ----

// ---- Routes mounting ----
const getBroadcasterId = () =>
  String(CURRENT_BROADCASTER_ID || BROADCASTER_ID || "");

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

// SSE stream for external overlays (OBS/Streamlabs browser source)
app.get("/api/overlay/stream", (req, res) => {
  if (!requireOverlayAuth(req, res)) return;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const key = normKey(req.query.key);
  const client = { res, key };
  sseClients.add(client);

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

  req.on("close", () => {
    sseClients.delete(client);
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
          })
          .catch((err) => console.error("EventSub WS error", err));
      }
    } catch (e) {
      console.error("onAdminLogin wiring failed", e);
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
      await broadcastToChannel({
        broadcasterId: getBroadcasterId(),
        type: "timer_add",
        payload: {
          secondsAdded: actual,
          newRemaining: remaining,
          hype: state.hypeActive,
        },
      });
    }
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
    })
    .catch((err) => console.error("EventSub WS error", err));
}

// Server tick → broadcast remaining once per second
setInterval(async () => {
  const remaining = getRemainingSeconds();
  await broadcastToChannel({
    broadcasterId: getBroadcasterId(),
    type: "timer_tick",
    payload: { remaining, hype: state.hypeActive },
  }).catch(() => {});

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

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`EBS listening on :${port}`));
