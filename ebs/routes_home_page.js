import { renderHomePage } from "./views/homePage.js";
import { renderPrivacyPage } from "./views/privacyPage.js";
import { renderGdprPage } from "./views/gdprPage.js";
import { renderUtilitiesPage } from "./views/utilitiesPage.js";
import { isSuperAdmin } from "./routes_admin.js";

const ROBOTS_TXT = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /overlay/config
Disallow: /sounds/config
Disallow: /goals/config
Disallow: /utilities
Disallow: /auth/
Disallow: /api/
Disallow: /overlay

Sitemap: https://livestreamerhub.com/sitemap.xml
`;

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://livestreamerhub.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://livestreamerhub.com/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://livestreamerhub.com/gdpr</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
`;

export function mountHomePageRoutes(app) {
  const contactEmail =
    process.env.CONTACT_EMAIL || process.env.SUPPORT_EMAIL || "help@darkfoxdev.com";

  app.get("/robots.txt", (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(ROBOTS_TXT);
  });

  app.get("/sitemap.xml", (req, res) => {
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(SITEMAP_XML);
  });

  app.get("/", (req, res) => {
    const user = req.session?.twitchUser;
    const adminName =
      user?.display_name || user?.login || "your Twitch account";
    const userKey =
      req.session?.userOverlayKey || req.session?.twitchUser?.id || "";
    const overlayUrl = `/overlay${
      userKey ? `?key=${encodeURIComponent(userKey)}` : ""
    }`;

    const isAdmin = Boolean(req.session?.isAdmin);
    const html = renderHomePage({
      base: "",
      overlayUrl,
      isAdmin,
      adminName,
      showUtilitiesLink: isAdmin,
      showAdminLink: isSuperAdmin(req),
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  });

  app.get("/privacy", (req, res) => {
    const html = renderPrivacyPage({ base: "", contactEmail });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(html);
  });

  app.get("/gdpr", (req, res) => {
    const html = renderGdprPage({ base: "", contactEmail });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(html);
  });

  app.get("/utilities", (req, res) => {
    if (!req.session?.isAdmin) {
      return res.redirect(
        `/auth/login?next=${encodeURIComponent("/utilities")}`
      );
    }
    const adminName =
      req.session?.twitchUser?.display_name ||
      req.session?.twitchUser?.login ||
      "Admin";
    const overlayKey =
      req.session?.userOverlayKey || req.session?.twitchUser?.id || "";
    const wheelOverlayBase = `/overlay/wheel`;
    const html = renderUtilitiesPage({
      base: "",
      adminName,
      overlayKey,
      wheelOverlayBase,
      showAdminLink: isSuperAdmin(req),
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  });
}
