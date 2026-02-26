import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { logger } from './logger.js';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const TIMER_STATE_PATH = path.resolve(DATA_DIR, 'overlay-timer-state.json');
const DEFAULT_USER_ID = 'default';

// Timer state and helpers (per-user)
export const state = {
  seen: new Map(), // global dedupe for EventSub message IDs
  users: new Map(), // uid -> timer state
};

function ensure(uid) {
  const id = String(uid || DEFAULT_USER_ID);
  if (!state.users.has(id)) {
    state.users.set(id, {
      timerExpiryEpochMs: 0,
      hypeActive: false,
      bonusActive: false,
      bonusStartEpochMs: 0,
      bonusEndEpochMs: 0,
      paused: false,
      pauseRemaining: 0,
      initialSeconds: 0,
      additionsTotal: 0,
      maxTotalSeconds: 0,
      bitsCarry: 0,
      capForcedOn: false,
    });
  }
  return state.users.get(id);
}

function snapshotUserState(userState) {
  return {
    timerExpiryEpochMs: Number(userState.timerExpiryEpochMs || 0),
    hypeActive: Boolean(userState.hypeActive),
    bonusActive: Boolean(userState.bonusActive),
    bonusStartEpochMs: Number(userState.bonusStartEpochMs || 0),
    bonusEndEpochMs: Number(userState.bonusEndEpochMs || 0),
    paused: Boolean(userState.paused),
    pauseRemaining: Number(userState.pauseRemaining || 0),
    initialSeconds: Number(userState.initialSeconds || 0),
    additionsTotal: Number(userState.additionsTotal || 0),
    maxTotalSeconds: Number(userState.maxTotalSeconds || 0),
    bitsCarry: Number(userState.bitsCarry || 0),
    capForcedOn: Boolean(userState.capForcedOn),
  };
}

function serializeAllUsers() {
  const obj = {};
  for (const [uid, val] of state.users.entries()) {
    obj[uid] = snapshotUserState(val);
  }
  return obj;
}

async function persistTimerState() {
  try {
    const data = { users: serializeAllUsers() };
    await writeFile(TIMER_STATE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

function parseUserState(val) {
  if (!val || typeof val !== 'object') return null;
  return {
    timerExpiryEpochMs: Number(val.timerExpiryEpochMs || 0),
    hypeActive: Boolean(val.hypeActive),
    bonusActive: Boolean(val.bonusActive),
    bonusStartEpochMs: Number(val.bonusStartEpochMs || 0),
    bonusEndEpochMs: Number(val.bonusEndEpochMs || 0),
    paused: Boolean(val.paused),
    pauseRemaining: Number(val.pauseRemaining || 0),
    initialSeconds: Number(val.initialSeconds || 0),
    additionsTotal: Number(val.additionsTotal || 0),
    maxTotalSeconds: Number(val.maxTotalSeconds || 0),
    bitsCarry: Number(val.bitsCarry || 0),
    capForcedOn: Boolean(val.capForcedOn),
  };
}

export async function loadTimerState() {
  try {
    const raw = await readFile(TIMER_STATE_PATH, 'utf-8');
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return;

    // New format: { users: { uid: state, ... } }
    if (typeof obj.users === 'object') {
      for (const [uid, val] of Object.entries(obj.users)) {
        const clean = parseUserState(val);
        if (clean) state.users.set(String(uid || DEFAULT_USER_ID), clean);
      }
      logger.info('timer_state_loaded', { format: 'new', userCount: state.users.size });
      return;
    }

    // Legacy format: { timerExpiryEpochMs, hypeActive, ... } (single user, no wrapper)
    // Detect by checking for known state properties
    if ('timerExpiryEpochMs' in obj || 'hypeActive' in obj || 'paused' in obj) {
      const clean = parseUserState(obj);
      if (clean) {
        state.users.set(DEFAULT_USER_ID, clean);
        logger.info('timer_state_loaded', { format: 'legacy', migratedToDefault: true });
        // Persist in new format for future loads
        persistTimerState().catch(() => {});
      }
    }
  } catch {}
}

export function clearTimer(uid = DEFAULT_USER_ID) {
  const s = ensure(uid);
  s.timerExpiryEpochMs = 0;
  s.hypeActive = false;
  s.bonusActive = false;
  s.bonusStartEpochMs = 0;
  s.bonusEndEpochMs = 0;
  s.paused = false;
  s.pauseRemaining = 0;
  s.initialSeconds = 0;
  s.additionsTotal = 0;
  s.bitsCarry = 0;
  persistTimerState().catch(() => {});
}

export function getRemainingSeconds(uid = DEFAULT_USER_ID) {
  const s = ensure(uid);
  if (s.paused) return Math.max(0, Math.floor(s.pauseRemaining));
  const ms = Math.max(0, s.timerExpiryEpochMs - Date.now());
  return Math.floor(ms / 1000);
}

export function addSeconds(uid = DEFAULT_USER_ID, sec = 0) {
  const s = ensure(uid);
  const now = Date.now();
  let toAdd = Math.floor(Number(sec) || 0);
  const requestedSeconds = toAdd;
  if (toAdd <= 0) return getRemainingSeconds(uid);
  if (s.capForcedOn) return getRemainingSeconds(uid);
  if (s.maxTotalSeconds > 0) {
    const used = Math.max(0, Math.floor(s.initialSeconds + s.additionsTotal));
    const remainingBudget = Math.max(0, s.maxTotalSeconds - used);
    const cappedAmount = Math.min(toAdd, remainingBudget);
    if (cappedAmount < toAdd) {
      logger.info('timer_add_capped', {
        userId: uid,
        requestedSeconds,
        cappedToSeconds: cappedAmount,
        maxTotalSeconds: s.maxTotalSeconds,
        usedSeconds: used,
        remainingBudget,
        capReached: remainingBudget <= 0,
      });
    }
    toAdd = cappedAmount;
  }
  if (toAdd <= 0) return getRemainingSeconds(uid);
  if (s.paused) {
    s.pauseRemaining = Math.max(0, Math.floor(s.pauseRemaining + toAdd));
  } else {
    const base = Math.max(now, s.timerExpiryEpochMs);
    s.timerExpiryEpochMs = base + toAdd * 1000;
  }
  s.additionsTotal = Math.max(0, Math.floor(s.additionsTotal + toAdd));
   // Persist any change to timer tracking
  persistTimerState().catch(() => {});
  return getRemainingSeconds(uid);
}

export function setHype(uid = DEFAULT_USER_ID, active) {
  const s = ensure(uid);
  s.hypeActive = active;
  persistTimerState().catch(() => {});
}

export function setBonusTime(uid = DEFAULT_USER_ID, { active, startEpochMs, endEpochMs } = {}) {
  const s = ensure(uid);
  if (typeof active === 'boolean') s.bonusActive = active;
  if (typeof startEpochMs === 'number') s.bonusStartEpochMs = Math.max(0, startEpochMs);
  if (typeof endEpochMs === 'number') s.bonusEndEpochMs = Math.max(0, endEpochMs);
  persistTimerState().catch(() => {});
}

export function checkBonusSchedule(uid = DEFAULT_USER_ID) {
  const s = ensure(uid);
  const now = Date.now();
  let changed = false;
  if (s.bonusStartEpochMs > 0 && !s.bonusActive && now >= s.bonusStartEpochMs) {
    s.bonusActive = true;
    s.bonusStartEpochMs = 0;
    changed = true;
  }
  if (s.bonusEndEpochMs > 0 && s.bonusActive && now >= s.bonusEndEpochMs) {
    s.bonusActive = false;
    s.bonusEndEpochMs = 0;
    changed = true;
  }
  if (changed) persistTimerState().catch(() => {});
  return changed;
}

export function pauseTimer(uid = DEFAULT_USER_ID) {
  const s = ensure(uid);
  if (s.paused) return getRemainingSeconds(uid);
  s.pauseRemaining = getRemainingSeconds(uid);
  s.paused = true;
  persistTimerState().catch(() => {});
  return s.pauseRemaining;
}

export function resumeTimer(uid = DEFAULT_USER_ID) {
  const s = ensure(uid);
  if (!s.paused) return getRemainingSeconds(uid);
  s.timerExpiryEpochMs = Date.now() + Math.max(0, Math.floor(s.pauseRemaining)) * 1000;
  s.paused = false;
  s.pauseRemaining = 0;
  persistTimerState().catch(() => {});
  return getRemainingSeconds(uid);
}

export function setInitialSeconds(uid = DEFAULT_USER_ID, secs) {
  const s = ensure(uid);
  const v = Math.max(0, Math.floor(Number(secs) || 0));
  s.initialSeconds = v;
  s.additionsTotal = 0;
  // Reset pooled bits at new stream start
  s.bitsCarry = 0;
  persistTimerState().catch(() => {});
}

export function setMaxTotalSeconds(uid = DEFAULT_USER_ID, secs) {
  const s = ensure(uid);
  s.maxTotalSeconds = Math.max(0, Math.floor(Number(secs) || 0));
  // If lowering the cap below already scheduled total, clamp current remaining
  const max = s.maxTotalSeconds|0;
  if (max > 0) {
    const used = Math.max(0, Math.floor((s.initialSeconds||0) + (s.additionsTotal||0)));
    const overflow = Math.max(0, used - max);
    if (overflow > 0) {
      const rem = getRemainingSeconds(uid);
      const newRem = Math.max(0, rem - overflow);
      if (s.paused) {
        s.pauseRemaining = newRem;
      } else {
        s.timerExpiryEpochMs = Date.now() + newRem * 1000;
      }
    }
  }
  persistTimerState().catch(() => {});
}

export function getTotals(uid = DEFAULT_USER_ID) {
  const s = ensure(uid);
  return {
    initialSeconds: Math.max(0, Math.floor(s.initialSeconds || 0)),
    additionsTotal: Math.max(0, Math.floor(s.additionsTotal || 0)),
    maxTotalSeconds: Math.max(0, Math.floor(s.maxTotalSeconds || 0))
  };
}

export function capReached(uid = DEFAULT_USER_ID) {
  const s = ensure(uid);
  if (s.capForcedOn) return true;
  const max = Math.max(0, Math.floor(s.maxTotalSeconds || 0));
  if (max <= 0) return false;
  const used = Math.max(0, Math.floor((s.initialSeconds || 0) + (s.additionsTotal || 0)));
  return used >= max;
}

export function setCapForcedOn(uid = DEFAULT_USER_ID, forced) {
  const s = ensure(uid);
  s.capForcedOn = Boolean(forced);
  persistTimerState().catch(() => {});
}
