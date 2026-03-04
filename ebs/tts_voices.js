import fetch from "node-fetch";
import { logger } from "./logger.js";

// Hardcoded fallback voices (English, Inworld.ai)
const FALLBACK_VOICES = [
  { id: "Alex", name: "Alex", gender: "male" },
  { id: "Ashley", name: "Ashley", gender: "female" },
  { id: "Craig", name: "Craig", gender: "male" },
  { id: "Deborah", name: "Deborah", gender: "female" },
  { id: "Dennis", name: "Dennis", gender: "male" },
  { id: "Edward", name: "Edward", gender: "male" },
  { id: "Elizabeth", name: "Elizabeth", gender: "female" },
  { id: "Julia", name: "Julia", gender: "female" },
  { id: "Mark", name: "Mark", gender: "male" },
  { id: "Olivia", name: "Olivia", gender: "female" },
  { id: "Pixie", name: "Pixie", gender: "female" },
  { id: "Priya", name: "Priya", gender: "female" },
  { id: "Ronald", name: "Ronald", gender: "male" },
  { id: "Sarah", name: "Sarah", gender: "female" },
  { id: "Shaun", name: "Shaun", gender: "male" },
  { id: "Theodore", name: "Theodore", gender: "male" },
  { id: "Timothy", name: "Timothy", gender: "male" },
  { id: "Wendy", name: "Wendy", gender: "female" },
];

export const DEFAULT_ALLOWED_VOICES = ["Ashley", "Alex", "Julia", "Mark", "Sarah"];

let cachedVoices = null;

/**
 * Fetch available voices from Inworld.ai API and cache them.
 * Falls back to hardcoded list on failure.
 */
export async function loadVoices() {
  const apiKey = process.env.INWORLD_API_KEY;
  if (!apiKey) {
    logger.warn("tts_voices_no_api_key", { message: "INWORLD_API_KEY not set, using fallback voices" });
    cachedVoices = FALLBACK_VOICES;
    return;
  }

  try {
    const res = await fetch("https://api.inworld.ai/tts/v1/voices?filter=language=en", {
      headers: { Authorization: `Basic ${apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`Inworld voices API returned ${res.status}`);
    }
    const data = await res.json();
    if (data.voices && Array.isArray(data.voices) && data.voices.length > 0) {
      cachedVoices = data.voices.map((v) => ({
        id: v.voiceId || v.id || v.name,
        name: v.displayName || v.name || v.voiceId,
        gender: (v.gender || "unknown").toLowerCase(),
        description: v.description || "",
      }));
      logger.info("tts_voices_loaded", { count: cachedVoices.length });
    } else {
      throw new Error("Empty voices list from API");
    }
  } catch (err) {
    logger.warn("tts_voices_fetch_failed", { message: err?.message });
    cachedVoices = FALLBACK_VOICES;
  }
}

export function getVoices() {
  return cachedVoices || FALLBACK_VOICES;
}

export function isValidVoice(voiceId) {
  return getVoices().some((v) => v.id === voiceId);
}
