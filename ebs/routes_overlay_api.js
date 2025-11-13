export function mountOverlayApiRoutes(app, ctx) {
  const { requireOverlayAuth, normKey, getSavedStyle, setSavedStyle, getOrCreateUserKey, rotateUserKey, getUserSettings, setUserSettings, sseClients, getRules, setRules, setMaxTotalSeconds } = ctx;

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
    res.json(saved);
  });

  // Per-user overlay key helpers (admin)
  app.get('/api/overlay/key', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const uid = req.session?.twitchUser?.id;
    if (!uid) return res.status(400).json({ error: 'No user in session' });
    const key = getOrCreateUserKey(uid);
    req.session.userOverlayKey = key;
    res.json({ key });
  });

  app.post('/api/overlay/key/rotate', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const uid = String(req.session?.twitchUser?.id || '');
    if (!uid) return res.status(400).json({ error: 'No user in session' });
    const key = rotateUserKey(uid);
    req.session.userOverlayKey = key;
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
    res.json(saved);
  });

  // Rules (admin only)
  app.get('/api/rules', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    try {
      res.json(getRules());
    } catch (e) {
      res.status(500).json({ error: 'Failed to load rules' });
    }
  });

  app.post('/api/rules', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    try {
      const saved = setRules(req.body || {});
      res.json(saved);
    } catch (e) {
      res.status(400).json({ error: 'Invalid rules payload' });
    }
  });
}
