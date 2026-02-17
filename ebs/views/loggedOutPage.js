import {
  THEME_CSS_VARS,
  THEME_TOGGLE_STYLES,
  renderThemeBootstrapScript,
} from "./theme.js";
import {
  GLOBAL_HEADER_STYLES,
  renderGlobalHeader,
} from "./globalHeader.js";

export function renderLoggedOutPage(options = {}) {
  const base = String(options.base || "");
  const next = options.next || "/overlay/config";
  const encodedNext = encodeURIComponent(String(next));
  const privacyUrl = `${base}/privacy`;
  const gdprUrl = `${base}/gdpr`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Logged out</title>
    <link rel="icon" type="image/png" href="/assets/convertico-coin_24x24.png">
    <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="6770198d-2c1f-46f8-af4b-694edc70484c" type="text/javascript"></script>
    ${renderThemeBootstrapScript()}
    <style>
      ${THEME_CSS_VARS}
      body { margin: 0; font-family: Inter, system-ui, Arial, sans-serif; background: var(--page-bg); color: var(--text-color); min-height: 100vh; display:flex; flex-direction:column; }
      .content { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; position: relative; }
      .box { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 12px; padding: 24px; max-width: 520px; width: min(520px, 100%); box-shadow: 0 20px 50px var(--goal-card-shadow); }
      .box h2 { margin: 0 0 8px; }
      .box p { margin: 0 0 16px; color: var(--text-muted); }
      .box small { color: var(--text-muted); display: block; margin-top: 10px; }
      button { background: var(--accent-color); color: #ffffff; border: 0; padding: 10px 14px; border-radius: 8px; cursor: pointer; font-size: 15px; }
      .global-footer { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 12px; font-size: 13px; color: var(--text-muted); flex-wrap: wrap; justify-content: center; }
      .global-footer a { color: var(--text-muted); text-decoration: none; }
      .global-footer a:hover { color: var(--accent-color); }
      ${THEME_TOGGLE_STYLES}
      ${GLOBAL_HEADER_STYLES}
    </style>
  </head>
  <body>
    ${renderGlobalHeader({ base, active: "home", includeThemeToggle: true })}
    <div class="content">
      <div class="box">
        <h2>You are logged out</h2>
        <p>To sign in again, click the button below.</p>
        <a href="${base}/auth/login?next=${encodedNext}"><button>Sign in with Twitch</button></a>
        <small>Note: you may still be signed into Twitch in this browser, which can auto-complete sign-in.</small>
      </div>
      <footer class="global-footer">
        <a href="${privacyUrl}">Privacy Policy</a>
        <a href="${gdprUrl}">GDPR / UK GDPR Disclosure</a>
      </footer>
    </div>
  </body>
</html>`;
}
