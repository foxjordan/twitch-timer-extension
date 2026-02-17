import {
  THEME_CSS_VARS,
  THEME_TOGGLE_STYLES,
  renderThemeBootstrapScript,
} from "./theme.js";
import {
  GLOBAL_HEADER_STYLES,
  renderGlobalHeader,
} from "./globalHeader.js";

export function renderPrivacyPage(options = {}) {
  const base = String(options.base || "");
  const contactEmail = String(options.contactEmail || "help@darkfoxdev.com");
  const lastUpdated = String(options.lastUpdated || "November 17, 2025");

  const gdprUrl = `${base}/gdpr`;
  const homeUrl = base ? `${base}/` : "/";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Privacy Policy – Live Streamer Hub</title>
    <link rel="icon" type="image/png" href="/assets/convertico-coin_24x24.png">
    <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="6770198d-2c1f-46f8-af4b-694edc70484c" type="text/javascript"></script>
    ${renderThemeBootstrapScript()}
    <style>
      ${THEME_CSS_VARS}
      body { margin: 0; font-family: Inter, system-ui, Arial, sans-serif; background: var(--page-bg); color: var(--text-color); min-height:100vh; display:flex; flex-direction:column; }
      main { width: min(960px, 100%); background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 16px; padding: 32px; box-shadow: 0 18px 60px var(--goal-card-shadow); margin: 32px auto 48px; }
      h1 { margin-top: 0; font-size: 34px; }
      h2 { margin-top: 32px; font-size: 22px; }
      p { line-height: 1.65; color: var(--text-muted); }
      ul { color: var(--text-muted); margin: 12px 0 12px 20px; line-height: 1.6; }
      .meta { color: var(--text-muted); font-size: 14px; margin-bottom: 28px; display:flex; justify-content: space-between; flex-wrap: wrap; gap:8px; }
      a { color: var(--accent-color); text-decoration: none; }
      a:hover { text-decoration: underline; }
      .global-footer { margin-top: 40px; border-top: 1px solid var(--surface-border); padding-top: 16px; font-size: 13px; color: var(--text-muted); display:flex; flex-wrap: wrap; gap: 12px; }
      .global-footer a { color: var(--text-muted); text-decoration: none; }
      .global-footer a:hover { color: var(--accent-color); }
      ${THEME_TOGGLE_STYLES}
      ${GLOBAL_HEADER_STYLES}
    </style>
  </head>
  <body>
    ${renderGlobalHeader({ base, active: "home", includeThemeToggle: true })}
    <main>
      <h1>Privacy Policy</h1>
      <div class="meta">
        <span>Service: Live Streamer Hub and Twitch Timer Overlay</span>
        <span>Last updated: ${lastUpdated}</span>
      </div>
      <p>We built the Twitch Timer overlay to help creators run charity drives, subathons, and other time-based goals. This Privacy Policy explains how we handle personal information today and describes the disclosures you should expect when we launch upcoming monetization features.</p>

      <h2>What data we collect today</h2>
      <p>At this time we do not permanently store personal data about viewers, creators, or administrators. The overlay only processes information required to authenticate admins via Twitch, apply timer rules, and render overlays in real time. Session data is temporary and automatically expires.</p>

      <h2>Planned monetization and advertising</h2>
      <p>In the future we may introduce premium subscriptions or sponsored placements. Those offerings could rely on third-party payment processors or advertising partners that have their own privacy policies and consent flows. We will update this page and provide in-product notices before enabling those features.</p>

      <h2>Third-party services</h2>
      <ul>
        <li><strong>Twitch:</strong> Used solely for authentication and ingesting channel events required to run the timer.</li>
        <li><strong>Payment or ad partners (future):</strong> Not yet active. When added we will share integration details, links to partner policies, and choice controls.</li>
      </ul>

      <h2>International users</h2>
      <p>European Economic Area (EEA), UK, and Swiss users can review our <a href="${gdprUrl}">GDPR/UK GDPR disclosure</a> for more detail on the lawful basis we rely on and the rights available to you.</p>

      <h2>Your choices</h2>
      <p>Because we do not store user profiles today, there is nothing to export or delete. If you have questions about future changes or want confirmation that we hold no data about you, please reach out.</p>

      <h2>Contact us</h2>
      <p>Email <a href="mailto:${contactEmail}">${contactEmail}</a> with any privacy questions or concerns. We will respond before enabling new data uses.</p>
      <footer class="global-footer">
        <a href="${homeUrl}">Home</a>
        <a href="${gdprUrl}">GDPR / UK GDPR Disclosure</a>
      </footer>
    </main>
  </body>
</html>`;
}
