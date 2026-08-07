/**
 * Installs a mock window.Twitch.ext covering exactly the SDK surface
 * extension/src/{App,ComponentApp,ConfigApp}.jsx actually call — see the
 * design doc for how this list was derived. Dev/preview-only; never
 * imported by any real production entry point.
 */
export function installPreviewTwitchMock({ channelId, token }) {
  const authListeners = [];
  const contextListeners = [];
  const featureChangeListeners = [];
  let currentContext = { theme: 'dark', language: 'en' };

  window.Twitch = {
    ext: {
      onAuthorized(cb) {
        authListeners.push(cb);
        cb({ channelId, token, clientId: 'preview', userId: channelId });
      },
      onContext(cb) {
        contextListeners.push(cb);
        cb(currentContext);
      },
      features: {
        isBitsEnabled: true,
        onChanged(cb) {
          featureChangeListeners.push(cb);
        },
      },
      bits: {
        showBitsBalance() {
          console.log('[preview] bits.showBitsBalance() called');
        },
        useBits(tier) {
          console.log('[preview] bits.useBits() called with tier', tier);
        },
        onTransactionComplete() {
          // Not fired in v1 — no simulated transactions.
        },
        onTransactionCancelled() {
          // Not fired in v1 — no simulated transactions.
        },
      },
      listen() {
        // Not fired in v1 — no simulated broadcast/alert messages.
      },
    },
  };

  // Lets the preview shell (extension/preview.html) push a live theme
  // change into this iframe without a full reload.
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'preview-theme') return;
    currentContext = { ...currentContext, theme: event.data.theme };
    contextListeners.forEach((cb) => cb(currentContext));
  });
}
