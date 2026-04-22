// Analytics removed — Firebase SDK caused CSP violations in Twitch's extension sandbox.
// All calls are no-ops so import sites don't need changes.

export async function setupAnalytics() {
  return null;
}

export function logEvent(_eventName, _params) {}

export const app = null;
