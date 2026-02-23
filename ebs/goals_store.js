import { readFile, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

const DATA_DIR = process.env.DATA_DIR || process.cwd();
export const GOALS_PATH = path.resolve(DATA_DIR, "overlay-goals.json");

const goalsByUser = new Map(); // userId -> Map<goalId, Goal>

export const SEGMENT_KEYS = [
  "tier1000",
  "tier2000",
  "tier3000",
  "resub",
  "gift",
  "bits",
  "tips",
  "charity",
  "follows",
  "manual",
  "other",
];

const DEFAULT_SEGMENT_COLORS = {
  tier1000: "#9146FF",
  tier2000: "#C08CFF",
  tier3000: "#FFB347",
  resub: "#FF6BD6",
  gift: "#F97316",
  bits: "#10B981",
  tips: "#FACC15",
  charity: "#22D3EE",
  follows: "#3B82F6",
  manual: "#38BDF8",
  other: "#94A3B8",
};

export const DEFAULT_GOAL_STYLE = {
  orientation: "horizontal",
  width: 800,
  height: 240,
  trackThickness: 38,
  borderRadius: 20,
  fillColor: "#9146FF",
  fillSecondaryColor: "#772CE8",
  emptyColor: "rgba(255,255,255,0.12)",
  backgroundColor: "rgba(0,0,0,0)",
  labelColor: "#FFFFFF",
  valueColor: "#FFFFFF",
  percentColor: "#FFFFFFCC",
  textShadow: "0 2px 8px rgba(0,0,0,0.65)",
  fontFamily: "Inter,system-ui,Arial,sans-serif",
  fontWeight: 700,
  fontSize: 20,
  showLabel: true,
  showValue: true,
  showPercent: true,
  showRemaining: true,
  showTimeframe: false,
  showSegmentLegend: true,
  showSegmentsOnBar: true,
  showGoalLine: false,
  align: "center",
  animateFill: true,
  overlayPadding: 16,
  labelPosition: "top",
  customCss: "",
  segmentColors: { ...DEFAULT_SEGMENT_COLORS },
};

export const DEFAULT_GOAL_RULES = {
  autoTrackSubs: true,
  autoTrackResubs: true,
  autoTrackGifts: true,
  autoTrackBits: false,
  autoTrackTips: false,
  autoTrackCharity: false,
  autoTrackFollows: false,
  followMode: "new", // "new" | "all"
  followWeight: 1,
  preferSubPoints: true,
  tierWeights: { "1000": 1, "2000": 2, "3000": 6 },
  resubWeight: 1,
  giftWeightPerSub: 0,
  bitsPerUnit: 100,
  bitsUnitValue: 1,
  tipsPerUsd: 1,
  charityPerUsd: 1,
  manualUnitValue: 1,
  breakdownEnabled: true,
  allowOverflow: true,
  showOnOverlay: true,
  subGoalMode: "points", // points | subs
};

function nowIso() {
  return new Date().toISOString();
}

function ensureUserMap(uid) {
  const id = uid ? String(uid) : "default";
  if (!goalsByUser.has(id)) goalsByUser.set(id, new Map());
  return goalsByUser.get(id);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export async function loadGoals() {
  try {
    const raw = await readFile(GOALS_PATH, "utf-8");
    const obj = JSON.parse(raw);
    goalsByUser.clear();
    if (obj && typeof obj === "object") {
      for (const [uid, value] of Object.entries(obj)) {
        const map = new Map();
        if (Array.isArray(value)) {
          for (const entry of value) {
            const normalized = normalizeGoal(entry);
            map.set(normalized.id, normalized);
          }
        } else if (value && typeof value === "object") {
          for (const [gid, entry] of Object.entries(value)) {
            const normalized = normalizeGoal({ id: gid, ...(entry || {}) });
            map.set(normalized.id, normalized);
          }
        }
        goalsByUser.set(String(uid), map);
      }
    }
  } catch {}
}

async function persistGoals() {
  try {
    const obj = {};
    for (const [uid, map] of goalsByUser.entries()) {
      obj[uid] = {};
      for (const [gid, goal] of map.entries()) {
        obj[uid][gid] = goal;
      }
    }
    await writeFile(GOALS_PATH, JSON.stringify(obj, null, 2), "utf-8");
  } catch {}
}

function sanitizeNumber(val, fallback = 0, min, max) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  if (typeof min === "number" && num < min) return min;
  if (typeof max === "number" && num > max) return max;
  return num;
}

function sanitizeString(val, fallback = "") {
  if (typeof val === "string") return val.slice(0, 512);
  if (typeof val === "number") return String(val);
  return fallback;
}

function sanitizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function sanitizeStyle(style = {}) {
  const next = { ...DEFAULT_GOAL_STYLE };
  if (style && typeof style === "object") {
    if (typeof style.orientation === "string") {
      const orient = style.orientation.toLowerCase();
      if (orient === "horizontal" || orient === "vertical")
        next.orientation = orient;
    }
    if (typeof style.align === "string") {
      const align = style.align.toLowerCase();
      if (["left", "center", "right"].includes(align)) next.align = align;
    }
    if (typeof style.labelPosition === "string") {
      const pos = style.labelPosition.toLowerCase();
      if (["top", "bottom"].includes(pos)) next.labelPosition = pos;
    }
    if (typeof style.customCss === "string") next.customCss = style.customCss;
    next.width = sanitizeNumber(style.width, next.width, 120);
    next.height = sanitizeNumber(style.height, next.height, 120);
    next.trackThickness = sanitizeNumber(
      style.trackThickness,
      next.trackThickness,
      12
    );
    next.borderRadius = sanitizeNumber(style.borderRadius, next.borderRadius, 0);
    next.fillColor = sanitizeString(style.fillColor, next.fillColor);
    next.fillSecondaryColor = sanitizeString(
      style.fillSecondaryColor,
      next.fillSecondaryColor
    );
    next.emptyColor = sanitizeString(style.emptyColor, next.emptyColor);
    next.backgroundColor = sanitizeString(
      style.backgroundColor,
      next.backgroundColor
    );
    next.labelColor = sanitizeString(style.labelColor, next.labelColor);
    next.valueColor = sanitizeString(style.valueColor, next.valueColor);
    next.percentColor = sanitizeString(style.percentColor, next.percentColor);
    next.textShadow = sanitizeString(style.textShadow, next.textShadow);
    next.fontFamily = sanitizeString(style.fontFamily, next.fontFamily);
    next.fontWeight = sanitizeNumber(style.fontWeight, next.fontWeight);
    next.fontSize = sanitizeNumber(style.fontSize, next.fontSize, 10);
    next.overlayPadding = sanitizeNumber(
      style.overlayPadding,
      next.overlayPadding,
      0
    );
    next.showLabel =
      typeof style.showLabel === "boolean" ? style.showLabel : next.showLabel;
    next.showValue =
      typeof style.showValue === "boolean" ? style.showValue : next.showValue;
    next.showPercent =
      typeof style.showPercent === "boolean"
        ? style.showPercent
        : next.showPercent;
    next.showRemaining =
      typeof style.showRemaining === "boolean"
        ? style.showRemaining
        : next.showRemaining;
    next.showTimeframe =
      typeof style.showTimeframe === "boolean"
        ? style.showTimeframe
        : next.showTimeframe;
    next.showSegmentLegend =
      typeof style.showSegmentLegend === "boolean"
        ? style.showSegmentLegend
        : next.showSegmentLegend;
    next.showSegmentsOnBar =
      typeof style.showSegmentsOnBar === "boolean"
        ? style.showSegmentsOnBar
        : next.showSegmentsOnBar;
    next.showGoalLine =
      typeof style.showGoalLine === "boolean"
        ? style.showGoalLine
        : next.showGoalLine;
    next.animateFill =
      typeof style.animateFill === "boolean"
        ? style.animateFill
        : next.animateFill;
    if (style.segmentColors && typeof style.segmentColors === "object") {
      const colors = {};
      for (const key of SEGMENT_KEYS) {
        colors[key] = sanitizeString(
          style.segmentColors[key],
          DEFAULT_SEGMENT_COLORS[key]
        );
      }
      next.segmentColors = colors;
    } else {
      next.segmentColors = { ...DEFAULT_SEGMENT_COLORS };
    }
  }
  return next;
}

function sanitizeRules(rules = {}) {
  const next = {
    ...DEFAULT_GOAL_RULES,
    tierWeights: { ...DEFAULT_GOAL_RULES.tierWeights },
  };
  if (!rules || typeof rules !== "object") return next;
  for (const key of [
    "autoTrackSubs",
    "autoTrackResubs",
    "autoTrackGifts",
    "autoTrackBits",
    "autoTrackTips",
    "autoTrackCharity",
    "autoTrackFollows",
    "preferSubPoints",
    "breakdownEnabled",
    "allowOverflow",
    "showOnOverlay",
  ]) {
    if (typeof rules[key] === "boolean") next[key] = rules[key];
  }
  if (rules.tierWeights && typeof rules.tierWeights === "object") {
    next.tierWeights["1000"] = sanitizeNumber(
      rules.tierWeights["1000"],
      next.tierWeights["1000"],
      0
    );
    next.tierWeights["2000"] = sanitizeNumber(
      rules.tierWeights["2000"],
      next.tierWeights["2000"],
      0
    );
    next.tierWeights["3000"] = sanitizeNumber(
      rules.tierWeights["3000"],
      next.tierWeights["3000"],
      0
    );
  }
  next.resubWeight = sanitizeNumber(
    rules.resubWeight,
    next.resubWeight,
    0
  );
  next.giftWeightPerSub = sanitizeNumber(
    rules.giftWeightPerSub,
    next.giftWeightPerSub,
    0
  );
  next.bitsPerUnit = Math.max(1, sanitizeNumber(rules.bitsPerUnit, 100, 1));
  next.bitsUnitValue = sanitizeNumber(
    rules.bitsUnitValue,
    next.bitsUnitValue,
    0
  );
  next.tipsPerUsd = sanitizeNumber(rules.tipsPerUsd, next.tipsPerUsd, 0);
  next.charityPerUsd = sanitizeNumber(
    rules.charityPerUsd,
    next.charityPerUsd,
    0
  );
  next.manualUnitValue = sanitizeNumber(
    rules.manualUnitValue,
    next.manualUnitValue,
    0
  );
  if (typeof rules.followMode === "string") {
    next.followMode = ["new", "all"].includes(rules.followMode)
      ? rules.followMode
      : "new";
  }
  next.followWeight = sanitizeNumber(rules.followWeight, next.followWeight, 0);
  return next;
}

function blankSegments() {
  const obj = {};
  for (const key of SEGMENT_KEYS) obj[key] = 0;
  return obj;
}

function normalizeGoal(raw = {}) {
  const goal = { ...raw };
  const now = nowIso();
  const type =
    goal.goalType && String(goal.goalType).toLowerCase() === "sub_goal"
      ? "sub_goal"
      : goal.type && String(goal.type).toLowerCase() === "sub_goal"
      ? "sub_goal"
      : "custom";
  const normalized = {
    id: goal.id ? String(goal.id) : crypto.randomUUID(),
    type,
    title: sanitizeString(goal.title, type === "sub_goal" ? "Sub Goal" : "New Goal"),
    description: sanitizeString(goal.description, ""),
    unitLabel:
      type === "sub_goal"
        ? "subs"
        : sanitizeString(goal.unitLabel, "points"),
    targetValue: Math.max(1, sanitizeNumber(goal.targetValue, 100, 1)),
    currentValue: Math.max(0, sanitizeNumber(goal.currentValue, 0)),
    createdAt: goal.createdAt || now,
    updatedAt: goal.updatedAt || now,
    startAt: sanitizeDate(goal.startAt),
    endAt: sanitizeDate(goal.endAt),
    archived: Boolean(goal.archived),
    style: sanitizeStyle(goal.style || {}),
    rules: sanitizeRules(goal.rules || {}),
    segments: { ...blankSegments(), ...(goal.segments || {}) },
    manualHistory: Array.isArray(goal.manualHistory)
      ? goal.manualHistory.slice(-50)
      : [],
    overlaySlug: sanitizeString(goal.overlaySlug, "").replace(/\s+/g, "") || "",
    tags: Array.isArray(goal.tags) ? goal.tags.map((t) => sanitizeString(t)) : [],
    followBaseline: sanitizeNumber(goal.followBaseline, null),
    subBaseline:
      type === "sub_goal"
        ? Math.max(0, sanitizeNumber(goal.subBaseline, goal.currentValue || 0))
        : null,
    lastSubCount:
      type === "sub_goal"
        ? Math.max(0, sanitizeNumber(goal.lastSubCount, 0))
        : null,
  };
  if (type === "sub_goal") {
    normalized.rules.autoTrackSubs = false;
    normalized.rules.autoTrackResubs = false;
    normalized.rules.autoTrackGifts = false;
    normalized.rules.autoTrackBits = false;
    normalized.rules.autoTrackTips = false;
    normalized.rules.autoTrackCharity = false;
    normalized.segments = blankSegments();
    normalized.manualHistory = [];
    normalized.currentValue = Math.max(
      0,
      Number(normalized.lastSubCount || 0) - Number(normalized.subBaseline || 0)
    );
  }
  if (!normalized.overlaySlug) {
    normalized.overlaySlug = normalized.id.slice(0, 8);
  }
  for (const key of SEGMENT_KEYS) {
    normalized.segments[key] = Math.max(
      0,
      sanitizeNumber(normalized.segments[key], 0)
    );
  }
  return normalized;
}

export function listGoals(uid) {
  const map = ensureUserMap(uid);
  const arr = Array.from(map.values()).map((g) => deepClone(g));
  return arr.sort((a, b) => {
    const aDate = Date.parse(a.createdAt || "") || 0;
    const bDate = Date.parse(b.createdAt || "") || 0;
    return aDate - bDate;
  });
}

export function getGoal(uid, goalId) {
  const map = ensureUserMap(uid);
  const goal = map.get(String(goalId));
  return goal ? deepClone(goal) : null;
}

export function createGoal(uid, patch = {}) {
  const map = ensureUserMap(uid);
  const goal = normalizeGoal(patch);
  map.set(goal.id, goal);
  persistGoals().catch(() => {});
  return deepClone(goal);
}

export function updateGoal(uid, goalId, patch = {}) {
  const map = ensureUserMap(uid);
  const goal = map.get(String(goalId));
  if (!goal) return null;
  if (patch.title) goal.title = sanitizeString(patch.title, goal.title);
  if ("description" in patch)
    goal.description = sanitizeString(patch.description, goal.description);
  if ("unitLabel" in patch)
    goal.unitLabel = sanitizeString(patch.unitLabel, goal.unitLabel);
  if ("targetValue" in patch) {
    goal.targetValue = Math.max(1, sanitizeNumber(patch.targetValue, goal.targetValue, 1));
  }
  if ("startAt" in patch) goal.startAt = sanitizeDate(patch.startAt);
  if ("endAt" in patch) goal.endAt = sanitizeDate(patch.endAt);
  if ("archived" in patch) goal.archived = Boolean(patch.archived);
  if ("currentValue" in patch)
    goal.currentValue = Math.max(0, sanitizeNumber(patch.currentValue, goal.currentValue));
  if (patch.style) goal.style = sanitizeStyle({ ...goal.style, ...patch.style });
  if (patch.rules) goal.rules = sanitizeRules({ ...goal.rules, ...patch.rules });
  if (patch.overlaySlug)
    goal.overlaySlug =
      sanitizeString(patch.overlaySlug, goal.overlaySlug).replace(/\s+/g, "") ||
      goal.overlaySlug;
  if (Array.isArray(patch.tags)) goal.tags = patch.tags.map((t) => sanitizeString(t));
  if ("followBaseline" in patch)
    goal.followBaseline = sanitizeNumber(patch.followBaseline, goal.followBaseline);
  if (patch.resetSegments) goal.segments = blankSegments();
  goal.updatedAt = nowIso();
  persistGoals().catch(() => {});
  return deepClone(goal);
}

export function deleteGoal(uid, goalId) {
  const map = ensureUserMap(uid);
  const removed = map.delete(String(goalId));
  if (removed) persistGoals().catch(() => {});
  return removed;
}

export function resetGoal(uid, goalId, options = {}) {
  const map = ensureUserMap(uid);
  const goal = map.get(String(goalId));
  if (!goal) return null;
  if (goal.type === "sub_goal") {
    const baseline = Number(goal.lastSubCount || goal.subBaseline || 0);
    goal.subBaseline = Math.max(0, baseline);
    goal.currentValue = 0;
  } else {
    goal.currentValue = 0;
    goal.segments = blankSegments();
    goal.followBaseline = null;
  }
  if (options.startAt !== undefined) goal.startAt = sanitizeDate(options.startAt);
  if (options.endAt !== undefined) goal.endAt = sanitizeDate(options.endAt);
  goal.manualHistory = [];
  goal.updatedAt = nowIso();
  persistGoals().catch(() => {});
  return deepClone(goal);
}

function applyGoalDelta(goal, delta = 0, meta = {}) {
  if (goal.type === "sub_goal") return false;
  let add = Number(delta) || 0;
  if (!Number.isFinite(add) || add === 0) return false;
  if (goal.rules && goal.rules.allowOverflow === false) {
    const target = Math.max(0, Number(goal.targetValue || 0));
    if (target > 0) {
      const remaining = Math.max(0, target - Number(goal.currentValue || 0));
      if (remaining <= 0) add = 0;
      else if (add > remaining) add = remaining;
    }
  }
  if (!add) return false;
  goal.currentValue = Math.max(
    0,
    Number(goal.currentValue || 0) + add
  );
  const seg = meta.segmentKey;
  if (seg && SEGMENT_KEYS.includes(seg)) {
    goal.segments[seg] = Math.max(
      0,
      Number(goal.segments[seg] || 0) + add
    );
  }
  if (meta.historyEntry) {
    goal.manualHistory.push({
      id: crypto.randomUUID(),
      ...meta.historyEntry,
      value: add,
      ts: Date.now(),
    });
    if (goal.manualHistory.length > 100) {
      goal.manualHistory.splice(0, goal.manualHistory.length - 100);
    }
  }
  goal.updatedAt = nowIso();
  return true;
}

export function applyGoalValue(uid, goalId, value, meta = {}) {
  const map = ensureUserMap(uid);
  const goal = map.get(String(goalId));
  if (!goal) return null;
  const changed = applyGoalDelta(goal, value, meta);
  if (changed) persistGoals().catch(() => {});
  return deepClone(goal);
}

function tierWeight(goal, tier) {
  const rules = goal.rules || DEFAULT_GOAL_RULES;
  const key = ["1000", "2000", "3000"].includes(String(tier))
    ? String(tier)
    : "1000";
  const weights = rules.tierWeights || DEFAULT_GOAL_RULES.tierWeights;
  const raw = Number(weights[key]);
  if (Number.isFinite(raw)) return Math.max(0, raw);
  return 1;
}

function eventWindowAllows(goal, timestamp) {
  if (!goal) return false;
  if (goal.archived) return false;
  const start = goal.startAt ? Date.parse(goal.startAt) : null;
  const end = goal.endAt ? Date.parse(goal.endAt) : null;
  if (start && timestamp < start) return false;
  if (end && timestamp > end) return false;
  return true;
}

export function applyAutoContribution({
  uid,
  type,
  event,
  timestamp = Date.now(),
}) {
  const map = ensureUserMap(uid);
  const results = [];
  for (const goal of map.values()) {
    if (!eventWindowAllows(goal, timestamp)) continue;
    const delta = mapEventToDelta(goal, type, event);
    if (!delta || !delta.value) continue;
    const changed = applyGoalDelta(goal, delta.value, {
      segmentKey: delta.segmentKey,
      historyEntry: delta.historyEntry,
    });
    if (changed) {
      results.push({ goalId: goal.id, value: delta.value });
    }
  }
  if (results.length) persistGoals().catch(() => {});
  return results;
}

function mapEventToDelta(goal, type, event = {}) {
  const rules = goal.rules || DEFAULT_GOAL_RULES;
  const e = event || {};
  switch (type) {
    case "channel.subscribe": {
      if (!rules.autoTrackSubs) return null;
      const tier = String(e.tier || "1000");
      const units = 1;
      const value = tierWeight(goal, tier) * Math.max(1, units);
      return {
        value,
        segmentKey: tierKeyToSegment(tier),
      };
    }
    case "channel.subscription.message": {
      if (!rules.autoTrackResubs) return null;
      const value = Math.max(0, Number(rules.resubWeight || 0));
      if (!value) return null;
      return {
        value,
        segmentKey: "resub",
      };
    }
    case "channel.subscription.gift": {
      if (!rules.autoTrackGifts) return null;
      const countRaw =
        e.total ?? e.cumulative_total ?? e.total_count ?? e.count ?? 1;
      const count = Math.max(1, Number(countRaw) || 1);
      const tier = String(e.tier || "1000");
      const override = Number(rules.giftWeightPerSub);
      const per =
        Number.isFinite(override) && override > 0
          ? override
          : tierWeight(goal, tier);
      const value = per * count;
      return {
        value,
        segmentKey: "gift",
      };
    }
    case "channel.bits.use":
    case "channel.cheer": {
      if (!rules.autoTrackBits) return null;
      const bits =
        Number(e.bits ?? e.total_bits_used ?? e.total_bits ?? 0) || 0;
      if (bits <= 0) return null;
      const value =
        (bits / Math.max(1, rules.bitsPerUnit || 1)) *
        Math.max(0, rules.bitsUnitValue || 0);
      if (!value) return null;
      return {
        value,
        segmentKey: "bits",
      };
    }
    case "channel.charity_campaign.donate": {
      if (!rules.autoTrackCharity && !rules.autoTrackTips) return null;
      const amount = e.amount?.value ?? 0;
      const decimals = e.amount?.decimal_places ?? 2;
      const usd = amount / Math.pow(10, decimals);
      const per = rules.autoTrackCharity
        ? Math.max(0, rules.charityPerUsd || 0)
        : Math.max(0, rules.tipsPerUsd || 0);
      if (!per || !usd) return null;
      return {
        value: usd * per,
        segmentKey: rules.autoTrackCharity ? "charity" : "tips",
      };
    }
    case "channel.follow": {
      if (!rules.autoTrackFollows) return null;
      const value = Math.max(0, Number(rules.followWeight || 1));
      if (!value) return null;
      return { value, segmentKey: "follows" };
    }
    default:
      return null;
  }
}

function tierKeyToSegment(tier) {
  const t = String(tier || "1000");
  if (t === "2000") return "tier2000";
  if (t === "3000") return "tier3000";
  return "tier1000";
}

function manualPayloadToDelta(goal, payload = {}) {
  if (goal.type === "sub_goal") return null;
  const type = typeof payload.type === "string" ? payload.type : "manual";
  const normalizedType = SEGMENT_KEYS.includes(type) ? type : "manual";
  const rules = goal.rules || DEFAULT_GOAL_RULES;
  let value = Number(payload.value);
  let units = Number(payload.units ?? payload.count ?? payload.amount ?? 0);
  if (!Number.isFinite(units)) units = 0;
  if (!Number.isFinite(value)) value = 0;

  if (!value) {
    switch (normalizedType) {
      case "tier1000":
      case "tier2000":
      case "tier3000": {
        const tier = normalizedType.replace("tier", "");
        if (units <= 0) units = Math.max(1, Number(payload.subs) || 0);
        if (units <= 0) units = 1;
        value = tierWeight(goal, tier) * Math.max(1, units);
        break;
      }
      case "resub": {
        if (units <= 0) units = 1;
        value = Math.max(0, rules.resubWeight || 0) * units;
        break;
      }
      case "gift": {
        if (units <= 0) units = Math.max(1, Number(payload.subs) || 0);
        if (units <= 0) units = 1;
        const manualTier = String(payload.tier || "1000");
        const override = Number(rules.giftWeightPerSub);
        const per =
          Number.isFinite(override) && override > 0
            ? override
            : tierWeight(goal, manualTier);
        value = per * Math.max(1, units);
        break;
      }
      case "bits": {
        const bits = units > 0 ? units : Number(payload.bits) || 0;
        if (bits > 0) {
          value =
            (bits / Math.max(1, rules.bitsPerUnit || 1)) *
            Math.max(0, rules.bitsUnitValue || 0);
          units = bits;
        }
        break;
      }
      case "tips": {
        const usd = units > 0 ? units : Number(payload.usd) || 0;
        if (usd > 0) {
          value = usd * Math.max(0, rules.tipsPerUsd || 0);
          units = usd;
        }
        break;
      }
      case "charity": {
        const usd = units > 0 ? units : Number(payload.usd) || 0;
        if (usd > 0) {
          value = usd * Math.max(0, rules.charityPerUsd || 0);
          units = usd;
        }
        break;
      }
      case "manual":
      default: {
        const manualUnits =
          units > 0 ? units : Number(payload.units ?? payload.amount ?? 0) || 0;
        if (manualUnits > 0) {
          value = manualUnits * Math.max(0, rules.manualUnitValue || 1);
          units = manualUnits;
        }
        break;
      }
    }
  }

  value = Number(value) || 0;
  if (!value) return null;
  return {
    value,
    segmentKey: normalizedType,
    historyEntry: {
      source: payload.source || "manual",
      note: sanitizeString(payload.note || payload.label || "", ""),
      type: normalizedType,
    },
  };
}

export function applyManualContribution(uid, goalId, payload = {}) {
  const map = ensureUserMap(uid);
  const goal = map.get(String(goalId));
  if (!goal) return null;
  if (goal.type === "sub_goal") return deepClone(goal);
  const delta = manualPayloadToDelta(goal, payload);
  if (!delta || !delta.value) return deepClone(goal);
  const changed = applyGoalDelta(goal, delta.value, delta);
  if (changed) persistGoals().catch(() => {});
  return deepClone(goal);
}

export function isGoalActive(goal, timestamp = Date.now()) {
  return eventWindowAllows(goal, timestamp);
}

export function getPublicGoals(uid, options = {}) {
  const now = Date.now();
  const map = ensureUserMap(uid);
  const includeInactive = Boolean(options.includeInactive);
  const selected = [];
  for (const goal of map.values()) {
    if (!goal.rules?.showOnOverlay) continue;
    if (!includeInactive && !eventWindowAllows(goal, now)) continue;
    selected.push(sanitizeGoalPublic(goal, now));
  }
  return selected;
}

export function getPublicGoal(uid, goalId) {
  const map = ensureUserMap(uid);
  const goal = map.get(String(goalId));
  if (!goal || !goal.rules?.showOnOverlay) return null;
  return sanitizeGoalPublic(goal, Date.now());
}

function sanitizeGoalPublic(goal, nowTs) {
  const start = goal.startAt ? Date.parse(goal.startAt) : null;
  const end = goal.endAt ? Date.parse(goal.endAt) : null;
  return {
    id: goal.id,
    type: goal.type || "custom",
    overlaySlug: goal.overlaySlug,
    title: goal.title,
    description: goal.description,
    unitLabel: goal.unitLabel,
    targetValue: goal.targetValue,
    currentValue: goal.currentValue,
    startAt: goal.startAt,
    endAt: goal.endAt,
    style: deepClone(goal.style || DEFAULT_GOAL_STYLE),
    segments: deepClone(goal.segments || blankSegments()),
    breakdownEnabled: goal.rules?.breakdownEnabled !== false,
    meta: {
      isActive: eventWindowAllows(goal, nowTs),
      isFuture: Boolean(start && nowTs < start),
      isExpired: Boolean(end && nowTs > end),
      updatedAt: goal.updatedAt,
      subBaseline: goal.type === "sub_goal" ? goal.subBaseline : null,
      lastSubCount: goal.type === "sub_goal" ? goal.lastSubCount : null,
    },
  };
}

export function syncSubGoals(uid, totalSubs) {
  const id = String(uid || "default");
  const map = ensureUserMap(id);
  let changed = false;
  const total = Math.max(0, Number(totalSubs || 0));
  for (const goal of map.values()) {
    if (goal.type !== "sub_goal") continue;
    if (typeof goal.subBaseline !== "number") {
      goal.subBaseline = total;
    }
    goal.lastSubCount = total;
    const value = Math.max(0, total - Number(goal.subBaseline || 0));
    if (goal.currentValue !== value) {
      goal.currentValue = value;
      goal.updatedAt = nowIso();
      changed = true;
    }
  }
  if (changed) persistGoals().catch(() => {});
  return changed;
}
