import { renderAdminDashboardPage } from "./views/adminDashboardPage.js";
import { getBan, banUser, unbanUser } from "./bans.js";
import { getSubscription, isPro } from "./subscription_store.js";
import { getTtsSettings, setTtsSettings, getGlobalTtsConfig, setGlobalTtsConfig } from "./tts_store.js";
import { getVoices } from "./tts_voices.js";
import { VALID_TIERS, TIER_LABELS, TIER_COSTS } from "./tiers.js";

const SUPER_ADMIN_IDS = (process.env.SUPER_ADMIN_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function isSuperAdmin(req) {
  if (!req.session?.isAdmin || !req.session?.twitchUser?.id) return false;
  if (SUPER_ADMIN_IDS.length === 0) return false;
  return SUPER_ADMIN_IDS.includes(String(req.session.twitchUser.id));
}

export function mountAdminRoutes(app, ctx) {
  const {
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
    onUserBanned,
    getUserProfile,
  } = ctx;

  app.get("/admin", (req, res) => {
    if (!req.session?.isAdmin) {
      return res.redirect(`/auth/login?next=${encodeURIComponent("/admin")}`);
    }
    if (!isSuperAdmin(req)) {
      return res.status(403).send("Access denied");
    }

    const adminName =
      req.session?.twitchUser?.display_name ||
      req.session?.twitchUser?.login ||
      "Admin";

    const html = renderAdminDashboardPage({ base: "", adminName });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  });

  app.get("/api/admin/stats", (req, res) => {
    if (!req.session?.isAdmin || !isSuperAdmin(req)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const registeredIds = getAllUserIds();
    const activeBroadcasters = getAllActiveBroadcasters();

    const users = registeredIds.map((uid) => {
      const conn = getBroadcasterConnection(uid);
      const totals = getTotals(uid);
      const remaining = getRemainingSeconds(uid);
      const cap = capReached(uid);
      const settings = getUserSettings(uid);
      const ban = getBan(uid);

      // Sounds
      let soundCount = 0;
      let soundsEnabled = false;
      let videoClipsEnabled = false;
      try {
        const sounds = listSounds(uid);
        soundCount = sounds.length;
        const soundSettings = getSoundSettings(uid);
        soundsEnabled = soundSettings.enabled && soundCount > 0;
        videoClipsEnabled = soundSettings.videoClipsEnabled || false;
      } catch {}

      // TTS
      let ttsEnabled = false;
      try {
        ttsEnabled = getTtsSettings(uid).enabled || false;
      } catch {}

      // Goals
      let goalCount = 0;
      try {
        const goals = listGoals(uid);
        goalCount = goals.length;
      } catch {}

      // Custom style
      let hasCustomStyle = false;
      try {
        const style = getSavedStyle(uid);
        hasCustomStyle = style !== DEFAULT_STYLE;
      } catch {}

      // Subscription
      const subscription = getSubscription(uid);

      const profile = getUserProfile ? getUserProfile(uid) : null;
      return {
        userId: uid,
        login: conn?.broadcasterLogin || profile?.login || null,
        displayName: conn?.broadcasterLogin || profile?.displayName || profile?.login || null,
        connected: conn?.ws?.readyState === 1,
        lastEventAt: conn?.lastEventAt || null,
        remaining: remaining > 0 ? remaining : null,
        timerPaused: totals.paused || false,
        additionsTotal: totals.additionsTotal || 0,
        initialSeconds: totals.initialSeconds || 0,
        maxTotalSeconds: totals.maxTotalSeconds || 0,
        capReached: cap,
        soundCount,
        soundsEnabled,
        videoClipsEnabled,
        ttsEnabled,
        goalCount,
        hasCustomStyle,
        defaultInitialSeconds: settings.defaultInitialSeconds || null,
        banned: !!ban,
        bannedAt: ban?.bannedAt || null,
        banReason: ban?.reason || null,
        subscriptionStatus: subscription?.status || null,
        stripeCustomerId: subscription?.stripeCustomerId || null,
        isPro: isPro(uid),
      };
    });

    const mem = process.memoryUsage();

    res.json({
      totalRegistered: registeredIds.length,
      totalConnected: activeBroadcasters.filter((uid) => {
        const conn = getBroadcasterConnection(uid);
        return conn?.ws?.readyState === 1;
      }).length,
      activeSseClients: sseClients.size,
      totalSseServed: observability.totalSseClientsServed || 0,
      server: {
        uptimeSeconds: Math.floor(process.uptime()),
        memoryMB: Math.round(mem.rss / 1024 / 1024),
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        lastEventSubEvent: observability.lastEventSubEventAt,
        lastEventSubType: observability.lastEventSubType,
        lastEventSubKeepalive: observability.lastEventSubKeepaliveAt,
        lastEventSubConnected: observability.lastEventSubConnectedAt,
        lastEventSubError: observability.lastEventSubErrorAt,
        lastEventSubErrorMessage: observability.lastEventSubErrorMessage,
        totalEventSubReconnects: observability.totalEventSubReconnects,
        lastTimerMutation: observability.lastTimerMutationAt,
        lastBroadcastError: observability.lastBroadcastErrorAt,
      },
      users,
    });
  });

  // Ban a user
  app.post("/api/admin/ban", (req, res) => {
    if (!req.session?.isAdmin || !isSuperAdmin(req)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const { userId, reason } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });

    const uid = String(userId);

    // Don't allow banning yourself
    if (SUPER_ADMIN_IDS.includes(uid)) {
      return res.status(400).json({ error: "Cannot ban a super admin" });
    }

    banUser(uid, reason || "");

    // Disconnect their EventSub and close SSE connections
    if (typeof onUserBanned === "function") {
      try { onUserBanned(uid); } catch {}
    }

    res.json({ ok: true, userId: uid, banned: true });
  });

  // Unban a user
  app.post("/api/admin/unban", (req, res) => {
    if (!req.session?.isAdmin || !isSuperAdmin(req)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });

    const uid = String(userId);
    const existed = unbanUser(uid);

    res.json({ ok: true, userId: uid, wasBanned: existed });
  });

  // Toggle video/clips feature for a user
  app.post("/api/admin/toggle-video-clips", (req, res) => {
    if (!req.session?.isAdmin || !isSuperAdmin(req)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const { userId, enabled } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });

    const uid = String(userId);
    setSoundSettings(uid, { videoClipsEnabled: Boolean(enabled) });

    res.json({ ok: true, userId: uid, videoClipsEnabled: Boolean(enabled) });
  });

  // Toggle TTS feature for a user
  app.post("/api/admin/toggle-tts", (req, res) => {
    if (!req.session?.isAdmin || !isSuperAdmin(req)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const { userId, enabled } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });

    const uid = String(userId);
    setTtsSettings(uid, { enabled: Boolean(enabled) });

    res.json({ ok: true, userId: uid, ttsEnabled: Boolean(enabled) });
  });

  // Get global TTS admin config
  app.get("/api/admin/tts-config", (req, res) => {
    if (!req.session?.isAdmin || !isSuperAdmin(req)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const config = getGlobalTtsConfig();
    const allVoices = getVoices();
    const tiers = VALID_TIERS.map((sku) => ({ sku, label: TIER_LABELS[sku], cost: TIER_COSTS[sku] }));
    res.json({ config, allVoices, tiers });
  });

  // Update global TTS admin config
  app.post("/api/admin/tts-config", (req, res) => {
    if (!req.session?.isAdmin || !isSuperAdmin(req)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const updated = setGlobalTtsConfig(req.body || {});
    res.json({ ok: true, config: updated });
  });
}
