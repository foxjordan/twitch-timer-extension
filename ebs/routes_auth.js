import crypto from 'crypto';
import fetch from 'node-fetch';
import { getOrCreateUserKey } from './keys.js';
import { renderLoggedOutPage } from './views/loggedOutPage.js';
import { logger } from './logger.js';
import { storeUserAccessToken } from './twitch_tokens.js';
import { getBaseUrl } from './base_url.js';

/**
 * Build a signed OAuth state value that encodes the origin so the callback
 * can reconstruct the exact redirect_uri even if the in-memory session is
 * lost (e.g. Fly machine restart between login and callback).
 *
 * Format: <nonce>.<base64url(origin)>.<hmac>
 */
function buildSignedState(origin, secret) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const originB64 = Buffer.from(origin).toString('base64url');
  const payload = `${nonce}.${originB64}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

/**
 * Verify and decode a signed state value.
 * Returns { valid: true, origin } or { valid: false }.
 */
function verifySignedState(state, secret) {
  if (!state || typeof state !== 'string') return { valid: false };
  const parts = state.split('.');
  if (parts.length !== 3) return { valid: false };
  const [nonce, originB64, hmac] = parts;
  const payload = `${nonce}.${originB64}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'))) {
    return { valid: false };
  }
  try {
    const origin = Buffer.from(originB64, 'base64url').toString();
    return { valid: true, origin };
  } catch {
    return { valid: false };
  }
}

export function mountAuthRoutes(app, opts = {}) {
  // Use a stable secret for signing OAuth state values.
  // TWITCH_CLIENT_SECRET is always set and stable across restarts.
  const stateSigningKey = process.env.SESSION_SECRET || process.env.TWITCH_CLIENT_SECRET || 'fallback-oauth-state-key';

  app.get('/auth/login', (req, res) => {
    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!clientId) return res.status(500).send('Missing TWITCH_CLIENT_ID');

    const origin = getBaseUrl(req);
    const state = buildSignedState(origin, stateSigningKey);
    const redirectUri = `${origin}/auth/callback`;

    // Also store in session as a fallback (if session survives, great)
    req.session.oauthState = state;
    req.session.oauthOrigin = origin;

    logger.info('oauth_login_start', {
      resolvedBase: origin,
      redirectUri,
      host: req.get('host'),
      origin: req.get('origin'),
      referer: req.get('referer'),
      xForwardedHost: req.get('x-forwarded-host'),
      protocol: req.protocol,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'channel:read:subscriptions bits:read channel:read:charity channel:read:hype_train moderator:read:followers',
      force_verify: 'true',
      state
    });
    const url = `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
    req.session.save(() => res.redirect(url));
  });

  app.get('/auth/callback', async (req, res) => {
    try {
      const { code, state } = req.query;

      // Verify the signed state (works even if session was lost)
      const verified = verifySignedState(state, stateSigningKey);
      const sessionStateMatch = state && state === req.session?.oauthState;

      logger.info('oauth_callback_start', {
        hasCode: !!code,
        hasState: !!state,
        signedStateValid: verified.valid,
        sessionStateMatch,
        hasSession: !!req.session,
        sessionKeys: req.session ? Object.keys(req.session) : [],
        host: req.get('host'),
        cookie: req.get('cookie') ? 'present' : 'missing',
        extractedOrigin: verified.origin,
      });

      if (!code || !state || !verified.valid) {
        logger.warn('oauth_state_invalid', {
          hasCode: !!code,
          hasState: !!state,
          signedValid: verified.valid,
        });
        return res.status(400).send('Invalid OAuth state');
      }

      // Clean up session state if it survived
      delete req.session.oauthState;

      // Use the origin from the signed state for the redirect_uri
      const callbackOrigin = verified.origin;
      const redirectUri = `${callbackOrigin}/auth/callback`;

      const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.TWITCH_CLIENT_ID,
          client_secret: process.env.TWITCH_CLIENT_SECRET,
          code: String(code),
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });
      const tokenJson = await tokenRes.json();
      const accessToken = tokenJson.access_token;
      const expiresIn = tokenJson.expires_in;
      if (!accessToken) {
        logger.error('oauth_token_exchange_failed', { error: tokenJson.error, message: tokenJson.message });
        return res.status(400).send('OAuth token exchange failed');
      }

      const userRes = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          'Client-Id': process.env.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`
        }
      });
      const userJson = await userRes.json();
      const user = userJson?.data?.[0];
      if (!user) return res.status(400).send('Failed to fetch Twitch user');

      // Treat any signed-in Twitch user as the admin of their own session.
      // Their channel ID is used for broadcasts + EventSub wiring.
      req.session.isAdmin = true;
      req.session.twitchUser = { id: user.id, login: user.login, display_name: user.display_name };
      // ensure a per-user overlay key exists and store in session for convenience
      try { req.session.userOverlayKey = getOrCreateUserKey(user.id); } catch {}
      try { storeUserAccessToken(user.id, accessToken, expiresIn); } catch {}
      // notify host (server) of admin login for dynamic broadcaster/eventsub wiring
      try { if (opts && typeof opts.onAdminLogin === 'function') opts.onAdminLogin({ user, accessToken }); } catch {}
      const next = req.query.next || '/overlay/config';
      res.redirect(String(next).startsWith('/') ? next : '/overlay/config');
    } catch (e) {
      logger.error('oauth_callback_error', { message: e?.message });
      res.status(500).send('OAuth error');
    }
  });

  app.post('/auth/logout', (req, res) => {
    const userId = req?.session?.twitchUser?.id;

    // Notify server to close EventSub connection for this user
    if (userId && opts && typeof opts.onUserLogout === 'function') {
      try {
        opts.onUserLogout(String(userId));
      } catch (e) {
        logger.error('logout_callback_failed', { message: e?.message });
      }
    }

    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    try { res.clearCookie('overlay.sid', { path: '/', sameSite: 'lax', secure }); } catch {}
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  // Convenience GET logout that redirects to login
  app.get('/auth/logout', (req, res) => {
    const userId = req?.session?.twitchUser?.id;

    // Notify server to close EventSub connection for this user
    if (userId && opts && typeof opts.onUserLogout === 'function') {
      try {
        opts.onUserLogout(String(userId));
      } catch (e) {
        logger.error('logout_callback_failed', { message: e?.message });
      }
    }

    const next = req.query.next || '/overlay/config';
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    try { res.clearCookie('overlay.sid', { path: '/', sameSite: 'lax', secure }); } catch {}
    req.session.destroy(() => {
      res.redirect(`/auth/logged-out?next=${encodeURIComponent(String(next))}`);
    });
  });

  // Simple logged-out page to avoid immediately re-authing via Twitch SSO
  app.get('/auth/logged-out', (req, res) => {
    const next = req.query.next || '/overlay/config';
    const html = renderLoggedOutPage({ base: '', next });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(html);
  });

  // Convenience alias
  app.get('/oauth/callback', (req, res) => {
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(`/auth/callback${qs}`);
  });
}
