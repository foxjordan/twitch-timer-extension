import { logger } from './logger.js';

export function mountOverlayApiRoutes(app, ctx) {
  const { requireOverlayAuth, normKey, getSavedStyle, setSavedStyle, getOrCreateUserKey, rotateUserKey, getUserSettings, setUserSettings, sseClients, getRules, setRules, setMaxTotalSeconds, resolveTimerUserId, onRulesSaved, broadcasterConnections, startEventSubForUser, pauseEventSubForUser } = ctx;

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
    try { if (typeof setMaxTotalSeconds === 'function') setMaxTotalSeconds(uid, Number(saved.maxTotalSeconds||0)); } catch(e) {}
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
      if (typeof onRulesSaved === 'function') {
        try { onRulesSaved(uid); } catch (e) {}
      }
      res.json(saved);
    } catch (e) {
      res.status(400).json({ error: 'Invalid rules payload' });
    }
  });

  // Pre-stream check: confirms (and opens, if needed) the broadcaster's own
  // EventSub connection without requiring them to actually be live — go-live
  // -triggered EventSub normally only opens this on a real stream.online
  // webhook, so offline testing needs an explicit opt-in path. Auto-pauses
  // after 10 minutes if a real stream never starts, via the same
  // pauseEventSubForUser used for the stream.offline webhook. Does not touch
  // timer state at all — purely connection lifecycle.
  app.post('/api/eventsub/verify-connection', async (req, res) => {
    const userId = req.session?.twitchUser?.id;
    if (!userId) return res.status(401).json({ error: 'Login required' });
    const uid = String(userId);
    try {
      let connection = broadcasterConnections.get(uid);
      const alreadyOpen = connection?.ws?.readyState === 1;
      if (!alreadyOpen) {
        await startEventSubForUser(uid);
        connection = broadcasterConnections.get(uid);
        if (connection) {
          if (connection.manualTestTimer) clearTimeout(connection.manualTestTimer);
          connection.manualTestTimer = setTimeout(() => {
            // Only pause if this is still just the manual test — a real
            // stream.online arriving in the meantime already cleared this
            // timer (see handleBroadcasterWentLive).
            if (broadcasterConnections.has(uid)) pauseEventSubForUser(uid);
          }, 10 * 60 * 1000);
        }
      }
      res.json({
        ok: true,
        eventSubConnected: broadcasterConnections.get(uid)?.ws?.readyState === 1,
        wasAlreadyOpen: alreadyOpen,
      });
    } catch (e) {
      logger.error('eventsub_verify_connection_failed', { userId: uid, message: e?.message });
      res.status(500).json({ error: 'Failed to verify connection' });
    }
  });
}
