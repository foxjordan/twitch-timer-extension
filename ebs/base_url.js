/**
 * Resolve the public-facing base URL from an Express request.
 *
 * Behind reverse proxies (Fly.io, Cloudflare, etc.) the Host header often
 * contains the internal hostname rather than the domain the visitor typed.
 * We prefer the Origin header (set by browsers on same-origin navigations)
 * or Referer as reliable sources of the actual domain.
 *
 * For internal redirects and page links, prefer using empty string as `base`
 * so that all paths are relative (same-origin). This function is mainly
 * needed for OAuth redirect URIs that require a full URL.
 */
export function getBaseUrl(req) {
  if (process.env.SERVER_BASE_URL) return process.env.SERVER_BASE_URL;

  // Origin header is the most reliable for the domain the user is on
  const origin = req.get('origin');
  if (origin && !origin.includes('ext-twitch.tv')) return origin;

  // Referer as fallback (strip path portion)
  const referer = req.get('referer');
  if (referer) {
    try {
      const u = new URL(referer);
      return u.origin;
    } catch {}
  }

  // X-Forwarded-Host (some proxies set this)
  const fwdHost = req.get('x-forwarded-host');
  if (fwdHost) {
    const proto = req.protocol;
    return `${proto}://${fwdHost}`;
  }

  // Last resort: Host header
  const proto = req.protocol;
  const host = req.get('host') || req.hostname;
  return `${proto}://${host}`;
}
