import { readFile, writeFile, mkdir, unlink, stat, copyFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const DATA_DIR = process.env.DATA_DIR || process.cwd();
export const SOUNDS_PATH = path.resolve(DATA_DIR, "overlay-sound-alerts.json");
export const SOUNDS_FILE_DIR = path.resolve(DATA_DIR, "sounds");

const soundAlertsByUser = new Map(); // userId -> { sounds: Map<soundId, SoundConfig>, settings: {} }

export const ALLOWED_MIME_TYPES = [
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/mp4",
  "audio/x-wav",
];

export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
];

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];

const IMAGE_MIME_TO_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

const VIDEO_MIME_TO_EXT = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export const MAX_IMAGE_SIZE = 256 * 1024; // 256 KB

const MIME_TO_EXT = {
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/x-wav": "wav",
};

export const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB
export const MAX_VIDEO_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_SOUNDS_PER_USER = 20;

export const VALID_TIERS = [
  "sound_10",
  "sound_25",
  "sound_50",
  "sound_75",
  "sound_100",
  "sound_150",
  "sound_200",
  "sound_300",
  "sound_500",
  "sound_1000",
  "sound_1250",
  "sound_1500",
  "sound_1750",
  "sound_2000",
  "sound_2500",
  "sound_3000",
  "sound_4000",
  "sound_5000",
  "sound_7500",
  "sound_10000",
];

const DEFAULT_SOUND_SETTINGS = {
  enabled: true,
  globalVolume: 100,
  globalCooldownMs: 3000,
  maxQueueSize: 5,
  overlayDurationMs: 5000,
  videoClipsEnabled: false,
};

function nowIso() {
  return new Date().toISOString();
}

function ensureUser(uid) {
  const id = uid ? String(uid) : "default";
  if (!soundAlertsByUser.has(id)) {
    soundAlertsByUser.set(id, {
      sounds: new Map(),
      settings: { ...DEFAULT_SOUND_SETTINGS },
    });
  }
  return soundAlertsByUser.get(id);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function sanitizeNumber(val, fallback = 0, min, max) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  if (typeof min === "number" && num < min) return min;
  if (typeof max === "number" && num > max) return max;
  return num;
}

function sanitizeString(val, fallback = "") {
  if (typeof val === "string") return val.slice(0, 255);
  if (typeof val === "number") return String(val);
  return fallback;
}

// ===== Persistence =====

export async function loadSoundAlerts() {
  try {
    const raw = await readFile(SOUNDS_PATH, "utf-8");
    const obj = JSON.parse(raw);
    soundAlertsByUser.clear();
    if (obj && typeof obj === "object") {
      for (const [uid, userData] of Object.entries(obj)) {
        const user = ensureUser(uid);
        if (userData.settings && typeof userData.settings === "object") {
          user.settings = sanitizeSettings(userData.settings);
        }
        if (userData.sounds && typeof userData.sounds === "object") {
          for (const [sid, sound] of Object.entries(userData.sounds)) {
            const normalized = normalizeSound({ id: sid, ...sound });
            user.sounds.set(normalized.id, normalized);
          }
        }
      }
    }
  } catch {}
}

async function persistSoundAlerts() {
  try {
    const obj = {};
    for (const [uid, user] of soundAlertsByUser.entries()) {
      obj[uid] = {
        settings: user.settings,
        sounds: {},
      };
      for (const [sid, sound] of user.sounds.entries()) {
        obj[uid].sounds[sid] = sound;
      }
    }
    await writeFile(SOUNDS_PATH, JSON.stringify(obj, null, 2), "utf-8");
  } catch {}
}

// ===== Normalization =====

export const VALID_TYPES = ["sound", "clip", "video"];

function normalizeSound(raw = {}) {
  const now = nowIso();
  return {
    id: raw.id ? String(raw.id) : `snd_${crypto.randomUUID().slice(0, 12)}`,
    type: VALID_TYPES.includes(raw.type) ? raw.type : "sound",
    name: sanitizeString(raw.name, "Untitled Sound"),
    filename: sanitizeString(raw.filename, ""),
    originalFilename: sanitizeString(raw.originalFilename, ""),
    mimeType: sanitizeString(raw.mimeType, "audio/mpeg"),
    sizeBytes: sanitizeNumber(raw.sizeBytes, 0, 0),
    imageFilename: sanitizeString(raw.imageFilename, ""),
    clipUrl: sanitizeString(raw.clipUrl, ""),
    clipSlug: sanitizeString(raw.clipSlug, ""),
    tier: VALID_TIERS.includes(raw.tier) ? raw.tier : "sound_100",
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
    volume: sanitizeNumber(raw.volume, 80, 0, 100),
    cooldownMs: sanitizeNumber(raw.cooldownMs, 5000, 0, 60000),
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  };
}

function sanitizeSettings(raw = {}) {
  const next = { ...DEFAULT_SOUND_SETTINGS };
  if (typeof raw.enabled === "boolean") next.enabled = raw.enabled;
  next.globalVolume = sanitizeNumber(raw.globalVolume, next.globalVolume, 0, 100);
  next.globalCooldownMs = sanitizeNumber(raw.globalCooldownMs, next.globalCooldownMs, 0, 60000);
  next.maxQueueSize = sanitizeNumber(raw.maxQueueSize, next.maxQueueSize, 1, 20);
  next.overlayDurationMs = sanitizeNumber(raw.overlayDurationMs, next.overlayDurationMs, 1000, 30000);
  if (typeof raw.videoClipsEnabled === "boolean") next.videoClipsEnabled = raw.videoClipsEnabled;
  return next;
}

// ===== CRUD =====

export function listSounds(uid) {
  const user = ensureUser(uid);
  return Array.from(user.sounds.values())
    .map((s) => deepClone(s))
    .sort((a, b) => {
      const aDate = Date.parse(a.createdAt || "") || 0;
      const bDate = Date.parse(b.createdAt || "") || 0;
      return aDate - bDate;
    });
}

export function getSound(uid, soundId) {
  const user = ensureUser(uid);
  const sound = user.sounds.get(String(soundId));
  return sound ? deepClone(sound) : null;
}

export function createSound(uid, data = {}) {
  const user = ensureUser(uid);
  if (user.sounds.size >= MAX_SOUNDS_PER_USER) {
    return { error: `Maximum of ${MAX_SOUNDS_PER_USER} sounds reached` };
  }
  const sound = normalizeSound(data);
  user.sounds.set(sound.id, sound);
  persistSoundAlerts().catch(() => {});
  return deepClone(sound);
}

export function updateSound(uid, soundId, patch = {}) {
  const user = ensureUser(uid);
  const sound = user.sounds.get(String(soundId));
  if (!sound) return null;
  if ("name" in patch) sound.name = sanitizeString(patch.name, sound.name);
  if ("type" in patch && VALID_TYPES.includes(patch.type)) sound.type = patch.type;
  if ("tier" in patch && VALID_TIERS.includes(patch.tier)) sound.tier = patch.tier;
  if ("enabled" in patch) sound.enabled = Boolean(patch.enabled);
  if ("volume" in patch) sound.volume = sanitizeNumber(patch.volume, sound.volume, 0, 100);
  if ("cooldownMs" in patch) sound.cooldownMs = sanitizeNumber(patch.cooldownMs, sound.cooldownMs, 0, 60000);
  if ("filename" in patch) sound.filename = sanitizeString(patch.filename, sound.filename);
  if ("mimeType" in patch) sound.mimeType = sanitizeString(patch.mimeType, sound.mimeType);
  if ("sizeBytes" in patch) sound.sizeBytes = sanitizeNumber(patch.sizeBytes, sound.sizeBytes, 0);
  if ("imageFilename" in patch) sound.imageFilename = sanitizeString(patch.imageFilename, sound.imageFilename);
  if ("clipUrl" in patch) sound.clipUrl = sanitizeString(patch.clipUrl, sound.clipUrl);
  if ("clipSlug" in patch) sound.clipSlug = sanitizeString(patch.clipSlug, sound.clipSlug);
  sound.updatedAt = nowIso();
  persistSoundAlerts().catch(() => {});
  return deepClone(sound);
}

export async function deleteSound(uid, soundId) {
  const user = ensureUser(uid);
  const sound = user.sounds.get(String(soundId));
  if (!sound) return false;
  user.sounds.delete(String(soundId));
  // Delete audio file from disk
  if (sound.filename) {
    const filePath = getSoundFilePath(uid, sound);
    try {
      await unlink(filePath);
    } catch {}
  }
  // Delete image file from disk
  if (sound.imageFilename) {
    const imgPath = path.resolve(SOUNDS_FILE_DIR, String(uid), sound.imageFilename);
    try {
      await unlink(imgPath);
    } catch {}
  }
  persistSoundAlerts().catch(() => {});
  return true;
}

// ===== Settings =====

export function getSoundSettings(uid) {
  const user = ensureUser(uid);
  return deepClone(user.settings);
}

export function setSoundSettings(uid, patch = {}) {
  const user = ensureUser(uid);
  user.settings = sanitizeSettings({ ...user.settings, ...patch });
  persistSoundAlerts().catch(() => {});
  return deepClone(user.settings);
}

// ===== File Paths =====

export function getSoundFilePath(uid, sound) {
  return path.resolve(SOUNDS_FILE_DIR, String(uid), sound.filename);
}

export function getSoundFileDir(uid) {
  return path.resolve(SOUNDS_FILE_DIR, String(uid));
}

export function generateFilename(uid, soundId, mimeType) {
  const ext = MIME_TO_EXT[mimeType] || VIDEO_MIME_TO_EXT[mimeType] || "mp3";
  return `${soundId}.${ext}`;
}

export function generateImageFilename(soundId, mimeType) {
  const ext = IMAGE_MIME_TO_EXT[mimeType] || "png";
  return `${soundId}_img.${ext}`;
}

export async function ensureSoundDir(uid) {
  const dir = getSoundFileDir(uid);
  await mkdir(dir, { recursive: true });
  return dir;
}

// ===== Default Sound Seeding =====

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOUNDS_DIR = path.resolve(__dirname, "default-sounds");

const DEFAULT_SOUNDS = [
  { file: "applause.mp3", name: "Applause" },
  { file: "booo.mp3", name: "Booo" },
  { file: "monsterRoar.mp3", name: "Monster Roar" },
  { file: "scream.mp3", name: "Scream" },
];

/**
 * Seed default sounds for a new broadcaster.
 * Only runs when the user has zero sounds — idempotent after first call.
 */
export async function seedDefaultSounds(uid) {
  const user = ensureUser(uid);
  if (user.sounds.size > 0) return; // already has sounds, skip

  const dir = await ensureSoundDir(uid);
  for (const def of DEFAULT_SOUNDS) {
    const src = path.join(DEFAULT_SOUNDS_DIR, def.file);
    if (!existsSync(src)) continue;

    const soundId = `snd_${crypto.randomUUID().slice(0, 12)}`;
    const filename = `${soundId}.mp3`;
    const dest = path.join(dir, filename);

    try {
      await copyFile(src, dest);
      const fileStat = await stat(dest);
      createSound(uid, {
        id: soundId,
        name: def.name,
        filename,
        originalFilename: def.file,
        mimeType: "audio/mpeg",
        sizeBytes: fileStat.size,
        tier: "sound_100",
        volume: 80,
        enabled: true,
      });
    } catch {}
  }
}

// ===== Public API (for viewers) =====

export function getPublicSoundList(uid) {
  const user = ensureUser(uid);
  if (!user.settings.enabled) return [];
  return Array.from(user.sounds.values())
    .filter((s) => s.enabled)
    .map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type || "sound",
      tier: s.tier,
      cooldownMs: s.cooldownMs,
      hasImage: Boolean(s.imageFilename),
    }))
    .sort((a, b) => {
      const aIdx = VALID_TIERS.indexOf(a.tier);
      const bIdx = VALID_TIERS.indexOf(b.tier);
      return aIdx - bIdx;
    });
}