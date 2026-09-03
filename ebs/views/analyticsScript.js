// First-party dashboard analytics. Injected into every ebs/views/* page next to
// renderThemeBootstrapScript()/renderFirebaseScript(). Posts to the existing
// /api/analytics/dashboard-event endpoint (session-authed, sanitised, writes
// client_events). Fire-and-forget: never blocks, silent on failure.
export function renderAnalyticsScript({ page } = {}) {
  const pageName = String(page || '').slice(0, 60);
  const p = JSON.stringify(pageName);
  return `<script>
  (function () {
    var lsh = (window.lsh = window.lsh || {});
    lsh.track = function (event, params) {
      try {
        fetch('/api/analytics/dashboard-event', {
          method: 'POST', credentials: 'same-origin', keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: event, params: params || {} })
        }).catch(function () {});
      } catch (e) {}
    };
    lsh.feature = function (key) { lsh.track('feature_view', { feature: key }); };
    lsh.use = function (key, action) { lsh.track('feature_use', { feature: key, action: action }); };
    ${pageName ? `lsh.track('page_view', { page: ${p} });` : ``}
  })();
</script>`;
}
