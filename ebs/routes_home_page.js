import { renderHomePage } from "./views/homePage.js";

export function mountHomePageRoutes(app) {
  app.get("/", (req, res) => {
    const base =
      process.env.SERVER_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const user = req.session?.twitchUser;
    const adminName =
      user?.display_name || user?.login || "your Twitch account";
    const userKey =
      req.session?.userOverlayKey || req.session?.twitchUser?.id || "";
    const overlayUrl = `${base}/overlay${
      userKey ? `?key=${encodeURIComponent(userKey)}` : ""
    }`;

    const html = renderHomePage({
      base,
      overlayUrl,
      isAdmin: Boolean(req.session?.isAdmin),
      adminName,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  });
}
