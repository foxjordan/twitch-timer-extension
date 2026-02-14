import { renderHomePage } from "./views/homePage.js";
import { renderPrivacyPage } from "./views/privacyPage.js";
import { renderGdprPage } from "./views/gdprPage.js";
import { renderUtilitiesPage } from "./views/utilitiesPage.js";
import { getBaseUrl } from "./base_url.js";

export function mountHomePageRoutes(app) {
  const baseUrl = (req) => getBaseUrl(req);
  const contactEmail =
    process.env.CONTACT_EMAIL || process.env.SUPPORT_EMAIL || "help@darkfoxdev.com";

  app.get("/", (req, res) => {
    const base = baseUrl(req);
    const user = req.session?.twitchUser;
    const adminName =
      user?.display_name || user?.login || "your Twitch account";
    const userKey =
      req.session?.userOverlayKey || req.session?.twitchUser?.id || "";
    const overlayUrl = `${base}/overlay${
      userKey ? `?key=${encodeURIComponent(userKey)}` : ""
    }`;

    const isAdmin = Boolean(req.session?.isAdmin);
    const html = renderHomePage({
      base,
      overlayUrl,
      isAdmin,
      adminName,
      showUtilitiesLink: isAdmin,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  });

  app.get("/privacy", (req, res) => {
    const base = baseUrl(req);
    const html = renderPrivacyPage({ base, contactEmail });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  });

  app.get("/gdpr", (req, res) => {
    const base = baseUrl(req);
    const html = renderGdprPage({ base, contactEmail });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  });

  app.get("/utilities", (req, res) => {
    if (!req.session?.isAdmin) {
      return res.redirect(
        `/auth/login?next=${encodeURIComponent("/utilities")}`
      );
    }
    const base = baseUrl(req);
    const adminName =
      req.session?.twitchUser?.display_name ||
      req.session?.twitchUser?.login ||
      "Admin";
    const overlayKey =
      req.session?.userOverlayKey || req.session?.twitchUser?.id || "";
    const wheelOverlayBase = `${base}/overlay/wheel`;
    const html = renderUtilitiesPage({
      base,
      adminName,
      overlayKey,
      wheelOverlayBase,
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  });
}
