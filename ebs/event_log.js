const MAX_ENTRIES = 200;
const entries = [];

export function addLogEntry(entry) {
  const e = { ts: Date.now(), ...entry };
  entries.push(e);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  return e;
}

export function getLogEntries() {
  return entries.slice();
}

export function clearLogEntries() {
  entries.length = 0;
}

