import { readFile, writeFile } from 'fs/promises';
import path from 'path';

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
      paused: false,
      pauseRemaining: 0,
      initialSeconds: 0,
      additionsTotal: 0,
      maxTotalSeconds: 0,
      bitsCarry: 0,
    });
  }
  return state.users.get(id);
}

function snapshotUserState(userState) {
  return {
    timerExpiryEpochMs: Number(userState.timerExpiryEpochMs || 0),
    hypeActive: Boolean(userState.hypeActive),
    paused: Boolean(userState.paused),
    pauseRemaining: Number(userState.pauseRemaining || 0),
    initialSeconds: Number(userState.initialSeconds || 0),
    additionsTotal: Number(userState.additionsTotal || 0),
    maxTotalSeconds: Number(userState.maxTotalSeconds || 0),
    bitsCarry: Number(userState.bitsCarry || 0),
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

export async function loadTimerState() {
  try {
    const raw = await readFile(TIMER_STATE_PATH, 'utf-8');
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || typeof obj.users !== 'object') return;
    for (const [uid, val] of Object.entries(obj.users)) {
      if (!val || typeof val !== 'object') continue;
      const clean = {
        timerExpiryEpochMs: Number(val.timerExpiryEpochMs || 0),
        hypeActive: Boolean(val.hypeActive),
        paused: Boolean(val.paused),
        pauseRemaining: Number(val.pauseRemaining || 0),
        initialSeconds: Number(val.initialSeconds || 0),
        additionsTotal: Number(val.additionsTotal || 0),
        maxTotalSeconds: Number(val.maxTotalSeconds || 0),
        bitsCarry: Number(val.bitsCarry || 0),
      };
      state.users.set(String(uid || DEFAULT_USER_ID), clean);
    }
  } catch {}
}

export function clearTimer(uid = DEFAULT_USER_ID) {
  const s = ensure(uid);
  s.timerExpiryEpochMs = 0;
  s.hypeActive = false;
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
  if (toAdd <= 0) return getRemainingSeconds(uid);
  if (s.maxTotalSeconds > 0) {
    const used = Math.max(0, Math.floor(s.initialSeconds + s.additionsTotal));
    const remainingBudget = Math.max(0, s.maxTotalSeconds - used);
    toAdd = Math.min(toAdd, remainingBudget);
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
  const max = Math.max(0, Math.floor(s.maxTotalSeconds || 0));
  if (max <= 0) return false;
  const used = Math.max(0, Math.floor((s.initialSeconds || 0) + (s.additionsTotal || 0)));
  return used >= max;
}
