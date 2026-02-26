import { broadcastToChannel } from './broadcast.js';
import { addLogEntry } from './event_log.js';
import { logger } from './logger.js';

export function mountTimerRoutes(app, ctx) {
  const {
    sseClients,
    requireOverlayAuth,
    state,
    getRemainingSeconds,
    addSeconds,
    setHype,
    setBonusTime,
    pauseTimer,
    resumeTimer,
    getUserSettings,
    setInitialSeconds,
    setMaxTotalSeconds,
    capReached,
    getTotals,
    clearTimer,
    setCapForcedOn,
    onBroadcastError,
    onTimerMutation,
    resolveTimerUserId,
  } = ctx;

  const resolveUid = (req) =>
    (typeof resolveTimerUserId === 'function' && resolveTimerUserId(req)) ||
    req.session?.twitchUser?.id ||
    'default';

  const markTimerMutation = () => {
    if (typeof onTimerMutation === 'function') onTimerMutation();
  };

  async function emitToChannel(uid, eventType, payload) {
    try {
      await broadcastToChannel({
        broadcasterId: String(uid),
        type: eventType,
        payload,
      });
    } catch (err) {
      if (typeof onBroadcastError === 'function') onBroadcastError();
      logger.error('broadcast_failed', {
        reason: err?.message,
        type: eventType,
        userId: uid,
      });
    }
  }

  app.post('/api/timer/start', async (req, res) => {
    const uid = resolveUid(req);
    let seconds = Number(req.body?.seconds ?? 300);
    const meta = (req.body && typeof req.body.meta === 'object' && req.body.meta) || {};
    // Pull current user's max setting, if available
    try {
      if (uid && typeof getUserSettings === 'function') {
        const us = getUserSettings(uid) || {};
        const max = Math.max(0, Number(us.maxTotalSeconds || 0));
        if (typeof setMaxTotalSeconds === 'function') setMaxTotalSeconds(uid, max);
        if (max > 0 && seconds > max) seconds = max;
      }
    } catch (e) {}
    if (typeof setInitialSeconds === 'function') setInitialSeconds(uid, seconds);
    const userState = state.users ? state.users.get(String(uid)) : null;
    if (userState) {
      userState.timerExpiryEpochMs = Date.now() + seconds * 1000;
      userState.paused = false;
      userState.pauseRemaining = 0;
    }
    addLogEntry({
      type: 'manual_start',
      source: String(meta.source || ''),
      label: String(meta.label || ''),
      requestedSeconds: Number(meta.requestedSeconds ?? seconds) || seconds,
      baseSeconds: seconds,
      appliedSeconds: seconds,
      actualSeconds: seconds,
      hypeMultiplier: Number(meta.hypeMultiplier || 1) || 1,
      userId: uid,
    });
    logger.info('timer_started', {
      requestId: req.requestId,
      seconds,
      userId: uid,
    });
    markTimerMutation();
    await emitToChannel(uid, 'timer_reset', { userId: String(uid), remaining: seconds, paused: userState?.paused });
    res.json({ remaining: seconds });
  });

  app.post('/api/timer/add', async (req, res) => {
    const uid = resolveUid(req);
    const seconds = Number(req.body?.seconds ?? 60);
    const meta = (req.body && typeof req.body.meta === 'object' && req.body.meta) || {};
    const before = getRemainingSeconds(uid);
    const remaining = addSeconds(uid, seconds);
    const actual = Math.max(0, remaining - before);
    addLogEntry({
      type: 'manual_add',
      source: String(meta.source || ''),
      label: String(meta.label || ''),
      requestedSeconds: Number(meta.requestedSeconds ?? seconds) || seconds,
      baseSeconds: seconds,
      appliedSeconds: seconds,
      actualSeconds: actual,
      hypeMultiplier: Number(meta.hypeMultiplier || 1) || 1,
      userId: uid,
    });
    logger.info('timer_added', {
      requestId: req.requestId,
      added: actual,
      requested: seconds,
      userId: uid,
    });
    markTimerMutation();
    await emitToChannel(uid, 'timer_add', {
      userId: String(uid),
      secondsAdded: actual,
      newRemaining: remaining,
      hype: state.users.get(String(uid))?.hypeActive,
      paused: state.users.get(String(uid))?.paused,
    });
    res.json({ remaining, added: actual });
  });

  app.get('/api/timer/state', (req, res) => {
    if (!requireOverlayAuth(req, res)) return;
    const uid = resolveUid(req);
    res.json({
      remaining: getRemainingSeconds(uid),
      hype: state.users.get(String(uid))?.hypeActive,
      paused: state.users.get(String(uid))?.paused,
      capReached: typeof capReached === 'function' ? capReached(uid) : false,
    });
  });

  app.post('/api/timer/pause', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const uid = resolveUid(req);
    const remaining = pauseTimer(uid);
    const payload = JSON.stringify({
      userId: String(uid),
      remaining,
      hype: state.users.get(String(uid))?.hypeActive,
      paused: state.users.get(String(uid))?.paused,
      capReached: typeof capReached === 'function' ? capReached(uid) : false,
    });
    for (const client of Array.from(sseClients)) {
      if (client.timerUserId && String(client.timerUserId) !== String(uid)) continue;
      try {
        client.res.write('event: timer_tick\n');
        client.res.write(`data: ${payload}\n\n`);
      } catch (e) {
        sseClients.delete(client);
      }
    }
    logger.info('timer_paused', {
      requestId: req.requestId,
      userId: uid,
      remaining,
    });
    markTimerMutation();
    res.json({ remaining, paused: state.users.get(String(uid))?.paused });
  });

  app.post('/api/timer/clear', async (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const uid = resolveUid(req);
    if (typeof clearTimer === 'function') clearTimer(uid);
    const remaining = getRemainingSeconds(uid);
    addLogEntry({
      type: 'manual_clear',
      source: 'panel_end_timer',
      label: 'End Timer',
      requestedSeconds: 0,
      baseSeconds: 0,
      appliedSeconds: 0,
      actualSeconds: 0,
      hypeMultiplier: 1,
      userId: uid,
    });
    const payload = JSON.stringify({
      userId: String(uid),
      remaining,
      hype: state.users.get(String(uid))?.hypeActive,
      paused: state.users.get(String(uid))?.paused,
      capReached: typeof capReached === 'function' ? capReached(uid) : false,
    });
    for (const client of Array.from(sseClients)) {
      if (client.timerUserId && String(client.timerUserId) !== String(uid)) continue;
      try {
        client.res.write('event: timer_tick\n');
        client.res.write(`data: ${payload}\n\n`);
      } catch (e) {
        sseClients.delete(client);
      }
    }
    logger.info('timer_cleared', { requestId: req.requestId, userId: uid });
    markTimerMutation();
    await emitToChannel(uid, 'timer_reset', { userId: String(uid), remaining, paused: state.users.get(String(uid))?.paused });
    res.json({ remaining, cleared: true });
  });

  app.post('/api/timer/restart', async (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const uid = resolveUid(req);
    const userState = state.users.get(String(uid)) || {};
    const secs = Math.max(0, Math.floor(Number(userState.initialSeconds || 0)));
    if (secs <= 0) {
      if (typeof clearTimer === 'function') clearTimer(uid);
      const remaining = getRemainingSeconds(uid);
      addLogEntry({
        type: 'manual_restart',
        source: 'panel_restart_timer',
        label: 'Restart Timer (no initial)',
        requestedSeconds: 0,
        baseSeconds: 0,
        appliedSeconds: 0,
        actualSeconds: remaining,
        hypeMultiplier: 1,
        userId: uid,
      });
      const payload = JSON.stringify({
        userId: String(uid),
        remaining,
        hype: state.users.get(String(uid))?.hypeActive,
        paused: state.users.get(String(uid))?.paused,
        capReached: typeof capReached === 'function' ? capReached(uid) : false,
      });
      for (const client of Array.from(sseClients)) {
        if (client.timerUserId && String(client.timerUserId) !== String(uid)) continue;
        try {
          client.res.write('event: timer_tick\n');
          client.res.write(`data: ${payload}\n\n`);
        } catch (e) {
          sseClients.delete(client);
        }
      }
      markTimerMutation();
      return res.json({ remaining });
    }
    if (typeof setInitialSeconds === 'function') setInitialSeconds(uid, secs);
    const user = state.users.get(String(uid));
    if (user) {
      user.timerExpiryEpochMs = Date.now() + secs * 1000;
      user.paused = false;
      user.pauseRemaining = 0;
    }
    const remaining = getRemainingSeconds(uid);
    addLogEntry({
      type: 'manual_restart',
      source: 'panel_restart_timer',
      label: 'Restart Timer',
      requestedSeconds: secs,
      baseSeconds: secs,
      appliedSeconds: secs,
      actualSeconds: remaining,
      hypeMultiplier: 1,
      userId: uid,
    });
    const payload = JSON.stringify({
      userId: String(uid),
      remaining,
      hype: state.users.get(String(uid))?.hypeActive,
      paused: state.users.get(String(uid))?.paused,
      capReached: typeof capReached === 'function' ? capReached(uid) : false,
    });
    for (const client of Array.from(sseClients)) {
      if (client.timerUserId && String(client.timerUserId) !== String(uid)) continue;
      try {
        client.res.write('event: timer_tick\n');
        client.res.write(`data: ${payload}\n\n`);
      } catch (e) {
        sseClients.delete(client);
      }
    }
    logger.info('timer_restarted', {
      requestId: req.requestId,
      userId: uid,
      seconds: remaining,
    });
    markTimerMutation();
    await emitToChannel(uid, 'timer_reset', { userId: String(uid), remaining, paused: state.users.get(String(uid))?.paused });
    res.json({ remaining });
  });

  app.post('/api/timer/resume', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const uid = resolveUid(req);
    const remaining = resumeTimer(uid);
    const payload = JSON.stringify({
      userId: String(uid),
      remaining,
      hype: state.users.get(String(uid))?.hypeActive,
      paused: state.users.get(String(uid))?.paused,
      capReached: typeof capReached === 'function' ? capReached(uid) : false,
    });
    for (const client of Array.from(sseClients)) {
      if (client.timerUserId && String(client.timerUserId) !== String(uid)) continue;
      try {
        client.res.write('event: timer_tick\n');
        client.res.write(`data: ${payload}\n\n`);
      } catch (e) {
        sseClients.delete(client);
      }
    }
    logger.info('timer_resumed', {
      requestId: req.requestId,
      userId: uid,
      remaining,
    });
    markTimerMutation();
    res.json({ remaining, paused: state.users.get(String(uid))?.paused });
  });

  app.get('/api/hype', (req, res) => {
    const uid = resolveUid(req);
    res.json({ hype: state.users.get(String(uid))?.hypeActive });
  });

  app.post('/api/hype', async (req, res) => {
    const uid = resolveUid(req);
    const active = Boolean(req.body?.active);
    setHype(uid, active);
    const remaining = getRemainingSeconds(uid);
    logger.info('timer_hype_manual', {
      requestId: req.requestId,
      userId: uid,
      active,
    });
    markTimerMutation();
    await emitToChannel(uid, 'timer_add', { userId: String(uid), secondsAdded: 0, newRemaining: remaining, hype: state.users.get(String(uid))?.hypeActive });
    const payload = JSON.stringify({
      userId: String(uid),
      remaining,
      hype: state.users.get(String(uid))?.hypeActive,
      paused: state.users.get(String(uid))?.paused,
    });
    for (const client of Array.from(sseClients)) {
      if (client.timerUserId && String(client.timerUserId) !== String(uid)) continue;
      try {
        client.res.write('event: timer_tick\n');
        client.res.write(`data: ${payload}\n\n`);
      } catch (e) {
        sseClients.delete(client);
      }
    }
    res.json({ remaining, hype: active });
  });

  app.get('/api/timer/bonus', (req, res) => {
    const uid = resolveUid(req);
    const u = state.users.get(String(uid));
    res.json({
      bonusActive: Boolean(u?.bonusActive),
      bonusStartEpochMs: Number(u?.bonusStartEpochMs || 0),
      bonusEndEpochMs: Number(u?.bonusEndEpochMs || 0),
    });
  });

  app.post('/api/timer/bonus', async (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const uid = resolveUid(req);
    const body = req.body || {};
    const opts = {};
    if (typeof body.active === 'boolean') opts.active = body.active;
    if (body.startTime) opts.startEpochMs = new Date(body.startTime).getTime() || 0;
    else if (body.startTime === null || body.startTime === '') opts.startEpochMs = 0;
    if (body.endTime) opts.endEpochMs = new Date(body.endTime).getTime() || 0;
    else if (body.endTime === null || body.endTime === '') opts.endEpochMs = 0;
    if (typeof setBonusTime === 'function') setBonusTime(uid, opts);
    const u = state.users.get(String(uid));
    const remaining = getRemainingSeconds(uid);
    logger.info('timer_bonus_manual', {
      requestId: req.requestId,
      userId: uid,
      active: u?.bonusActive,
      startEpochMs: u?.bonusStartEpochMs,
      endEpochMs: u?.bonusEndEpochMs,
    });
    markTimerMutation();
    const payload = JSON.stringify({
      userId: String(uid),
      remaining,
      hype: u?.hypeActive,
      bonus: u?.bonusActive,
      paused: u?.paused,
    });
    for (const client of Array.from(sseClients)) {
      if (client.timerUserId && String(client.timerUserId) !== String(uid)) continue;
      try {
        client.res.write('event: timer_tick\n');
        client.res.write(`data: ${payload}\n\n`);
      } catch (e) {
        sseClients.delete(client);
      }
    }
    res.json({
      bonusActive: Boolean(u?.bonusActive),
      bonusStartEpochMs: Number(u?.bonusStartEpochMs || 0),
      bonusEndEpochMs: Number(u?.bonusEndEpochMs || 0),
      remaining,
    });
  });

  // Admin-only: totals for configurator
  app.get('/api/timer/totals', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    try {
      const uid = resolveUid(req);
      const t = typeof getTotals === 'function' ? getTotals(uid) : { initialSeconds: 0, additionsTotal: 0, maxTotalSeconds: 0 };
      const used = Math.max(0, (t.initialSeconds|0) + (t.additionsTotal|0));
      const max = Math.max(0, t.maxTotalSeconds|0);
      const budget = max > 0 ? Math.max(0, max - used) : null;
      const capForced = Boolean(state.users.get(String(uid))?.capForcedOn);
      res.json({ ...t, used, budget, capReached: typeof capReached === 'function' ? capReached(uid) : false, capForcedOn: capForced });
    } catch (e) {
      res.status(500).json({ error: 'Failed to get totals' });
    }
  });

  app.post('/api/timer/force-cap', (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).json({ error: 'Admin login required' });
    const uid = resolveUid(req);
    const forced = Boolean(req.body?.forced);
    if (typeof setCapForcedOn === 'function') setCapForcedOn(uid, forced);
    const cap = typeof capReached === 'function' ? capReached(uid) : forced;
    const remaining = getRemainingSeconds(uid);
    const payload = JSON.stringify({
      userId: String(uid),
      remaining,
      hype: state.users.get(String(uid))?.hypeActive,
      paused: state.users.get(String(uid))?.paused,
      capReached: cap,
    });
    for (const client of Array.from(sseClients)) {
      if (client.timerUserId && String(client.timerUserId) !== String(uid)) continue;
      try {
        client.res.write('event: timer_tick\n');
        client.res.write(`data: ${payload}\n\n`);
      } catch (e) {
        sseClients.delete(client);
      }
    }
    markTimerMutation();
    res.json({ capReached: cap, forced });
  });
}
