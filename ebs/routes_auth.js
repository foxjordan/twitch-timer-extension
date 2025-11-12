import crypto from 'crypto';
import fetch from 'node-fetch';
import { getOrCreateUserKey } from './keys.js';

function buildRedirectURI(req) {
  const base = process.env.SERVER_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/auth/callback`;
}

export function mountAuthRoutes(app) {
  app.get('/auth/login', (req, res) => {
    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!clientId) return res.status(500).send('Missing TWITCH_CLIENT_ID');
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: buildRedirectURI(req),
      response_type: 'code',
      scope: '',
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

      const isAdmin = String(user.id) === String(process.env.BROADCASTER_USER_ID);
      if (!isAdmin) return res.status(403).send('Not authorized for this configurator');

      req.session.isAdmin = true;
      req.session.twitchUser = { id: user.id, login: user.login, display_name: user.display_name };
      // ensure a per-user overlay key exists and store in session for convenience
      try { req.session.userOverlayKey = getOrCreateUserKey(user.id); } catch {}
      const next = req.query.next || '/overlay/config';
      const base = process.env.SERVER_BASE_URL || `${req.protocol}://${req.get('host')}`;
      res.redirect(`${base}${String(next).startsWith('/') ? next : '/overlay/config'}`);
    } catch (e) {
      console.error('OAuth callback error', e);
      res.status(500).send('OAuth error');
    }
  });

  app.post('/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  // Convenience alias
  app.get('/oauth/callback', (req, res) => {
    const base = process.env.SERVER_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(`${base}/auth/callback${qs}`);
  });
}
