import { readFile, writeFile } from "fs/promises";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const SUBS_PATH = path.resolve(DATA_DIR, "overlay-subscriptions.json");

// userId -> { stripeCustomerId, subscriptionId, status, currentPeriodEnd }
const subscriptions = new Map();

export async function loadSubscriptions() {
  try {
    const raw = await readFile(SUBS_PATH, "utf-8");
    const obj = JSON.parse(raw);
    for (const [uid, val] of Object.entries(obj)) {
      subscriptions.set(String(uid), val);
    }
  } catch {}
}

async function persist() {
  try {
    const obj = {};
    for (const [uid, val] of subscriptions.entries()) obj[uid] = val;
    await writeFile(SUBS_PATH, JSON.stringify(obj, null, 2), "utf-8");
  } catch {}
}

export function getSubscription(userId) {
  return subscriptions.get(String(userId)) || null;
}

export function setSubscription(userId, data) {
  const uid = String(userId);
  const existing = subscriptions.get(uid) || {};
  subscriptions.set(uid, { ...existing, ...data });
  persist().catch(() => {});
}

export function removeSubscription(userId) {
  const uid = String(userId);
  const existed = subscriptions.has(uid);
  subscriptions.delete(uid);
  if (existed) persist().catch(() => {});
  return existed;
}

export function isPro(userId) {
  const sub = subscriptions.get(String(userId));
  if (!sub) return false;
  return sub.status === "active" || sub.status === "trialing";
}

export function findUserByCustomerId(stripeCustomerId) {
  for (const [uid, val] of subscriptions.entries()) {
    if (val.stripeCustomerId === stripeCustomerId) return uid;
  }
  return null;
}

export function getAllSubscriptions() {
  const result = {};
  for (const [uid, val] of subscriptions.entries()) result[uid] = val;
  return result;
}
