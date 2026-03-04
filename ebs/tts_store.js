import { readFile, writeFile } from "fs/promises";
import path from "path";
import { VALID_TIERS } from "./tiers.js";
import { DEFAULT_ALLOWED_VOICES, isValidVoice } from "./tts_voices.js";

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const TTS_PATH = path.resolve(DATA_DIR, "overlay-tts-settings.json");

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

// Minimum tier index (sound_300 = index of "sound_300" in VALID_TIERS)
const MIN_TIER = "sound_300";

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
    // Enforce minimum of sound_300
    const tierIdx = VALID_TIERS.indexOf(patch.tier);
    const minIdx = VALID_TIERS.indexOf(MIN_TIER);
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
