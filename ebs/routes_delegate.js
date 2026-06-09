import { addDelegate, removeDelegate, listDelegates, getDelegatableChannels, isDelegate } from './delegate_store.js';
import { fetchUserDisplayName, lookupUserByLogin } from './twitch_api.js';
import { logger } from './logger.js';

export function mountDelegateRoutes(app, ctx) {
  const { getUserProfile } = ctx;

  function sessionUid(req) {
    return req?.session?.twitchUser?.id ? String(req.session.twitchUser.id) : null;
  }

  function requireLogin(req, res) {
    if (!req.session?.isAdmin) {
      res.status(401).json({ error: 'Login required' });
      return null;
    }
    const uid = sessionUid(req);
    if (!uid) { res.status(401).json({ error: 'Login required' }); return null; }
    return uid;
  }

  // Channels this user can manage as delegate
  app.get('/api/delegate/my-channels', async (req, res) => {
    const uid = requireLogin(req, res);
    if (!uid) return;
    try {
      const rows = await getDelegatableChannels(uid);
      const channels = await Promise.all(rows.map(async (r) => {
        const profile = getUserProfile ? getUserProfile(r.channel_id) : null;
        const displayName =
          profile?.displayName || profile?.login ||
          await fetchUserDisplayName(r.channel_id, r.channel_id).catch(() => null) ||
          r.channel_id;
        return { channelId: r.channel_id, displayName, grantedAt: r.granted_at };
      }));
      res.json({ channels });
    } catch (err) {
      logger.error('delegate_my_channels_failed', { message: err?.message });
      res.status(500).json({ error: err?.message || 'Query failed' });
    }
  });

  // List delegates for the logged-in broadcaster's own channel
  app.get('/api/delegate/list', async (req, res) => {
    const uid = requireLogin(req, res);
    if (!uid) return;
    try {
      const rows = await listDelegates(uid);
      const delegates = await Promise.all(rows.map(async (d) => ({
        userId: d.delegate_user_id,
        grantedAt: d.granted_at,
        displayName:
          await fetchUserDisplayName(d.delegate_user_id, uid).catch(() => null) ||
          d.delegate_user_id,
      })));
      res.json({ delegates });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Query failed' });
    }
  });

  // Add a delegate by Twitch login name
  app.post('/api/delegate/add', async (req, res) => {
    const uid = requireLogin(req, res);
    if (!uid) return;
    const { login } = req.body || {};
    if (!login || typeof login !== 'string') return res.status(400).json({ error: 'login required' });
    const sanitized = login.trim().toLowerCase();
    try {
      const user = await lookupUserByLogin(sanitized, uid);
      if (!user) return res.status(404).json({ error: `Twitch user '${sanitized}' not found` });
      if (user.id === uid) return res.status(400).json({ error: 'Cannot add yourself as a delegate' });
      await addDelegate(uid, user.id, uid);
      logger.info('delegate_added', { channelId: uid, delegateId: user.id });
      res.json({ ok: true, userId: user.id, displayName: user.displayName });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Failed to add delegate' });
    }
  });

  // Remove a delegate
  app.delete('/api/delegate/:delegateId', async (req, res) => {
    const uid = requireLogin(req, res);
    if (!uid) return;
    const delegateId = String(req.params.delegateId);
    try {
      await removeDelegate(uid, delegateId);
      logger.info('delegate_removed', { channelId: uid, delegateId });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Failed to remove delegate' });
    }
  });

  // Verify and switch to managing a specific channel
  // Sets req.session.managingAs and returns { ok, channelId, displayName }
  app.post('/api/delegate/switch', async (req, res) => {
    const uid = requireLogin(req, res);
    if (!uid) return;
    const { channelId } = req.body || {};
    if (!channelId) return res.status(400).json({ error: 'channelId required' });
    const target = String(channelId);
    // Allow switching to own channel (just clears delegate context)
    if (target === uid) {
      req.session.managingAs = null;
      req.session.managingAsName = null;
      return res.json({ ok: true, channelId: uid, own: true });
    }
    try {
      const ok = await isDelegate(target, uid);
      if (!ok) return res.status(403).json({ error: 'You are not a delegate for this channel' });
      const profile = getUserProfile ? getUserProfile(target) : null;
      const displayName =
        profile?.displayName || profile?.login ||
        await fetchUserDisplayName(target, target).catch(() => null) ||
        target;
      req.session.managingAs = target;
      req.session.managingAsName = displayName;
      res.json({ ok: true, channelId: target, displayName });
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Switch failed' });
    }
  });

  // Clear delegate context (stop managing another channel)
  app.post('/api/delegate/stop', (req, res) => {
    if (!req.session?.isAdmin) return res.status(401).json({ error: 'Login required' });
    req.session.managingAs = null;
    req.session.managingAsName = null;
    res.json({ ok: true });
  });
}
