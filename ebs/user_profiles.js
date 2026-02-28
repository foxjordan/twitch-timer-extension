import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const PROFILES_PATH = path.resolve(DATA_DIR, 'user-profiles.json');
const profiles = new Map(); // userId -> { login, displayName }

export async function loadUserProfiles() {
  try {
    const raw = await readFile(PROFILES_PATH, 'utf-8');
    const obj = JSON.parse(raw);
    for (const [uid, profile] of Object.entries(obj)) {
      if (profile && typeof profile === 'object') {
        profiles.set(String(uid), profile);
      }
    }
  } catch {}
}

async function persistUserProfiles() {
  try {
    const obj = {};
    for (const [uid, profile] of profiles.entries()) obj[uid] = profile;
    await writeFile(PROFILES_PATH, JSON.stringify(obj, null, 2), 'utf-8');
  } catch {}
}

export function setUserProfile(userId, login, displayName) {
  const uid = String(userId);
  profiles.set(uid, {
    login: login || null,
    displayName: displayName || login || null,
  });
  persistUserProfiles().catch(() => {});
}

export function getUserProfile(userId) {
  return profiles.get(String(userId)) || null;
}
