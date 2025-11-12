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
  } = ctx;

  app.post('/api/timer/start', async (req, res) => {
    const seconds = Number(req.body?.seconds ?? 300);
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
    const remaining = addSeconds(seconds);
    await broadcastToChannel({
      broadcasterId: BROADCASTER_ID,
      type: 'timer_add',
      payload: { secondsAdded: seconds, newRemaining: remaining, hype: state.hypeActive, paused: state.paused }
    });
    res.json({ remaining });
  });

  app.get('/api/timer/state', (req, res) => {
    if (!requireOverlayAuth(req, res)) return;
    res.json({ remaining: getRemainingSeconds(), hype: state.hypeActive, paused: state.paused });
  });

  app.post('/api/timer/pause', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const remaining = pauseTimer();
    const payload = JSON.stringify({ remaining, hype: state.hypeActive, paused: state.paused });
    for (const client of Array.from(sseClients)) {
      try { client.res.write('event: timer_tick\n'); client.res.write(`data: ${payload}\n\n`); } catch (e) { sseClients.delete(client); }
    }
    res.json({ remaining, paused: state.paused });
  });

  app.post('/api/timer/resume', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const remaining = resumeTimer();
    const payload = JSON.stringify({ remaining, hype: state.hypeActive, paused: state.paused });
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
}

