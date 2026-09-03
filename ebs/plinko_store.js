import { readFile } from 'fs/promises';
import path from 'path';
import { atomicWriteFile } from './atomic_write.js';
import { DEFAULT_PLINKO_CONFIG, sanitizePlinkoConfig } from './plinko.js';

// Per-broadcaster Plinko board config. Keys are Twitch user IDs as strings —
// same keyspace as overlay-rules.json. Mirrors rules_store.js, but persists
// atomically (atomic_write.js) like the newer stores (sounds_store.js).
const DATA_DIR = process.env.DATA_DIR || process.cwd();
const PLINKO_PATH = path.resolve(DATA_DIR, 'overlay-plinko.json');

let byUser = {}; // { [uid: string]: PlinkoConfig }

// Setters fire-and-forget their persist, so serialize writes through one chain:
// two atomicWriteFile() calls in the same millisecond would otherwise collide
// on their shared temp path. await persistPlinkoConfig() waits for the tail.
let persistChain = Promise.resolve();

export async function loadPlinkoConfig() {
  try {
    const raw = await readFile(PLINKO_PATH, 'utf-8');
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') {
      const next = {};
      for (const [uid, cfg] of Object.entries(obj)) {
        next[String(uid)] = sanitizePlinkoConfig(cfg || {}, DEFAULT_PLINKO_CONFIG);
      }
      byUser = next;
    }
  } catch {
    // no file yet / unreadable — start empty, same as rules_store
  }
}

export function persistPlinkoConfig() {
  const snapshot = JSON.stringify(byUser, null, 2);
  persistChain = persistChain
    .catch(() => {})
    .then(() => atomicWriteFile(PLINKO_PATH, snapshot))
    .catch(() => {}); // best effort, same as the other stores
  return persistChain;
}

export function getPlinkoConfig(uid) {
  const id = uid ? String(uid) : null;
  const stored = id && byUser[id] ? byUser[id] : DEFAULT_PLINKO_CONFIG;
  return sanitizePlinkoConfig({}, stored);
}

export function setPlinkoConfig(uid, patch = {}) {
  const id = String(uid || '').trim();
  if (!id) throw new Error('Broadcaster id required');
  const curr = byUser[id] || DEFAULT_PLINKO_CONFIG;
  const next = sanitizePlinkoConfig(patch || {}, curr);
  byUser[id] = next;
  persistPlinkoConfig().catch(() => {});
  return sanitizePlinkoConfig({}, next);
}

export function deletePlinkoConfig(uid) {
  const id = String(uid || '').trim();
  if (!id) return false;
  const existed = id in byUser;
  delete byUser[id];
  if (existed) persistPlinkoConfig().catch(() => {});
  return existed;
}
