import { broadcastToChannel } from './broadcast.js';

export function mountTimerRoutes(app, ctx) {
  const {
    BROADCASTER_ID,
    sseClients,
    requireOverlayAuth,
    state,
    getRemainingSeconds,
    addSeconds,
    setHype,
    pauseTimer,
    resumeTimer,
    getUserSettings,
    setInitialSeconds,
    setMaxTotalSeconds,
    capReached,
    getTotals,
  } = ctx;

  app.post('/api/timer/start', async (req, res) => {
    let seconds = Number(req.body?.seconds ?? 300);
    // Pull current user's max setting, if available
    try {
      const uid = req.session?.twitchUser?.id;
      if (uid && typeof getUserSettings === 'function') {
        const us = getUserSettings(uid) || {};
        const max = Math.max(0, Number(us.maxTotalSeconds || 0));
        if (typeof setMaxTotalSeconds === 'function') setMaxTotalSeconds(max);
        if (max > 0 && seconds > max) seconds = max;
      }
    } catch (e) {}
    if (typeof setInitialSeconds === 'function') setInitialSeconds(seconds);
    state.timerExpiryEpochMs = Date.now() + seconds * 1000;
    await broadcastToChannel({
      broadcasterId: BROADCASTER_ID,
      type: 'timer_reset',
      payload: { remaining: seconds, paused: state.paused }
    });
    res.json({ remaining: seconds });
  });

  app.post('/api/timer/add', async (req, res) => {
    const seconds = Number(req.body?.seconds ?? 60);
    const before = getRemainingSeconds();
    const remaining = addSeconds(seconds);
    const actual = Math.max(0, remaining - before);
    await broadcastToChannel({
      broadcasterId: BROADCASTER_ID,
      type: 'timer_add',
      payload: { secondsAdded: actual, newRemaining: remaining, hype: state.hypeActive, paused: state.paused }
    });
    res.json({ remaining, added: actual });
  });

  app.get('/api/timer/state', (req, res) => {
    if (!requireOverlayAuth(req, res)) return;
    res.json({ remaining: getRemainingSeconds(), hype: state.hypeActive, paused: state.paused, capReached: typeof capReached === 'function' ? capReached() : false });
  });

  app.post('/api/timer/pause', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const remaining = pauseTimer();
    const payload = JSON.stringify({ remaining, hype: state.hypeActive, paused: state.paused, capReached: typeof capReached === 'function' ? capReached() : false });
    for (const client of Array.from(sseClients)) {
      try { client.res.write('event: timer_tick\n'); client.res.write(`data: ${payload}\n\n`); } catch (e) { sseClients.delete(client); }
    }
    res.json({ remaining, paused: state.paused });
  });

  app.post('/api/timer/resume', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const remaining = resumeTimer();
    const payload = JSON.stringify({ remaining, hype: state.hypeActive, paused: state.paused, capReached: typeof capReached === 'function' ? capReached() : false });
    for (const client of Array.from(sseClients)) {
      try { client.res.write('event: timer_tick\n'); client.res.write(`data: ${payload}\n\n`); } catch (e) { sseClients.delete(client); }
    }
    res.json({ remaining, paused: state.paused });
  });

  app.get('/api/hype', (req, res) => {
    res.json({ hype: state.hypeActive });
  });

  app.post('/api/hype', async (req, res) => {
    const active = Boolean(req.body?.active);
    setHype(active);
    const remaining = getRemainingSeconds();
    await broadcastToChannel({
      broadcasterId: BROADCASTER_ID,
      type: 'timer_add',
      payload: { secondsAdded: 0, newRemaining: remaining, hype: state.hypeActive }
    }).catch(() => {});
    const payload = JSON.stringify({ remaining, hype: state.hypeActive, paused: state.paused });
    for (const client of Array.from(sseClients)) {
      try { client.res.write('event: timer_tick\n'); client.res.write(`data: ${payload}\n\n`); } catch (e) { sseClients.delete(client); }
    }
    res.json({ hype: state.hypeActive });
  });

  // Admin-only: totals for configurator
  app.get('/api/timer/totals', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    try {
      const t = typeof getTotals === 'function' ? getTotals() : { initialSeconds: 0, additionsTotal: 0, maxTotalSeconds: 0 };
      const used = Math.max(0, (t.initialSeconds|0) + (t.additionsTotal|0));
      const max = Math.max(0, t.maxTotalSeconds|0);
      const budget = max > 0 ? Math.max(0, max - used) : null;
      res.json({ ...t, used, budget, capReached: typeof capReached === 'function' ? capReached() : false });
    } catch (e) {
      res.status(500).json({ error: 'Failed to get totals' });
    }
  });
}
