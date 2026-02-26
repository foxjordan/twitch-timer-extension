// Single source of truth for sound tier SKUs on the extension (frontend) side.
// Mirrors ebs/tiers.js — kept separate because the extension can't import from ebs/.

const VALID_TIERS = [
  "sound_10",
  "sound_25",
  "sound_50",
  "sound_75",
  "sound_100",
  "sound_150",
  "sound_200",
  "sound_250",
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

export const DEFAULT_TIER = "sound_100";

export const TIER_LABELS = Object.fromEntries(
  VALID_TIERS.map((sku) => [sku, sku.replace("sound_", "") + " Bits"])
);

export const TIER_COSTS = Object.fromEntries(
  VALID_TIERS.map((sku) => [sku, sku.replace("sound_", "")])
);
