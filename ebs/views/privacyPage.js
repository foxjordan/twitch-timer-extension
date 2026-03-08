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

export function renderPrivacyPage(options = {}) {
  const base = String(options.base || "");
  const contactEmail = String(options.contactEmail || "help@darkfoxdev.com");
  const lastUpdated = String(options.lastUpdated || "March 5, 2026");

  const gdprUrl = `${base}/gdpr`;
  const termsUrl = `${base}/terms`;
  const homeUrl = base ? `${base}/` : "/";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Privacy Policy – Livestreamer Hub</title>
    <meta name="description" content="Privacy policy for Livestreamer Hub — how we handle your data, Twitch OAuth, cookies, and third-party services." />
    <link rel="canonical" href="https://livestreamerhub.com/privacy" />
    <meta property="og:title" content="Privacy Policy – Livestreamer Hub" />
    <meta property="og:description" content="Privacy policy for Livestreamer Hub — how we handle your data, Twitch OAuth, cookies, and third-party services." />
    <meta property="og:url" content="https://livestreamerhub.com/privacy" />
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
      <p>We built the Livestreamer Hub and Twitch Timer overlay to help creators run charity drives, subathons, sound alerts, text-to-speech redemptions, and other interactive features. This Privacy Policy explains what personal information we collect, how we use it, and what choices you have.</p>

      <h2>1. Information we collect</h2>

      <h3>Account and profile data</h3>
      <p>When you sign in via Twitch OAuth, we collect and store:</p>
      <ul>
        <li>Twitch user ID, login handle, and display name</li>
        <li>OAuth access tokens (stored temporarily in server memory and automatically expired)</li>
      </ul>

      <h3>Configuration and preferences</h3>
      <p>We persistently store settings you configure, including:</p>
      <ul>
        <li>Timer rules (bits, subs, gifted subs, charity, hype train, follows, tips)</li>
        <li>Overlay styles and visual customizations</li>
        <li>Timer state (expiry, pause status, additions)</li>
        <li>Goal configurations (charity drives, subathons, segment tracking)</li>
        <li>Sound alert settings (volume, cooldowns, queue size, overlay duration)</li>
        <li>Text-to-speech settings (voice selection, volume, moderation filters, banned words)</li>
        <li>Default timer duration preferences</li>
      </ul>

      <h3>Uploaded content</h3>
      <p>Creators may upload sound files (MP3, OGG, WAV, WebM, MP4, M4A) and video clips. These are stored on our servers and associated with your Twitch user ID.</p>

      <h3>Subscription and payment data</h3>
      <p>If you subscribe to a Pro plan, Stripe processes your payment. We store your Stripe customer ID, subscription ID, subscription status, and billing period — but we never store credit card numbers or full payment details. Those are handled entirely by Stripe.</p>

      <h3>Analytics data</h3>
      <p>We use Google Analytics (via Firebase) to understand how the extension is used. Analytics events include page loads, feature usage (sound uploads, TTS redemptions, clip creation, settings updates), and channel ID. Analytics data is collected anonymously and is not linked to personal profiles.</p>

      <h3>Session data</h3>
      <p>We use a server-side session cookie (<code>overlay.sid</code>) to maintain your authenticated state. This cookie is httpOnly and does not contain personal data directly.</p>

      <h3>Moderation and safety</h3>
      <p>We maintain a list of banned user IDs with timestamps and reasons to prevent abuse of the platform.</p>

      <h2>2. How we use your information</h2>
      <ul>
        <li><strong>Provide the service:</strong> Authenticate you via Twitch, apply your timer rules, render overlays, process sound alerts, and synthesize text-to-speech audio.</li>
        <li><strong>Process payments:</strong> Manage Pro subscriptions through Stripe.</li>
        <li><strong>Improve the product:</strong> Analyze anonymous usage patterns via Google Analytics to understand which features are used and how to improve them.</li>
        <li><strong>Prevent abuse:</strong> Enforce bans, moderate TTS content (offensive language filtering, caps filtering, URL blocking), and maintain platform security.</li>
      </ul>

      <h2>3. Twitch data we access</h2>
      <p>Through Twitch OAuth, we request the following scopes:</p>
      <ul>
        <li><code>channel:read:subscriptions</code> — to read subscriber events for timer rules</li>
        <li><code>bits:read</code> — to read bits/cheer transactions for timer rules</li>
        <li><code>channel:read:charity</code> — to read charity campaign data</li>
        <li><code>channel:read:hype_train</code> — to read hype train events</li>
        <li><code>moderator:read:followers</code> — to read follower events for timer rules</li>
        <li><code>moderation:read</code> — to check channel banned users and blocked terms for content moderation</li>
      </ul>
      <p>We access this data only to power the timer, goal tracking, and overlay features you configure. We do not read chat messages, stream metadata, or VOD content.</p>

      <h2>4. Third-party services</h2>
      <ul>
        <li><strong>Twitch (<a href="https://www.twitch.tv/p/legal/privacy-notice/" target="_blank" rel="noopener noreferrer">Privacy Policy</a>):</strong> Authentication and channel event data via OAuth and EventSub.</li>
        <li><strong>Google / Firebase Analytics (<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>):</strong> Anonymous usage analytics to understand feature adoption and improve the product.</li>
        <li><strong>Stripe (<a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>):</strong> Payment processing for Pro subscriptions. Stripe receives your payment details directly — we never see or store full card numbers.</li>
        <li><strong>Inworld AI (<a href="https://inworld.ai/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>):</strong> Text-to-speech synthesis. We send only the text content and selected voice — no user identification is transmitted.</li>
        <li><strong>Cookiebot (<a href="https://www.cookiebot.com/en/privacy-policy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a>):</strong> Cookie consent management for GDPR compliance.</li>
      </ul>

      <h2>5. Cookies</h2>
      <ul>
        <li><strong>Session cookie</strong> (<code>overlay.sid</code>): Essential for maintaining your login session. httpOnly, SameSite=Lax.</li>
        <li><strong>Firebase Analytics cookies:</strong> Used for anonymous analytics tracking. SameSite=None, Secure, 2-hour expiration.</li>
        <li><strong>Cookiebot cookies:</strong> Track your cookie consent preferences.</li>
      </ul>
      <p>You can manage cookie preferences through the Cookiebot consent banner or your browser settings.</p>

      <h2>6. Data retention</h2>
      <ul>
        <li><strong>Account and settings data:</strong> Retained as long as you use the service. Contact us to request deletion.</li>
        <li><strong>OAuth tokens:</strong> Stored in server memory with automatic expiration (approximately 1 hour).</li>
        <li><strong>Session data:</strong> Expires when your browser session ends or you log out.</li>
        <li><strong>TTS audio files:</strong> Automatically deleted after 10 minutes.</li>
        <li><strong>Uploaded sounds and clips:</strong> Retained until you delete them or request account data removal.</li>
        <li><strong>Analytics data:</strong> Retained per Google Analytics default retention policies.</li>
        <li><strong>Stripe data:</strong> Retained per Stripe's data retention policies for payment compliance.</li>
      </ul>

      <h2>7. Data storage and security</h2>
      <p>Your data is hosted on servers in the United States. We protect your data with:</p>
      <ul>
        <li>HTTPS encryption for all data in transit</li>
        <li>httpOnly, Secure session cookies to prevent cross-site scripting attacks</li>
        <li>HMAC-signed OAuth state parameters to prevent CSRF attacks</li>
        <li>Server-side token storage (tokens are never exposed to the browser)</li>
        <li>Webhook signature verification for Stripe events</li>
      </ul>

      <h2>8. International users</h2>
      <p>European Economic Area (EEA), UK, and Swiss users can review our <a href="${gdprUrl}">GDPR / UK GDPR disclosure</a> for more detail on the lawful bases we rely on and the rights available to you.</p>

      <h2>9. Your choices and rights</h2>
      <ul>
        <li><strong>Access:</strong> Contact us to request a copy of the data we hold about you.</li>
        <li><strong>Deletion:</strong> Contact us to request deletion of your account data, uploaded content, and stored preferences.</li>
        <li><strong>Cookie control:</strong> Use the Cookiebot consent banner or your browser settings to manage cookies.</li>
        <li><strong>Analytics opt-out:</strong> You can opt out of Google Analytics using <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Google's browser add-on</a> or by declining analytics cookies via the consent banner.</li>
        <li><strong>Disconnect Twitch:</strong> You can revoke our access at any time from your <a href="https://www.twitch.tv/settings/connections" target="_blank" rel="noopener noreferrer">Twitch Connections settings</a>.</li>
      </ul>

      <h2>10. Children's privacy</h2>
      <p>Livestreamer Hub is not directed at children under 13. We do not knowingly collect data from children. If you believe a child has provided us with personal data, please contact us and we will delete it.</p>

      <h2>11. Changes to this policy</h2>
      <p>We may update this policy from time to time. Material changes will be communicated through in-product notices or updates to this page. The "Last updated" date at the top reflects when the most recent revision was published.</p>

      <h2>12. Contact us</h2>
      <p>Email <a href="mailto:${contactEmail}">${contactEmail}</a> with any privacy questions, data requests, or concerns. You can also reach us on <a href="https://discord.gg/nwu4w5cUVd" target="_blank" rel="noopener noreferrer">Discord</a>.</p>
      <footer class="global-footer">
        <a href="${homeUrl}">Home</a>
        <a href="${termsUrl}">Terms of Service</a>
        <a href="${gdprUrl}">GDPR / UK GDPR Disclosure</a>
        <a href="https://discord.gg/nwu4w5cUVd" target="_blank" rel="noopener noreferrer"><svg style="width:14px;height:14px;fill:currentColor;vertical-align:-2px;margin-right:3px" viewBox="0 0 127.14 96.36"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53.05s5-12.68 11.45-12.68S54 46.09 53.89 53.05 48.84 65.69 42.45 65.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53.05s5-12.68 11.44-12.68S96.23 46.09 96.12 53.05 91.08 65.69 84.69 65.69Z"/></svg>Discord</a>
      </footer>
    </main>
  </body>
</html>`;
}
