import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { RULES as DEFAULT_RULES } from './rules.js';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const RULES_PATH = path.resolve(DATA_DIR, 'overlay-rules.json');

// Store per-user rules. Keys are Twitch user IDs as strings.
// We still support legacy file shape (single rules object) by treating it as a default.
let byUser = {}; // { [uid: string]: Rules }

function mergeRules(base, patch = {}) {
  const next = JSON.parse(JSON.stringify(base));
  if (patch.bits) {
    next.bits = {
      per: numberOr(next.bits.per, patch.bits.per),
      add_seconds: numberOr(next.bits.add_seconds, patch.bits.add_seconds)
    };
  }
  if (patch.sub) {
    next.sub = {
      '1000': numberOr(next.sub['1000'], patch.sub['1000']),
      '2000': numberOr(next.sub['2000'], patch.sub['2000']),
      '3000': numberOr(next.sub['3000'], patch.sub['3000'])
    };
  }
  if (patch.resub) {
    next.resub = { base_seconds: numberOr(next.resub.base_seconds, patch.resub.base_seconds) };
  }
  if (patch.gift_sub) {
    next.gift_sub = { per_sub_seconds: numberOr(next.gift_sub.per_sub_seconds, patch.gift_sub.per_sub_seconds) };
  }
  if (patch.charity) {
    next.charity = { per_usd: numberOr(next.charity.per_usd, patch.charity.per_usd) };
  }
  if (patch.hypeTrain) {
    next.hypeTrain = { multiplier: numberOr(next.hypeTrain.multiplier, patch.hypeTrain.multiplier, 1) };
  }
  if (patch.bonusTime) {
    next.bonusTime = {
      multiplier: numberOr(next.bonusTime?.multiplier ?? 2, patch.bonusTime.multiplier, 0),
      stackWithHype: (typeof patch.bonusTime.stackWithHype === 'boolean') ? patch.bonusTime.stackWithHype : (next.bonusTime?.stackWithHype ?? false),
    };
  }
  if (patch.follow) {
    next.follow = {
      enabled: (typeof patch.follow.enabled === 'boolean') ? patch.follow.enabled : (next.follow?.enabled ?? false),
      add_seconds: numberOr(next.follow?.add_seconds ?? 600, patch.follow.add_seconds)
    };
  }
  return next;
}

export async function loadRules() {
  try {
    const raw = await readFile(RULES_PATH, 'utf-8');
    const obj = JSON.parse(raw);
    if (obj && (obj.bits || obj.sub || obj.hypeTrain)) {
      // legacy single object; treat as default for everyone under key "default"
      byUser = { default: mergeRules(DEFAULT_RULES, obj) };
    } else if (obj && typeof obj === 'object') {
      byUser = {};
      for (const [uid, rules] of Object.entries(obj)) {
        byUser[String(uid)] = mergeRules(DEFAULT_RULES, rules || {});
      }
    }
  } catch {}
}

async function persistRules() {
  try {
    await writeFile(RULES_PATH, JSON.stringify(byUser, null, 2), 'utf-8');
  } catch {}
}

function numberOr(base, candidate, min) {
  const n = Number(candidate);
  if (!Number.isFinite(n)) return base;
  if (typeof min === 'number' && n < min) return base;
  return n;
}

export function getRules(uid) {
  const id = uid ? String(uid) : null;
  if (id && byUser[id]) return mergeRules(DEFAULT_RULES, byUser[id]);
  if (byUser.default) return mergeRules(DEFAULT_RULES, byUser.default);
  return DEFAULT_RULES;
}

export function setRules(uid, patch = {}) {
  const id = String(uid || '').trim();
  if (!id) throw new Error('User id required');
  const curr = byUser[id] ? mergeRules(DEFAULT_RULES, byUser[id]) : mergeRules(DEFAULT_RULES, {});
  const next = mergeRules(curr, patch || {});
  byUser[id] = next;
  persistRules().catch(() => {});
  return next;
}
