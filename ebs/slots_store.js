import { readFile } from 'fs/promises';
import path from 'path';
import { atomicWriteFile } from './atomic_write.js';
import { DEFAULT_SLOTS_CONFIG, sanitizeSlotsConfig } from './slots.js';

// Per-broadcaster Slot Machine config. Keys are Twitch user IDs as strings —
// same keyspace as overlay-rules.json / overlay-plinko.json. Mirrors
// plinko_store.js, including the serialized persist chain.
const DATA_DIR = process.env.DATA_DIR || process.cwd();
const SLOTS_PATH = path.resolve(DATA_DIR, 'overlay-slots.json');

let byUser = {}; // { [uid: string]: SlotsConfig }

// Setters fire-and-forget their persist, so serialize writes through one chain:
// two atomicWriteFile() calls in the same millisecond would otherwise collide
// on their shared temp path.
let persistChain = Promise.resolve();

export async function loadSlotsConfig() {
  try {
    const raw = await readFile(SLOTS_PATH, 'utf-8');
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') {
      const next = {};
      for (const [uid, cfg] of Object.entries(obj)) {
        next[String(uid)] = sanitizeSlotsConfig(cfg || {}, DEFAULT_SLOTS_CONFIG);
      }
      byUser = next;
    }
  } catch {
    // no file yet / unreadable — start empty, same as the other stores
  }
}

export function persistSlotsConfig() {
  const snapshot = JSON.stringify(byUser, null, 2);
  persistChain = persistChain
    .catch(() => {})
    .then(() => atomicWriteFile(SLOTS_PATH, snapshot))
    .catch(() => {}); // best effort, same as the other stores
  return persistChain;
}

export function getSlotsConfig(uid) {
  const id = uid ? String(uid) : null;
  const stored = id && byUser[id] ? byUser[id] : DEFAULT_SLOTS_CONFIG;
  return sanitizeSlotsConfig({}, stored);
}

export function setSlotsConfig(uid, patch = {}) {
  const id = String(uid || '').trim();
  if (!id) throw new Error('Broadcaster id required');
  const curr = byUser[id] || DEFAULT_SLOTS_CONFIG;
  const next = sanitizeSlotsConfig(patch || {}, curr);
  byUser[id] = next;
  persistSlotsConfig().catch(() => {});
  return sanitizeSlotsConfig({}, next);
}

export function deleteSlotsConfig(uid) {
  const id = String(uid || '').trim();
  if (!id) return false;
  const existed = id in byUser;
  delete byUser[id];
  if (existed) persistSlotsConfig().catch(() => {});
  return existed;
}
