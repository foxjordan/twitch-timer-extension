import { renderOverlayPage } from "./views/overlayPage.js";
import { renderOverlayConfigPage } from "./views/overlayConfigPage.js";

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
