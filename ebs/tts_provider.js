import fetch from "node-fetch";
import { logger } from "./logger.js";

// Provider registry: name -> async (text, voiceId) => Buffer
const providers = {};

// ---- Inworld.ai TTS (default) ----
providers.inworld = async (text, voiceId) => {
  const apiKey = process.env.INWORLD_API_KEY;
  if (!apiKey) throw new Error("INWORLD_API_KEY is not set");

  const response = await fetch("https://api.inworld.ai/tts/v1/voice", {
    method: "POST",
    headers: {
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voiceId,
      modelId: "inworld-tts-1.5-max",
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Inworld TTS failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  if (!data.audioContent) {
    throw new Error("Inworld TTS response missing audioContent");
  }

  return Buffer.from(data.audioContent, "base64");
};

// ---- OpenAI TTS (stub for future) ----
providers.openai = async (_text, _voiceId) => {
  throw new Error("OpenAI TTS provider not yet implemented");
};

// ---- Google Cloud TTS (stub for future) ----
providers.google = async (_text, _voiceId) => {
  throw new Error("Google Cloud TTS provider not yet implemented");
};

// ---- Amazon Polly (stub for future) ----
providers.polly = async (_text, _voiceId) => {
  throw new Error("Amazon Polly TTS provider not yet implemented");
};

const ACTIVE_PROVIDER = process.env.TTS_PROVIDER || "inworld";

/**
 * Synthesize speech from text using the active TTS provider.
 * @param {string} text - The text to synthesize
 * @param {string} voiceId - The voice identifier
 * @returns {Promise<Buffer>} Audio data buffer
 */
export async function synthesizeSpeech(text, voiceId) {
  const provider = providers[ACTIVE_PROVIDER];
  if (!provider) throw new Error(`Unknown TTS provider: ${ACTIVE_PROVIDER}`);

  logger.info("tts_synthesize", { provider: ACTIVE_PROVIDER, voiceId, textLength: text.length });
  return provider(text, voiceId);
}
