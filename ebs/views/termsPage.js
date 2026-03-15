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

export function renderTermsPage(options = {}) {
  const base = String(options.base || "");
  const contactEmail = String(options.contactEmail || "help@darkfoxdev.com");
  const lastUpdated = String(options.lastUpdated || "March 13, 2026");

  const privacyUrl = `${base}/privacy`;
  const homeUrl = base ? `${base}/` : "/";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Terms of Service – Livestreamer Hub</title>
    <meta name="description" content="Terms of Service for Livestreamer Hub — rules, responsibilities, and acceptable use of our Twitch extension and related services." />
    <link rel="canonical" href="https://livestreamerhub.com/terms" />
    <meta property="og:title" content="Terms of Service – Livestreamer Hub" />
    <meta property="og:description" content="Terms of Service for Livestreamer Hub — rules, responsibilities, and acceptable use." />
    <meta property="og:url" content="https://livestreamerhub.com/terms" />
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
      <h1>Terms of Service</h1>
      <div class="meta">
        <span>Service: Livestreamer Hub and Twitch Timer Overlay</span>
        <span>Last updated: ${lastUpdated}</span>
      </div>
      <p>By accessing or using Livestreamer Hub, the Twitch Timer Overlay extension, or any related services (collectively, the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service.</p>

      <h2>1. Eligibility</h2>
      <p>You must be at least 13 years old to use the Service. By using the Service, you represent that you meet this age requirement. If you are under 18, you represent that a parent or guardian has reviewed and agreed to these Terms on your behalf.</p>

      <h2>2. Account and access</h2>
      <p>You access the Service by authenticating through your Twitch account. You are responsible for maintaining the security of your Twitch account credentials. You may not share your overlay keys or access credentials with unauthorized third parties. We reserve the right to suspend or terminate access to any account at our discretion.</p>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any unlawful purpose or in violation of any applicable law or regulation.</li>
        <li>Upload, transmit, or distribute content that is illegal, hateful, harassing, defamatory, obscene, or that infringes on the intellectual property rights of others.</li>
        <li>Attempt to gain unauthorized access to the Service, other users' accounts, or our servers and infrastructure.</li>
        <li>Interfere with or disrupt the Service, including through automated scripts, bots, or denial-of-service attacks.</li>
        <li>Use the text-to-speech or sound alert features to distribute hate speech, harassment, or content that violates Twitch's Community Guidelines.</li>
        <li>Reverse-engineer, decompile, or attempt to extract the source code of the Service.</li>
        <li>Resell, redistribute, or sublicense access to the Service without our written permission.</li>
        <li>Circumvent usage limits, content moderation filters, or subscription tier restrictions.</li>
      </ul>

      <h2>4. User content</h2>
      <p>You retain ownership of content you upload to the Service (sound files, video clips, overlay configurations). By uploading content, you grant us a limited, non-exclusive license to store, process, and serve that content solely for the purpose of operating the Service. You represent and warrant that you own or have obtained all necessary rights, licenses, and permissions to upload any content you provide and that it does not infringe on the intellectual property or other rights of any third party.</p>

      <h2>4a. Community Library and shared content</h2>
      <p>The Service includes a Community Library feature that allows users to share uploaded sound alerts with other broadcasters. By opting in to share content through the Community Library, you grant an additional non-exclusive license for that content to be browsed, previewed, and copied by other users of the Service for use in their own broadcasts. You may withdraw content from the Community Library at any time by disabling sharing on individual alerts.</p>
      <p>Livestreamer Hub does not pre-screen, endorse, or assume responsibility for any user-uploaded content made available through the Community Library or any other part of the Service. All content is provided by users and remains the sole responsibility of the person who uploaded it. We make no guarantees regarding the legality, accuracy, quality, or appropriateness of any user-submitted content.</p>
      <p>We reserve the right to remove any content from the Service at any time and without prior notice if we determine, in our sole discretion, that it is inappropriate, offensive, or otherwise in violation of these Terms, applicable law, or Twitch's Community Guidelines.</p>

      <h2>4b. Copyright and DMCA takedown requests</h2>
      <p>If you believe that content available through the Service infringes on your copyright or other intellectual property rights, you may submit a takedown request by contacting us at <a href="mailto:${contactEmail}">${contactEmail}</a>. Please include:</p>
      <ul>
        <li>A description of the copyrighted work you claim has been infringed.</li>
        <li>A description of the content you believe is infringing and its location within the Service (if known).</li>
        <li>Your contact information (name, email address, and, if applicable, mailing address and phone number).</li>
        <li>A statement that you have a good-faith belief that the use of the material is not authorized by the copyright owner, its agent, or the law.</li>
        <li>A statement, under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act on the owner&rsquo;s behalf.</li>
      </ul>
      <p>Upon receipt of a valid takedown request, we will promptly remove or disable access to the identified content and make reasonable efforts to notify the user who uploaded it.</p>

      <h2>5. Subscriptions and payments</h2>
      <p>Certain features of the Service require a paid Pro subscription. Payments are processed by Stripe. Subscription terms, pricing, and billing cycles are presented at the time of purchase. Unless otherwise stated:</p>
      <ul>
        <li>Subscriptions renew automatically at the end of each billing period.</li>
        <li>You may cancel your subscription at any time; access continues through the end of the current billing period.</li>
        <li>Refunds are handled on a case-by-case basis. Contact us if you believe a charge was made in error.</li>
      </ul>

      <h2>6. Bits and Twitch transactions</h2>
      <p>Viewers may use Twitch Bits to redeem sound alerts, text-to-speech messages, and other features configured by the broadcaster. These transactions are governed by Twitch's own terms and policies. We are not responsible for Bits purchased through Twitch, and Bits transactions are non-refundable through us.</p>

      <h2>7. Service availability</h2>
      <p>We strive to keep the Service available and reliable, but we do not guarantee uninterrupted or error-free operation. The Service is provided on an "as is" and "as available" basis. We may modify, suspend, or discontinue any part of the Service at any time with or without notice.</p>

      <h2>8. Limitation of liability</h2>
      <p>To the maximum extent permitted by law, Livestreamer Hub and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from or related to your use of the Service. This includes, without limitation, loss of revenue, lost stream time, data loss, or damages resulting from service interruptions. Our total liability for any claim arising from the Service shall not exceed the amount you paid us in the 12 months preceding the claim.</p>

      <h2>9. Disclaimer of warranties</h2>
      <p>The Service is provided "as is" without warranties of any kind, whether express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Service will meet your requirements, be accurate, or operate without interruption.</p>

      <h2>10. Indemnification</h2>
      <p>You agree to indemnify and hold harmless Livestreamer Hub and its operators from any claims, damages, losses, or expenses (including reasonable legal fees) arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights.</p>

      <h2>11. Termination</h2>
      <p>We may suspend or terminate your access to the Service at any time for any reason, including violation of these Terms. Upon termination, your right to use the Service ceases immediately. You may request deletion of your account and associated data at any time by contacting us or using the account deletion feature.</p>

      <h2>12. Intellectual property</h2>
      <p>The Service, including its design, code, features, and branding, is owned by Livestreamer Hub. Nothing in these Terms grants you any right to use our trademarks, logos, or other intellectual property except as expressly permitted.</p>

      <h2>13. Privacy</h2>
      <p>Your use of the Service is also governed by our <a href="${privacyUrl}">Privacy Policy</a>, which describes how we collect, use, and protect your information.</p>

      <h2>14. Changes to these Terms</h2>
      <p>We may update these Terms from time to time. Material changes will be communicated through in-product notices or updates to this page. Your continued use of the Service after changes are posted constitutes acceptance of the revised Terms. The "Last updated" date at the top reflects when the most recent revision was published.</p>

      <h2>15. Governing law</h2>
      <p>These Terms are governed by the laws of the United States. Any disputes arising from or relating to these Terms or the Service shall be resolved in accordance with applicable U.S. law.</p>

      <h2>16. Contact us</h2>
      <p>If you have questions about these Terms, email <a href="mailto:${contactEmail}">${contactEmail}</a> or reach us on <a href="https://discord.gg/nwu4w5cUVd" target="_blank" rel="noopener noreferrer">Discord</a>.</p>
      <footer class="global-footer">
        <a href="${homeUrl}">Home</a>
        <a href="${privacyUrl}">Privacy Policy</a>
        <a href="https://discord.gg/nwu4w5cUVd" target="_blank" rel="noopener noreferrer"><svg style="width:14px;height:14px;fill:currentColor;vertical-align:-2px;margin-right:3px" viewBox="0 0 127.14 96.36"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53.05s5-12.68 11.45-12.68S54 46.09 53.89 53.05 48.84 65.69 42.45 65.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53.05s5-12.68 11.44-12.68S96.23 46.09 96.12 53.05 91.08 65.69 84.69 65.69Z"/></svg>Discord</a>
      </footer>
    </main>
  </body>
</html>`;
}
