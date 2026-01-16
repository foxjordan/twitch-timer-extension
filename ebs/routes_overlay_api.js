import { logger } from './logger.js';

export function mountOverlayApiRoutes(app, ctx) {
  const { requireOverlayAuth, normKey, getSavedStyle, setSavedStyle, getOrCreateUserKey, rotateUserKey, getUserSettings, setUserSettings, sseClients, getRules, setRules, setMaxTotalSeconds, resolveTimerUserId } = ctx;

  // Resolve the broadcaster ID that this user is managing
  // This ensures rules are saved/loaded for the correct broadcaster
  const resolveManagedBroadcasterId = (req) => {
    // If we have a timer user ID resolver, use it (handles overlay key mapping)
    if (typeof resolveTimerUserId === 'function') {
      const resolved = resolveTimerUserId(req);
      if (resolved && resolved !== 'default') return resolved;
    }
    // Fall back to the logged-in user's ID
    return req.session?.twitchUser?.id;
  };

  // Style read (public to overlays/key holder)
  app.get('/api/overlay/style', (req, res) => {
    if (!requireOverlayAuth(req, res)) return;
    const key = normKey(req.query.key);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(getSavedStyle(key));
  });

  // Style update (admin only)
  app.post('/api/overlay/style', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const key = normKey(req.query.key);
    const saved = setSavedStyle(key, req.body || {});
    // Fan-out style update to SSE clients with the same key
    for (const client of Array.from(sseClients || [])) {
      if (client.key !== key) continue;
      try {
        client.res.write('event: style_update\n');
        client.res.write(`data: ${JSON.stringify(saved)}\n\n`);
      } catch (e) { try { sseClients.delete(client); } catch {} }
    }
    logger.info('overlay_style_saved', {
      requestId: req.requestId,
      key,
      userId: req.session?.twitchUser?.id,
    });
    res.json(saved);
  });

  // Per-user overlay key helpers (admin)
  app.get('/api/overlay/key', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const uid = req.session?.twitchUser?.id;
    if (!uid) return res.status(400).json({ error: 'No user in session' });
    const key = getOrCreateUserKey(uid);
    req.session.userOverlayKey = key;
    logger.info('overlay_key_issued', {
      requestId: req.requestId,
      userId: uid,
    });
    res.json({ key });
  });

  app.post('/api/overlay/key/rotate', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const uid = String(req.session?.twitchUser?.id || '');
    if (!uid) return res.status(400).json({ error: 'No user in session' });
    const key = rotateUserKey(uid);
    req.session.userOverlayKey = key;
    logger.info('overlay_key_rotated', {
      requestId: req.requestId,
      userId: uid,
    });
    res.json({ key });
  });

  // Per-user settings (admin)
  app.get('/api/user/settings', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const uid = req.session?.twitchUser?.id;
    if (!uid) return res.status(400).json({ error: 'No user in session' });
    res.json(getUserSettings(uid));
  });

  app.post('/api/user/settings', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const uid = req.session?.twitchUser?.id;
    if (!uid) return res.status(400).json({ error: 'No user in session' });
    const saved = setUserSettings(uid, req.body || {});
    // propagate max cap into runtime state for immediate effect
    try { if (typeof setMaxTotalSeconds === 'function') setMaxTotalSeconds(Number(saved.maxTotalSeconds||0)); } catch(e) {}
    logger.info('user_settings_saved', {
      requestId: req.requestId,
      userId: uid,
    });
    res.json(saved);
  });

  // Rules (admin only)
  // Uses resolveManagedBroadcasterId to ensure rules are saved/loaded for the
  // correct broadcaster (the one whose events will trigger the timer)
  app.get('/api/rules', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    try {
      const uid = resolveManagedBroadcasterId(req);
      res.json(getRules(uid));
    } catch (e) {
      res.status(500).json({ error: 'Failed to load rules' });
    }
  });

  app.post('/api/rules', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    try {
      const uid = resolveManagedBroadcasterId(req);
      const saved = setRules(uid, req.body || {});
      logger.info('rules_saved', {
        requestId: req.requestId,
        visitorUserId: req.session?.twitchUser?.id,
        broadcasterId: uid,
      });
      res.json(saved);
    } catch (e) {
      res.status(400).json({ error: 'Invalid rules payload' });
    }
  });
}
