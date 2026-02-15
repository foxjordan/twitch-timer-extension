import { renderAdminDashboardPage } from "./views/adminDashboardPage.js";

const SUPER_ADMIN_IDS = (process.env.SUPER_ADMIN_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isSuperAdmin(req) {
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
    listGoals,
    getSavedStyle,
    DEFAULT_STYLE,
    observability,
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

      // Sounds
      let soundCount = 0;
      let soundsEnabled = false;
      try {
        const sounds = listSounds(uid);
        soundCount = sounds.length;
        const soundSettings = getSoundSettings(uid);
        soundsEnabled = soundSettings.enabled && soundCount > 0;
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

      return {
        userId: uid,
        login: conn?.broadcasterLogin || null,
        displayName: conn?.broadcasterLogin || null,
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
        goalCount,
        hasCustomStyle,
        defaultInitialSeconds: settings.defaultInitialSeconds || null,
      };
    });

    res.json({
      totalRegistered: registeredIds.length,
      totalConnected: activeBroadcasters.filter((uid) => {
        const conn = getBroadcasterConnection(uid);
        return conn?.ws?.readyState === 1;
      }).length,
      activeSseClients: sseClients.size,
      totalSseServed: observability.totalSseClientsServed || 0,
      users,
    });
  });
}
