import { renderOverlayPage } from "./views/overlayPage.js";
import { renderOverlayConfigPage } from "./views/overlayConfigPage.js";
import { renderGoalsConfigPage } from "./views/goalsConfigPage.js";
import { renderGoalsOverlayPage } from "./views/goalsOverlayPage.js";
import { renderWheelOverlayPage } from "./views/wheelOverlayPage.js";
import { renderSoundAlertOverlayPage } from "./views/soundAlertOverlayPage.js";
import { renderSoundConfigPage } from "./views/soundConfigPage.js";
import { isSuperAdmin } from "./routes_admin.js";
import { isDelegate, getDelegatableChannels } from "./delegate_store.js";
import { fetchUserDisplayName } from "./twitch_api.js";

// Helper: resolve the effective channel ID for a logged-in session,
// honouring delegate context (managingAs) when set and valid.
function effectiveUid(req) {
  return req.session?.managingAs || req.session?.twitchUser?.id;
}

export function mountOverlayPageRoutes(app, deps) {
  const { requireOverlayAuth, requireAdmin, getUserSettings, getRules, getSavedStyle, getUserProfile } =
    deps;

  app.get("/overlay", (req, res) => {
    if (!requireOverlayAuth(req, res)) return;

    const html = renderOverlayPage({ query: req.query || {} });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.send(html);
  });

  const renderGoalRoute = (req, res) => {
    if (!requireOverlayAuth(req, res)) return;
    const html = renderGoalsOverlayPage({ query: req.query || {} });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.send(html);
  };

  app.get("/overlay/goal", renderGoalRoute);
  app.get("/overlay/goals", renderGoalRoute);

  app.get("/overlay/wheel", (req, res) => {
    if (!requireOverlayAuth(req, res)) return;
    const html = renderWheelOverlayPage();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.send(html);
  });

  app.get("/overlay/sounds", (req, res) => {
    if (!requireOverlayAuth(req, res)) return;
    const html = renderSoundAlertOverlayPage();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.send(html);
  });

  // ── Delegate management pages ──────────────────────────────────────────────

  // Landing page: list channels this user can manage
  app.get("/manage", requireAdmin, async (req, res) => {
    const selfId = String(req.session.twitchUser.id);
    const selfName = req.session.twitchUser.display_name || req.session.twitchUser.login || selfId;
    let rows = [];
    try { rows = await getDelegatableChannels(selfId); } catch {}
    const channels = await Promise.all(rows.map(async (r) => {
      const profile = getUserProfile ? getUserProfile(r.channel_id) : null;
      const displayName =
        profile?.displayName || profile?.login ||
        await fetchUserDisplayName(r.channel_id, r.channel_id).catch(() => null) ||
        r.channel_id;
      return { channelId: r.channel_id, displayName };
    }));
    const managingAs = req.session.managingAs;
    const managingAsName = req.session.managingAsName;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Manage Channels</title>
<style>body{font-family:system-ui,sans-serif;background:#0e0e10;color:#efeff1;max-width:600px;margin:60px auto;padding:20px}
h1{font-size:22px;margin-bottom:6px}p{color:#adadb8;font-size:14px;margin-bottom:24px}
.card{background:#18181b;border:1px solid #303038;border-radius:12px;padding:16px 20px;margin-bottom:12px;display:flex;align-items:center;gap:14px}
.card-name{font-weight:700;font-size:15px;flex:1}.card-id{font-size:11px;color:#adadb8;font-family:monospace}
.btn{padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;text-decoration:none;display:inline-block}
.btn-primary{background:#9146ff;color:#fff}.btn-secondary{background:transparent;border:1px solid #adadb8;color:#efeff1}
.banner{background:#f59e0b22;border:2px solid #f59e0b;border-radius:10px;padding:10px 16px;margin-bottom:20px;font-size:13px}
a{color:#9146ff}</style></head><body>
<h1>Channel Management</h1>
<p>Select a channel to manage, or manage your own settings.</p>
${managingAs ? `<div class="banner">⚠️ Currently managing <strong>${managingAsName || managingAs}</strong>'s settings.</div>` : ''}
<div class="card">
  <div><div class="card-name">${selfName} <span style="font-size:11px;background:#9146ff33;color:#bf94ff;padding:2px 7px;border-radius:4px;font-weight:600">You</span></div>
  <div class="card-id">${selfId}</div></div>
  <a href="/sounds/config?clearDelegate=1" class="btn btn-primary">Manage My Channel</a>
</div>
${channels.map(c => `<div class="card">
  <div><div class="card-name">${c.displayName}</div><div class="card-id">${c.channelId}</div></div>
  <a href="/manage/${encodeURIComponent(c.channelId)}" class="btn btn-secondary">Manage</a>
</div>`).join('')}
${channels.length === 0 ? '<p style="color:#adadb8;font-size:13px;">No one has added you as a delegate yet. Ask a streamer to add your Twitch username in their Sound Alerts settings.</p>' : ''}
</body></html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  // Switch to managing a specific channel (sets session, redirects to sounds/config)
  app.get("/manage/:channelId", requireAdmin, async (req, res) => {
    const selfId = String(req.session.twitchUser.id);
    const target = String(req.params.channelId);
    if (target === selfId) {
      req.session.managingAs = null;
      req.session.managingAsName = null;
      return res.redirect("/sounds/config");
    }
    try {
      const ok = await isDelegate(target, selfId);
      if (!ok) return res.status(403).send("You are not a delegate for this channel.");
      const profile = getUserProfile ? getUserProfile(target) : null;
      const displayName =
        profile?.displayName || profile?.login ||
        await fetchUserDisplayName(target, target).catch(() => null) ||
        target;
      req.session.managingAs = target;
      req.session.managingAsName = displayName;
      res.redirect("/sounds/config");
    } catch (err) {
      res.status(500).send("Error: " + (err?.message || "unknown"));
    }
  });

  // ── Config pages ────────────────────────────────────────────────────────────

  app.get("/sounds/config", requireAdmin, (req, res) => {
    // ?clearDelegate=1 exits delegate mode
    if (req.query.clearDelegate) {
      req.session.managingAs = null;
      req.session.managingAsName = null;
    }
    const uid = effectiveUid(req);
    const isManagingOther = req.session?.managingAs && req.session.managingAs !== req.session.twitchUser?.id;
    const adminName = String(
      req.session?.twitchUser?.display_name ||
        req.session?.twitchUser?.login ||
        "Admin"
    );
    const userKey = String(req.session?.userOverlayKey || uid || "");
    const superAdmin = isSuperAdmin(req);
    const html = renderSoundConfigPage({
      base: "",
      adminName,
      userKey,
      showAdminLink: superAdmin,
      isSuperAdmin: superAdmin,
      delegateMode: isManagingOther,
      managedByName: isManagingOther ? (req.session.managingAsName || req.session.managingAs) : null,
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  app.get("/goals/config", requireAdmin, (req, res) => {
    const uid = effectiveUid(req);
    const isManagingOther = req.session?.managingAs && req.session.managingAs !== req.session.twitchUser?.id;
    const adminName = String(
      req.session?.twitchUser?.display_name ||
        req.session?.twitchUser?.login ||
        "Admin"
    );
    const userKey = String(req.session?.userOverlayKey || uid || "");
    const settings = getUserSettings(uid);
    const html = renderGoalsConfigPage({
      base: "",
      adminName,
      userKey,
      settings,
      showAdminLink: isSuperAdmin(req),
      delegateMode: isManagingOther,
      managedByName: isManagingOther ? (req.session.managingAsName || req.session.managingAs) : null,
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  app.get("/overlay/config", requireAdmin, (req, res) => {
    const uid = effectiveUid(req);
    const isManagingOther = req.session?.managingAs && req.session.managingAs !== req.session.twitchUser?.id;
    const adminName = String(
      req.session?.twitchUser?.display_name ||
        req.session?.twitchUser?.login ||
        "Admin"
    );
    const userKey = String(req.session?.userOverlayKey || uid || "");
    const settings = getUserSettings(uid);
    const rulesSnapshot = getRules(uid);
    const savedStyle = getSavedStyle ? getSavedStyle(userKey) : {};
    const initialQuery = Object.assign({}, savedStyle, req.query || {});
    const html = renderOverlayConfigPage({
      base: "",
      adminName,
      userKey,
      settings,
      rulesSnapshot,
      initialQuery,
      showAdminLink: isSuperAdmin(req),
      delegateMode: isManagingOther,
      managedByName: isManagingOther ? (req.session.managingAsName || req.session.managingAs) : null,
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });
}
