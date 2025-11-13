// Timer state and helpers (single-channel dev)
export const state = {
  timerExpiryEpochMs: 0,
  hypeActive: false,
  paused: false,
  pauseRemaining: 0,
  seen: new Map(),
  initialSeconds: 0,
  additionsTotal: 0,
  maxTotalSeconds: 0
};

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
  return getRemainingSeconds();
}

export function setHype(active) {
  state.hypeActive = active;
}

export function pauseTimer() {
  if (state.paused) return getRemainingSeconds();
  state.pauseRemaining = getRemainingSeconds();
  state.paused = true;
  return state.pauseRemaining;
}

export function resumeTimer() {
  if (!state.paused) return getRemainingSeconds();
  state.timerExpiryEpochMs = Date.now() + Math.max(0, Math.floor(state.pauseRemaining)) * 1000;
  state.paused = false;
  state.pauseRemaining = 0;
  return getRemainingSeconds();
}

export function setInitialSeconds(secs) {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  state.initialSeconds = s;
  state.additionsTotal = 0;
}

export function setMaxTotalSeconds(secs) {
  state.maxTotalSeconds = Math.max(0, Math.floor(Number(secs) || 0));
}

export function getTotals() {
  return {
    initialSeconds: Math.max(0, Math.floor(state.initialSeconds || 0)),
    additionsTotal: Math.max(0, Math.floor(state.additionsTotal || 0)),
    maxTotalSeconds: Math.max(0, Math.floor(state.maxTotalSeconds || 0))
  };
}
