import { readFile, writeFile } from "fs/promises";
import path from "path";
import { VALID_TIERS } from "./tiers.js";
import { DEFAULT_ALLOWED_VOICES, isValidVoice } from "./tts_voices.js";

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const TTS_PATH = path.resolve(DATA_DIR, "overlay-tts-settings.json");
const TTS_GLOBAL_PATH = path.resolve(DATA_DIR, "tts-global-config.json");

// userId -> TtsSettings
const ttsSettingsByUser = new Map();

const DEFAULT_TTS_SETTINGS = {
  enabled: false,
  tier: "sound_300",
  allowedVoices: [...DEFAULT_ALLOWED_VOICES],
  maxMessageLength: 300,
  bannedWords: [],
  volume: 80,
  cooldownMs: 10000,
  moderationEnabled: true,
};

// ===== Global admin TTS config =====
let globalTtsConfig = {
  minTier: "sound_300",
  availableVoices: [], // empty = all voices available (populated on first load)
  moderation: {
    offensiveFilterEnabled: true,  // built-in slur/hate patterns
    capsFilterEnabled: true,       // excessive caps detection
    capsRatio: 80,                 // % of letters that must be caps (1-100)
    capsMinLength: 20,             // only check messages longer than this
    repeatFilterEnabled: true,     // repeated character detection
    repeatThreshold: 10,           // consecutive identical chars to trigger
    blockUrls: false,              // block messages containing URLs
  },
};

function cloneSettings(s) {
  return JSON.parse(JSON.stringify(s));
}

function ensureUser(uid) {
  const id = uid ? String(uid) : "default";
  if (!ttsSettingsByUser.has(id)) {
    ttsSettingsByUser.set(id, cloneSettings(DEFAULT_TTS_SETTINGS));
  }
  return id;
}

export async function loadTtsSettings() {
  // Load global admin config
  try {
    const raw = await readFile(TTS_GLOBAL_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.minTier === "string" && VALID_TIERS.includes(parsed.minTier)) {
      globalTtsConfig.minTier = parsed.minTier;
    }
    if (Array.isArray(parsed.availableVoices)) {
      globalTtsConfig.availableVoices = parsed.availableVoices.filter((v) => typeof v === "string");
    }
    if (parsed.moderation && typeof parsed.moderation === "object") {
      globalTtsConfig.moderation = { ...globalTtsConfig.moderation, ...parsed.moderation };
    }
  } catch {}

  // Load per-user settings
  try {
    const raw = await readFile(TTS_PATH, "utf-8");
    const obj = JSON.parse(raw);
    for (const [uid, val] of Object.entries(obj)) {
      ttsSettingsByUser.set(String(uid), { ...cloneSettings(DEFAULT_TTS_SETTINGS), ...val });
    }
  } catch {}
}

async function persist() {
  try {
    const obj = {};
    for (const [uid, val] of ttsSettingsByUser.entries()) obj[uid] = val;
    await writeFile(TTS_PATH, JSON.stringify(obj, null, 2), "utf-8");
  } catch {}
}

export function getTtsSettings(uid) {
  const id = ensureUser(uid);
  return cloneSettings(ttsSettingsByUser.get(id));
}

export function setTtsSettings(uid, patch) {
  const id = ensureUser(uid);
  const curr = ttsSettingsByUser.get(id);

  if (typeof patch.enabled === "boolean") {
    curr.enabled = patch.enabled;
  }

  if (typeof patch.tier === "string" && VALID_TIERS.includes(patch.tier)) {
    // Enforce global minimum tier set by admin
    const tierIdx = VALID_TIERS.indexOf(patch.tier);
    const minIdx = VALID_TIERS.indexOf(globalTtsConfig.minTier);
    if (tierIdx >= minIdx) {
      curr.tier = patch.tier;
    }
  }

  if (Array.isArray(patch.allowedVoices)) {
    const valid = patch.allowedVoices.filter((v) => typeof v === "string" && isValidVoice(v));
    if (valid.length > 0) {
      curr.allowedVoices = valid;
    }
  }

  if (typeof patch.maxMessageLength === "number") {
    curr.maxMessageLength = Math.max(1, Math.min(300, Math.floor(patch.maxMessageLength)));
  }

  if (Array.isArray(patch.bannedWords)) {
    curr.bannedWords = patch.bannedWords
      .filter((w) => typeof w === "string" && w.trim().length > 0)
      .map((w) => w.trim().toLowerCase())
      .slice(0, 200); // cap at 200 banned words
  }

  if (typeof patch.volume === "number") {
    curr.volume = Math.max(0, Math.min(100, Math.floor(patch.volume)));
  }

  if (typeof patch.cooldownMs === "number") {
    curr.cooldownMs = Math.max(0, Math.min(120000, Math.floor(patch.cooldownMs)));
  }

  if (typeof patch.moderationEnabled === "boolean") {
    curr.moderationEnabled = patch.moderationEnabled;
  }

  ttsSettingsByUser.set(id, curr);
  persist().catch(() => {});
  return cloneSettings(curr);
}

/**
 * Viewer-facing subset of settings (no banned words exposed).
 */
export function getPublicTtsSettings(uid) {
  const s = getTtsSettings(uid);
  return {
    enabled: s.enabled,
    allowedVoices: s.allowedVoices,
    tier: s.tier,
    maxMessageLength: s.maxMessageLength,
    volume: s.volume,
    cooldownMs: s.cooldownMs,
  };
}

// ===== Global admin TTS config =====

export function getGlobalTtsConfig() {
  return {
    ...globalTtsConfig,
    availableVoices: [...globalTtsConfig.availableVoices],
    moderation: { ...globalTtsConfig.moderation },
  };
}

export function setGlobalTtsConfig(patch) {
  if (typeof patch.minTier === "string" && VALID_TIERS.includes(patch.minTier)) {
    globalTtsConfig.minTier = patch.minTier;
  }
  if (Array.isArray(patch.availableVoices)) {
    globalTtsConfig.availableVoices = patch.availableVoices.filter((v) => typeof v === "string");
  }
  if (patch.moderation && typeof patch.moderation === "object") {
    const m = patch.moderation;
    const cur = globalTtsConfig.moderation;
    if (typeof m.offensiveFilterEnabled === "boolean") cur.offensiveFilterEnabled = m.offensiveFilterEnabled;
    if (typeof m.capsFilterEnabled === "boolean") cur.capsFilterEnabled = m.capsFilterEnabled;
    if (typeof m.capsRatio === "number") cur.capsRatio = Math.max(1, Math.min(100, Math.floor(m.capsRatio)));
    if (typeof m.capsMinLength === "number") cur.capsMinLength = Math.max(1, Math.min(500, Math.floor(m.capsMinLength)));
    if (typeof m.repeatFilterEnabled === "boolean") cur.repeatFilterEnabled = m.repeatFilterEnabled;
    if (typeof m.repeatThreshold === "number") cur.repeatThreshold = Math.max(2, Math.min(50, Math.floor(m.repeatThreshold)));
    if (typeof m.blockUrls === "boolean") cur.blockUrls = m.blockUrls;
  }
  persistGlobal().catch(() => {});
  return getGlobalTtsConfig();
}

async function persistGlobal() {
  try {
    await writeFile(TTS_GLOBAL_PATH, JSON.stringify(globalTtsConfig, null, 2), "utf-8");
  } catch {}
}
