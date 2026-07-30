import {
  THEME_CSS_VARS,
  THEME_TOGGLE_STYLES,
  renderThemeBootstrapScript,
} from "./theme.js";
import { GLOBAL_HEADER_STYLES, renderGlobalHeader } from "./globalHeader.js";
import { renderFirebaseScript } from "./firebase.js";

const FAQS = [
  {
    q: "Does the timer keep running if my stream or computer crashes?",
    a: "Yes. Timer state lives on our server, not your browser or OBS. If your computer or stream crashes and you reconnect, the countdown picks up exactly where it left off — nothing to re-enter.",
  },
  {
    q: "Do I have to reconfigure my alerts and overlay every time I go live?",
    a: "No. Your timer rules, sound alerts, and overlay style are saved to your account and stay in place from stream to stream.",
  },
  {
    q: "Can I check everything is working before I go live?",
    a: 'Yes — the "Verify Connection" button in the configurator confirms both your Twitch connection and your overlay are active, so you can check in OBS before you\'re live, not during.',
  },
  {
    q: "Does it work with OBS, Streamlabs, or other broadcasting software?",
    a: "Yes. The timer runs as a standard Browser Source URL, so it works with OBS, Streamlabs, and any software that supports browser sources.",
  },
  {
    q: "Can viewers add time with something other than Bits?",
    a: "Yes — subs, gifted subs, follows, hype train, and charity donations can all be configured to add time, and you control how much each one is worth.",
  },
  {
    q: "Is it free?",
    a: "Yes. The core timer, overlay, and Bit Alerts are free to use.",
  },
];

export function renderSubathonTimerPage(options = {}) {
  const base = String(options.base || "");
  const loginUrl = `${base}/auth/login?next=${encodeURIComponent(
    "/overlay/config",
  )}`;
  const configUrl = `${base}/overlay/config`;
  const isAdmin = Boolean(options.isAdmin);
  const adminName = options.adminName
    ? String(options.adminName)
    : "your Twitch account";
  const privacyUrl = `${base}/privacy`;
  const gdprUrl = `${base}/gdpr`;
  const termsUrl = `${base}/terms`;
  const showUtilitiesLink = Boolean(options.showUtilitiesLink);
  const showAdminLink = Boolean(options.showAdminLink);
  const headerAdminName = isAdmin ? adminName : "";

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Twitch Subathon Timer – Free, Reliable Countdown Timer | Livestreamer Hub</title>
    <meta name="description" content="Free Twitch subathon timer that adds time from Bits, subs, gifted subs, and follows. OBS-ready overlay, live style editor, and reconnects automatically if anything drops." />
    <link rel="canonical" href="https://livestreamerhub.com/subathon-timer" />
    <meta property="og:title" content="Twitch Subathon Timer – Free, Reliable Countdown Timer" />
    <meta property="og:description" content="Free Twitch subathon timer that adds time from Bits, subs, gifted subs, and follows. OBS-ready overlay and automatic reconnect." />
    <meta property="og:image" content="https://livestreamerhub.com/assets/link_preview.png" />
    <meta property="og:url" content="https://livestreamerhub.com/subathon-timer" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Twitch Subathon Timer – Free, Reliable Countdown Timer" />
    <meta name="twitter:description" content="Free Twitch subathon timer that adds time from Bits, subs, gifted subs, and follows. OBS-ready overlay and automatic reconnect." />
    <meta name="twitter:image" content="https://livestreamerhub.com/assets/link_preview.png" />
    <link rel="icon" type="image/png" href="/assets/convertico-coin_24x24.png">
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Livestreamer Hub Subathon Timer",
      "url": "https://livestreamerhub.com/subathon-timer",
      "description": "Free Twitch subathon timer that adds time from Bits, subs, gifted subs, and follows, with an OBS-ready overlay.",
      "applicationCategory": "Multimedia",
      "operatingSystem": "Web",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      }
    }
    </script>
    <script type="application/ld+json">
    ${JSON.stringify(faqJsonLd)}
    </script>
    <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="6770198d-2c1f-46f8-af4b-694edc70484c" type="text/javascript"></script>
    ${renderThemeBootstrapScript()}
    ${renderFirebaseScript()}
    <style>
      ${THEME_CSS_VARS}
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--home-bg); color: var(--text-color); display:flex; flex-direction:column; min-height:100vh; }
      main { width: 100%; max-width: 1100px; margin: 0 auto; padding: 0 24px 72px; }
      p { line-height: 1.6; }

      .cta { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 18px; border-radius: 999px; border: 0; font-weight: 600; font-size: 15px; cursor: pointer; text-decoration: none; transition: transform .1s ease, box-shadow .2s ease, opacity .15s ease; }
      .cta.primary { background: linear-gradient(135deg, #9146FF, #772CE8); color: #fff; box-shadow: 0 6px 18px rgba(145,70,255,0.35); }
      .cta.secondary { background: var(--secondary-button-bg); color: var(--secondary-button-text); border: 1px solid var(--secondary-button-border); }
      .cta:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(0,0,0,0.2); }
      .cta:active { transform: translateY(0); }

      .hero { text-align: center; padding: 72px 24px 60px; }
      .hero .eyebrow { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent-color); margin-bottom: 16px; }
      .hero h1 { font-size: clamp(32px, 4.6vw, 48px); font-weight: 800; line-height: 1.15; margin: 0 0 20px; background: linear-gradient(135deg, var(--text-color) 30%, var(--accent-color) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
      .hero .hero-desc { font-size: 18px; line-height: 1.6; color: var(--text-muted); max-width: 620px; margin: 0 auto 36px; }
      .hero-ctas { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

      .section-divider { display: flex; align-items: center; gap: 16px; margin: 0 0 64px; color: var(--text-muted); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
      .section-divider::before, .section-divider::after { content: ''; flex: 1; height: 1px; background: var(--surface-border); }

      .intro-section { max-width: 720px; margin: 0 auto 64px; text-align: center; }
      .intro-section h2 { font-size: 24px; font-weight: 700; margin: 0 0 14px; }
      .intro-section p { color: var(--text-muted); font-size: 16px; line-height: 1.7; }

      .feature-block { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; margin-bottom: 88px; }
      .tag-pill { display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(145, 70, 255, 0.12); color: var(--accent-color); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 16px; }
      .feature-text h2 { font-size: clamp(22px, 2.8vw, 32px); font-weight: 700; line-height: 1.2; margin: 0 0 16px; }
      .feature-text p { color: var(--text-muted); line-height: 1.65; margin: 0 0 20px; font-size: 16px; }
      .feature-bullets { list-style: none; padding: 0; margin: 0 0 28px; display: flex; flex-direction: column; gap: 10px; }
      .feature-bullets li { display: flex; align-items: flex-start; gap: 10px; color: var(--text-muted); font-size: 15px; }
      .feature-bullets li::before { content: '\\2713'; color: var(--accent-color); font-weight: 700; flex-shrink: 0; margin-top: 1px; }
      .feature-ctas { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }

      .feature-screenshots { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
      .screenshot-card { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 14px; overflow: hidden; box-shadow: 0 8px 32px var(--goal-card-shadow); }
      .screenshot-card img { width: 100%; height: auto; display: block; }

      .faq-section { margin-bottom: 72px; }
      .faq-section > h2 { font-size: 26px; font-weight: 700; text-align: center; margin: 0 0 32px; }
      .faq-list { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
      .faq-item { background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: 14px; padding: 18px 22px; box-shadow: 0 4px 20px var(--goal-card-shadow); }
      .faq-item h3 { margin: 0 0 8px; font-size: 16px; font-weight: 700; }
      .faq-item p { margin: 0; font-size: 14.5px; color: var(--text-muted); line-height: 1.6; }

      .global-footer { margin-top: 40px; display: flex; flex-wrap: wrap; gap: 16px; font-size: 14px; color: var(--text-muted); align-items: center; justify-content: center; }
      .global-footer a { color: var(--text-muted); text-decoration: none; font-weight: 500; display: inline-flex; align-items: center; gap: 5px; }
      .global-footer a:hover { color: var(--accent-color); }
      .global-footer .discord-icon { width: 16px; height: 16px; fill: currentColor; flex-shrink: 0; }

      @media (max-width: 840px) {
        .feature-block { grid-template-columns: 1fr; gap: 32px; margin-bottom: 56px; }
        .feature-screenshots { grid-template-columns: 1fr; max-width: 420px; margin: 0 auto; }
      }
      @media (max-width: 600px) {
        main { padding: 0 18px 56px; }
        .hero { padding: 48px 0 40px; }
        .hero h1 { font-size: 28px; }
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
        <div class="eyebrow">Free Twitch Subathon Timer</div>
        <h1>A subathon timer built to keep running when everything else stops</h1>
        <p class="hero-desc">Viewers add time with Bits, subs, gifted subs, follows, and hype trains. You control pace with pause, resume, and manual time adjustments — all from a browser-source overlay that reconnects on its own if anything drops mid-stream.</p>
        <div class="hero-ctas">
          <a class="cta primary" href="${loginUrl}">Sign in with Twitch</a>
          <a class="cta secondary" href="${configUrl}">Open Configurator</a>
        </div>
      </section>

      <!-- What is a subathon timer -->
      <section class="intro-section">
        <h2>What is a subathon timer?</h2>
        <p>A subathon timer is a countdown clock, usually shown as a stream overlay, that adds time whenever viewers support the stream — Bits, subs, gifted subs, follows, or donations. The stream keeps going as long as the timer has time left, which is what makes subathons feel like a shared, collaborative event instead of a fixed-length broadcast.</p>
      </section>

      <div class="section-divider">How it works</div>

      <!-- Timer Overlay -->
      <div class="feature-block">
        <div class="feature-text">
          <div class="tag-pill">Timer Overlay</div>
          <h2>Everything a subathon needs, in one overlay</h2>
          <p>Fully configurable countdown timer for subathons, charity streams, and any event where viewer contributions keep the clock alive.</p>
          <ul class="feature-bullets">
            <li>Live style editor with real-time overlay preview</li>
            <li>Bits, subs, gift subs, follows, hype train, and charity donations all add time</li>
            <li>Pause, resume, and manual time controls when you need them</li>
            <li>Goal bar trackers for milestone fundraising</li>
            <li>OBS Browser Source URL generated automatically — no manual widget setup</li>
            <li>Reconnects automatically if your connection drops mid-stream</li>
          </ul>
          <div class="feature-ctas">
            <a class="cta secondary" href="${configUrl}">Open Configurator</a>
          </div>
        </div>
        <div class="feature-screenshots">
          <div class="screenshot-card">
            <img src="/assets/screenshots/new_timer_screenshot.png" alt="Subathon timer configurator with live overlay preview and controls" loading="lazy" />
          </div>
          <div class="screenshot-card">
            <img src="/assets/screenshots/newGoalbarScreenshot.png" alt="Goal bar configurator with live preview and appearance controls" loading="lazy" />
          </div>
        </div>
      </div>

      <!-- FAQ -->
      <section class="faq-section">
        <h2>Common questions</h2>
        <div class="faq-list">
          ${FAQS.map(
            (f) => `<div class="faq-item">
            <h3>${f.q}</h3>
            <p>${f.a}</p>
          </div>`,
          ).join("\n")}
        </div>
      </section>

      <!-- CTA -->
      <section class="hero" style="padding: 24px 24px 48px;">
        <div class="hero-ctas">
          <a class="cta primary" href="${loginUrl}">Sign in with Twitch</a>
          <a class="cta secondary" href="${base}/">See everything else Livestreamer Hub includes</a>
        </div>
      </section>

      <!-- Footer -->
      <footer class="global-footer">
        <a href="${termsUrl}">Terms of Service</a>
        <a href="${privacyUrl}">Privacy Policy</a>
        <a href="${gdprUrl}">GDPR / UK GDPR Disclosure</a>
        <a href="https://discord.gg/nwu4w5cUVd" target="_blank" rel="noopener noreferrer"><svg class="discord-icon" viewBox="0 0 127.14 96.36" xmlns="http://www.w3.org/2000/svg"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53.05s5-12.68 11.45-12.68S54 46.09 53.89 53.05 48.84 65.69 42.45 65.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53.05s5-12.68 11.44-12.68S96.23 46.09 96.12 53.05 91.08 65.69 84.69 65.69Z"/></svg> Discord</a>
      </footer>

    </main>
  </body>
</html>`;
}
