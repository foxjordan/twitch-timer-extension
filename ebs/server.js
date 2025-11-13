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
import { getRules, setRules, loadRules } from "./rules_store.js";
import "newrelic";

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

// Minimal overlay page for browser sources
app.get("/overlay", (req, res) => {
  if (!requireOverlayAuth(req, res)) return;
  // basic customization via query params
  const fontSize = Number(req.query.fontSize ?? 64);
  const color = String(req.query.color ?? "#FFFFFF");
  const bg = req.query.transparent
    ? "transparent"
    : String(req.query.bg ?? "rgba(0,0,0,0)");
  const fontFamily = String(
    req.query.font ?? "Inter,system-ui,Arial,sans-serif"
  );
  const showLabel = String(req.query.label ?? "0") !== "0";
  const align = String(req.query.align ?? "center"); // left|center|right
  const weight = Number(req.query.weight ?? 700);
  const key = req.query.key ? String(req.query.key) : "";
  const qs = key ? `?key=${encodeURIComponent(key)}` : "";
  const title = String(req.query.title ?? "Stream Countdown");
  const shadow = String(req.query.shadow ?? "0") !== "0";
  const shadowColor = String(req.query.shadowColor ?? "rgba(0,0,0,0.7)");
  const shadowBlur = Number(req.query.shadowBlur ?? 8);
  const stroke = Number(req.query.stroke ?? 0);
  const strokeColor = String(req.query.strokeColor ?? "#000000");

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <title>Timer Overlay</title>
    <style>
      html, body { height: 100%; }
      body { margin: 0; background: ${bg}; color: ${color}; font-family: ${fontFamily}; }
      .wrap { display: flex; align-items: center; justify-content: ${
        align === "left"
          ? "flex-start"
          : align === "right"
          ? "flex-end"
          : "center"
      }; height: 100%; padding: 0 8px; }
      .timer { font-variant-numeric: tabular-nums; letter-spacing: 1px; }
      .label { font-size: 14px; opacity: 0.75; margin-bottom: 4px; text-align: ${align}; }
      .hype { font-size: 12px; opacity: 0.9; margin-top: 4px; }
      .paused { font-size: 12px; opacity: 0.9; margin-top: 4px; }
      .cap  { font-size: 12px; opacity: 0.9; margin-top: 4px; }
      @keyframes flash {
        0% { opacity: 1; }
        50% { opacity: 0.3; }
        100% { opacity: 1; }
      }
      .flash { animation: flash 1s infinite; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div>
        <div id="label" class="label" style="display:none"></div>
        <div id="clock" class="timer" style="font-size:${fontSize}px; font-weight:${weight}; text-align:${align};${
    shadow
      ? ` text-shadow: 0 0 ${shadowBlur}px ${shadowColor}, 0 2px 2px ${shadowColor};`
      : ""
  }${
    stroke > 0
      ? ` -webkit-text-stroke: ${stroke}px ${strokeColor}; text-stroke: ${stroke}px ${strokeColor};`
      : ""
  }">--:--</div>
        <div id="hype" class="hype" style="display:none">🔥 Hype Train active</div>
        <div id="paused" class="paused" style="display:none">⏸ Paused</div>
        <div id="cap" class="cap" style="display:none">⏱ Stream has reached maximum length</div>
      </div>
    </div>
    <script>
      (function(){
        let remaining = 0;
        let hype = false;
        let tickTimer = null;
        let paused = false;
        let styleThresholds = { warnUnderSeconds: 300, warnColor: '#FFA500', dangerUnderSeconds: 60, dangerColor: '#FF4D4D', flashUnderSeconds: 0 };
        let timeFormat = 'mm:ss';
        let cap = false;

        function render() {
          const el = document.getElementById('clock');
          var txt = '--:--';
          var r = Math.max(0, remaining|0);
          if (timeFormat === 'hh:mm:ss') {
            var h = Math.floor(r/3600), m = Math.floor((r%3600)/60), s = r%60;
            txt = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
          } else if (timeFormat === 'auto') {
            var h2 = Math.floor(r/3600), m2 = Math.floor((r%3600)/60), s2 = r%60;
            if (h2 > 0) {
              txt = String(h2).padStart(2,'0') + ':' + String(m2).padStart(2,'0') + ':' + String(s2).padStart(2,'0');
            } else {
              txt = String((Math.floor(r/60))).padStart(2,'0') + ':' + String(r%60).padStart(2,'0');
            }
          } else {
            txt = String((Math.floor(r/60))).padStart(2,'0') + ':' + String(r%60).padStart(2,'0');
          }
          el.textContent = txt;
          document.getElementById('hype').style.display = hype ? 'block' : 'none';
          document.getElementById('paused').style.display = paused ? 'block' : 'none';
          document.getElementById('cap').style.display = cap ? 'block' : 'none';

          // Apply threshold color/flash
          var color = el.style.color;
          var w = Number(styleThresholds.warnUnderSeconds||0);
          var d = Number(styleThresholds.dangerUnderSeconds||0);
          if (d > 0 && remaining <= d) {
            color = styleThresholds.dangerColor || color;
          } else if (w > 0 && remaining <= w) {
            color = styleThresholds.warnColor || color;
          }
          el.style.color = color;
          var f = Number(styleThresholds.flashUnderSeconds||0);
          if (f > 0 && remaining <= f) {
            el.classList.add('flash');
          } else {
            el.classList.remove('flash');
          }
        }

        function startLocalTick() {
          if (tickTimer) clearInterval(tickTimer);
          tickTimer = setInterval(function(){
            if (!paused && remaining > 0) { remaining -= 1; render(); }
          }, 1000);
        }

        function applyStyle(s) {
          if (!s) return;
          try {
            const body = document.body;
            body.style.background = (s.transparent ? 'transparent' : (s.bg || 'transparent'));
            const clock = document.getElementById('clock');
            clock.style.fontSize = (s.fontSize || 64) + 'px';
            clock.style.color = s.color || '#FFFFFF';
            clock.style.fontFamily = s.font || 'Inter,system-ui,Arial,sans-serif';
            clock.style.fontWeight = String(s.weight || 700);
            clock.style.textAlign = s.align || 'center';
            if (s.shadow) {
              const blur = Number(s.shadowBlur || 8);
              const col = s.shadowColor || 'rgba(0,0,0,0.7)';
              clock.style.textShadow = '0 0 ' + blur + 'px ' + col + ', 0 2px 2px ' + col;
            } else {
              clock.style.textShadow = '';
            }
            if (Number(s.stroke || 0) > 0) {
              const w = Number(s.stroke);
              const sc = s.strokeColor || '#000000';
              clock.style.webkitTextStroke = w + 'px ' + sc;
              clock.style.textStroke = w + 'px ' + sc;
            } else {
              clock.style.webkitTextStroke = '';
              clock.style.textStroke = '';
            }
            const label = document.getElementById('label');
            if (label) {
              label.textContent = s.title || 'Stream Countdown';
              label.style.display = s.label ? 'block' : 'none';
              label.style.color = s.color || '#FFFFFF';
              label.style.textAlign = s.align || 'center';
            }
            const wrap = document.querySelector('.wrap');
            wrap.style.justifyContent = s.align === 'left' ? 'flex-start' : s.align === 'right' ? 'flex-end' : 'center';

            // thresholds
            styleThresholds.warnUnderSeconds = Number(s.warnUnderSeconds||0);
            styleThresholds.warnColor = s.warnColor || '#FFA500';
            styleThresholds.dangerUnderSeconds = Number(s.dangerUnderSeconds||0);
            styleThresholds.dangerColor = s.dangerColor || '#FF4D4D';
            styleThresholds.flashUnderSeconds = Number(s.flashUnderSeconds||0);
            timeFormat = (s.timeFormat==='hh:mm:ss' || s.timeFormat==='auto') ? s.timeFormat : 'mm:ss';
            render();
          } catch (e) {}
        }

        fetch('/api/timer/state${qs}').then(r => r.json()).then(s => {
          remaining = Number(s.remaining || 0);
          hype = Boolean(s.hype);
          paused = Boolean(s.paused);
          cap = Boolean(s.capReached);
          render();
          startLocalTick();
        }).catch(function(){});

        // Fetch initial style snapshot (in case SSE missed it)
        (function(){
          var u = '/api/overlay/style${qs}';
          u += (u.indexOf('?') === -1 ? '?' : '&') + '_=' + Date.now();
          fetch(u, { cache: 'no-store' }).then(function(r){ return r.json(); }).then(applyStyle).catch(function(){});
        })();
        // Fallback polling to handle environments where SSE is flaky (e.g., some OBS versions)
        setInterval(function(){
          var u = '/api/overlay/style${qs}';
          u += (u.indexOf('?') === -1 ? '?' : '&') + '_=' + Date.now();
          fetch(u, { cache: 'no-store' }).then(function(r){ return r.json(); }).then(applyStyle).catch(function(){});
        }, 5000);

          try {
            const es = new EventSource('/api/overlay/stream${qs}');
            es.addEventListener('timer_tick', function(ev){
              try {
                const data = JSON.parse(ev.data);
                if (typeof data.remaining === 'number') { remaining = data.remaining; }
                if (typeof data.hype === 'boolean') { hype = data.hype; }
                if (typeof data.paused === 'boolean') { paused = data.paused; }
                if (typeof data.capReached === 'boolean') { cap = data.capReached; }
                render();
              } catch (e) {}
            });
            es.addEventListener('style_update', function(ev){
              try { applyStyle(JSON.parse(ev.data)); } catch (e) {}
            });
          } catch (e) {}
      })();
    </script>
  </body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.send(html);
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

// Overlay Configurator (admin only; generates URL and previews)
app.get("/overlay/config", requireAdmin, (req, res) => {
  const base =
    process.env.SERVER_BASE_URL || `${req.protocol}://${req.get("host")}`;
  const adminName = String(
    req.session?.twitchUser?.display_name ||
      req.session?.twitchUser?.login ||
      "Admin"
  );
  const userKey = String(
    req.session?.userOverlayKey ||
      getOrCreateUserKey(req.session?.twitchUser?.id)
  );
  const settings = getUserSettings(req.session?.twitchUser?.id);
  const safeNum = (val, fallback = 0) => {
    const num = Number(val);
    return Number.isFinite(num) ? num : fallback;
  };
  const rulesSnapshot = getRules();
  const devCharityUsd = 5;
  const devTest = {
    bitsSeconds: safeNum(rulesSnapshot?.bits?.add_seconds, 60),
    bitsPer: safeNum(rulesSnapshot?.bits?.per, 100),
    subSeconds: safeNum(rulesSnapshot?.sub?.["1000"], 300),
    resubSeconds: safeNum(rulesSnapshot?.resub?.base_seconds, 300),
    giftSeconds: safeNum(rulesSnapshot?.gift_sub?.per_sub_seconds, 300),
    charityUsd: devCharityUsd,
    charitySeconds:
      safeNum(rulesSnapshot?.charity?.per_usd, 60) * devCharityUsd,
  };
  const defSecs = Number(settings.defaultInitialSeconds || 0);
  const defH = Math.floor(defSecs / 3600);
  const defM = Math.floor((defSecs % 3600) / 60);
  const defS = defSecs % 60;
  const initial = {
    fontSize: Number(req.query.fontSize ?? 64),
    color: String(req.query.color ?? "#FFFFFF"),
    bg: String(req.query.bg ?? "rgba(0,0,0,0)"),
    transparent: String(req.query.transparent ?? "1") !== "0",
    font: String(req.query.font ?? "Inter,system-ui,Arial,sans-serif"),
    label: String(req.query.label ?? "0") !== "0",
    title: String(req.query.title ?? "Stream Countdown"),
    align: String(req.query.align ?? "center"),
    weight: Number(req.query.weight ?? 700),
    shadow: String(req.query.shadow ?? "0") !== "0",
    shadowColor: String(req.query.shadowColor ?? "rgba(0,0,0,0.7)"),
    shadowBlur: Number(req.query.shadowBlur ?? 8),
    stroke: Number(req.query.stroke ?? 0),
    strokeColor: String(req.query.strokeColor ?? "#000000"),
    key: String(req.query.key ?? ""),
  };

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Timer Overlay Configurator</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; font-family: Inter, system-ui, Arial, sans-serif; background: #0e0e10; color: #efeff1; }
      header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #1b1b1f; border-bottom: 1px solid #303038; }
      header .left { font-weight: 600; }
      header .right { display: flex; gap: 12px; align-items: center; opacity: 0.9; }
      header button { background: #2c2c31; color: #efeff1; border: 1px solid #3a3a3d; padding: 6px 10px; border-radius: 8px; cursor: pointer; }
      .row { display: flex; gap: 16px; padding: 16px; }
      .panel { background: #1f1f23; border: 1px solid #303038; border-radius: 12px; padding: 16px; }
      .controls { width: 420px; }
      .control { display: grid; grid-template-columns: 140px 1fr; align-items: center; gap: 8px; margin-bottom: 10px; }
      .control label { opacity: 0.8; }
      .preview { flex: 1; min-height: 320px; }
      .row2 { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
      input[type="text"], input[type="number"], select { width: 100%; padding: 6px 8px; border-radius: 6px; border: 1px solid #3a3a3d; background: #151517; color: #efeff1; }
      input[type="checkbox"] { transform: scale(1.1); }
      input[type="color"] { height: 32px; }
      button { background: #9146FF; color: white; border: 0; padding: 8px 10px; border-radius: 8px; cursor: pointer; }
      button.secondary { background: #2c2c31; color: #efeff1; border: 1px solid #3a3a3d; }
      button { transition: transform .04s ease, box-shadow .15s ease, filter .15s ease, opacity .2s; }
      button:hover { box-shadow: 0 0 0 1px #4a4a50 inset; filter: brightness(1.02); }
      button:active { transform: translateY(1px) scale(0.99); filter: brightness(0.98); }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      @keyframes btnpulse { 0% { transform: scale(0.99); } 100% { transform: scale(1); } }
      .btn-click { animation: btnpulse .18s ease; }
      .url { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #151517; border: 1px solid #3a3a3d; padding: 8px; border-radius: 8px; overflow: auto; }
      iframe { width: 100%; height: 360px; border: 0; background: #000; }
      .hint { font-size: 12px; opacity: 0.8; }
    </style>
  </head>
  <body>
    <header>
      <div class="left">Timer Overlay Configurator</div>
      <div class="right">
        <div>Logged in as ${adminName}</div>
        <button id="logout">Logout</button>
      </div>
    </header>
    <div class="row">
      <div class="panel controls">
        <div class="control"><label>Overlay Key</label>
          <div style="display:flex; gap:8px; align-items:center;">
            <input id="key" type="text" value="${userKey}" readonly style="background:#151517; color:#efeff1;">
            <button class="secondary" id="rotateKey" title="Generate a new overlay key">Rotate</button>
          </div>
        </div>
        <div class="control"><label>Font Size</label><input id="fontSize" type="number" min="10" max="300" step="1" value="${
          initial.fontSize
        }"></div>
        <div class="control"><label>Color</label><input id="color" type="color" value="${
          initial.color
        }"></div>
        <div class="control"><label>Transparent</label><input id="transparent" type="checkbox" ${
          initial.transparent ? "checked" : ""
        }></div>
        <div class="control"><label>Background</label><input id="bg" type="color" value="#000000"></div>
        <div class="control"><label>Font Family</label><input id="font" type="text" value="${
          initial.font
        }"></div>
        <div class="control"><label>Show Label</label><input id="label" type="checkbox" ${
          initial.label ? "checked" : ""
        }></div>
        <div class="control"><label>Label Text</label><input id="title" type="text" value="${
          initial.title
        }"></div>
        <div class="control"><label>Align</label>
          <select id="align">
            <option ${
              initial.align === "left" ? "selected" : ""
            } value="left">left</option>
            <option ${
              initial.align === "center" ? "selected" : ""
            } value="center">center</option>
            <option ${
              initial.align === "right" ? "selected" : ""
            } value="right">right</option>
          </select>
        </div>
        <div class="control"><label>Weight</label><input id="weight" type="number" min="100" max="1000" step="100" value="${
          initial.weight
        }"></div>
        <div class="control"><label>Shadow</label><input id="shadow" type="checkbox" ${
          initial.shadow ? "checked" : ""
        }></div>
        <div class="control"><label>Shadow Color</label><input id="shadowColor" type="color" value="#000000"></div>
        <div class="control"><label>Shadow Blur</label><input id="shadowBlur" type="number" min="0" max="50" step="1" value="${
          initial.shadowBlur
        }"></div>
        <div class="control"><label>Outline Width</label><input id="stroke" type="number" min="0" max="20" step="1" value="${
          initial.stroke
        }"></div>
        <div class="control"><label>Outline Color</label><input id="strokeColor" type="color" value="#000000"></div>
        <div class="row2">
          <button class="secondary" id="presetClean">Preset: Clean</button>
          <button class="secondary" id="presetBold">Preset: Bold White</button>
          <button class="secondary" id="presetOutline">Preset: Outline</button>
          <button class="secondary" id="presetShadow">Preset: Shadow</button>
        </div>
        <div class="control"><label>Time format</label>
          <select id="timeFormat">
            <option value="mm:ss" >mm:ss</option>
            <option value="hh:mm:ss">hh:mm:ss</option>
            <option value="auto" selected>auto (hh:mm:ss when hours > 0)</option>
          </select>
        </div>
        <hr style="border:none;border-top:1px solid #303038;margin:16px 0;" />
        <div style="margin:4px 0 12px; opacity:0.85; font-weight:600;">Threshold Styling</div>
        <div class="control"><label>Warn under (sec)</label><input id="warnUnder" type="number" min="0" step="1" value="300"></div>
        <div class="control"><label>Warn color</label><input id="warnColor" type="color" value="#FFA500"></div>
        <div class="control"><label>Danger under (sec)</label><input id="dangerUnder" type="number" min="0" step="1" value="60"></div>
        <div class="control"><label>Danger color</label><input id="dangerColor" type="color" value="#FF4D4D"></div>
        <div class="control"><label>Flash under (sec)</label><input id="flashUnder" type="number" min="0" step="1" value="0"></div>
        <div class="row2">
          <button id="copy">Copy URL</button>
          <div class="hint">Add as a Browser Source in OBS</div>
        </div>
        <hr style="border:none;border-top:1px solid #303038;margin:16px 0;" />
        <div style="margin:4px 0 12px; opacity:0.85; font-weight:600;">Timer Controls</div>
        <div class="control"><label>Hours</label><input id="h" type="number" min="0" step="1" value="${defH}"></div>
        <div class="control"><label>Minutes</label><input id="m" type="number" min="0" max="59" step="1" value="${defM}"></div>
        <div class="control"><label>Seconds</label><input id="s" type="number" min="0" max="59" step="1" value="${defS}"></div>
       
        <div class="control"><label>Max Stream Length</label>
          <div style="display:flex; gap:8px; align-items:center;">
            <input id="maxH" type="number" min="0" step="1" value="0" style="max-width:80px">h
            <input id="maxM" type="number" min="0" max="59" step="1" value="0" style="max-width:80px">m
            <input id="maxS" type="number" min="0" max="59" step="1" value="0" style="max-width:80px">s
          </div>
        </div> 
        <div class="row2">
          <button id="startTimer">Start Timer</button>
          <button class="secondary" id="saveDefault">Save Default</button>
        </div>
        <div class="row2">
          <button class="secondary" id="clearMax" title="Remove the max cap">Clear Max</button>
        </div>
        <div class="row2">
          <button class="secondary" id="pause">Pause</button>
          <button class="secondary" id="resume">Resume</button>
        </div>
        <div class="row2">
          <button class="secondary" data-add="300">+5 min</button>
          <button class="secondary" data-add="600">+10 min</button>
          <button class="secondary" data-add="1800">+30 min</button>
        </div>
        <div class="row2">
          <input id="addCustomSeconds" type="number" min="1" step="1" placeholder="Seconds" style="max-width:140px" />
          <button class="secondary" id="addCustomBtn">Add</button>
        </div>
        <div class="hint" style="margin-top:8px">Current remaining: <span id="remain">--:--</span></div>
        <div class="hint" id="capStatus" style="margin-top:4px; opacity:0.8"></div>
        <hr style="border:none;border-top:1px solid #303038;margin:16px 0;" />
        <div style="margin:4px 0 12px; opacity:0.85; font-weight:600;">Rules</div>
        <div class="control"><label>Min. Bits to Trigger</label><input id="r_bits_per" type="number" min="1" step="1" value="100"></div>
        <div class="control"><label>Bits add (sec)</label><input id="r_bits_add" type="number" min="0" step="1" value="60"></div>
        <div class="control"><label>T1 Subs add (sec)</label><input id="r_sub_1000" type="number" min="0" step="1" value="300"></div>
        <div class="control"><label>T2 Subs add (sec)</label><input id="r_sub_2000" type="number" min="0" step="1" value="600"></div>
        <div class="control"><label>T3 Subs add (sec)</label><input id="r_sub_3000" type="number" min="0" step="1" value="900"></div>
        <div class="control"><label>Resub base (sec)</label><input id="r_resub_base" type="number" min="0" step="1" value="300"></div>
        <div class="control"><label>Gift sub per-sub (sec)</label><input id="r_gift_per" type="number" min="0" step="1" value="300"></div>
        <div class="control"><label>Charity per $1 (sec)</label><input id="r_charity_per_usd" type="number" min="0" step="1" value="60"></div>
        <div class="control"><label>Hype Train Modifier</label><input id="r_hype" type="number" min="0" step="0.1" value="2"></div>
        <div class="row2"><button id="saveRules">Save Rules</button></div>
        <hr style="border:none;border-top:1px solid #303038;margin:16px 0;" />
        <div style="margin:4px 0 4px; opacity:0.85; font-weight:600;">Testing Tools</div>
        <div class="row2" id="devTests">
          <button class="secondary" data-test-seconds="${
            devTest.bitsSeconds
          }" title="Simulate ${devTest.bitsPer} bits">
            Quick: ${devTest.bitsPer} bits (+${devTest.bitsSeconds}s)
          </button>
          <button class="secondary" data-test-seconds="${
            devTest.subSeconds
          }" title="Simulate Tier 1 sub">
            Quick: 1x T1 sub (+${devTest.subSeconds}s)
          </button>
          <button class="secondary" data-test-seconds="${
            devTest.giftSeconds
          }" title="Simulate single gift sub">
            Quick: 1x gift sub (+${devTest.giftSeconds}s)
          </button>
        </div>
        <div class="row2" id="devCustomBits">
          <input id="devBitsInput" type="number" min="0" step="1" placeholder="Bits amount" style="max-width:150px" />
          <button class="secondary" id="devApplyBits" title="Apply custom bits based on rules">Apply Bits</button>
        </div>
        <div class="row2" id="devCustomSubs">
          <input id="devSubCount" type="number" min="1" step="1" value="1" style="max-width:100px" />
          <select id="devSubTier" style="max-width:160px">
            <option value="1000">Tier 1</option>
            <option value="2000">Tier 2</option>
            <option value="3000">Tier 3</option>
          </select>
          <button class="secondary" id="devApplySubs" title="Apply N subs">Apply Subs</button>
        </div>
        <div class="row2" id="devCustomGifts">
          <input id="devGiftCount" type="number" min="1" step="1" value="1" style="max-width:100px" />
          <button class="secondary" id="devApplyGifts" title="Apply N gift subs">Apply Gift Subs</button>
        </div>
        <div class="row2" id="devHypeControls">
          <button class="secondary" id="testHypeOn">Force Hype On</button>
          <button class="secondary" id="testHypeOff">Force Hype Off</button>
        </div>
      </div>
      <div class="panel preview">
        <div style="margin-bottom:8px; opacity:0.85">Live Preview</div>
        <iframe id="preview" referrerpolicy="no-referrer"></iframe>
        <div style="margin-top:8px" class="url" id="url"></div>
        <div style="margin-top:8px" class="hint">Pause/Resume and Start actions update the live overlay immediately.</div>
      </div>
    </div>
    <script>
      const inputs = [
        'key','fontSize','color','transparent','bg','font','label','title','align','weight','shadow','shadowColor','shadowBlur','stroke','strokeColor','timeFormat',
        'h','m','s'
      ].reduce((acc, id) => (acc[id] = document.getElementById(id), acc), {});

      function overlayUrl() {
        const p = new URLSearchParams();
        if (inputs.key.value) p.set('key', inputs.key.value.trim());
        return '${base}/overlay' + (p.toString() ? ('?' + p.toString()) : '');
      }

      async function saveStyle() {
        const p = new URLSearchParams();
        if (inputs.key.value) p.set('key', inputs.key.value.trim());
        const url = '${base}/api/overlay/style' + (p.toString() ? ('?' + p.toString()) : '');
        const payload = {
          fontSize: Number(inputs.fontSize.value),
          color: inputs.color.value,
          transparent: Boolean(inputs.transparent.checked),
          bg: inputs.bg.value,
          font: inputs.font.value,
          label: Boolean(inputs.label.checked),
          title: inputs.title.value,
          align: inputs.align.value,
          weight: Number(inputs.weight.value),
          shadow: Boolean(inputs.shadow.checked),
          shadowColor: inputs.shadowColor.value,
          shadowBlur: Number(inputs.shadowBlur.value),
          stroke: Number(inputs.stroke.value),
          strokeColor: inputs.strokeColor.value,
          warnUnderSeconds: Number(document.getElementById('warnUnder').value||0),
          warnColor: document.getElementById('warnColor').value,
          dangerUnderSeconds: Number(document.getElementById('dangerUnder').value||0),
          dangerColor: document.getElementById('dangerColor').value,
          flashUnderSeconds: Number(document.getElementById('flashUnder').value||0),
          timeFormat: inputs.timeFormat.value
        };
        try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch(e) {}
      }

      function setBusy(btn, busy) { if (!btn) return; btn.disabled = !!busy; }
      function flashButton(btn) { if (!btn) return; btn.classList.add('btn-click'); setTimeout(() => btn.classList.remove('btn-click'), 160); }

      function totalSeconds() {
        var h = parseInt(inputs.h.value||'0',10)||0;
        var m = parseInt(inputs.m.value||'0',10)||0;
        var s = parseInt(inputs.s.value||'0',10)||0;
        if (m > 59) m = 59; if (s > 59) s = 59; if (h < 0) h = 0; if (m < 0) m = 0; if (s < 0) s = 0;
        return (h*3600)+(m*60)+s;
      }

      async function startTimer() {
        var secs = totalSeconds();
        if (secs <= 0) return;
        try { await fetch('/api/timer/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seconds: secs }) }); } catch(e) {}
      }

      async function addTime(secs) {
        try { await fetch('/api/timer/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seconds: secs }) }); } catch(e) {}
      }

      async function setHypeActive(active) {
        try {
          await fetch('/api/hype', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: !!active })
          });
        } catch (e) {}
      }

      async function getHypeActive() {
        try { const r = await fetch('/api/hype'); const j = await r.json(); return !!j.hype; } catch(e) { return false; }
      }

      function num(v, d){ const n = Number(v); return Number.isFinite(n) ? n : d; }

      async function saveDefaultInitial() {
        var secs = totalSeconds();
        var maxH = parseInt(document.getElementById('maxH').value||'0',10)||0;
        var maxM = parseInt(document.getElementById('maxM').value||'0',10)||0;
        var maxS = parseInt(document.getElementById('maxS').value||'0',10)||0;
        if (maxM > 59) maxM = 59; if (maxS > 59) maxS = 59; if (maxH < 0) maxH = 0; if (maxM < 0) maxM = 0; if (maxS < 0) maxS = 0;
        var maxTotal = (maxH*3600)+(maxM*60)+maxS;
        const payload = { defaultInitialSeconds: secs, maxTotalSeconds: maxTotal };
        try { await fetch('/api/user/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch(e) {}
      }

      async function saveMaxOnly(maxTotal) {
        const payload = { maxTotalSeconds: Math.max(0, parseInt(maxTotal,10)||0) };
        try { await fetch('/api/user/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch(e) {}
      }

      function fmt(sec) {
        sec = Math.max(0, (parseInt(sec,10) || 0));
        var h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
        var mm = String(m).padStart(2,'0'); var ss = String(s).padStart(2,'0');
        return (h>0? (h+':') : '') + mm + ':' + ss;
      }

      function refresh() {
        const url = overlayUrl();
        document.getElementById('url').textContent = url;
        document.getElementById('preview').src = url;
      }

      async function updateCapStatus(){
        const el = document.getElementById('capStatus');
        if (!el) return;
        try {
          const r = await fetch('/api/timer/totals', { cache: 'no-store' });
          const t = await r.json();
          const max = Number(t.maxTotalSeconds||0);
          const init = Number(t.initialSeconds||0);
          const add = Number(t.additionsTotal||0);
          const used = Math.max(0, init + add);
          if (max > 0) {
            el.textContent = 'Max: ' + fmt(max) + ' • Initial: ' + fmt(init) + ' • Added: ' + fmt(add) + ' • Total: ' + fmt(used);
          } else {
            el.textContent = 'No max set • Initial: ' + fmt(init) + ' • Added: ' + fmt(add) + ' • Total: ' + fmt(used);
          }
        } catch(e) {}
      }

      function bind() {
        for (const id in inputs) {
          const el = inputs[id];
          el.addEventListener('input', () => { saveStyle(); });
          el.addEventListener('change', () => { saveStyle(); });
        }
        document.getElementById('logout').addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = '/auth/logout?next=' + encodeURIComponent('/overlay/config');
        });
        const copyBtn = document.getElementById('copy');
        copyBtn.addEventListener('click', async (e) => {
          flashButton(copyBtn);
          const url = document.getElementById('url').textContent;
          const old = copyBtn.textContent;
          try { await navigator.clipboard.writeText(url); copyBtn.textContent = 'Copied!'; } catch(e) { copyBtn.textContent = 'Copy failed'; }
          setTimeout(() => { copyBtn.textContent = old; }, 900);
        });
        const rotateBtn = document.getElementById('rotateKey');
        rotateBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          flashButton(rotateBtn);
          if (!confirm('Rotate key? Your OBS URL will need to be updated.')) return;
          setBusy(rotateBtn, true);
          try {
            const r = await fetch('/api/overlay/key/rotate', { method: 'POST' });
            const j = await r.json();
            if (j.key) { inputs.key.value = j.key; refresh(); saveStyle(); }
          } catch (e) {}
          setBusy(rotateBtn, false);
        });
        document.getElementById('presetClean').addEventListener('click', (e) => {
          e.preventDefault();
          flashButton(e.currentTarget);
          inputs.color.value = '#FFFFFF';
          inputs.transparent.checked = true;
          inputs.label.checked = false;
          inputs.shadow.checked = false;
          inputs.stroke.value = 0;
          saveStyle();
        });
        document.getElementById('presetBold').addEventListener('click', (e) => {
          e.preventDefault();
          flashButton(e.currentTarget);
          inputs.color.value = '#FFFFFF';
          inputs.weight.value = 900;
          inputs.fontSize.value = Math.max(64, Number(inputs.fontSize.value)||64);
          inputs.transparent.checked = true;
          inputs.stroke.value = 0;
          inputs.shadow.checked = false;
          inputs.label.checked = false;
          saveStyle();
        });
        document.getElementById('presetOutline').addEventListener('click', (e) => {
          e.preventDefault();
          flashButton(e.currentTarget);
          inputs.color.value = '#FFFFFF';
          inputs.stroke.value = 4;
          inputs.strokeColor.value = '#000000';
          inputs.shadow.checked = false;
          inputs.transparent.checked = true;
          inputs.label.checked = false;
          saveStyle();
        });
        document.getElementById('presetShadow').addEventListener('click', (e) => {
          e.preventDefault();
          flashButton(e.currentTarget);
          inputs.shadow.checked = true;
          inputs.shadowColor.value = 'rgba(0,0,0,0.75)';
          inputs.shadowBlur.value = 10;
          inputs.transparent.checked = true;
          inputs.stroke.value = 0;
          inputs.label.checked = false;
          saveStyle();
        });

        // Timer controls
        document.getElementById('startTimer').addEventListener('click', async function(e){ e.preventDefault(); const btn=e.currentTarget; flashButton(btn); setBusy(btn,true); await startTimer(); await updateCapStatus(); setBusy(btn,false); });
        document.getElementById('saveDefault').addEventListener('click', async function(e){ e.preventDefault(); const btn=e.currentTarget; flashButton(btn); setBusy(btn,true); await saveDefaultInitial(); await updateCapStatus(); setBusy(btn,false); });
        const clearMaxBtn = document.getElementById('clearMax');
        if (clearMaxBtn) {
          clearMaxBtn.addEventListener('click', async function(e){
            e.preventDefault();
            flashButton(clearMaxBtn);
            setBusy(clearMaxBtn, true);
            document.getElementById('maxH').value = 0;
            document.getElementById('maxM').value = 0;
            document.getElementById('maxS').value = 0;
            await saveMaxOnly(0);
            await updateCapStatus();
            setBusy(clearMaxBtn, false);
          });
        }
        Array.from(document.querySelectorAll('[data-add]')).forEach(function(btn){
          btn.addEventListener('click', async function(e){ e.preventDefault(); flashButton(btn); var v = parseInt(btn.getAttribute('data-add'),10)||0; if (v>0) { setBusy(btn,true); await addTime(v); await updateCapStatus(); setBusy(btn,false);} });
        });
        // Custom add seconds
        (function(){
          const input = document.getElementById('addCustomSeconds');
          const btn = document.getElementById('addCustomBtn');
          if (!input || !btn) return;
          const doAdd = async () => {
            const v = parseInt(input.value, 10) || 0;
            if (v <= 0) return;
            flashButton(btn);
            setBusy(btn, true);
            await addTime(v);
            await updateCapStatus();
            setBusy(btn, false);
          };
          btn.addEventListener('click', function(e){ e.preventDefault(); doAdd(); });
          input.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
        })();
        document.getElementById('pause').addEventListener('click', async function(e){ e.preventDefault(); const btn=e.currentTarget; flashButton(btn); setBusy(btn,true); try { await fetch('/api/timer/pause', { method: 'POST' }); } catch(e) {} setBusy(btn,false); });
        document.getElementById('resume').addEventListener('click', async function(e){ e.preventDefault(); const btn=e.currentTarget; flashButton(btn); setBusy(btn,true); try { await fetch('/api/timer/resume', { method: 'POST' }); } catch(e) {} setBusy(btn,false); });
        const devPanel = document.getElementById('devTests');
        if (devPanel) {
          // Expose rules for client-side calculation
          window.DEV_RULES = ${
            rulesSnapshot ? JSON.stringify(rulesSnapshot) : "null"
          };
          Array.from(devPanel.querySelectorAll('[data-test-seconds]')).forEach(function(btn){
            btn.addEventListener('click', async function(e){
              e.preventDefault();
              var secs = parseInt(btn.getAttribute('data-test-seconds'), 10) || 0;
              if (secs <= 0) return;
              flashButton(btn);
              setBusy(btn, true);
              // Apply hype multiplier if active
              try {
                const hype = await getHypeActive();
                if (hype && window.DEV_RULES && window.DEV_RULES.hypeTrain) {
                  const mult = Number(window.DEV_RULES.hypeTrain.multiplier) || 1;
                  secs = Math.floor(secs * mult);
                }
              } catch(e) {}
              await addTime(secs);
              await updateCapStatus();
              setBusy(btn, false);
            });
          });
          // Custom bits
          const bitsBtn = document.getElementById('devApplyBits');
          if (bitsBtn) bitsBtn.addEventListener('click', async function(e){
            e.preventDefault();
            const bits = num(document.getElementById('devBitsInput')?.value, 0);
            if (!window.DEV_RULES || bits <= 0) return;
            let secs = Math.floor(bits / (Number(window.DEV_RULES.bits?.per)||100)) * (Number(window.DEV_RULES.bits?.add_seconds)||0);
            const hype = await getHypeActive();
            if (hype) { const mult = Number(window.DEV_RULES.hypeTrain?.multiplier)||1; secs = Math.floor(secs * mult); }
            flashButton(bitsBtn); setBusy(bitsBtn,true); await addTime(secs); await updateCapStatus(); setBusy(bitsBtn,false);
          });
          // Custom subs
          const subsBtn = document.getElementById('devApplySubs');
          if (subsBtn) subsBtn.addEventListener('click', async function(e){
            e.preventDefault();
            const count = Math.max(1, num(document.getElementById('devSubCount')?.value, 1));
            const tier = String(document.getElementById('devSubTier')?.value||'1000');
            if (!window.DEV_RULES) return;
            let per = Number((window.DEV_RULES.sub||{})[tier] ?? (window.DEV_RULES.sub||{})['1000'] ?? 0);
            let secs = Math.floor(count * per);
            const hype = await getHypeActive();
            if (hype) { const mult = Number(window.DEV_RULES.hypeTrain?.multiplier)||1; secs = Math.floor(secs * mult); }
            flashButton(subsBtn); setBusy(subsBtn,true); await addTime(secs); await updateCapStatus(); setBusy(subsBtn,false);
          });
          // Custom gift subs
          const giftsBtn = document.getElementById('devApplyGifts');
          if (giftsBtn) giftsBtn.addEventListener('click', async function(e){
            e.preventDefault();
            const count = Math.max(1, num(document.getElementById('devGiftCount')?.value, 1));
            if (!window.DEV_RULES) return;
            let secs = Math.floor(count * (Number(window.DEV_RULES.gift_sub?.per_sub_seconds)||0));
            const hype = await getHypeActive();
            if (hype) { const mult = Number(window.DEV_RULES.hypeTrain?.multiplier)||1; secs = Math.floor(secs * mult); }
            flashButton(giftsBtn); setBusy(giftsBtn,true); await addTime(secs); await updateCapStatus(); setBusy(giftsBtn,false);
          });
        }
        const hypeOnBtn = document.getElementById('testHypeOn');
        const hypeOffBtn = document.getElementById('testHypeOff');
        if (hypeOnBtn) hypeOnBtn.addEventListener('click', async function(e){ e.preventDefault(); flashButton(hypeOnBtn); setBusy(hypeOnBtn,true); await setHypeActive(true); await updateCapStatus(); setBusy(hypeOnBtn,false); });
        if (hypeOffBtn) hypeOffBtn.addEventListener('click', async function(e){ e.preventDefault(); flashButton(hypeOffBtn); setBusy(hypeOffBtn,true); await setHypeActive(false); await updateCapStatus(); setBusy(hypeOffBtn,false); });

        // Load current user settings into inputs in case server changed
        fetch('/api/user/settings').then(function(r){return r.json();}).then(function(j){
          var secs = Number(j.defaultInitialSeconds||0);
          inputs.h.value = Math.floor(secs/3600);
          inputs.m.value = Math.floor((secs%3600)/60);
          inputs.s.value = secs%60;
          var max = Number(j.maxTotalSeconds||0);
          document.getElementById('maxH').value = Math.floor(max/3600);
          document.getElementById('maxM').value = Math.floor((max%3600)/60);
          document.getElementById('maxS').value = max%60;
        }).catch(function(){});

        // Load current style thresholds to sync controls
        (function(){
          var u = '/api/overlay/style';
          var key = inputs.key.value.trim();
          if (key) { u += '?key=' + encodeURIComponent(key); }
          fetch(u, { cache: 'no-store' }).then(function(r){return r.json();}).then(function(s){
            try {
              if (typeof s.warnUnderSeconds !== 'undefined') document.getElementById('warnUnder').value = Number(s.warnUnderSeconds)||0;
              if (typeof s.warnColor !== 'undefined') document.getElementById('warnColor').value = s.warnColor || '#FFA500';
              if (typeof s.dangerUnderSeconds !== 'undefined') document.getElementById('dangerUnder').value = Number(s.dangerUnderSeconds)||0;
              if (typeof s.dangerColor !== 'undefined') document.getElementById('dangerColor').value = s.dangerColor || '#FF4D4D';
              if (typeof s.flashUnderSeconds !== 'undefined') document.getElementById('flashUnder').value = Number(s.flashUnderSeconds)||0;
              if (typeof s.timeFormat !== 'undefined') document.getElementById('timeFormat').value = (s.timeFormat==='hh:mm:ss' || s.timeFormat==='auto') ? s.timeFormat : 'mm:ss';
            } catch(e) {}
          }).catch(function(){});
        })();

        // Show current remaining
        function updateRemain(){ fetch('/api/timer/state').then(function(r){return r.json();}).then(function(j){ document.getElementById('remain').textContent = fmt(j.remaining||0); }).catch(function(){}); }
        updateRemain(); setInterval(updateRemain, 1000);
        updateCapStatus(); setInterval(updateCapStatus, 3000);

        // Load rules and populate inputs
        fetch('/api/rules').then(r=>r.json()).then(function(rr){
          try {
            if (rr && rr.bits) {
              document.getElementById('r_bits_per').value = rr.bits.per ?? 100;
              document.getElementById('r_bits_add').value = rr.bits.add_seconds ?? 60;
            }
            if (rr && rr.sub) {
              document.getElementById('r_sub_1000').value = rr.sub['1000'] ?? 300;
              if (document.getElementById('r_sub_2000')) document.getElementById('r_sub_2000').value = rr.sub['2000'] ?? 600;
              if (document.getElementById('r_sub_3000')) document.getElementById('r_sub_3000').value = rr.sub['3000'] ?? 900;
            }
            if (rr && rr.resub) {
              if (document.getElementById('r_resub_base')) document.getElementById('r_resub_base').value = rr.resub.base_seconds ?? 300;
            }
            if (rr && rr.gift_sub) {
              if (document.getElementById('r_gift_per')) document.getElementById('r_gift_per').value = rr.gift_sub.per_sub_seconds ?? 300;
            }
            if (rr && rr.charity) {
              if (document.getElementById('r_charity_per_usd')) document.getElementById('r_charity_per_usd').value = rr.charity.per_usd ?? 60;
            }
            if (rr && rr.hypeTrain) {
              document.getElementById('r_hype').value = rr.hypeTrain.multiplier ?? 2;
            }
          } catch (e) {}
        }).catch(function(){});

        // Save rules
        document.getElementById('saveRules').addEventListener('click', async function(e){
          e.preventDefault();
          const body = {
            bits: { per: Number(document.getElementById('r_bits_per').value||100), add_seconds: Number(document.getElementById('r_bits_add').value||60) },
            sub: {
              '1000': Number(document.getElementById('r_sub_1000').value||300),
              '2000': Number((document.getElementById('r_sub_2000')||{}).value||600),
              '3000': Number((document.getElementById('r_sub_3000')||{}).value||900)
            },
            resub: { base_seconds: Number((document.getElementById('r_resub_base')||{}).value||300) },
            gift_sub: { per_sub_seconds: Number((document.getElementById('r_gift_per')||{}).value||300) },
            charity: { per_usd: Number((document.getElementById('r_charity_per_usd')||{}).value||60) },
            hypeTrain: { multiplier: Number(document.getElementById('r_hype').value||2) }
          };
          try { await fetch('/api/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch(e) {}
        });

        // (rules UI removed)
      }

      bind();
      refresh();
      saveStyle();
    </script>
  </body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.send(html);
});

// ---- EventSub integration ----
function secondsFromEvent(notification) {
  const subType = notification?.payload?.subscription?.type;
  const e = notification?.payload?.event ?? {};
  const RULES = getRules();
  switch (subType) {
    case "channel.bits.use": // Bits in Extensions
    case "channel.cheer": {  // Standard Bits cheers
      const bits = e.bits ?? e.total_bits_used ?? e.total_bits ?? 0;
      return Math.floor(bits / RULES.bits.per) * RULES.bits.add_seconds;
    }
    case "channel.subscribe": {
      const tier = e.tier || "1000";
      return RULES.sub[tier] || RULES.sub["1000"];
    }
    case "channel.subscription.message": {
      return RULES.resub.base_seconds;
    }
    case "channel.subscription.gift": {
      const count = e.total ?? e.cumulative_total ?? e.total_count ?? 0;
      return (count || 1) * RULES.gift_sub.per_sub_seconds;
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
      if ((CURRENT_BROADCASTER_LOGIN || '').toLowerCase() === 'darkfoxllc') {
        return 600; // +10 minutes
      }
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

  if (
    subType === "channel.hype_train.begin" ||
    subType === "channel.hype_train.progress"
  ) {
    setHype(true);
  }
  if (subType === "channel.hype_train.end") {
    setHype(false);
  }

  let seconds = secondsFromEvent(notification);
  if (seconds > 0 && state.hypeActive) {
    seconds = Math.floor(seconds * getRules().hypeTrain.multiplier);
  }
  if (seconds > 0) {
    const before = getRemainingSeconds();
    const remaining = addSeconds(seconds);
    const actual = Math.max(0, remaining - before);
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
    payload: { remaining },
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
