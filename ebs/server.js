import "dotenv/config";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { db, sessionDb } from "./db.js";
import { wrapStoreWithReadCache } from "./session_read_cache.js";
import { v4 as uuidv4 } from "uuid";
import { RULES } from "./rules.js";
import { connectEventSubWS } from "./eventsub-ws.js";
import { broadcastToChannel, sendExtensionChatMessage, sendBroadcasterChatMessage } from "./broadcast.js";
import { fetchUserDisplayName, fetchLiveStreamStatus, getAppAccessToken } from "./twitch_api.js";
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
import { loadUserProfiles, getUserProfile, setUserProfile, addEventSubWebhookSubIds } from "./user_profiles.js";
import { loadBannerConfig } from "./banner_store.js";
import { mountTimerRoutes } from "./routes_timer.js";
import { mountAuthRoutes } from "./routes_auth.js";
import { mountOverlayApiRoutes } from "./routes_overlay_api.js";
import { mountOverlayPageRoutes } from "./routes_overlay_page.js";
import { mountDelegateRoutes } from "./routes_delegate.js";
import { mountLibraryModerationRoutes } from "./routes_library_moderation.js";
import { mountAnalyticsRoutes } from "./routes_analytics.js";
import { mountOfficialLibraryRoutes } from "./routes_official_library.js";
import { isDelegate } from "./delegate_store.js";
import { isSuperAdminId } from "./super_admin.js";
import { mountHomePageRoutes } from "./routes_home_page.js";
import { mountGoalRoutes } from "./routes_goals.js";
import { logger, requestLogger, setLoggerContext } from "./logger.js";
import { getRules, setRules, loadRules } from "./rules_store.js";
import { getPlinkoConfig, setPlinkoConfig, loadPlinkoConfig } from "./plinko_store.js";
import { computePlinkoDrop } from "./plinko.js";
import { createPlinkoQueue } from "./plinko_queue.js";
import { createSubDedup } from "./sub_dedup.js";
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
import { loadSoundAlerts, listSounds, getSoundSettings, setSoundSettings, getSoundByChannelPointsRewardId } from "./sounds_store.js";
import { loadBans, isBanned } from "./bans.js";
import { loadSubscriptions } from "./subscription_store.js";
import { mountStripeWebhookRoute, mountStripeRoutes } from "./routes_stripe.js";
import { mountEventSubWebhookRoute, ensureStreamStatusWebhookSubs, removeStreamStatusWebhookSubs } from "./eventsub_webhook.js";
import { mountTtsRoutes, registerAudioFile } from "./routes_tts.js";
import { synthesizeSpeech } from "./tts_provider.js";
import { loadTtsSettings, getTtsSettings } from "./tts_store.js";
import { loadVoices, getVoices } from "./tts_voices.js";
import { persistTokens, loadTokens, getAllTokenUserIds, getUserAccessToken, getValidAccessToken, refreshAccessToken } from "./twitch_tokens.js";
import { mountStreamElementsRoutes } from "./routes_streamelements.js";
import { logSoundEvent, logTtsEvent } from "./alert_events_store.js";
import * as Sentry from "@sentry/node";
import {
  connectStreamElements,
  disconnectStreamElements,
  disconnectAllStreamElements,
  getStreamElementsStatus,
} from "./streamelements.js";

const app = express();
// honor X-Forwarded-* so req.protocol resolves to https behind Fly
app.set("trust proxy", 1);
// Stripe and EventSub webhooks both need the raw body — must be before express.json()
mountStripeWebhookRoute(app);
mountEventSubWebhookRoute(app, {
  onStreamOnline: (broadcasterId) => handleBroadcasterWentLive(broadcasterId),
  onStreamOffline: (broadcasterId) => handleBroadcasterWentOffline(broadcasterId),
  seen: state.seen,
});
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
const PgSessionStore = connectPgSimple(session);
app.use(
  session({
    name: "overlay.sid",
    // Persists sessions in Postgres instead of express-session's default
    // MemoryStore, which never expires entries and leaks memory until the
    // process is restarted.
    // Wrapped in a short-lived read cache: a single page load fires a dozen
    // or so concurrent requests, each independently asking for this exact
    // session — without the cache that's a dozen near-simultaneous DB reads
    // competing for the same pool. See session_read_cache.js.
    store: wrapStoreWithReadCache(
      new PgSessionStore({ pool: sessionDb, tableName: "session", createTableIfMissing: true }),
    ),
    secret:
      process.env.SESSION_SECRET || process.env.TWITCH_CLIENT_SECRET || crypto.randomBytes(16).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: "auto", maxAge: 30 * 24 * 60 * 60 * 1000 },
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

// Re-verify delegate relationship on every session that has managingAs set.
// Checks at most once per 60 seconds to avoid a DB hit on every request.
// If delegation was revoked: API requests get a 403; page requests silently
// drop the delegate context so the user sees their own settings instead.
app.use(async (req, res, next) => {
  const managingAs = req.session?.managingAs;
  const selfId = req.session?.twitchUser?.id;
  // superAdminManaging is only meaningful while managingAs is set — clear the
  // stray flag on any request after the context was dropped elsewhere.
  if (!managingAs && req.session?.superAdminManaging) req.session.superAdminManaging = null;
  if (!managingAs || !selfId || managingAs === selfId) return next();
  const verifiedAt = req.session.delegateVerifiedAt || 0;
  if (Date.now() - verifiedAt < 60_000) return next();
  try {
    // A super admin holds a delegate-style context for any channel without a
    // delegate record (see routes_admin.js "/admin/broadcaster/:userId").
    const valid = (await isDelegate(managingAs, selfId)) || isSuperAdminId(selfId);
    if (!valid) {
      req.session.managingAs = null;
      req.session.managingAsName = null;
      req.session.delegateVerifiedAt = null;
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'Delegate access has been revoked' });
      }
    } else {
      req.session.delegateVerifiedAt = Date.now();
    }
  } catch {
    // DB unavailable — fail open (don't block the request) but don't refresh cache
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
const lastPromptByKey = new Map();
const lastPlinkoDropByKey = new Map();
const lastPlinkoBoardByKey = new Map(); // latest board look (rows/bins/token/style)
const lastPlinkoQueueByKey = new Map(); // latest { nowPlaying, waiting[], waitingCount }
const subDedup = createSubDedup(); // one subscription counted per subscriber
// Drops play one at a time per channel so a burst of sound-triggered drops
// doesn't clobber each other on the overlay. play()/onChange() are hoisted
// function declarations defined further down.
const plinkoQueue = createPlinkoQueue({
  play: (item) => playPlinkoDrop(item),
  onChange: (channelId) => broadcastPlinkoQueue(channelId),
});
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
loadPlinkoConfig().catch(() => {});
loadTimerState().catch(() => {});
loadGoals().catch(() => {});
loadSoundAlerts().catch(() => {});
loadBans().catch(() => {});
loadSubscriptions().catch(() => {});
loadTtsSettings().catch(() => {});
loadVoices().catch(() => {});
loadTokens().catch(() => {});
loadBannerConfig().catch(() => {});

// One-time, idempotent DB bootstrap: analytics indexes + the persisted event log.
(async () => {
  try {
    await db.query("CREATE INDEX IF NOT EXISTS client_events_name_created_idx ON client_events (event_name, created_at)");
    await db.query("CREATE INDEX IF NOT EXISTS client_events_feature_idx ON client_events ((params ->> 'feature')) WHERE (params ->> 'feature') IS NOT NULL");
    await db.query(`CREATE TABLE IF NOT EXISTS event_log (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      ts bigint NOT NULL,
      type text NOT NULL,
      data jsonb NOT NULL DEFAULT '{}'::jsonb
    )`);
    await db.query("CREATE INDEX IF NOT EXISTS event_log_user_ts_idx ON event_log (user_id, ts DESC)");
  } catch (err) {
    logger.error("db_bootstrap_failed", { message: err?.message });
  }
})();

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

// cleanup loop for dedupe map (every 10 minutes) — yielded in batches.
// channel.chat.message (subscribed for chat-command support) fires for
// literally every chat message across every connected channel, dwarfing
// every other EventSub type in volume; with a 24h TTL and enough active
// channels this Map can hold well over 100k entries by the time a sweep
// runs. A single unbroken synchronous pass over that many blocks the whole
// event loop — every other request, including trivial in-memory reads like
// /api/timer/state, queues behind it for the full sweep duration.
const SEEN_CLEANUP_YIELD_BATCH_SIZE = 2000;
setInterval(async () => {
  const now = Date.now();
  let i = 0;
  for (const [k, exp] of state.seen.entries()) {
    if (exp <= now) state.seen.delete(k);
    i++;
    if (i % SEEN_CLEANUP_YIELD_BATCH_SIZE === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }
  subDedup.sweep(now); // tiny map (one entry per recent subscriber) — no batching needed
}, 10 * 60 * 1000);

// client_events retention: 12 months (spec). Low volume — a single DELETE daily.
setInterval(async () => {
  try {
    const r = await db.query("DELETE FROM client_events WHERE created_at < now() - interval '12 months'");
    if (r.rowCount > 0) logger.info("client_events_pruned", { rows: r.rowCount });
  } catch (err) {
    logger.error("client_events_prune_failed", { message: err?.message });
  }
}, 24 * 60 * 60 * 1000);

// event_log retention: 90 days. Low volume — a single DELETE daily. ts is epoch ms.
setInterval(async () => {
  try {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const r = await db.query("DELETE FROM event_log WHERE ts < $1", [cutoff]);
    if (r.rowCount > 0) logger.info("event_log_pruned", { rows: r.rowCount });
  } catch (err) {
    logger.error("event_log_prune_failed", { message: err?.message });
  }
}, 24 * 60 * 60 * 1000);

// Per-channel pending alert queue: channelId -> [{ alertId, type, soundName, viewerUserId, viewerDisplayName, bitsAmount, enqueuedAt, expiresAt }]
export const pendingAlerts = new Map();
const ALERT_QUEUE_TTL_MS = 10 * 60 * 1000; // items expire after 10 minutes

// Cleanup expired queue items every minute
setInterval(() => {
  const now = Date.now();
  for (const [cid, queue] of pendingAlerts.entries()) {
    const fresh = queue.filter(a => a.expiresAt > now);
    if (fresh.length !== queue.length) pendingAlerts.set(cid, fresh);
  }
}, 60 * 1000);

// Basic health endpoint
// Go-live-triggered EventSub means eventSubActiveConnections is now normally
// LOW (only live broadcasters), not an implicit health signal on its own —
// pairing it with how many broadcasters Twitch says are actually live turns
// "5 active connections" from ambiguous into "5 active, 5 live: healthy" vs.
// "0 active, 3 live: broken". Cached with a short TTL rather than a fresh
// Helix call on every hit, since Fly's own health-check polling interval is
// tighter than this would ever meaningfully change.
let healthzLiveCache = { count: null, expiresAt: 0 };
async function getCachedLiveBroadcasterCount() {
  if (Date.now() < healthzLiveCache.expiresAt) return healthzLiveCache.count;
  try {
    const liveMap = await fetchLiveStreamStatus(Array.from(broadcasterConnections.keys()));
    healthzLiveCache = { count: liveMap.size, expiresAt: Date.now() + 15_000 };
  } catch {
    // Keep serving the last known value on a transient Helix failure rather
    // than flipping to a misleading "0 live" reading.
  }
  return healthzLiveCache.count;
}

app.get("/healthz", async (_req, res) => {
  // Check if ANY EventSub connections are active
  const activeConnections = Array.from(broadcasterConnections.entries()).filter(
    ([_, conn]) => conn.ws && typeof conn.ws.readyState === "number" && conn.ws.readyState === 1
  );
  const eventSubReady = activeConnections.length > 0;
  const liveBroadcasterCount = await getCachedLiveBroadcasterCount();

  res.json({
    ok: true,
    activeBroadcasters: getAllActiveBroadcasters().length,
    broadcasterIds: getAllActiveBroadcasters(),
    sseClients: sseClients.size,
    eventSubConnected: eventSubReady,
    eventSubActiveConnections: activeConnections.length,
    // null (not 0) on a fetch failure — avoids a false "everyone's offline" alarm
    liveBroadcasterCount,
    eventSubHealthy: liveBroadcasterCount == null ? null : activeConnections.length >= liveBroadcasterCount,
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
app.get("/api/events/log", async (req, res) => {
  if (!req?.session?.isAdmin)
    return res.status(401).json({ error: "Admin login required" });
  const uid = req.session?.twitchUser?.id;
  res.json({ entries: await getLogEntries(uid ? String(uid) : null) });
});

app.post("/api/events/log/clear", async (req, res) => {
  if (!req?.session?.isAdmin)
    return res.status(401).json({ error: "Admin login required" });
  const uid = req.session?.twitchUser?.id;
  await clearLogEntries(uid ? String(uid) : null);
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

  const entry = await getLogEntryById(req.params.alertId);
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

// Prompt Engine — manually-triggered conversation prompts for a Browser
// Source overlay, same broadcast/late-join-cache shape as the wheel above.
// An empty text clears the overlay (used by the "Hide" button).
app.post("/api/prompt/show", (req, res) => {
  if (!req?.session?.isAdmin)
    return res.status(401).json({ error: "Admin login required" });
  const overlayKey = normKey(
    req.body?.overlayKey || req.query.key || req.session?.userOverlayKey || ""
  );
  if (!overlayKey)
    return res.status(400).json({ error: "Overlay key is required" });
  const text = String(req.body?.text || "").slice(0, 280).trim();
  const payload = { text, shownAt: new Date().toISOString() };
  lastPromptByKey.set(overlayKey, payload);
  for (const client of Array.from(sseClients)) {
    if (!client || client.key !== overlayKey) continue;
    try {
      client.res.write("event: prompt_show\n");
      client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
  res.json(payload);
});

// Plinko — a token dropped from a chosen top column bounces down a seeded
// path and lands in a multiplier bin; the bin multiplies a configurable base
// time onto the subathon timer. Same admin-trigger + SSE fan-out + late-join
// cache shape as the wheel above, but this one also writes the timer.
app.get("/api/plinko/config", (req, res) => {
  if (!req?.session?.isAdmin)
    return res.status(401).json({ error: "Admin login required" });
  const uid = resolveTimerUserIdFromRequest(req);
  if (!uid) return res.status(400).json({ error: "No broadcaster in session" });
  res.json(getPlinkoConfig(uid));
});

app.post("/api/plinko/config", (req, res) => {
  if (!req?.session?.isAdmin)
    return res.status(401).json({ error: "Admin login required" });
  const uid = resolveTimerUserIdFromRequest(req);
  if (!uid) return res.status(400).json({ error: "No broadcaster in session" });
  try {
    const saved = setPlinkoConfig(uid, req.body || {});
    logger.info("plinko_config_saved", { requestId: req.requestId, broadcasterId: uid });
    res.json(saved);

    // Push the new board look to any live browser source on this key so it
    // updates without a reload / re-copied link. Late joiners get it from the
    // late-join cache below.
    const overlayKey = normKey(req.session?.userOverlayKey || "");
    if (overlayKey) {
      const boardPayload = {
        rows: saved.rows,
        bins: saved.bins,
        token: saved.token,
        style: saved.style,
      };
      lastPlinkoBoardByKey.set(overlayKey, boardPayload);
      // Keep a cached (replayed-on-reconnect) drop visually consistent too.
      for (const [ck, dropPayload] of lastPlinkoDropByKey) {
        if (ck === overlayKey || ck.startsWith(overlayKey + ":")) {
          Object.assign(dropPayload, boardPayload);
        }
      }
      for (const client of Array.from(sseClients)) {
        if (!client || client.key !== overlayKey) continue;
        try {
          client.res.write("event: plinko_board\n");
          client.res.write(`data: ${JSON.stringify(boardPayload)}\n\n`);
        } catch (e) {
          sseClients.delete(client);
        }
      }
    }
  } catch (e) {
    res.status(400).json({ error: "Invalid Plinko config" });
  }
});

// Write a plinko_drop event to every browser source on this overlay key.
function fanOutPlinkoDrop(overlayKey, boardId, payload) {
  for (const client of Array.from(sseClients)) {
    if (!client || client.key !== overlayKey) continue;
    if (boardId && client.boardId && client.boardId !== boardId) continue;
    try {
      client.res.write("event: plinko_drop\n");
      client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// Push the current queue state (now dropping / who's waiting) to the Extras UI.
function broadcastPlinkoQueue(channelId) {
  let overlayKey = "";
  try {
    overlayKey = normKey(getOrCreateUserKey(String(channelId)));
  } catch {
    return;
  }
  if (!overlayKey) return;
  const snap = plinkoQueue.snapshot(channelId);
  lastPlinkoQueueByKey.set(overlayKey, snap);
  const data = JSON.stringify(snap);
  for (const client of Array.from(sseClients)) {
    if (!client || client.key !== overlayKey) continue;
    try {
      client.res.write("event: plinko_queue\n");
      client.res.write(`data: ${data}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// Called by the queue when a drop reaches the front: animate it on the overlay,
// then credit the timer when the token lands (not when it was queued).
function playPlinkoDrop(item) {
  const {
    uid, overlayKey, boardId, payload, durationMs, secondsToAdd,
    binIndex, multiplier, dropColumn, baseSeconds,
  } = item;
  const cacheKey = boardId ? `${overlayKey}:${boardId}` : overlayKey;
  lastPlinkoDropByKey.set(cacheKey, payload);
  fanOutPlinkoDrop(overlayKey, boardId, payload);

  if (secondsToAdd > 0) {
    setTimeout(() => {
      try {
        const before = getRemainingSeconds(uid);
        const remaining = addSeconds(uid, secondsToAdd);
        const actual = Math.max(0, remaining - before);
        observability.lastTimerMutationAt = new Date().toISOString();
        addLogEntry({
          type: "plinko_drop",
          source: item.source || "manual",
          baseSeconds,
          multiplier,
          appliedSeconds: secondsToAdd,
          actualSeconds: actual,
          binIndex,
          dropColumn,
          userName:
            item.viewerName && item.viewerName !== "Streamer" ? item.viewerName : undefined,
          userId: uid,
        });
        broadcastToChannel({
          broadcasterId: uid,
          type: "timer_add",
          payload: {
            userId: uid,
            secondsAdded: actual,
            newRemaining: remaining,
            hype: state.users.get(String(uid))?.hypeActive,
          },
        }).catch(() => {});
      } catch (e) {
        logger.warn("plinko_drop_credit_failed", { userId: uid, message: e?.message });
      }
    }, durationMs);
  }
}

// Single entry point for making a drop happen — used by the manual route and by
// the sound-alert trigger. `dropColumn` finite -> that column; otherwise random.
// `test` fires animate immediately and never queue or touch the timer.
function firePlinkoDrop({
  uid,
  overlayKey,
  dropColumn,
  boardId = "",
  test = false,
  source = "manual",
  viewerName = "",
}) {
  const cfg = getPlinkoConfig(uid);
  const col = Number.isFinite(dropColumn)
    ? Math.max(0, Math.min(cfg.rows, Math.round(dropColumn)))
    : Math.floor(Math.random() * (cfg.rows + 1));
  const seed = uuidv4();
  const { path: dropPath, binIndex, multiplier, secondsToAdd } = computePlinkoDrop(cfg, {
    dropColumn: col,
    seed,
  });
  const durationMs = Math.max(2000, Math.min(12000, 1400 + cfg.rows * 420));
  const payload = {
    dropId: seed,
    boardId,
    dropColumn: col,
    rows: cfg.rows,
    bins: cfg.bins,
    token: cfg.token,
    style: cfg.style,
    path: dropPath,
    binIndex,
    multiplier,
    baseSeconds: cfg.baseSeconds,
    // Intended amount — actually credited when the token lands, so the overlay's
    // "+time" and the subathon clock move together.
    secondsAdded: test ? 0 : secondsToAdd,
    source,
    test,
    durationMs,
    triggeredAt: new Date().toISOString(),
  };

  if (test) {
    fanOutPlinkoDrop(overlayKey, boardId, payload);
    return payload;
  }

  const { accepted } = plinkoQueue.enqueue(uid, {
    uid,
    overlayKey,
    boardId,
    payload,
    durationMs,
    secondsToAdd,
    binIndex,
    multiplier,
    dropColumn: col,
    baseSeconds: cfg.baseSeconds,
    viewerName: viewerName || "Someone",
    source,
  });
  if (!accepted) {
    logger.warn("plinko_drop_rejected", { userId: uid, source, reason: "queue_full" });
  }
  return payload;
}

app.post("/api/plinko/drop", (req, res) => {
  if (!req?.session?.isAdmin)
    return res.status(401).json({ error: "Admin login required" });
  const overlayKey = normKey(
    req.body?.overlayKey || req.query.key || req.session?.userOverlayKey || ""
  );
  if (!overlayKey)
    return res.status(400).json({ error: "Overlay key is required" });
  const uid = resolveTimerUserIdFromRequest(req);
  if (!uid) return res.status(400).json({ error: "No broadcaster in session" });

  const rawColumn = Number(req.body?.dropColumn);
  const payload = firePlinkoDrop({
    uid,
    overlayKey,
    dropColumn: Number.isFinite(rawColumn) ? rawColumn : undefined,
    boardId: typeof req.body?.boardId === "string" ? req.body.boardId.trim() : "",
    test: Boolean(req.body?.test),
    source: "manual",
    viewerName: "Streamer",
  });
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
  if (req?.session?.managingAs) return String(req.session.managingAs);
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
  if (req?.session?.managingAs) return String(req.session.managingAs);
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
  const boardId = typeof req.query.boardId === "string" ? req.query.boardId.trim() : "";
  const client = { res, key, goalUserId, timerUserId, wheelId, boardId };
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

  if (timerUserId) {
    const soundSettings = getSoundSettings(String(timerUserId));
    if (soundSettings) {
      const ssPayload = { maxQueueSize: soundSettings.maxQueueSize, overlayDurationMs: soundSettings.overlayDurationMs, videoSize: soundSettings.videoSize || "medium" };
      res.write("event: sound_settings\n");
      res.write(`data: ${JSON.stringify(ssPayload)}\n\n`);
    }
  }

  const wheelCacheKey = wheelId ? `${key}:${wheelId}` : key;
  const lastWheel = lastWheelSpinByKey.get(wheelCacheKey);
  if (lastWheel) {
    res.write("event: wheel_spin\n");
    res.write(`data: ${JSON.stringify(lastWheel)}\n\n`);
  }

  const plinkoCacheKey = boardId ? `${key}:${boardId}` : key;
  const lastPlinko = lastPlinkoDropByKey.get(plinkoCacheKey);
  if (lastPlinko) {
    res.write("event: plinko_drop\n");
    res.write(`data: ${JSON.stringify(lastPlinko)}\n\n`);
  }

  // Sent last so its look wins over anything carried on a replayed drop.
  const lastPlinkoBoard = lastPlinkoBoardByKey.get(key);
  if (lastPlinkoBoard) {
    res.write("event: plinko_board\n");
    res.write(`data: ${JSON.stringify(lastPlinkoBoard)}\n\n`);
  }

  const lastPlinkoQ = lastPlinkoQueueByKey.get(key);
  if (lastPlinkoQ) {
    res.write("event: plinko_queue\n");
    res.write(`data: ${JSON.stringify(lastPlinkoQ)}\n\n`);
  }

  const lastPrompt = lastPromptByKey.get(key);
  if (lastPrompt) {
    res.write("event: prompt_show\n");
    res.write(`data: ${JSON.stringify(lastPrompt)}\n\n`);
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

      // Go-live-triggered: don't open the expensive per-broadcaster WS just
      // because someone logged into the dashboard — most logged-in
      // broadcasters aren't live at any given moment, so that WS would be
      // pure standing cost. Instead, register cheap webhook subscriptions
      // (app-token-authenticated, no connection needed) for stream.online/
      // stream.offline, and only open the WS now if they're already live.
      // handleBroadcasterWentLive (via the webhook) opens it later for free
      // whenever they actually go live.
      if (accessToken && process.env.TWITCH_CLIENT_ID) {
        ensureStreamStatusWebhookSubs(userId, { getAppAccessToken })
          .then((ids) => addEventSubWebhookSubIds(userId, ids))
          .catch((e) => logger.error("eventsub_webhook_sub_setup_failed", { userId, message: e?.message }));
        fetchLiveStreamStatus([userId])
          .then((liveMap) => {
            if (liveMap.has(String(userId))) startEventSubForUser(userId);
          })
          .catch((e) => logger.error("eventsub_login_live_check_failed", { userId, message: e?.message }));
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

  // Refresh the token if expired before opening a new session
  const freshToken = await getValidAccessToken(String(userId)).catch(() => null);
  if (freshToken && freshToken !== connection.broadcasterToken) {
    connection.broadcasterToken = freshToken;
  }
  const token = connection.broadcasterToken;

  try {
    // Start new WebSocket connection for this broadcaster
    const ws = await startEventSubWS(
      connection.broadcasterId,
      token,
      (notification) => handleEventSub(notification, userId)
    );
    connection.ws = ws;
    // Anchor for the idle-disconnect sweep below when a connection has never
    // received any event yet — without this, a freshly (re)connected,
    // still-quiet broadcaster (lastEventAt still null) would look exactly
    // like one that's been silent since a connection from days ago.
    connection.connectedAt = Date.now();
    logger.info("eventsub_started", { userId, broadcasterId: connection.broadcasterId });
  } catch (e) {
    logger.error("eventsub_start_failed", { userId, message: e?.message });

    // Retry after delay
    connection.reconnectTimer = setTimeout(() => {
      startEventSubForUser(userId);
    }, 30000);
  }
}

// Called after a rules save — channel.chat.message is only subscribed when
// chatCommand.enabled was true at connect time (see startEventSubWS), so
// toggling that setting on an already-open connection needs a reconnect to
// actually pick up (or drop) the subscription. No-op if the connection is
// already in the right state, so this is safe to call on every rules save.
function reconnectForChatCommandsIfNeeded(broadcasterId) {
  let ownerUserId = null;
  let connection = null;
  for (const [uid, conn] of broadcasterConnections) {
    if (conn.broadcasterId === String(broadcasterId)) { ownerUserId = uid; connection = conn; break; }
  }
  if (!ownerUserId || !connection) return;
  // Offline (no open WS) — nothing to reconcile now. The next real
  // stream.online reads rules fresh at connect time (eventsub-ws.js), so a
  // rules save while offline doesn't need to spuriously wake the connection.
  if (!connection.ws || connection.ws.readyState !== 1) return;

  const wantsChatMessage = Boolean(getRules(broadcasterId)?.chatCommand?.enabled);
  if (Boolean(connection.chatMessageSubscribed) === wantsChatMessage) return; // already correct

  logger.info("eventsub_reconnect_for_chat_command_toggle", { broadcasterId, wantsChatMessage });
  startEventSubForUser(ownerUserId);
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

// Closes the WS for a broadcaster who just went offline, but — unlike
// closeEventSubForUser — keeps the broadcasterConnections record (and its
// stored token reference) so the next stream.online webhook can reopen it
// cheaply, without a fresh dashboard login. Also clears any in-flight manual
// "Verify Connection" auto-pause timer, since we're pausing right now anyway.
function pauseEventSubForUser(userId) {
  const connection = broadcasterConnections.get(String(userId));
  if (!connection) return;

  if (connection.ws && typeof connection.ws.close === "function") {
    try {
      connection.ws.close();
    } catch {}
  }
  connection.ws = null;

  if (connection.reconnectTimer) {
    clearTimeout(connection.reconnectTimer);
    connection.reconnectTimer = null;
  }
  if (connection.manualTestTimer) {
    clearTimeout(connection.manualTestTimer);
    connection.manualTestTimer = null;
  }
  connection.reconnectAttempts = 0;

  logger.info("eventsub_paused_stream_offline", { userId });
}

// Webhook stream.online handler — opens the real per-broadcaster WS on
// demand. May fire for a broadcaster with no in-memory connection record yet
// (e.g. process restarted since they last logged in, but their webhook
// subscription — which lives on Twitch's side — survived) by rebuilding a
// minimal record from their stored token.
function handleBroadcasterWentLive(broadcasterId) {
  const userId = String(broadcasterId);
  if (!broadcasterConnections.has(userId)) {
    const token = getUserAccessToken(userId);
    if (!token) {
      logger.warn("eventsub_webhook_stream_online_no_token", { userId });
      return;
    }
    const profile = getUserProfile(userId);
    broadcasterConnections.set(userId, {
      broadcasterId: userId,
      broadcasterLogin: profile?.login || "unknown",
      broadcasterToken: token,
      ws: null,
      reconnectTimer: null,
      lastEventAt: null,
      lastWsMessageAt: null,
    });
  }
  const connection = broadcasterConnections.get(userId);
  // A real stream starting supersedes any manual "Verify Connection" test —
  // don't let its 10-minute auto-pause timer close a genuinely live stream.
  if (connection.manualTestTimer) {
    clearTimeout(connection.manualTestTimer);
    connection.manualTestTimer = null;
  }
  logger.info("eventsub_webhook_stream_online", { userId });
  startEventSubForUser(userId);
}

function handleBroadcasterWentOffline(broadcasterId) {
  const userId = String(broadcasterId);
  logger.info("eventsub_webhook_stream_offline", { userId });
  pauseEventSubForUser(userId);
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
  onRulesSaved: reconnectForChatCommandsIfNeeded,
  broadcasterConnections,
  startEventSubForUser,
  pauseEventSubForUser,
});

mountGoalRoutes(app, {
  requireOverlayAuth,
  resolveOverlayUserId: resolveGoalUserIdFromRequest,
  getSessionUserId: (req) => req.session?.managingAs || req.session?.twitchUser?.id,
  onGoalsChanged: (uid) => broadcastGoalSnapshot(uid),
});

// Shared by both trigger paths: a real Bits redemption (routes_sounds.js's
// notify(), passing `tier`) and a Channel Points redemption (the EventSub
// handler below, passing `channelPointsAmount` instead) — same overlay
// broadcast, same extension pubsub, same chat notification either way, just
// different wording for what the viewer actually spent.
function handleSoundAlert({ channelId, soundId, soundName, tier, txId, viewerUserId, type, clipSlug, volume, channelPointsAmount, imageFilename, popupStyle }) {
  const isTestAlert = !txId || txId.startsWith('test_');
  if (!isTestAlert) {
    logSoundEvent({ channelId, viewerUserId, soundId, soundName, alertType: type, tier, txId, clipSlug, eventKind: 'played' });
  }
  const alertId = crypto.randomUUID().slice(0, 12);
  const bitsAmount = tier ? (Number(tier.replace(/^[^_]+_/, '')) || null) : null;
  const queueItem = {
    alertId,
    type: type || 'sound',
    soundName,
    soundId,
    viewerUserId: viewerUserId || null,
    viewerDisplayName: null,
    bitsAmount,
    channelPointsAmount: channelPointsAmount || null,
    hasImage: Boolean(imageFilename),
    enqueuedAt: Date.now(),
    expiresAt: Date.now() + ALERT_QUEUE_TTL_MS,
  };
  const cq = pendingAlerts.get(String(channelId)) || [];
  cq.push(queueItem);
  pendingAlerts.set(String(channelId), cq);
  const logEntry = addLogEntry({
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
    alertId,
    soundId,
    soundName,
    channelId,
    txId,
    ts: Date.now(),
    type: type || "sound",
    clipSlug: clipSlug || "",
    volume: volume || 80,
    // Just a flag, not the filename itself — the overlay already knows its
    // own key and constructs the image URL the same way it does for audio.
    hasImage: Boolean(imageFilename),
    popupStyle: popupStyle === "large" ? "large" : "corner",
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

  // Add timer time for Bits-in-Extensions usage (same rules as cheers) —
  // skipped for test-fired alerts, which must never mutate real timer state.
  // Channel Points redemptions never reach this branch (no `tier`), matching
  // the original design intent that only Bits count toward the timer.
  if (tier && !isTestAlert) {
    const bits = Number(tier.replace("sound_", "")) || 0;
    if (bits > 0) {
      logEntry.bitsAmount = bits;
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
          logEntry.secondsAdded = secs;
          logger.info("bits_in_ext_timer_add", { userId: timerUid, bits, seconds: secs, source: "sound_alert" });
        }
      }
    }
  }

  // Post to chat (async, best-effort) — also backfill display name on the log entry
  if (viewerUserId && (tier || channelPointsAmount)) {
    const costText = tier ? `${tier.replace("sound_", "")} Bits` : `${channelPointsAmount} Channel Points`;
    (async () => {
      const displayName = await fetchUserDisplayName(viewerUserId, channelId);
      if (displayName) {
        logEntry.viewerDisplayName = displayName;
        queueItem.viewerDisplayName = displayName;
      }
      const who = displayName || viewerUserId;
      const accessToken = await getValidAccessToken(String(channelId)).catch(() => null);
      await sendBroadcasterChatMessage({
        broadcasterId: channelId,
        accessToken,
        text: `${who} played "${soundName}" for ${costText}!`,
      });
    })().catch(() => {});
  }

  // Auto-drop a Plinko token if this sound is the configured trigger. Bits and
  // Channel Points both reach here; test fires never do. The landing multiplier
  // adds baseSeconds x multiplier on top of the sound's own Bits time.
  if (!isTestAlert) {
    const pk = getPlinkoConfig(String(channelId));
    if (pk.triggerSoundId && String(soundId) === pk.triggerSoundId) {
      (async () => {
        let viewerName = "";
        if (viewerUserId) {
          viewerName =
            (await fetchUserDisplayName(viewerUserId, channelId).catch(() => "")) || "";
        }
        firePlinkoDrop({
          uid: String(channelId),
          overlayKey: normKey(getOrCreateUserKey(String(channelId))),
          source: "sound_alert",
          viewerName: viewerName || viewerUserId || "Someone",
          // dropColumn omitted -> random
        });
      })().catch(() => {});
    }
  }
}

mountSoundRoutes(app, {
  requireOverlayAuth,
  getSessionUserId: (req) => req.session?.managingAs || req.session?.twitchUser?.id,
  getUserIdForKey,
  sseClients,
  pendingAlerts,
  onRemoveAlert: ({ channelId, alertId }) => {
    const cq = pendingAlerts.get(String(channelId));
    if (cq) {
      const idx = cq.findIndex(a => a.alertId === alertId);
      if (idx !== -1) cq.splice(idx, 1);
    }
    const payload = JSON.stringify({ alertId, ts: Date.now() });
    for (const client of Array.from(sseClients)) {
      if (client.timerUserId && String(client.timerUserId) !== String(channelId)) continue;
      try {
        client.res.write("event: remove_alert\n");
        client.res.write(`data: ${payload}\n\n`);
      } catch { sseClients.delete(client); }
    }
  },
  onSoundAlert: handleSoundAlert,
  deduplicateTx: (txId) => {
    const key = `soundtx:${txId}`;
    if (state.seen.has(key)) return true;
    state.seen.set(key, Date.now() + 24 * 3600 * 1000);
    return false;
  },
});

mountTtsRoutes(app, {
  requireOverlayAuth,
  getSessionUserId: (req) => req.session?.managingAs || req.session?.twitchUser?.id,
  getUserIdForKey,
  onTtsAlert: ({ channelId, message, voiceName, voiceId, fileId, volume, txId, viewerUserId, viewerDisplayName, tier }) => {
    if (txId && !txId.startsWith('test_')) {
      logTtsEvent({ channelId, viewerUserId, voiceId, voiceName, message, tier, txId, eventKind: 'played' });
    }
    const alertId = crypto.randomUUID().slice(0, 12);
    const bitsAmount = tier ? (Number(tier.replace(/^[^_]+_/, '')) || null) : null;
    const cq = pendingAlerts.get(String(channelId)) || [];
    cq.push({
      alertId,
      type: 'tts',
      soundName: message ? message.slice(0, 60) : 'TTS',
      soundId: null,
      viewerUserId: viewerUserId || null,
      viewerDisplayName: viewerDisplayName || null,
      bitsAmount,
      enqueuedAt: Date.now(),
      expiresAt: Date.now() + ALERT_QUEUE_TTL_MS,
    });
    pendingAlerts.set(String(channelId), cq);
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
      alertId,
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
        const displayName = await fetchUserDisplayName(viewerUserId, channelId);
        const who = displayName || viewerUserId;
        const voice = voiceName ? ` (${voiceName})` : "";
        const accessToken = await getValidAccessToken(String(channelId)).catch(() => null);
        await sendBroadcasterChatMessage({
          broadcasterId: channelId,
          accessToken,
          text: `${who} used ${bits} Bits to say${voice}: "${message}"`,
        });
      })().catch(() => {});
    }
  },
  onSkipAlert: ({ channelId }) => {
    pendingAlerts.delete(String(channelId));
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
  getUserProfile,
});

mountDelegateRoutes(app, { getUserProfile });

mountLibraryModerationRoutes(app);

mountAnalyticsRoutes(app);

mountOfficialLibraryRoutes(app);

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

// ---- Chat command ----
const chatCommandCooldowns = new Map(); // broadcasterId -> lastFiredEpochMs

function fmtSecs(s) {
  const n = Number(s) || 0;
  if (n >= 3600) return (n / 3600).toFixed(1).replace(/\.0$/, "") + "h";
  if (n >= 60) return Math.round(n / 60) + "m";
  return n + "s";
}

function buildRulesSummary(rules) {
  const parts = [];
  if (rules.bits?.add_seconds > 0) {
    parts.push(`${rules.bits.per} bits=+${fmtSecs(rules.bits.add_seconds)}`);
  }
  if (rules.sub) {
    if (rules.sub["1000"] > 0) parts.push(`T1 Sub +${fmtSecs(rules.sub["1000"])}`);
    if (rules.sub["2000"] > 0) parts.push(`T2 Sub +${fmtSecs(rules.sub["2000"])}`);
    if (rules.sub["3000"] > 0) parts.push(`T3 Sub +${fmtSecs(rules.sub["3000"])}`);
  }
  if (rules.resub?.base_seconds > 0) {
    parts.push(`Resub +${fmtSecs(rules.resub.base_seconds)}`);
  }
  if (rules.gift_sub) {
    if (rules.gift_sub.matchSubTiers) {
      parts.push("Gift subs match sub tiers");
    } else {
      if (rules.gift_sub["1000"] > 0) parts.push(`T1 Gift +${fmtSecs(rules.gift_sub["1000"])}`);
      if (rules.gift_sub["2000"] > 0) parts.push(`T2 Gift +${fmtSecs(rules.gift_sub["2000"])}`);
      if (rules.gift_sub["3000"] > 0) parts.push(`T3 Gift +${fmtSecs(rules.gift_sub["3000"])}`);
    }
  }
  if (rules.charity?.per_usd > 0) {
    parts.push(`$1 charity=+${fmtSecs(rules.charity.per_usd)}`);
  }
  if (rules.thirdPartyTip?.per_unit > 0) {
    const min = rules.thirdPartyTip.min_amount > 0 ? `$${rules.thirdPartyTip.min_amount}+` : "$1+";
    parts.push(`Tips ${min}=+${fmtSecs(rules.thirdPartyTip.per_unit)}`);
  }
  if (rules.follow?.enabled && rules.follow?.add_seconds > 0) {
    parts.push(`Follow +${fmtSecs(rules.follow.add_seconds)}`);
  }
  if (rules.raid?.enabled) {
    const raidBits = [];
    if (rules.raid.base_seconds > 0) raidBits.push(`+${fmtSecs(rules.raid.base_seconds)}`);
    if (rules.raid.perViewerEnabled && rules.raid.perViewerSeconds > 0) raidBits.push(`+${fmtSecs(rules.raid.perViewerSeconds)}/raider`);
    if (raidBits.length) parts.push(`Raid ${raidBits.join(" ")}`);
  }
  const text = "Timer Rules: " + (parts.length ? parts.join(" | ") : "No rules configured");
  return text.slice(0, 500);
}

function applyCustomMessage(template, rules) {
  const r = rules;
  const vars = {
    bits_per:    String(r.bits?.per ?? 100),
    bits_add:    fmtSecs(r.bits?.add_seconds ?? 0),
    t1_sub:      fmtSecs(r.sub?.["1000"] ?? 0),
    t2_sub:      fmtSecs(r.sub?.["2000"] ?? 0),
    t3_sub:      fmtSecs(r.sub?.["3000"] ?? 0),
    resub:       fmtSecs(r.resub?.base_seconds ?? 0),
    t1_gift:     fmtSecs(r.gift_sub?.["1000"] ?? 0),
    t2_gift:     fmtSecs(r.gift_sub?.["2000"] ?? 0),
    t3_gift:     fmtSecs(r.gift_sub?.["3000"] ?? 0),
    charity_per: fmtSecs(r.charity?.per_usd ?? 0),
    tip_per:     fmtSecs(r.thirdPartyTip?.per_unit ?? 0),
    tip_min:     String(r.thirdPartyTip?.min_amount ?? 1),
    follow:      fmtSecs(r.follow?.add_seconds ?? 0),
    raid:        fmtSecs(r.raid?.base_seconds ?? 0),
    raid_per_viewer: fmtSecs(r.raid?.perViewerEnabled ? (r.raid?.perViewerSeconds ?? 0) : 0),
    raid_min:    String(r.raid?.min_viewers ?? 1),
    hype_mult:   String(r.hypeTrain?.multiplier ?? 1),
  };
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match).slice(0, 500);
}

async function handleChatCommand(event, broadcasterId) {
  const text = (event.message?.text || "").trim();
  if (!text.startsWith("!")) return;

  const rules = getRules(broadcasterId);
  const cmd = rules.chatCommand;
  if (!cmd?.enabled || !cmd?.command) {
    logger.info("chat_command_disabled", { broadcasterId, text, enabled: cmd?.enabled, command: cmd?.command });
    return;
  }

  const expectedCommand = ("!" + cmd.command).toLowerCase();
  const msgLower = text.toLowerCase();
  if (msgLower !== expectedCommand && !msgLower.startsWith(expectedCommand + " ")) {
    logger.info("chat_command_no_match", { broadcasterId, text, expectedCommand });
    return;
  }

  const cooldownMs = Math.max(0, Number(cmd.cooldownSeconds) || 30) * 1000;
  const now = Date.now();
  const lastAt = chatCommandCooldowns.get(broadcasterId) || 0;
  if (cooldownMs > 0 && now - lastAt < cooldownMs) {
    logger.info("chat_command_cooldown", { broadcasterId, remainingMs: cooldownMs - (now - lastAt) });
    return;
  }
  chatCommandCooldowns.set(broadcasterId, now);

  const message = cmd.customMessage?.trim()
    ? applyCustomMessage(cmd.customMessage, rules)
    : buildRulesSummary(rules);
  logger.info("chat_command_firing", { broadcasterId, command: cmd.command, messageLength: message.length });
  const accessToken = await getValidAccessToken(broadcasterId).catch(() => null);
  sendBroadcasterChatMessage({ broadcasterId, accessToken, text: message }).catch((err) => {
    logger.error("chat_command_send_failed", { broadcasterId, message: err?.message });
  });
}

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
    case "channel.raid": {
      if (!RULES.raid?.enabled) return 0;
      const viewers = Number(e.viewers) || 0;
      const minViewers = Math.max(1, Number(RULES.raid.min_viewers || 1));
      if (viewers < minViewers) return 0;
      let total = Math.max(0, Number(RULES.raid.base_seconds || 0));
      if (RULES.raid.perViewerEnabled) {
        total += viewers * Math.max(0, Number(RULES.raid.perViewerSeconds || 0));
      }
      return Math.floor(total);
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
  // channel.raid subscribes with to_broadcaster_user_id (we only ever
  // subscribe for raids landing on us), not broadcaster_user_id like every
  // other event type here.
  const broadcasterId =
    notification?.payload?.subscription?.condition?.broadcaster_user_id ||
    notification?.payload?.subscription?.condition?.to_broadcaster_user_id;

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

  // ---- Sub dedup ----
  // Twitch fires BOTH channel.subscribe and channel.subscription.message for
  // many resubs (especially Prime, which viewers re-up manually each month),
  // and occasionally re-delivers channel.subscribe on a WS reconnect. Count
  // each subscription once per subscriber — the first of the pair to arrive
  // wins, the rest are dropped. See sub_dedup.js.
  //
  // Note: a resub often arrives channel.subscribe-first (message seconds to
  // minutes later — too far apart to reliably wait for), so it's credited at
  // the sub rate / "sub" goal segment rather than resub. Harmless when resub
  // time == sub time (the common subathon setup); revisit if a streamer needs
  // them weighted differently.
  if (subType === "channel.subscribe" || subType === "channel.subscription.message") {
    const { deduped } = subDedup.evaluate({
      broadcaster: timerUid,
      userId: e.user_id || e.user_login || "",
      subType,
      isGift: Boolean(e.is_gift || e.was_gift),
      now,
    });
    if (deduped) {
      addLogEntry({
        type: "sub_deduped",
        subType,
        userId: timerUid,
        userName: e.user_name || e.user_login || e.user_id || undefined,
        subTier: e.tier,
        baseSeconds: 0,
        appliedSeconds: 0,
        actualSeconds: 0,
      });
      logger.info("sub_deduped", {
        broadcasterId: timerUid,
        userId: e.user_id || e.user_login,
        subType,
      });
      return;
    }
  }

  if (subType === "channel.chat.message") {
    await handleChatCommand(e, timerUid);
    return;
  }

  // Channel Points redemptions never touch the timer — they're a separate,
  // free-to-viewers trigger for sound alerts only (see handleSoundAlert).
  if (subType === "channel.channel_points_custom_reward_redemption.add") {
    const rewardId = e.reward?.id;
    const sound = rewardId ? getSoundByChannelPointsRewardId(timerUid, rewardId) : null;
    if (sound) {
      handleSoundAlert({
        channelId: timerUid,
        soundId: sound.id,
        soundName: sound.name,
        txId: e.id,
        viewerUserId: e.user_id,
        type: sound.type || "sound",
        clipSlug: sound.clipSlug || "",
        volume: sound.volume || 80,
        channelPointsAmount: e.reward?.cost || sound.channelPointsCost,
        imageFilename: sound.imageFilename || "",
        popupStyle: sound.popupStyle || "corner",
      });
    }
    return;
  }

  processEventTimer(notification, timerUid, id, now);
}

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
      raidViewers: e.viewers,
      userId: timerUid,
      userName: e.is_anonymous
        ? "Anonymous"
        : (e.user_name || e.user_login || e.from_broadcaster_user_name || e.from_broadcaster_user_login || undefined),
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

  return appliedSeconds;
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

  // channel.chat.message fires for every chat message in the channel — only
  // worth subscribing to on channels that actually have chat commands
  // enabled. Recorded on the connection so a later rules change can tell
  // whether this connection needs a reconnect to pick up a newly-enabled
  // command (see reconnectForChatCommandsIfNeeded below).
  const wantsChatMessage = Boolean(getRules(broadcasterId)?.chatCommand?.enabled);
  if (ownerConn) ownerConn.chatMessageSubscribed = wantsChatMessage;

  // Capture ws identity so the 'closed' handler can tell whether this
  // particular socket has already been replaced by a newer startEventSubForUser
  // call. Checking readyState===1 (OPEN) was racy: the new WS could still be
  // CONNECTING (readyState=0) when the old one fires 'close', causing a
  // spurious reconnect that then kills the newly-connected WS in a tight loop.
  let thisWs = null;
  const wsPromise = connectEventSubWS({
    userAccessToken: accessToken,
    clientId,
    broadcasterId,
    wantsChatMessage,
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
          if (ownerConn) {
            ownerConn.lastWsMessageAt = Date.now();
            ownerConn.reconnectAttempts = 0;
          }
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
          if (ownerConn && status.message?.includes("429")) {
            ownerConn.lastRateLimitedAt = Date.now();
          }
          break;
        case "closed": {
          observability.lastEventSubErrorAt = nowIso;
          observability.lastEventSubErrorMessage = "socket_closed";
          logger.warn("eventsub_socket_closed", { broadcasterId, code: status.code });

          // AUTO-RECONNECT: Schedule reconnection with exponential backoff.
          // Skip if conn.ws has already been replaced by a newer socket — identity
          // check is reliable even when the replacement is still CONNECTING (readyState=0).
          if (ownerUserId) {
            const conn = broadcasterConnections.get(ownerUserId);
            const alreadyReplaced = thisWs !== null && conn?.ws !== thisWs;
            if (conn && !conn.reconnectTimer && !alreadyReplaced) {
              conn.reconnectAttempts = (conn.reconnectAttempts || 0) + 1;
              const wasRateLimited = conn.lastRateLimitedAt && (Date.now() - conn.lastRateLimitedAt < 15000);
              let delay;
              if (wasRateLimited) {
                // 429: back off hard — 60-120s with jitter
                delay = 60000 + Math.random() * 60000;
              } else {
                // Exponential backoff: 5s → 10s → 20s → 40s → 80s, cap 120s
                const base = Math.min(120000, 5000 * Math.pow(2, conn.reconnectAttempts - 1));
                delay = base + Math.random() * Math.min(base, 10000);
              }
              logger.info("eventsub_scheduling_reconnect", { userId: ownerUserId, delayMs: Math.round(delay), attempt: conn.reconnectAttempts, wasRateLimited: Boolean(wasRateLimited) });
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
  wsPromise.then(ws => { thisWs = ws; });
  return wsPromise;
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

// Idle-disconnect sweep: now a BACKSTOP, not the primary offline-cleanup
// path — under go-live-triggered EventSub, a broadcaster's WS is expected to
// close within seconds of the real stream.offline webhook firing
// (handleBroadcasterWentOffline). This sweep only matters when that webhook
// gets missed or fails delivery (network blip, Twitch-side issue) and a
// connection is left open with no activity. Uses pauseEventSubForUser (not
// closeEventSubForUser) — the connection record and stored token reference
// are kept so a future stream.online webhook (or the next login) can reopen
// it cheaply, rather than fully tearing down as if they'd logged out.
// 12h (not a much shorter window) specifically to tolerate long
// boosted/subathon streams that can run overnight with little to no bits/
// subs/points/follow/chat activity — a genuinely live-but-quiet broadcaster
// must not get force-paused mid-stream.
const IDLE_DISCONNECT_SWEEP_INTERVAL_MS = 30 * 60 * 1000; // every 30 min
const IDLE_DISCONNECT_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12h of silence
setInterval(() => {
  const now = Date.now();
  for (const [userId, conn] of broadcasterConnections) {
    if (userId === ENV_BROADCASTER_ID) continue; // always-on, not tied to a real login
    if (!conn.ws || conn.ws.readyState !== 1) continue; // already offline — nothing to sweep
    const lastActivity = conn.lastEventAt ? new Date(conn.lastEventAt).getTime() : conn.connectedAt;
    if (!lastActivity) continue; // still connecting, hasn't had a chance yet
    const idleMs = now - lastActivity;
    if (idleMs > IDLE_DISCONNECT_THRESHOLD_MS) {
      logger.warn("eventsub_idle_disconnect_backstop", { userId, idleMs });
      pauseEventSubForUser(userId);
    }
  }
}, IDLE_DISCONNECT_SWEEP_INTERVAL_MS);

// Server tick → broadcast remaining once per second per user/key
//
// tickInProgress guards against overlapping runs: this callback awaits a real
// network call (broadcastToChannel, Twitch's PubSub API) once per active
// broadcaster. setInterval fires on a fixed wall-clock schedule regardless of
// whether the previous invocation's promise has resolved — with enough
// broadcasters, a single pass can take longer than 1s, and without this guard
// each new tick starts on top of the last, piling up concurrent in-flight
// requests without bound as the broadcaster count grows. That pileup was
// found live in production: 29 registered broadcasters keep an always-on
// EventSub connection (idle-disconnect only fires after 48h of total
// inactivity, not stream-offline), each sequential broadcastToChannel call
// costs a real Twitch round-trip, and the resulting CPU/event-loop pressure
// was severe enough to fail Fly's own health check and drop traffic at the
// edge — surfacing to users as CORS-looking "access control checks" errors.
let tickInProgress = false;
setInterval(async () => {
  if (tickInProgress) return;
  tickInProgress = true;
  try {
  // Check bonus time schedules for all users
  for (const uid of state.users.keys()) {
    checkBonusSchedule(uid);
  }

  // Broadcast to Twitch Extension PubSub for ALL active broadcasters, in
  // parallel — sequential awaits here don't scale with broadcaster count.
  await Promise.allSettled(
    Array.from(broadcasterConnections.keys()).map(async (userId) => {
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
    }),
  );

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
  } finally {
    tickInProgress = false;
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
// Go-live-triggered: batch-check who's actually live BEFORE opening any WS,
// rather than unconditionally reopening one per token holder — on a restart
// with dozens of registered broadcasters, most aren't live at that moment,
// so this is where a full restart used to pay for every connection at once.
// Everyone still gets their webhook subs re-registered (idempotent — 409s if
// still active from before the restart, since those live on Twitch's side
// and outlive our process) so they're ready to receive the go-live webhook
// regardless of whether we open their WS immediately.
setTimeout(async () => {
  const tokenUserIds = getAllTokenUserIds().filter(
    (uid) => uid !== ENV_BROADCASTER_ID && !isBanned(uid) && !broadcasterConnections.has(uid)
  );
  if (tokenUserIds.length === 0) return;

  let liveMap = new Map();
  try {
    liveMap = await fetchLiveStreamStatus(tokenUserIds);
  } catch (e) {
    logger.error("boot_live_check_failed", { message: e?.message });
  }

  for (const uid of tokenUserIds) {
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

    ensureStreamStatusWebhookSubs(uid, { getAppAccessToken })
      .then((ids) => addEventSubWebhookSubIds(uid, ids))
      .catch((e) => logger.error("eventsub_webhook_sub_setup_failed", { userId: uid, message: e?.message }));

    if (liveMap.has(String(uid))) {
      startEventSubForUser(uid);
      logger.info("eventsub_restored_live_on_boot", { userId: uid, login: profile?.login });
    } else {
      logger.info("eventsub_webhook_registered_offline_on_boot", { userId: uid, login: profile?.login });
    }

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

// Must be registered after all routes so Sentry can capture Express errors
Sentry.setupExpressErrorHandler(app);

// Final fallback: any error not already handled by a route (including ones
// thrown by middleware, like a session store hiccup) lands here instead of
// Express's default handler, which leaks stack traces/file paths to the
// client whenever NODE_ENV isn't "production".
app.use((err, req, res, _next) => {
  logger.error("unhandled_request_error", {
    requestId: req.requestId,
    path: req.path,
    message: err?.message,
  });
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`EBS listening on :${port} (boot ${SERVER_BOOT_ID})`));
