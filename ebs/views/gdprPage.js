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
    <title>GDPR Disclosure – Livestreamer Hub</title>
    <link rel="icon" type="image/png" href="/assets/convertico-coin_24x24.png">
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
        <span>Service: Livestreamer Hub</span>
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
        <a href="https://discord.gg/nwu4w5cUVd" target="_blank" rel="noopener noreferrer"><svg style="width:14px;height:14px;fill:currentColor;vertical-align:-2px;margin-right:3px" viewBox="0 0 127.14 96.36"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53.05s5-12.68 11.45-12.68S54 46.09 53.89 53.05 48.84 65.69 42.45 65.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53.05s5-12.68 11.44-12.68S96.23 46.09 96.12 53.05 91.08 65.69 84.69 65.69Z"/></svg>Discord</a>
      </footer>
    </main>
  </body>
</html>`;
}
