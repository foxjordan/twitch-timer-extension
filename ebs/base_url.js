/**
 * Resolve the public-facing base URL from an Express request.
 *
 * Behind reverse proxies (Fly.io, Cloudflare, etc.) the Host header may
 * contain the internal hostname rather than the domain the visitor typed.
 * X-Forwarded-Host carries the original hostname; prefer it when available.
 */
export function getBaseUrl(req) {
  if (process.env.SERVER_BASE_URL) return process.env.SERVER_BASE_URL;
  const host =
    req.get('x-forwarded-host') || req.get('host') || req.hostname;
  const proto = req.protocol; // respects trust-proxy setting
  return `${proto}://${host}`;
}
