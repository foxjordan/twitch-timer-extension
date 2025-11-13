import newrelic from 'newrelic';

export function recordEvent(eventType, attrs = {}) {
  try {
    newrelic.recordCustomEvent(String(eventType || 'CustomEvent'), sanitize(attrs));
  } catch (e) {
    // ignore
  }
}

export function recordError(err, attrs = {}) {
  try {
    const error = err instanceof Error ? err : new Error(String(err));
    newrelic.noticeError(error, sanitize(attrs));
  } catch (e) {
    // ignore
  }
}

function sanitize(obj) {
  const out = {};
  try {
    for (const [k, v] of Object.entries(obj || {})) {
      const key = String(k).slice(0, 255);
      const val = typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
        ? v
        : JSON.stringify(v).slice(0, 4096);
      out[key] = val;
    }
  } catch {}
  return out;
}

// Global traps (best-effort)
try {
  process.on('unhandledRejection', (reason) => {
    try { recordError(reason, { scope: 'unhandledRejection' }); } catch {}
  });
  process.on('uncaughtException', (err) => {
    try { recordError(err, { scope: 'uncaughtException' }); } catch {}
  });
} catch {}

