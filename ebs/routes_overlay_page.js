import { renderOverlayPage } from "./views/overlayPage.js";
import { renderOverlayConfigPage } from "./views/overlayConfigPage.js";
import { renderGoalsOverlayPage } from "./views/goalsOverlayPage.js";
import { renderWheelOverlayPage } from "./views/wheelOverlayPage.js";
import { renderSoundAlertOverlayPage } from "./views/soundAlertOverlayPage.js";

export function mountOverlayPageRoutes(app, deps) {
  const { requireOverlayAuth, requireAdmin, getUserSettings, getRules } =
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

  app.get("/overlay/config", requireAdmin, (req, res) => {
    const base =
      process.env.SERVER_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const adminName = String(
      req.session?.twitchUser?.display_name ||
        req.session?.twitchUser?.login ||
        "Admin"
    );
    const userKey = String(
      req.session?.userOverlayKey || req.session?.twitchUser?.id || ""
    );
    const settings = getUserSettings(req.session?.twitchUser?.id);
    const rulesSnapshot = getRules(req.session?.twitchUser?.id);

    const html = renderOverlayConfigPage({
      base,
      adminName,
      userKey,
      settings,
      rulesSnapshot,
      initialQuery: req.query || {},
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });
}
