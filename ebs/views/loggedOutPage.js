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
        <a href="https://discord.gg/nwu4w5cUVd" target="_blank" rel="noopener noreferrer"><svg style="width:14px;height:14px;fill:currentColor;vertical-align:-2px;margin-right:3px" viewBox="0 0 127.14 96.36"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53.05s5-12.68 11.45-12.68S54 46.09 53.89 53.05 48.84 65.69 42.45 65.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53.05s5-12.68 11.44-12.68S96.23 46.09 96.12 53.05 91.08 65.69 84.69 65.69Z"/></svg>Discord</a>
      </footer>
    </div>
  </body>
</html>`;
}
