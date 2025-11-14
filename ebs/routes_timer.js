import { broadcastToChannel } from './broadcast.js';
import { addLogEntry } from './event_log.js';

export function mountTimerRoutes(app, ctx) {
  const {
    BROADCASTER_ID,
    getBroadcasterId,
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
    clearTimer,
  } = ctx;

  app.post('/api/timer/start', async (req, res) => {
    let seconds = Number(req.body?.seconds ?? 300);
    const meta = (req.body && typeof req.body.meta === 'object' && req.body.meta) || {};
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
    // Manual start/reset: treat requested seconds as the new base
    state.timerExpiryEpochMs = Date.now() + seconds * 1000;
    addLogEntry({
      type: 'manual_start',
      source: String(meta.source || ''),
      label: String(meta.label || ''),
      requestedSeconds: Number(meta.requestedSeconds ?? seconds) || seconds,
      baseSeconds: seconds,
      appliedSeconds: seconds,
      actualSeconds: seconds,
      hypeMultiplier: Number(meta.hypeMultiplier || 1) || 1
    });
    await broadcastToChannel({
      broadcasterId: (typeof getBroadcasterId === 'function' && getBroadcasterId()) || BROADCASTER_ID,
      type: 'timer_reset',
      payload: { remaining: seconds, paused: state.paused }
    });
    res.json({ remaining: seconds });
  });

  app.post('/api/timer/add', async (req, res) => {
    const seconds = Number(req.body?.seconds ?? 60);
    const meta = (req.body && typeof req.body.meta === 'object' && req.body.meta) || {};
    const before = getRemainingSeconds();
    const remaining = addSeconds(seconds);
    const actual = Math.max(0, remaining - before);
    addLogEntry({
      type: 'manual_add',
      source: String(meta.source || ''),
      label: String(meta.label || ''),
      requestedSeconds: Number(meta.requestedSeconds ?? seconds) || seconds,
      baseSeconds: seconds,
      appliedSeconds: seconds,
      actualSeconds: actual,
      hypeMultiplier: Number(meta.hypeMultiplier || 1) || 1
    });
    await broadcastToChannel({
      broadcasterId: (typeof getBroadcasterId === 'function' && getBroadcasterId()) || BROADCASTER_ID,
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

  app.post('/api/timer/clear', async (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    if (typeof clearTimer === 'function') clearTimer();
    const remaining = getRemainingSeconds();
    addLogEntry({
      type: 'manual_clear',
      source: 'panel_end_timer',
      label: 'End Timer',
      requestedSeconds: 0,
      baseSeconds: 0,
      appliedSeconds: 0,
      actualSeconds: 0,
      hypeMultiplier: 1
    });
    const payload = JSON.stringify({ remaining, hype: state.hypeActive, paused: state.paused, capReached: typeof capReached === 'function' ? capReached() : false });
    for (const client of Array.from(sseClients)) {
      try { client.res.write('event: timer_tick\n'); client.res.write(`data: ${payload}\n\n`); } catch (e) { sseClients.delete(client); }
    }
    await broadcastToChannel({
      broadcasterId: (typeof getBroadcasterId === 'function' && getBroadcasterId()) || BROADCASTER_ID,
      type: 'timer_reset',
      payload: { remaining, paused: state.paused }
    }).catch(() => {});
    res.json({ remaining, cleared: true });
  });

  app.post('/api/timer/restart', async (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const secs = Math.max(0, Math.floor(Number(state.initialSeconds || 0)));
    if (secs <= 0) {
      if (typeof clearTimer === 'function') clearTimer();
      const remaining = getRemainingSeconds();
      addLogEntry({
        type: 'manual_restart',
        source: 'panel_restart_timer',
        label: 'Restart Timer (no initial)',
        requestedSeconds: 0,
        baseSeconds: 0,
        appliedSeconds: 0,
        actualSeconds: remaining,
        hypeMultiplier: 1
      });
      const payload = JSON.stringify({ remaining, hype: state.hypeActive, paused: state.paused, capReached: typeof capReached === 'function' ? capReached() : false });
      for (const client of Array.from(sseClients)) {
        try { client.res.write('event: timer_tick\n'); client.res.write(`data: ${payload}\n\n`); } catch (e) { sseClients.delete(client); }
      }
      return res.json({ remaining });
    }
    if (typeof setInitialSeconds === 'function') setInitialSeconds(secs);
    state.timerExpiryEpochMs = Date.now() + secs * 1000;
    const remaining = getRemainingSeconds();
    addLogEntry({
      type: 'manual_restart',
      source: 'panel_restart_timer',
      label: 'Restart Timer',
      requestedSeconds: secs,
      baseSeconds: secs,
      appliedSeconds: secs,
      actualSeconds: remaining,
      hypeMultiplier: 1
    });
    const payload = JSON.stringify({ remaining, hype: state.hypeActive, paused: state.paused, capReached: typeof capReached === 'function' ? capReached() : false });
    for (const client of Array.from(sseClients)) {
      try { client.res.write('event: timer_tick\n'); client.res.write(`data: ${payload}\n\n`); } catch (e) { sseClients.delete(client); }
    }
    await broadcastToChannel({
      broadcasterId: (typeof getBroadcasterId === 'function' && getBroadcasterId()) || BROADCASTER_ID,
      type: 'timer_reset',
      payload: { remaining, paused: state.paused }
    }).catch(() => {});
    res.json({ remaining });
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
      broadcasterId: (typeof getBroadcasterId === 'function' && getBroadcasterId()) || BROADCASTER_ID,
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
