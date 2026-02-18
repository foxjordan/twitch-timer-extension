/**
 * Renders a <script type="module"> block that loads Firebase from CDN
 * and initialises Analytics (plus the core app).
 *
 * Config values are read from process.env so they stay out of source control
 * (stored as Fly.io secrets).  If the required env vars are missing the
 * function returns an empty string — pages still render, just without analytics.
 */
export function renderFirebaseScript() {
  const apiKey = process.env.FIREBASE_API_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const measurementId = process.env.FIREBASE_MEASUREMENT_ID;

  // Bail out silently when config isn't available (local dev, etc.)
  if (!apiKey || !projectId) return "";

  const config = JSON.stringify({
    apiKey,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || "",
    measurementId: measurementId || "",
  });

  return `
    <script type="module">
      import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
      import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-analytics.js";
      try {
        const app = initializeApp(${config});
        if (${JSON.stringify(!!measurementId)}) getAnalytics(app);
      } catch (e) {
        console.warn("Firebase init skipped:", e.message);
      }
    </script>`;
}
