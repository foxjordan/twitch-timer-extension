// Pure, dependency-free core for the Slot Machine Extras overlay. Mirrors the
// shape of plinko.js: DEFAULT config + sanitizer + a seeded, server-authoritative
// outcome function. The overlay and the Extras preview replay `reels` verbatim.
import { ALLOWED_TOKEN_HOSTS } from './plinko.js';

export const MIN_SYMBOLS = 2;
export const MAX_SYMBOLS = 8;
export const SLOTS_DURATION_MS = 2700;

const clone = (v) => JSON.parse(JSON.stringify(v));
const HEX_COLOR = /^#([0-9a-fA-F]{3}){1,2}$/;
const ALLOWED_EMOTE_SOURCES = new Set(['twitch', '7tv', '']);

const MIN_BASE_SECONDS = 1;
const MAX_BASE_SECONDS = 3600;
const MIN_WEIGHT = 1;
const MAX_WEIGHT = 1000;
const MIN_MULT = 1;
const MAX_MULT = 100;

const roundTo = (n, d) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
function clampNumber(value, lo, hi, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
function sanitizeColor(value, fallback) {
  return typeof value === 'string' && HEX_COLOR.test(value.trim()) ? value.trim() : fallback;
}
function sanitizeEmoteUrl(value) {
  if (typeof value !== 'string' || !value) return '';
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'https:') return '';
  if (!ALLOWED_TOKEN_HOSTS.has(parsed.hostname)) return '';
  return parsed.toString();
}

export const DEFAULT_SLOTS_CONFIG = {
  baseSeconds: 30,
  symbols: [
    { emote: { name: '', url: '', source: '' }, weight: 1, tripleMultiplier: 2 },
    { emote: { name: '', url: '', source: '' }, weight: 1, tripleMultiplier: 4 },
    { emote: { name: '', url: '', source: '' }, weight: 1, tripleMultiplier: 10 },
  ],
  anyTwoMultiplier: 1.5,
  noMatchMultiplier: 1.0,
  triggerSoundId: '',
  style: {
    panel: true,
    panelColor: '#0f0f12',
    panelOpacity: 0.82,
    reelColor: '#17171b',
    textColor: '#f8fafc',
    showStatus: true,
    reelSound: true,
    reelSoundVolume: 0.35,
    winSound: true,
    winSoundVolume: 0.5,
    loseSound: true,
    loseSoundVolume: 0.5,
    bgSound: true,
    bgSoundVolume: 0.25,
  },
};

function centreDefaultSymbol() {
  return clone(DEFAULT_SLOTS_CONFIG.symbols[0]);
}

function sanitizeSymbol(raw, fallback) {
  const base = fallback || centreDefaultSymbol();
  if (raw == null || typeof raw !== 'object') return clone(base);
  const rawEmote = raw.emote && typeof raw.emote === 'object' ? raw.emote : {};
  return {
    emote: {
      name: typeof rawEmote.name === 'string' ? rawEmote.name.slice(0, 100) : base.emote.name,
      url: 'url' in rawEmote ? sanitizeEmoteUrl(rawEmote.url) : base.emote.url,
      source: ALLOWED_EMOTE_SOURCES.has(rawEmote.source) ? rawEmote.source : '',
    },
    weight: Math.round(clampNumber(raw.weight, MIN_WEIGHT, MAX_WEIGHT, base.weight)),
    tripleMultiplier: roundTo(
      clampNumber(raw.tripleMultiplier, MIN_MULT, MAX_MULT, base.tripleMultiplier),
      2,
    ),
  };
}

function sanitizeSymbols(rawSymbols, baseSymbols) {
  const source = Array.isArray(rawSymbols)
    ? rawSymbols
    : Array.isArray(baseSymbols)
      ? baseSymbols
      : DEFAULT_SLOTS_CONFIG.symbols;
  const trimmed = source.slice(0, MAX_SYMBOLS);
  const out = trimmed.map((s, i) => sanitizeSymbol(s, (baseSymbols && baseSymbols[i]) || null));
  while (out.length < MIN_SYMBOLS) out.push(centreDefaultSymbol());
  return out;
}

function sanitizeStyle(raw, baseStyle) {
  const base = baseStyle || DEFAULT_SLOTS_CONFIG.style;
  if (raw == null || typeof raw !== 'object') return { ...base };
  const vol = (k) => roundTo(clampNumber(k in raw ? raw[k] : base[k], 0, 1, base[k]), 2);
  return {
    panel: bool(raw.panel, base.panel),
    panelColor: sanitizeColor(raw.panelColor, base.panelColor),
    panelOpacity: roundTo(
      clampNumber('panelOpacity' in raw ? raw.panelOpacity : base.panelOpacity, 0, 1, base.panelOpacity),
      2,
    ),
    reelColor: sanitizeColor(raw.reelColor, base.reelColor),
    textColor: sanitizeColor(raw.textColor, base.textColor),
    showStatus: bool(raw.showStatus, base.showStatus),
    reelSound: bool(raw.reelSound, base.reelSound),
    reelSoundVolume: vol('reelSoundVolume'),
    winSound: bool(raw.winSound, base.winSound),
    winSoundVolume: vol('winSoundVolume'),
    loseSound: bool(raw.loseSound, base.loseSound),
    loseSoundVolume: vol('loseSoundVolume'),
    bgSound: bool(raw.bgSound, base.bgSound),
    bgSoundVolume: vol('bgSoundVolume'),
  };
}

/**
 * Merge a partial patch onto a base config and clamp every field. Never throws.
 * @param {object} [patch]
 * @param {object} [base]
 */
export function sanitizeSlotsConfig(patch, base = DEFAULT_SLOTS_CONFIG) {
  const b = clone(base);
  const p = patch && typeof patch === 'object' ? patch : {};
  return {
    baseSeconds: Math.floor(
      clampNumber('baseSeconds' in p ? p.baseSeconds : b.baseSeconds, MIN_BASE_SECONDS, MAX_BASE_SECONDS, b.baseSeconds),
    ),
    symbols: sanitizeSymbols(p.symbols, b.symbols),
    anyTwoMultiplier: roundTo(
      clampNumber('anyTwoMultiplier' in p ? p.anyTwoMultiplier : b.anyTwoMultiplier, MIN_MULT, MAX_MULT, b.anyTwoMultiplier),
      2,
    ),
    noMatchMultiplier: roundTo(
      clampNumber('noMatchMultiplier' in p ? p.noMatchMultiplier : b.noMatchMultiplier, MIN_MULT, MAX_MULT, b.noMatchMultiplier),
      2,
    ),
    triggerSoundId:
      'triggerSoundId' in p
        ? (typeof p.triggerSoundId === 'string' ? p.triggerSoundId.slice(0, 64) : '')
        : (typeof b.triggerSoundId === 'string' ? b.triggerSoundId : ''),
    style: sanitizeStyle(p.style, b.style),
  };
}

// --- seeded PRNG (xmur3 -> mulberry32), kept private like plinko.js -----------
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick(symbols, r) {
  const total = symbols.reduce((s, x) => s + (x.weight || 1), 0) || symbols.length;
  let x = r * total;
  for (let i = 0; i < symbols.length; i++) {
    x -= symbols[i].weight || 1;
    if (x < 0) return i;
  }
  return symbols.length - 1;
}

/**
 * One spin: seeded weighted pick per reel, then resolve the match to a
 * multiplier and the seconds to add. The route layer does auth + queue +
 * addSeconds around this.
 * @param {object} config a sanitized Slots config
 * @param {{ seed?: string }} opts
 * @returns {{ reels:number[], matchKind:'triple'|'pair'|'none', multiplier:number, secondsToAdd:number }}
 */
export function computeSlotsSpin(config, { seed = '' } = {}) {
  const rand = mulberry32(xmur3(String(seed))());
  const symbols = config.symbols;
  const reels = [
    weightedPick(symbols, rand()),
    weightedPick(symbols, rand()),
    weightedPick(symbols, rand()),
  ];
  const [a, b, c] = reels;
  let matchKind;
  let multiplier;
  if (a === b && b === c) {
    matchKind = 'triple';
    multiplier = symbols[a].tripleMultiplier;
  } else if (a === b || b === c || a === c) {
    matchKind = 'pair';
    multiplier = config.anyTwoMultiplier;
  } else {
    matchKind = 'none';
    multiplier = config.noMatchMultiplier;
  }
  return { reels, matchKind, multiplier, secondsToAdd: Math.floor(config.baseSeconds * multiplier) };
}
