import {
  THEME_CSS_VARS,
  THEME_TOGGLE_STYLES,
  renderThemeBootstrapScript,
} from "./theme.js";
import {
  GLOBAL_HEADER_STYLES,
  renderGlobalHeader,
} from "./globalHeader.js";
import { renderFirebaseScript } from "./firebase.js";

export function renderGdprPage(options = {}) {
  const base = String(options.base || "");
  const contactEmail = String(options.contactEmail || "help@darkfoxdev.com");
  const lastUpdated = String(options.lastUpdated || "March 5, 2026");

  const privacyUrl = `${base}/privacy`;
  const termsUrl = `${base}/terms`;
  const homeUrl = base ? `${base}/` : "/";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GDPR Disclosure – Livestreamer Hub</title>
    <meta name="description" content="GDPR and UK GDPR disclosure for Livestreamer Hub — data processing, your rights, and how to contact us." />
    <link rel="canonical" href="https://livestreamerhub.com/gdpr" />
    <meta property="og:title" content="GDPR Disclosure – Livestreamer Hub" />
    <meta property="og:description" content="GDPR and UK GDPR disclosure for Livestreamer Hub — data processing, your rights, and how to contact us." />
    <meta property="og:url" content="https://livestreamerhub.com/gdpr" />
    <meta property="og:type" content="website" />
    <link rel="icon" type="image/png" href="/assets/convertico-coin_24x24.png">
    <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="6770198d-2c1f-46f8-af4b-694edc70484c" type="text/javascript"></script>
    ${renderThemeBootstrapScript()}
    ${renderFirebaseScript()}
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
      <p>This disclosure supplements our <a href="${privacyUrl}">Privacy Policy</a> for users located in the European Economic Area (EEA), the United Kingdom, and Switzerland. It explains the legal bases we rely on, the categories of data we process, and the rights that apply under the GDPR and UK GDPR.</p>

      <h2>Data controller</h2>
      <p>Livestreamer Hub ("we", "us") is the data controller responsible for the processing of your personal data. You can reach us at <a href="mailto:${contactEmail}">${contactEmail}</a>.</p>

      <h2>Categories of personal data processed</h2>
      <ul>
        <li><strong>Account identifiers:</strong> Twitch user ID, login handle, and display name (collected via Twitch OAuth).</li>
        <li><strong>Service configuration:</strong> Timer rules, overlay styles, sound alert settings, TTS preferences, goal configurations, and other settings you create.</li>
        <li><strong>Uploaded content:</strong> Sound files and video clips you upload to the platform.</li>
        <li><strong>Payment data:</strong> Stripe customer ID, subscription ID, and subscription status. Full payment details (card numbers, billing address) are processed exclusively by Stripe and never stored by us.</li>
        <li><strong>Usage data:</strong> Anonymous analytics events collected via Google Analytics / Firebase (e.g., page loads, feature usage, channel ID).</li>
        <li><strong>Technical data:</strong> Session cookies, IP addresses in server logs, and browser user-agent strings.</li>
      </ul>

      <h2>Legal bases for processing</h2>
      <ul>
        <li><strong>Performance of a contract (Art. 6(1)(b)):</strong> Processing your Twitch account data, storing your configuration and preferences, and managing your subscription are necessary to provide you with the service you signed up for.</li>
        <li><strong>Legitimate interests (Art. 6(1)(f)):</strong> We process technical data and maintain ban records to ensure platform security, prevent abuse, and maintain the reliability of our infrastructure. Our legitimate interest does not override your fundamental rights.</li>
        <li><strong>Consent (Art. 6(1)(a)):</strong> Analytics cookies and Google Analytics tracking are based on your consent, managed through Cookiebot. You may withdraw consent at any time via the cookie banner without affecting the lawfulness of prior processing.</li>
      </ul>

      <h2>Data processors and third-party recipients</h2>
      <ul>
        <li><strong>Twitch (Amazon):</strong> Authentication provider and source of channel event data. Data processed in the US.</li>
        <li><strong>Google / Firebase:</strong> Anonymous analytics. Data processed in the US under Google's data processing terms.</li>
        <li><strong>Stripe:</strong> Payment processor for Pro subscriptions. Data processed in the US under Stripe's DPA.</li>
        <li><strong>Inworld AI:</strong> Text-to-speech synthesis. Only message text and voice selection are transmitted — no user identifiers.</li>
        <li><strong>Cookiebot (Cybot A/S):</strong> Cookie consent management. Cookiebot is an EU-based processor.</li>
      </ul>

      <h2>International transfers</h2>
      <p>Your data is hosted on servers in the United States. Transfers of personal data from the EEA/UK/Switzerland to the US are supported by:</p>
      <ul>
        <li>The EU-US Data Privacy Framework (where applicable to our processors)</li>
        <li>Standard Contractual Clauses (SCCs) incorporated into processor agreements</li>
      </ul>

      <h2>Data retention</h2>
      <ul>
        <li><strong>Account and configuration data:</strong> Retained while your account is active. Deleted upon request.</li>
        <li><strong>OAuth tokens:</strong> Held in server memory only; automatically expire after approximately 1 hour.</li>
        <li><strong>Session cookies:</strong> Expire when you close your browser or log out.</li>
        <li><strong>TTS audio:</strong> Automatically deleted after 10 minutes.</li>
        <li><strong>Uploaded content:</strong> Retained until you delete it or request account removal.</li>
        <li><strong>Analytics data:</strong> Retained per Google Analytics default policies (14 or 26 months depending on property settings).</li>
        <li><strong>Payment records:</strong> Retained per Stripe's policies and applicable financial regulations.</li>
      </ul>

      <h2>Your rights as a data subject</h2>
      <p>Under GDPR / UK GDPR you have the right to:</p>
      <ul>
        <li><strong>Access</strong> the personal data we hold about you (Art. 15).</li>
        <li><strong>Rectify</strong> inaccurate data (Art. 16). Note: your Twitch display name syncs from Twitch — changes should be made there.</li>
        <li><strong>Erase</strong> your data ("right to be forgotten") (Art. 17). We will delete your stored profile, preferences, uploaded content, and subscription records.</li>
        <li><strong>Restrict</strong> processing in certain circumstances (Art. 18).</li>
        <li><strong>Data portability</strong> — receive your data in a structured, machine-readable format (Art. 20).</li>
        <li><strong>Object</strong> to processing based on legitimate interests (Art. 21).</li>
        <li><strong>Withdraw consent</strong> for analytics cookies at any time via the Cookiebot banner (Art. 7(3)).</li>
        <li><strong>Lodge a complaint</strong> with your local supervisory authority if you believe your rights have been violated.</li>
      </ul>

      <h2>Automated decision-making</h2>
      <p>We do not use automated decision-making or profiling that produces legal or similarly significant effects on you. TTS content moderation filters (offensive language, caps, repeat characters) are applied uniformly and do not constitute profiling under GDPR.</p>

      <h2>How to exercise your rights</h2>
      <p>Email <a href="mailto:${contactEmail}">${contactEmail}</a> with "GDPR request" in the subject line. Please include your Twitch username so we can locate your data. We will respond within 30 days. If we need additional time (up to 60 additional days for complex requests), we will inform you within the initial 30-day period.</p>
      <footer class="global-footer">
        <a href="${homeUrl}">Home</a>
        <a href="${privacyUrl}">Privacy Policy</a>
        <a href="${termsUrl}">Terms of Service</a>
        <a href="https://discord.gg/nwu4w5cUVd" target="_blank" rel="noopener noreferrer"><svg style="width:14px;height:14px;fill:currentColor;vertical-align:-2px;margin-right:3px" viewBox="0 0 127.14 96.36"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53.05s5-12.68 11.45-12.68S54 46.09 53.89 53.05 48.84 65.69 42.45 65.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53.05s5-12.68 11.44-12.68S96.23 46.09 96.12 53.05 91.08 65.69 84.69 65.69Z"/></svg>Discord</a>
      </footer>
    </main>
  </body>
</html>`;
}
