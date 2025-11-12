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
    const html = `<!doctype html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Logged out</title>
<style>body{margin:0;font-family:system-ui,Arial;background:#0e0e10;color:#efeff1;display:flex;align-items:center;justify-content:center;height:100vh}
.box{background:#1f1f23;border:1px solid #303038;border-radius:12px;padding:24px;max-width:520px}
button{background:#9146FF;color:#fff;border:0;padding:10px 14px;border-radius:8px;cursor:pointer}</style>
</head><body>
<div class="box">
  <h2 style="margin:0 0 8px">You are logged out</h2>
  <p style="opacity:.85;margin:0 0 16px">To sign in again, click the button below.</p>
  <a href="${base}/auth/login?next=${encodeURIComponent(String(next))}"><button>Sign in with Twitch</button></a>
  <div style="opacity:.7;font-size:12px;margin-top:10px">Note: you may still be signed into Twitch in this browser, which can auto-complete sign-in.</div>
</div>
</body></html>`;
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
