import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
export const KEYS_PATH = path.resolve(DATA_DIR, 'overlay-keys.json');
const overlayKeys = new Map(); // userId -> key

export async function loadOverlayKeys() {
  try {
    const raw = await readFile(KEYS_PATH, 'utf-8');
    const obj = JSON.parse(raw);
    for (const [uid, key] of Object.entries(obj)) overlayKeys.set(String(uid), String(key));
  } catch {}
}

export async function persistOverlayKeys() {
  try {
    const obj = {};
    for (const [uid, key] of overlayKeys.entries()) obj[uid] = key;
    await writeFile(KEYS_PATH, JSON.stringify(obj, null, 2), 'utf-8');
  } catch {}
}

export function getOrCreateUserKey(userId) {
  const uid = String(userId);
  if (overlayKeys.has(uid)) return overlayKeys.get(uid);
  const key = crypto.randomBytes(16).toString('hex');
  overlayKeys.set(uid, key);
  persistOverlayKeys().catch(() => {});
  return key;
}

export function rotateUserKey(userId) {
  const uid = String(userId);
  const key = crypto.randomBytes(16).toString('hex');
  overlayKeys.set(uid, key);
  persistOverlayKeys().catch(() => {});
  return key;
}

export function keyIsValid(globalKey, candidate) {
  if (!candidate) return false;
  if (globalKey && candidate === globalKey) return true;
  for (const val of overlayKeys.values()) if (val === candidate) return true;
  return false;
}

export function getUserIdForKey(candidate) {
  if (!candidate) return null;
  const key = String(candidate);
  for (const [uid, saved] of overlayKeys.entries()) {
    if (saved === key) return uid;
  }
  return null;
}
