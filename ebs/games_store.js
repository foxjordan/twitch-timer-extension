import { readFile, writeFile } from "fs/promises";
import path from "path";
import { VALID_TIERS } from "./tiers.js";

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const GAMES_PATH = path.resolve(DATA_DIR, "overlay-games-settings.json");
const GAMES_GLOBAL_PATH = path.resolve(DATA_DIR, "games-global-config.json");

// userId -> GamesSettings
const gamesSettingsByUser = new Map();

const DEFAULT_GAMES_SETTINGS = {
  granted: false,
  visibility: {
    enabled: true,
    plinko: true,
    slots: true,
  },
  pricing: {
    plinkoMinTier: "sound_100",
    slotsMinTier: "sound_100",
  },
};

// Site-wide, admin-only — independent of any one broadcaster's settings.
// `launched` is per-game so the site can go live with e.g. Plinko while
// keeping Slots off, rather than one switch gating both together.
let globalGamesConfig = {
  launched: {
    plinko: false,
    slots: false,
  },
  minTier: "sound_100",
};

function cloneSettings(s) {
  return JSON.parse(JSON.stringify(s));
}

function ensureUser(uid) {
  const id = uid ? String(uid) : "default";
  if (!gamesSettingsByUser.has(id)) {
    gamesSettingsByUser.set(id, cloneSettings(DEFAULT_GAMES_SETTINGS));
  }
  return id;
}

export async function loadGamesSettings() {
  try {
    const raw = await readFile(GAMES_GLOBAL_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.launched?.plinko === "boolean") globalGamesConfig.launched.plinko = parsed.launched.plinko;
    if (typeof parsed.launched?.slots === "boolean") globalGamesConfig.launched.slots = parsed.launched.slots;
    if (typeof parsed.minTier === "string" && VALID_TIERS.includes(parsed.minTier)) {
      globalGamesConfig.minTier = parsed.minTier;
    }
  } catch {}

  try {
    const raw = await readFile(GAMES_PATH, "utf-8");
    const obj = JSON.parse(raw);
    for (const [uid, val] of Object.entries(obj)) {
      gamesSettingsByUser.set(String(uid), { ...cloneSettings(DEFAULT_GAMES_SETTINGS), ...val });
    }
  } catch {}
}

export async function persistGamesSettings() {
  try {
    const obj = {};
    for (const [uid, val] of gamesSettingsByUser.entries()) obj[uid] = val;
    await writeFile(GAMES_PATH, JSON.stringify(obj, null, 2), "utf-8");
  } catch {}
}

export async function persistGlobalGamesConfig() {
  try {
    await writeFile(GAMES_GLOBAL_PATH, JSON.stringify(globalGamesConfig, null, 2), "utf-8");
  } catch {}
}

export function deleteGamesSettings(uid) {
  const id = uid ? String(uid) : "default";
  const existed = gamesSettingsByUser.has(id);
  gamesSettingsByUser.delete(id);
  if (existed) persistGamesSettings().catch(() => {});
  return existed;
}

export function getGamesSettings(uid) {
  const id = ensureUser(uid);
  return cloneSettings(gamesSettingsByUser.get(id));
}

export function setGamesSettings(uid, patch = {}) {
  const id = ensureUser(uid);
  const curr = gamesSettingsByUser.get(id);

  if (typeof patch.granted === "boolean") {
    curr.granted = patch.granted;
  }

  if (patch.visibility && typeof patch.visibility === "object") {
    if (typeof patch.visibility.enabled === "boolean") curr.visibility.enabled = patch.visibility.enabled;
    if (typeof patch.visibility.plinko === "boolean") curr.visibility.plinko = patch.visibility.plinko;
    if (typeof patch.visibility.slots === "boolean") curr.visibility.slots = patch.visibility.slots;
  }

  if (patch.pricing && typeof patch.pricing === "object") {
    const floorIdx = VALID_TIERS.indexOf(globalGamesConfig.minTier);
    if (typeof patch.pricing.plinkoMinTier === "string" && VALID_TIERS.includes(patch.pricing.plinkoMinTier)) {
      if (VALID_TIERS.indexOf(patch.pricing.plinkoMinTier) >= floorIdx) {
        curr.pricing.plinkoMinTier = patch.pricing.plinkoMinTier;
      }
    }
    if (typeof patch.pricing.slotsMinTier === "string" && VALID_TIERS.includes(patch.pricing.slotsMinTier)) {
      if (VALID_TIERS.indexOf(patch.pricing.slotsMinTier) >= floorIdx) {
        curr.pricing.slotsMinTier = patch.pricing.slotsMinTier;
      }
    }
  }

  gamesSettingsByUser.set(id, curr);
  persistGamesSettings().catch(() => {});
  return cloneSettings(curr);
}

export function getGlobalGamesConfig() {
  // Deep clone, not a shallow spread — `launched` is nested now, and a
  // shallow copy would hand callers a live reference to it, letting a
  // careless mutation elsewhere corrupt the real config.
  return cloneSettings(globalGamesConfig);
}

export function setGlobalGamesConfig(patch = {}) {
  if (patch.launched && typeof patch.launched === "object") {
    if (typeof patch.launched.plinko === "boolean") globalGamesConfig.launched.plinko = patch.launched.plinko;
    if (typeof patch.launched.slots === "boolean") globalGamesConfig.launched.slots = patch.launched.slots;
  }
  if (typeof patch.minTier === "string" && VALID_TIERS.includes(patch.minTier)) {
    globalGamesConfig.minTier = patch.minTier;
  }
  persistGlobalGamesConfig().catch(() => {});
  return getGlobalGamesConfig();
}
