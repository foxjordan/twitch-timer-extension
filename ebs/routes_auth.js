import crypto from 'crypto';
import fetch from 'node-fetch';
import { getOrCreateUserKey } from './keys.js';
import { renderLoggedOutPage } from './views/loggedOutPage.js';

function buildRedirectURI(req) {
  const base = process.env.SERVER_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/auth/callback`;
}

export function mountAuthRoutes(app, opts = {}) {
  app.get('/auth/login', (req, res) => {
    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!clientId) return res.status(500).send('Missing TWITCH_CLIENT_ID');
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: buildRedirectURI(req),
      response_type: 'code',
      // Scopes required to subscribe to EventSub topics for the logged-in broadcaster.
      // Include follows (moderator scope), subs, bits, charity, hype train.
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
      if (!code || !state || state !== req.session.oauthState) {
        return res.status(400).send('Invalid OAuth state');
      }
      delete req.session.oauthState;

      const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.TWITCH_CLIENT_ID,
          client_secret: process.env.TWITCH_CLIENT_SECRET,
          code: String(code),
          grant_type: 'authorization_code',
          redirect_uri: buildRedirectURI(req)
        })
      });
      const tokenJson = await tokenRes.json();
      const accessToken = tokenJson.access_token;
      if (!accessToken) return res.status(400).send('OAuth token exchange failed');

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
      // notify host (server) of admin login for dynamic broadcaster/eventsub wiring
      try { if (opts && typeof opts.onAdminLogin === 'function') opts.onAdminLogin({ user, accessToken }); } catch {}
      const next = req.query.next || '/overlay/config';
      const base = process.env.SERVER_BASE_URL || `${req.protocol}://${req.get('host')}`;
      res.redirect(`${base}${String(next).startsWith('/') ? next : '/overlay/config'}`);
    } catch (e) {
      console.error('OAuth callback error', e);
      res.status(500).send('OAuth error');
    }
  });

  app.post('/auth/logout', (req, res) => {
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    try { res.clearCookie('overlay.sid', { path: '/', sameSite: 'lax', secure }); } catch {}
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  // Convenience GET logout that redirects to login
  app.get('/auth/logout', (req, res) => {
    const next = req.query.next || '/overlay/config';
    const base = process.env.SERVER_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    try { res.clearCookie('overlay.sid', { path: '/', sameSite: 'lax', secure }); } catch {}
    req.session.destroy(() => {
      res.redirect(`${base}/auth/logged-out?next=${encodeURIComponent(String(next))}`);
    });
  });

  // Simple logged-out page to avoid immediately re-authing via Twitch SSO
  app.get('/auth/logged-out', (req, res) => {
    const base = process.env.SERVER_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const next = req.query.next || '/overlay/config';
    const html = renderLoggedOutPage({ base, next });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(html);
  });

  // Convenience alias
  app.get('/oauth/callback', (req, res) => {
    const base = process.env.SERVER_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(`${base}/auth/callback${qs}`);
  });
}
