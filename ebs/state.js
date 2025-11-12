// Timer state and helpers (single-channel dev)
export const state = {
  timerExpiryEpochMs: 0,
  hypeActive: false,
  paused: false,
  pauseRemaining: 0,
  seen: new Map()
};

export function getRemainingSeconds() {
  if (state.paused) return Math.max(0, Math.floor(state.pauseRemaining));
  const ms = Math.max(0, state.timerExpiryEpochMs - Date.now());
  return Math.floor(ms / 1000);
}

export function addSeconds(sec) {
  const now = Date.now();
  if (state.paused) {
    state.pauseRemaining = Math.max(0, Math.floor(state.pauseRemaining + sec));
  } else {
    const base = Math.max(now, state.timerExpiryEpochMs);
    state.timerExpiryEpochMs = base + sec * 1000;
  }
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

