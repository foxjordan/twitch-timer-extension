import { readFile, writeFile } from "fs/promises";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const BANS_PATH = path.resolve(DATA_DIR, "overlay-bans.json");

// userId -> { bannedAt, reason }
const bans = new Map();

export async function loadBans() {
  try {
    const raw = await readFile(BANS_PATH, "utf-8");
    const obj = JSON.parse(raw);
    for (const [uid, val] of Object.entries(obj)) {
      bans.set(String(uid), val);
    }
  } catch {}
}

async function persistBans() {
  try {
    const obj = {};
    for (const [uid, val] of bans.entries()) obj[uid] = val;
    await writeFile(BANS_PATH, JSON.stringify(obj, null, 2), "utf-8");
  } catch {}
}

export function isBanned(userId) {
  return bans.has(String(userId));
}

export function getBan(userId) {
  return bans.get(String(userId)) || null;
}

export function banUser(userId, reason = "") {
  const uid = String(userId);
  bans.set(uid, { bannedAt: new Date().toISOString(), reason });
  persistBans().catch(() => {});
}

export function unbanUser(userId) {
  const uid = String(userId);
  const existed = bans.has(uid);
  bans.delete(uid);
  if (existed) persistBans().catch(() => {});
  return existed;
}

export function getAllBans() {
  const result = {};
  for (const [uid, val] of bans.entries()) result[uid] = val;
  return result;
}
