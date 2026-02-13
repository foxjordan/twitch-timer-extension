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

export function getLogEntries(userId) {
  if (!userId) return entries.slice();
  const uid = String(userId);
  return entries.filter((e) => e.userId === uid);
}

export function clearLogEntries(userId) {
  if (!userId) {
    entries.length = 0;
    return;
  }
  const uid = String(userId);
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].userId === uid) entries.splice(i, 1);
  }
}
