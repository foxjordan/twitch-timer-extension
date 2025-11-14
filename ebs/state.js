import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const TIMER_STATE_PATH = path.resolve(DATA_DIR, 'overlay-timer-state.json');

// Timer state and helpers (single-channel dev)
export const state = {
  timerExpiryEpochMs: 0,
  hypeActive: false,
  paused: false,
  pauseRemaining: 0,
  seen: new Map(),
  initialSeconds: 0,
  additionsTotal: 0,
  maxTotalSeconds: 0,
  bitsCarry: 0
};

function snapshotTimerState() {
  return {
    timerExpiryEpochMs: Number(state.timerExpiryEpochMs || 0),
    hypeActive: Boolean(state.hypeActive),
    paused: Boolean(state.paused),
    pauseRemaining: Number(state.pauseRemaining || 0),
    initialSeconds: Number(state.initialSeconds || 0),
    additionsTotal: Number(state.additionsTotal || 0),
    maxTotalSeconds: Number(state.maxTotalSeconds || 0),
    bitsCarry: Number(state.bitsCarry || 0)
  };
}

async function persistTimerState() {
  try {
    const snap = snapshotTimerState();
    await writeFile(TIMER_STATE_PATH, JSON.stringify(snap, null, 2), 'utf-8');
  } catch {}
}

export async function loadTimerState() {
  try {
    const raw = await readFile(TIMER_STATE_PATH, 'utf-8');
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return;
    if (typeof obj.timerExpiryEpochMs === 'number') state.timerExpiryEpochMs = obj.timerExpiryEpochMs;
    if (typeof obj.hypeActive === 'boolean') state.hypeActive = obj.hypeActive;
    if (typeof obj.paused === 'boolean') state.paused = obj.paused;
    if (typeof obj.pauseRemaining === 'number') state.pauseRemaining = obj.pauseRemaining;
    if (typeof obj.initialSeconds === 'number') state.initialSeconds = obj.initialSeconds;
    if (typeof obj.additionsTotal === 'number') state.additionsTotal = obj.additionsTotal;
    if (typeof obj.maxTotalSeconds === 'number') state.maxTotalSeconds = obj.maxTotalSeconds;
    if (typeof obj.bitsCarry === 'number') state.bitsCarry = obj.bitsCarry;
  } catch {}
}

export function clearTimer() {
  state.timerExpiryEpochMs = 0;
  state.hypeActive = false;
  state.paused = false;
  state.pauseRemaining = 0;
  state.initialSeconds = 0;
  state.additionsTotal = 0;
  state.bitsCarry = 0;
  persistTimerState().catch(() => {});
}

export function getRemainingSeconds() {
  if (state.paused) return Math.max(0, Math.floor(state.pauseRemaining));
  const ms = Math.max(0, state.timerExpiryEpochMs - Date.now());
  return Math.floor(ms / 1000);
}

export function addSeconds(sec) {
  const now = Date.now();
  let toAdd = Math.floor(Number(sec) || 0);
  if (toAdd <= 0) return getRemainingSeconds();
  if (state.maxTotalSeconds > 0) {
    const used = Math.max(0, Math.floor(state.initialSeconds + state.additionsTotal));
    const remainingBudget = Math.max(0, state.maxTotalSeconds - used);
    toAdd = Math.min(toAdd, remainingBudget);
  }
  if (toAdd <= 0) return getRemainingSeconds();
  if (state.paused) {
    state.pauseRemaining = Math.max(0, Math.floor(state.pauseRemaining + toAdd));
  } else {
    const base = Math.max(now, state.timerExpiryEpochMs);
    state.timerExpiryEpochMs = base + toAdd * 1000;
  }
  state.additionsTotal = Math.max(0, Math.floor(state.additionsTotal + toAdd));
   // Persist any change to timer tracking
  persistTimerState().catch(() => {});
  return getRemainingSeconds();
}

export function setHype(active) {
  state.hypeActive = active;
  persistTimerState().catch(() => {});
}

export function pauseTimer() {
  if (state.paused) return getRemainingSeconds();
  state.pauseRemaining = getRemainingSeconds();
  state.paused = true;
  persistTimerState().catch(() => {});
  return state.pauseRemaining;
}

export function resumeTimer() {
  if (!state.paused) return getRemainingSeconds();
  state.timerExpiryEpochMs = Date.now() + Math.max(0, Math.floor(state.pauseRemaining)) * 1000;
  state.paused = false;
  state.pauseRemaining = 0;
  persistTimerState().catch(() => {});
  return getRemainingSeconds();
}

export function setInitialSeconds(secs) {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  state.initialSeconds = s;
  state.additionsTotal = 0;
  // Reset pooled bits at new stream start
  state.bitsCarry = 0;
  persistTimerState().catch(() => {});
}

export function setMaxTotalSeconds(secs) {
  state.maxTotalSeconds = Math.max(0, Math.floor(Number(secs) || 0));
  // If lowering the cap below already scheduled total, clamp current remaining
  const max = state.maxTotalSeconds|0;
  if (max > 0) {
    const used = Math.max(0, Math.floor((state.initialSeconds||0) + (state.additionsTotal||0)));
    const overflow = Math.max(0, used - max);
    if (overflow > 0) {
      const rem = getRemainingSeconds();
      const newRem = Math.max(0, rem - overflow);
      if (state.paused) {
        state.pauseRemaining = newRem;
      } else {
        state.timerExpiryEpochMs = Date.now() + newRem * 1000;
      }
    }
  }
  persistTimerState().catch(() => {});
}

export function getTotals() {
  return {
    initialSeconds: Math.max(0, Math.floor(state.initialSeconds || 0)),
    additionsTotal: Math.max(0, Math.floor(state.additionsTotal || 0)),
    maxTotalSeconds: Math.max(0, Math.floor(state.maxTotalSeconds || 0))
  };
}

export function capReached() {
  const max = Math.max(0, Math.floor(state.maxTotalSeconds || 0));
  if (max <= 0) return false;
  const used = Math.max(0, Math.floor((state.initialSeconds || 0) + (state.additionsTotal || 0)));
  return used >= max;
}
