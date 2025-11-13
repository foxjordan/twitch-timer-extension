import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { RULES as DEFAULT_RULES } from './rules.js';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const RULES_PATH = path.resolve(DATA_DIR, 'overlay-rules.json');

let current = { ...DEFAULT_RULES };

export function getRules() {
  return current;
}

export function setRules(patch = {}) {
  // shallow merge; validate numeric fields
  const next = JSON.parse(JSON.stringify(current));
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
  if (patch.follow) {
    next.follow = {
      enabled: (typeof patch.follow.enabled === 'boolean') ? patch.follow.enabled : (next.follow?.enabled ?? false),
      add_seconds: numberOr(next.follow?.add_seconds ?? 600, patch.follow.add_seconds)
    };
  }
  current = next;
  persistRules().catch(() => {});
  return current;
}

export async function loadRules() {
  try {
    const raw = await readFile(RULES_PATH, 'utf-8');
    const obj = JSON.parse(raw);
    current = { ...DEFAULT_RULES, ...obj,
      bits: { ...DEFAULT_RULES.bits, ...(obj.bits||{}) },
      sub: { ...DEFAULT_RULES.sub, ...(obj.sub||{}) },
      resub: { ...DEFAULT_RULES.resub, ...(obj.resub||{}) },
      gift_sub: { ...DEFAULT_RULES.gift_sub, ...(obj.gift_sub||{}) },
      charity: { ...DEFAULT_RULES.charity, ...(obj.charity||{}) },
      hypeTrain: { ...DEFAULT_RULES.hypeTrain, ...(obj.hypeTrain||{}) },
      follow: { ...DEFAULT_RULES.follow, ...(obj.follow||{}) },
    };
  } catch {}
}

async function persistRules() {
  try {
    await writeFile(RULES_PATH, JSON.stringify(current, null, 2), 'utf-8');
  } catch {}
}

function numberOr(base, candidate, min) {
  const n = Number(candidate);
  if (!Number.isFinite(n)) return base;
  if (typeof min === 'number' && n < min) return base;
  return n;
}
