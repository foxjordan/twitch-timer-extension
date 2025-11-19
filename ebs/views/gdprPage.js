import {
  THEME_CSS_VARS,
  THEME_TOGGLE_STYLES,
  renderThemeBootstrapScript,
} from "./theme.js";
import {
  GLOBAL_HEADER_STYLES,
  renderGlobalHeader,
} from "./globalHeader.js";

export function renderGdprPage(options = {}) {
  const base = String(options.base || "");
  const contactEmail = String(options.contactEmail || "help@darkfoxdev.com");
  const lastUpdated = String(options.lastUpdated || "November 17, 2025");

  const privacyUrl = `${base}/privacy`;
  const homeUrl = base ? `${base}/` : "/";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GDPR Disclosure – Twitch Timer Overlay</title>
    <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="6770198d-2c1f-46f8-af4b-694edc70484c" type="text/javascript"></script>
    ${renderThemeBootstrapScript()}
    <style>
      ${THEME_CSS_VARS}
      body { margin: 0; font-family: Inter, system-ui, Arial, sans-serif; background: var(--page-bg); color: var(--text-color); min-height:100vh; display:flex; flex-direction:column; }
      main { width: min(960px, 100%); background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 16px; padding: 32px; box-shadow: 0 18px 60px var(--goal-card-shadow); margin: 32px auto 48px; }
      h1 { margin-top: 0; font-size: 34px; }
      h2 { margin-top: 28px; font-size: 22px; }
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
      <h1>GDPR / UK GDPR Disclosure</h1>
      <div class="meta">
        <span>Service: Twitch Timer Overlay</span>
        <span>Last updated: ${lastUpdated}</span>
      </div>
      <p>This disclosure supplements our <a href="${privacyUrl}">Privacy Policy</a> for users located in the European Economic Area (EEA), the United Kingdom, and Switzerland. It explains the legal bases we rely on and the rights that apply under the GDPR and UK GDPR.</p>

      <h2>Current data processing</h2>
      <p>The timer overlay presently does not store personal data beyond short-lived session information that enables Twitch authentication and timer control. We do not build user profiles or keep audience activity logs.</p>

      <h2>Legal bases</h2>
      <ul>
        <li><strong>Performance of a contract:</strong> Required to authenticate administrators via Twitch and provide the overlay functionality they request.</li>
        <li><strong>Legitimate interests:</strong> Limited to ensuring platform security, preventing abuse, and operating the timer infrastructure.</li>
        <li><strong>Consent (future features):</strong> If we introduce advertising, analytics, or premium subscriptions, we will seek consent where required and provide clear controls.</li>
      </ul>

      <h2>Data subject rights</h2>
      <p>GDPR/UK GDPR gives you the right to access, correct, delete, restrict, or object to processing of your personal data. Because we do not currently store persistent personal data, many of these rights will result in simple confirmation that we hold no information about you. When we add features that change this, we will provide tools to exercise each right.</p>

      <h2>International transfers</h2>
      <p>Any data we process is hosted in the United States. If we begin transferring personal data from the EEA/UK, we will rely on an accepted transfer mechanism such as Standard Contractual Clauses and will disclose that here.</p>

      <h2>How to contact us</h2>
      <p>Email <a href="mailto:${contactEmail}">${contactEmail}</a> with "GDPR request" in the subject line to exercise your rights or ask questions about upcoming changes. We respond within 30 days.</p>
      <footer class="global-footer">
        <a href="${homeUrl}">Home</a>
        <a href="${privacyUrl}">Privacy Policy</a>
      </footer>
    </main>
  </body>
</html>`;
}
