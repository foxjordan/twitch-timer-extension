// Lightweight first-party analytics. Events are POSTed to our own EBS (the
// same origin every other API call in this app already uses), which avoids
// the CSP violations the removed Firebase SDK caused inside Twitch's
// extension sandbox. See ebs/routes_analytics.js for the receiving endpoint.

const EBS_BASE = import.meta.env.VITE_EBS_BASE || "https://livestreamerhub.com";

const ctx = { channelId: null, token: null, language: null, theme: null, surface: null };

// Called once with the auth data from Twitch.ext.onAuthorized, before the
// first logEvent() call in that same callback.
export function setAnalyticsAuth(authData) {
  ctx.channelId = authData?.channelId || null;
  ctx.token = authData?.token || null;
}

export async function setupAnalytics(surface) {
  ctx.surface = surface || ctx.surface;
  window.Twitch?.ext?.onContext((context) => {
    if (context?.language) ctx.language = context.language;
    if (context?.theme) ctx.theme = context.theme;
  });
  return null;
}

export function logEvent(eventName, params = {}) {
  if (!ctx.channelId || !ctx.token) return;
  fetch(`${EBS_BASE}/api/analytics/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.token}` },
    body: JSON.stringify({
      event: eventName,
      surface: ctx.surface,
      language: ctx.language,
      theme: ctx.theme,
      params,
    }),
    keepalive: true,
  }).catch(() => {});
}

export const app = null;
