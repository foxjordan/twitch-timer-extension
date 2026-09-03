// Pure, dependency-free core for the Plinko Extras overlay:
//   - simulatePlinko(): server-authoritative, seeded bounce -> landing bin
//   - DEFAULT_PLINKO_CONFIG / sanitizePlinkoConfig(): per-broadcaster board config
//
// The overlay and the Extras-page preview replay the returned `path` array
// verbatim, so this function is the single source of truth for where a token
// lands and no client ever re-simulates physics.

export const MIN_ROWS = 6;
export const MAX_ROWS = 16;

const clone = (v) => JSON.parse(JSON.stringify(v));

const MIN_BASE_SECONDS = 1;
const MAX_BASE_SECONDS = 3600;
const MIN_MULTIPLIER = 0.1;
const MAX_MULTIPLIER = 100;
const HEX_COLOR = /^#([0-9a-fA-F]{3}){1,2}$/;

// Exact-hostname allowlist for the token image, matching the sound-alert
// thumbnail rule (ebs/routes_sounds.js ALLOWED_THUMBNAIL_HOSTS). The overlay
// is an external browser source, so it loads these CDNs directly — but the
// value is broadcaster-supplied, so it's still validated before we store it.
export const ALLOWED_TOKEN_HOSTS = new Set(['static-cdn.jtvnw.net', 'cdn.7tv.app']);
const ALLOWED_TOKEN_SOURCES = new Set(['twitch', '7tv', '']);

const roundTo = (n, d) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

function clampNumber(value, lo, hi, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

function sanitizeColor(value, fallback) {
  return typeof value === 'string' && HEX_COLOR.test(value.trim()) ? value.trim() : fallback;
}

function sanitizeTokenUrl(value) {
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

function sanitizeToken(raw, baseToken) {
  const base = baseToken || DEFAULT_PLINKO_CONFIG.token;
  if (raw == null || typeof raw !== 'object') return { ...base };
  return {
    name: typeof raw.name === 'string' ? raw.name.slice(0, 100) : base.name,
    url: 'url' in raw ? sanitizeTokenUrl(raw.url) : base.url,
    source:
      'source' in raw
        ? ALLOWED_TOKEN_SOURCES.has(raw.source)
          ? raw.source
          : ''
        : base.source,
  };
}

const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

// Look of the overlay board, so streamers can match their scene. Everything
// here is cosmetic — it never affects where a token lands.
function sanitizeStyle(raw, baseStyle) {
  const base = baseStyle || DEFAULT_PLINKO_CONFIG.style;
  if (raw == null || typeof raw !== 'object') return { ...base };
  return {
    panel: bool(raw.panel, base.panel),
    panelColor: sanitizeColor(raw.panelColor, base.panelColor),
    panelOpacity: roundTo(
      clampNumber('panelOpacity' in raw ? raw.panelOpacity : base.panelOpacity, 0, 1, base.panelOpacity),
      2,
    ),
    pegs: bool(raw.pegs, base.pegs),
    pegColor: sanitizeColor(raw.pegColor, base.pegColor),
    textColor: sanitizeColor(raw.textColor, base.textColor),
    showStatus: bool(raw.showStatus, base.showStatus),
    pegSound: bool(raw.pegSound, base.pegSound),
    pegSoundVolume: roundTo(
      clampNumber('pegSoundVolume' in raw ? raw.pegSoundVolume : base.pegSoundVolume, 0, 1, base.pegSoundVolume),
      2,
    ),
    winSound: bool(raw.winSound, base.winSound),
    winSoundVolume: roundTo(
      clampNumber('winSoundVolume' in raw ? raw.winSoundVolume : base.winSoundVolume, 0, 1, base.winSoundVolume),
      2,
    ),
  };
}

function sanitizeBins(rawBins, rows, baseBins) {
  const target = rows + 1;
  const defaults = makeDefaultBins(rows);
  const source = Array.isArray(rawBins)
    ? rawBins
    : Array.isArray(baseBins)
      ? baseBins
      : defaults;
  const out = [];
  for (let i = 0; i < target; i++) {
    const entry = source[i] || defaults[i];
    out.push({
      multiplier: roundTo(
        clampNumber(entry.multiplier, MIN_MULTIPLIER, MAX_MULTIPLIER, defaults[i].multiplier),
        2,
      ),
      color: sanitizeColor(entry.color, defaults[i].color),
    });
  }
  return out;
}

// Symmetric multiplier ramp: low in the centre (common landings), high at the
// edges (rare). Quadratic falloff from 1x centre to ~4x edge, snapped to a
// tidy 0.25 step so the defaults read nicely in the config UI.
function makeDefaultBins(rows) {
  const n = rows + 1;
  const center = rows / 2;
  const bins = [];
  for (let i = 0; i < n; i++) {
    const d = center > 0 ? Math.abs(i - center) / center : 0; // 0 centre .. 1 edge
    const raw = 1 + (4 - 1) * d * d;
    const multiplier = Math.max(1, Math.round(raw * 4) / 4);
    bins.push({ multiplier, color: colorForMultiplier(multiplier) });
  }
  return bins;
}

function colorForMultiplier(m) {
  if (m >= 4) return '#F97316'; // orange
  if (m >= 2) return '#EC4899'; // pink
  if (m >= 1.5) return '#3B82F6'; // blue
  return '#9146FF'; // twitch purple
}

export const DEFAULT_PLINKO_CONFIG = {
  baseSeconds: 60,
  rows: 9,
  bins: makeDefaultBins(9),
  token: { name: '', url: '', source: '' },
  // A sound id whose redemption auto-drops a token (random column). '' = off.
  triggerSoundId: '',
  style: {
    panel: true,
    panelColor: '#0f0f12',
    panelOpacity: 0.82,
    pegs: true,
    pegColor: '#ffffff',
    textColor: '#f8fafc',
    showStatus: true,
    pegSound: true,
    pegSoundVolume: 0.35,
    winSound: true,
    winSoundVolume: 0.5,
  },
};

/**
 * Merge a partial patch onto a base config and clamp every field to a safe
 * range. Never throws: bad values fall back to the base / default.
 * @param {object} [patch]
 * @param {object} [base]
 */
export function sanitizePlinkoConfig(patch, base = DEFAULT_PLINKO_CONFIG) {
  const b = clone(base);
  const p = patch && typeof patch === 'object' ? patch : {};

  const baseSeconds = Math.floor(
    clampNumber(
      'baseSeconds' in p ? p.baseSeconds : b.baseSeconds,
      MIN_BASE_SECONDS,
      MAX_BASE_SECONDS,
      b.baseSeconds,
    ),
  );

  const rows = Math.round(
    clampNumber('rows' in p ? p.rows : b.rows, MIN_ROWS, MAX_ROWS, b.rows),
  );

  const triggerSoundId =
    'triggerSoundId' in p
      ? (typeof p.triggerSoundId === 'string' ? p.triggerSoundId.slice(0, 64) : '')
      : (typeof b.triggerSoundId === 'string' ? b.triggerSoundId : '');

  return {
    baseSeconds,
    rows,
    bins: sanitizeBins(p.bins, rows, b.bins),
    token: sanitizeToken(p.token, b.token),
    triggerSoundId,
    style: sanitizeStyle(p.style, b.style),
  };
}

// --- seeded PRNG ------------------------------------------------------------
// xmur3 (string -> uint32 seed) feeding mulberry32 (uint32 -> [0,1) stream).
// Both are tiny, well-known, and give a stable stream across Node versions.
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

// Each bounce nudges the token a half cell. Instead of a fair coin per bounce
// (a tidy left/right shuffle around one column), the direction is *sticky*:
// with probability PLINKO_PERSISTENCE the token keeps its current heading, so
// it caroms several cells to one side before turning — like a real board with
// momentum. Walls always send it back inward. ~1.5 bounces per row gives the
// spread room to reach the middle from an edge column while still leaving a
// clear centre-weighted bell.
const PLINKO_PERSISTENCE = 0.68;
const PLINKO_STEPS_PER_ROW = 1.5;

/**
 * A Galton board with a chosen entry column and momentum. The token enters
 * above `dropColumn`; where it enters shifts where it can land, but never
 * guarantees a bin.
 *
 * The bounce count is forced even so the token always comes to rest on a whole
 * bin, never straddling the line between two — `binIndex` is then unambiguous
 * and unbiased.
 *
 * @param {{ rows:number, dropColumn?:number, seed?:string }} opts
 * @returns {{ path: boolean[], binIndex: number }} path[i] === true means the
 *   token moved right at step i; binIndex is the 0..rows landing bin. The
 *   overlay replays `path` verbatim, so this is the only source of truth.
 */
export function simulatePlinko({ rows, dropColumn = 0, seed = '' } = {}) {
  const nRows = rows;
  const rand = mulberry32(xmur3(String(seed))());
  const start = Math.min(nRows, Math.max(0, Number(dropColumn) || 0));
  let steps = Math.round(nRows * PLINKO_STEPS_PER_ROW);
  if (steps % 2 !== 0) steps += 1; // even -> always lands on a whole bin

  const path = [];
  let pos = start; // horizontal position in bin units
  let dir = rand() < 0.5 ? 1 : -1; // current heading (+1 = right)
  for (let i = 0; i < steps; i++) {
    if (rand() >= PLINKO_PERSISTENCE) dir = -dir; // occasionally lose momentum
    if (pos <= 0) dir = 1; // a wall always sends it back inward
    if (pos >= nRows) dir = -1;
    pos += dir * 0.5;
    if (pos < 0) pos = 0;
    if (pos > nRows) pos = nRows;
    path.push(dir > 0);
  }

  return { path, binIndex: Math.min(nRows, Math.max(0, Math.round(pos))) };
}

/**
 * Full outcome of one drop: run the bounce, then resolve the landing bin to a
 * multiplier and the seconds to add to the subathon timer. The route layer
 * only does auth + addSeconds + broadcast around this.
 * @param {object} config a sanitized Plinko config
 * @param {{ dropColumn?:number, seed?:string }} opts
 * @returns {{ path: boolean[], binIndex: number, multiplier: number, secondsToAdd: number }}
 */
export function computePlinkoDrop(config, { dropColumn = 0, seed = '' } = {}) {
  const { path, binIndex } = simulatePlinko({ rows: config.rows, dropColumn, seed });
  const bin = config.bins[binIndex] || config.bins[config.bins.length - 1];
  const multiplier = bin ? bin.multiplier : 1;
  const secondsToAdd = Math.floor(config.baseSeconds * multiplier);
  return { path, binIndex, multiplier, secondsToAdd };
}
