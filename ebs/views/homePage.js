import {
  THEME_CSS_VARS,
  THEME_TOGGLE_STYLES,
  renderThemeBootstrapScript,
} from "./theme.js";
import { GLOBAL_HEADER_STYLES, renderGlobalHeader } from "./globalHeader.js";
import { renderFirebaseScript } from "./firebase.js";

export function renderHomePage(options = {}) {
  const base = String(options.base || "");
  const loginUrl = `${base}/auth/login?next=${encodeURIComponent(
    "/overlay/config",
  )}`;
  const configUrl = `${base}/overlay/config`;
  const overlayUrl = String(options.overlayUrl || `${base}/overlay`);
  const isAdmin = Boolean(options.isAdmin);
  const adminName = options.adminName
    ? String(options.adminName)
    : "your Twitch account";
  const privacyUrl = `${base}/privacy`;
  const gdprUrl = `${base}/gdpr`;
  const showUtilitiesLink = Boolean(options.showUtilitiesLink);
  const showAdminLink = Boolean(options.showAdminLink);
  const headerAdminName = isAdmin ? adminName : "";
  const soundsConfigUrl = `${base}/sounds/config`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Live Streamer Hub</title>
    <meta property="og:title" content="Live Streamer Hub" />
    <meta property="og:description" content="Free tools and overlays for Twitch streamers — timers, sound alerts, spinning wheels, and more." />
    <meta property="og:image" content="https://livestreamerhub.com/assets/link_preview.png" />
    <meta property="og:url" content="https://livestreamerhub.com" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Live Streamer Hub" />
    <meta name="twitter:description" content="Free tools and overlays for Twitch streamers — timers, sound alerts, spinning wheels, and more." />
    <meta name="twitter:image" content="https://livestreamerhub.com/assets/link_preview.png" />
    <link rel="icon" type="image/png" href="/assets/convertico-coin_24x24.png">
    <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="6770198d-2c1f-46f8-af4b-694edc70484c" type="text/javascript"></script>
    ${renderThemeBootstrapScript()}
    ${renderFirebaseScript()}
    <style>
      ${THEME_CSS_VARS}
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--home-bg); color: var(--text-color); display:flex; flex-direction:column; min-height:100vh; }
      main { width: 100%; max-width: 1100px; margin: 0 auto; padding: 0 24px 72px; }
      p { line-height: 1.6; }

      /* CTA buttons */
      .cta { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 18px; border-radius: 999px; border: 0; font-weight: 600; font-size: 15px; cursor: pointer; text-decoration: none; transition: transform .1s ease, box-shadow .2s ease, opacity .15s ease; }
      .cta.primary { background: linear-gradient(135deg, #9146FF, #772CE8); color: #fff; box-shadow: 0 6px 18px rgba(145,70,255,0.35); }
      .cta.secondary { background: var(--secondary-button-bg); color: var(--secondary-button-text); border: 1px solid var(--secondary-button-border); }
      .cta:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(0,0,0,0.2); }
      .cta:active { transform: translateY(0); }

      /* Hero */
      .hero { text-align: center; padding: 72px 24px 60px; }
      .hero .eyebrow { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent-color); margin-bottom: 16px; }
      .hero h1 { font-size: clamp(36px, 5vw, 52px); font-weight: 800; line-height: 1.1; margin: 0 0 20px; background: linear-gradient(135deg, var(--text-color) 30%, var(--accent-color) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
      .hero .hero-desc { font-size: 18px; line-height: 1.6; color: var(--text-muted); max-width: 580px; margin: 0 auto 36px; }
      .hero-ctas { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
      .hero-status { margin-top: 22px; font-size: 14px; color: var(--text-muted); }
      .hero-status strong { color: var(--accent-color); }

      /* Section divider */
      .section-divider { display: flex; align-items: center; gap: 16px; margin: 0 0 64px; color: var(--text-muted); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
      .section-divider::before, .section-divider::after { content: ''; flex: 1; height: 1px; background: var(--surface-border); }

      /* Feature blocks */
      .feature-block { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; margin-bottom: 88px; }
      .feature-block.reverse { direction: rtl; }
      .feature-block.reverse > * { direction: ltr; }
      .tag-pill { display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(145, 70, 255, 0.12); color: var(--accent-color); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 16px; }
      .feature-text h2 { font-size: clamp(22px, 2.8vw, 32px); font-weight: 700; line-height: 1.2; margin: 0 0 16px; }
      .feature-text p { color: var(--text-muted); line-height: 1.65; margin: 0 0 20px; font-size: 16px; }
      .feature-bullets { list-style: none; padding: 0; margin: 0 0 28px; display: flex; flex-direction: column; gap: 10px; }
      .feature-bullets li { display: flex; align-items: flex-start; gap: 10px; color: var(--text-muted); font-size: 15px; }
      .feature-bullets li::before { content: '\\2713'; color: var(--accent-color); font-weight: 700; flex-shrink: 0; margin-top: 1px; }
      .feature-ctas { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }

      /* Screenshots */
      .feature-screenshots { display: flex; flex-direction: column; gap: 14px; }
      .screenshot-card { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 14px; overflow: hidden; box-shadow: 0 8px 32px var(--goal-card-shadow); }
      .screenshot-card img { width: 100%; height: auto; display: block; }
      .screenshot-card img.compact { max-height: 200px; object-fit: cover; object-position: top; }

      /* Utilities */
      .utilities-section { margin-bottom: 80px; }
      .utilities-header { text-align: center; margin-bottom: 28px; }
      .utilities-header h2 { font-size: 26px; font-weight: 700; margin: 0 0 10px; }
      .utilities-header p { color: var(--text-muted); font-size: 16px; margin: 0 auto; max-width: 540px; }
      .utilities-screenshots { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 800px; margin: 0 auto 24px; }
      .utilities-cta { text-align: center; }

      /* Steps */
      .steps-section { margin-bottom: 64px; }
      .steps-section > h2 { font-size: 22px; font-weight: 700; text-align: center; margin: 0 0 28px; }
      .steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
      .step-card { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 14px; padding: 24px 20px; box-shadow: 0 4px 20px var(--goal-card-shadow); }
      .step-number { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #9146FF, #772CE8); color: #fff; font-weight: 800; font-size: 15px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
      .step-card h3 { margin: 0 0 8px; font-size: 16px; font-weight: 700; }
      .step-card p { margin: 0 0 10px; font-size: 14px; color: var(--text-muted); line-height: 1.55; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; display: block; padding: 10px 12px; border-radius: 8px; background: var(--code-bg); border: 1px solid var(--code-border); margin: 10px 0 0; word-break: break-all; font-size: 13px; color: var(--text-color); }

      /* Status + footer */
      .status { margin-top: 16px; padding: 16px; border-radius: 12px; background: var(--surface-muted); border: 1px solid var(--surface-border); color: var(--text-color); }
      .status strong { color: var(--accent-color); }
      .global-footer { margin-top: 40px; display: flex; flex-wrap: wrap; gap: 16px; font-size: 14px; color: var(--text-muted); align-items: center; }
      .global-footer a { color: var(--text-muted); text-decoration: none; font-weight: 500; display: inline-flex; align-items: center; gap: 5px; }
      .global-footer a:hover { color: var(--accent-color); }
      .global-footer .discord-icon { width: 16px; height: 16px; fill: currentColor; flex-shrink: 0; }

      /* Community banner */
      .community-banner { margin-bottom: 48px; padding: 28px 32px; border-radius: 14px; background: var(--surface-color); border: 1px solid var(--surface-border); box-shadow: 0 4px 20px var(--goal-card-shadow); display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
      .community-banner .discord-icon-lg { width: 40px; height: 40px; fill: #5865F2; flex-shrink: 0; }
      .community-banner .community-text { flex: 1; min-width: 200px; }
      .community-banner h3 { margin: 0 0 4px; font-size: 17px; font-weight: 700; }
      .community-banner p { margin: 0; font-size: 14px; color: var(--text-muted); line-height: 1.5; }

      /* Beta banner */
      .beta-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: linear-gradient(135deg, #F97316, #EA580C); color: #fff; font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; vertical-align: middle; margin-left: 8px; }
      .beta-callout { margin-top: 20px; padding: 14px 16px; border-radius: 10px; background: rgba(249, 115, 22, 0.08); border: 1px solid rgba(249, 115, 22, 0.25); font-size: 14px; line-height: 1.5; color: var(--text-color); }
      .beta-callout strong { color: #F97316; }

      /* Responsive */
      @media (max-width: 840px) {
        .feature-block, .feature-block.reverse { grid-template-columns: 1fr; direction: ltr; gap: 32px; margin-bottom: 56px; }
        .feature-block.reverse .feature-text { order: 1; }
        .feature-block.reverse .feature-screenshots { order: 2; }
        .steps-grid { grid-template-columns: 1fr; }
        .utilities-screenshots { grid-template-columns: 1fr; max-width: 480px; }
      }
      @media (max-width: 600px) {
        main { padding: 0 18px 56px; }
        .hero { padding: 48px 0 40px; }
        .hero h1 { font-size: 32px; }
        .hero .hero-desc { font-size: 16px; }
        .section-divider { margin-bottom: 48px; }
      }
      ${THEME_TOGGLE_STYLES}
      ${GLOBAL_HEADER_STYLES}
    </style>
  </head>
  <body>
    ${renderGlobalHeader({ base, adminName: headerAdminName, active: "home", includeThemeToggle: true, showUtilitiesLink, showAdminLink })}
    <main>

      <!-- Hero -->
      <section class="hero">
        <div class="eyebrow">Livestreamer Hub</div>
        <h1>The complete toolkit for Twitch broadcasters</h1>
        <p class="hero-desc">A charity &amp; subathon countdown timer, live Bit Alerts, interactive stream utilities, and OBS-ready overlays &mdash; built for streamers, all in one place.</p>
        <div class="hero-ctas">
          <a class="cta primary" href="${loginUrl}">Sign in with Twitch</a>
          <a class="cta secondary" href="${configUrl}">Open Configurator</a>
        </div>
        <div class="hero-status">
          ${isAdmin
            ? `<strong>Signed in as ${adminName}</strong> &mdash; your configurator is ready.`
            : `Not signed in. Sign in with your broadcaster account to manage settings.`}
        </div>
      </section>

      <!-- Divider -->
      <div class="section-divider">What&rsquo;s included</div>

      <!-- Timer Overlay -->
      <div class="feature-block">
        <div class="feature-text">
          <div class="tag-pill">Timer Overlay</div>
          <h2>A timer that rewards your community</h2>
          <p>Fully configurable countdown timer for subathons, charity streams, and any event where viewer contributions keep the clock alive.</p>
          <ul class="feature-bullets">
            <li>Live style editor with real-time overlay preview</li>
            <li>Bits, subs, gift subs, follows, hype train, and charity donations</li>
            <li>Pause, resume, and manual time controls</li>
            <li>Goal bar trackers for milestone fundraising</li>
            <li>OBS Browser Source URL generated automatically</li>
          </ul>
          <div class="feature-ctas">
            <a class="cta secondary" href="${configUrl}">Open Configurator</a>
          </div>
        </div>
        <div class="feature-screenshots">
          <div class="screenshot-card">
            <img src="/assets/screenshots/timer-config.png" alt="Timer overlay configurator with live preview and style controls" loading="lazy" />
          </div>
          <div class="screenshot-card">
            <img src="/assets/screenshots/timer-rules.png" alt="Timer rules configuration for bits, subs, gifts, follows" loading="lazy" />
          </div>
          <div class="screenshot-card">
            <img src="/assets/screenshots/goal-bar-config.png" class="compact" alt="Goal bar configurator with live preview and appearance controls" loading="lazy" />
          </div>
        </div>
      </div>

      <!-- Bit Alerts Extension -->
      <div class="feature-block reverse">
        <div class="feature-text">
          <div class="tag-pill">Twitch Extension</div><span class="beta-badge">Beta</span>
          <h2>Live Bit Alerts for your stream</h2>
          <p>A companion Twitch Extension that fires custom sound effects when viewers cheer Bits. Viewers can browse the active sounds right inside their Twitch panel.</p>
          <ul class="feature-bullets">
            <li>Viewer panel displays the active sound alert list</li>
            <li>Upload custom sounds for any Bit threshold</li>
            <li>Configure directly from the Twitch Extension dashboard</li>
            <li>OBS Browser Source overlay for on-screen alerts</li>
          </ul>
          <div class="feature-ctas">
            <a class="cta primary" href="https://forms.gle/68zBupcoB6XthTheA" target="_blank" rel="noopener noreferrer">Request Beta Access</a>
            <a class="cta secondary" href="${soundsConfigUrl}">Manage Sounds</a>
          </div>
          <div class="beta-callout">
            <strong>Looking for beta testers!</strong> Bit Alerts is currently in testing on Twitch and requires whitelisting. Request access using the button above and we&rsquo;ll get you set up.
          </div>
        </div>
        <div class="feature-screenshots">
          <div class="screenshot-card">
            <img src="/assets/screenshots/bit-alerts-viewer.png" alt="Bit Alerts viewer panel showing sound alerts" loading="lazy" />
          </div>
          <div class="screenshot-card">
            <img src="/assets/screenshots/bit-alerts-streamer-config.png" class="compact" alt="Sound alerts configuration for uploading and managing sounds" loading="lazy" />
          </div>
          <div class="screenshot-card">
            <img src="/assets/screenshots/bit-alerts-dashboard.png" class="compact" alt="Bit Alerts extension configuration in Twitch dashboard" loading="lazy" />
          </div>
        </div>
      </div>

      <!-- Utilities -->
      <div class="utilities-section">
        <div class="utilities-header">
          <div class="tag-pill">Broadcaster Utilities</div>
          <h2>Bonus tools for your stream</h2>
          <p>Browser-projectable utilities you can use live on stream or add as OBS Browser Sources.</p>
        </div>
        <div class="utilities-screenshots">
          <div class="screenshot-card">
            <img src="/assets/screenshots/utilities-coin-dice.png" alt="Coin flip and dice roller utilities" loading="lazy" />
          </div>
          <div class="screenshot-card">
            <img src="/assets/screenshots/utilities-wheel.png" alt="Wheel spinner utility" loading="lazy" />
          </div>
        </div>
        <div class="utilities-cta">
          ${showUtilitiesLink
            ? `<a class="cta secondary" href="${base}/utilities">Open Utilities</a>`
            : `<span style="font-size:14px; color:var(--text-muted)">Available to registered broadcasters after signing in.</span>`}
        </div>
      </div>

      <!-- How to get started -->
      <section class="steps-section">
        <h2>How to get started</h2>
        <div class="steps-grid">
          <div class="step-card">
            <div class="step-number">1</div>
            <h3>Sign in with Twitch</h3>
            <p>Use the button above with your broadcaster account. You need to be the channel owner to manage settings.</p>
          </div>
          <div class="step-card">
            <div class="step-number">2</div>
            <h3>Configure your tools</h3>
            <p>Set timer rules, upload Bit Alert sounds, style your overlays, and manage your overlay key in the configurator.</p>
          </div>
          <div class="step-card">
            <div class="step-number">3</div>
            <h3>Add overlays to OBS</h3>
            <p>Copy your Browser Source URL from the configurator and point an OBS source at it. Refresh after style changes.</p>
            <code>${overlayUrl}</code>
          </div>
        </div>
      </section>

      <!-- Community -->
      <div class="community-banner">
        <svg class="discord-icon-lg" viewBox="0 0 127.14 96.36" xmlns="http://www.w3.org/2000/svg"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53.05s5-12.68 11.45-12.68S54 46.09 53.89 53.05 48.84 65.69 42.45 65.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53.05s5-12.68 11.44-12.68S96.23 46.09 96.12 53.05 91.08 65.69 84.69 65.69Z"/></svg>
        <div class="community-text">
          <h3>Join the community</h3>
          <p>Got questions, feedback, or feature requests? Come hang out on Discord.</p>
        </div>
        <a class="cta secondary" href="https://discord.gg/nwu4w5cUVd" target="_blank" rel="noopener noreferrer">Join Discord</a>
      </div>

      <!-- Status -->
      <div class="status">
        ${isAdmin
          ? `<strong>Signed in:</strong> ${adminName}. Your overlay link above already includes your saved key.`
          : `Not signed in. Use the Sign in button above to manage settings for ${adminName}.`}
      </div>

      <!-- Footer -->
      <footer class="global-footer">
        <a href="${privacyUrl}">Privacy Policy</a>
        <a href="${gdprUrl}">GDPR / UK GDPR Disclosure</a>
        <a href="https://discord.gg/nwu4w5cUVd" target="_blank" rel="noopener noreferrer"><svg class="discord-icon" viewBox="0 0 127.14 96.36" xmlns="http://www.w3.org/2000/svg"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53.05s5-12.68 11.45-12.68S54 46.09 53.89 53.05 48.84 65.69 42.45 65.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53.05s5-12.68 11.44-12.68S96.23 46.09 96.12 53.05 91.08 65.69 84.69 65.69Z"/></svg> Discord</a>
      </footer>

    </main>
  </body>
</html>`;
}
