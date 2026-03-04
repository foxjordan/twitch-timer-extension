// Built-in offensive content patterns (word-boundary-aware where possible)
const BUILTIN_BLOCKED_PATTERNS = [
  // Racial slurs
  /\bn[i1]gg[ae3]r?s?\b/i,
  /\bk[i1]ke[s]?\b/i,
  /\bch[i1]nk[s]?\b/i,
  /\bsp[i1]c[sk]?\b/i,
  /\bw[e3]tb[a4]ck[s]?\b/i,
  /\bg[o0]{2}k[s]?\b/i,
  /\bcoon[s]?\b/i,
  /\bdarki[e3][s]?\b/i,
  /\btowel\s*head[s]?\b/i,
  /\bsand\s*n[i1]gg[ae3]r?s?\b/i,

  // Homophobic/transphobic slurs
  /\bf[a4]gg?[o0]t[s]?\b/i,
  /\btr[a4]nn[yi1e][e3]?[s]?\b/i,
  /\bdyke[s]?\b/i,

  // Sexist slurs
  /\bcunt[s]?\b/i,

  // Hate speech phrases
  /\bheil\s+h[i1]tl[e3]r\b/i,
  /\bwhite\s+(?:power|supremac)/i,
  /\bgas\s+the\s+jews?\b/i,
  /\bkill\s+(?:all\s+)?(?:blacks?|jews?|muslims?|gays?|trans)\b/i,

  // Explicit threats
  /\bi(?:'ll|.?will)\s+(?:kill|murder|rape|shoot)\s+(?:you|them|her|him|everyone)\b/i,
];

/**
 * Moderate a TTS message before charging Bits.
 * @param {string} message - The viewer's message
 * @param {string[]} bannedWords - Streamer-defined banned words
 * @param {boolean} moderationEnabled - Whether built-in moderation is active
 * @returns {{ approved: boolean, reason?: string }}
 */
export function moderateMessage(message, bannedWords = [], moderationEnabled = true) {
  if (!message || typeof message !== "string") {
    return { approved: false, reason: "Message is empty" };
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return { approved: false, reason: "Message is empty" };
  }

  // Layer 1: Streamer-defined banned words (always runs)
  const lower = trimmed.toLowerCase();
  for (const word of bannedWords) {
    if (word && lower.includes(word.toLowerCase())) {
      return { approved: false, reason: "Message contains a banned word" };
    }
  }

  // Layers 2-3 only run if moderation is enabled
  if (!moderationEnabled) {
    return { approved: true };
  }

  // Layer 2: Built-in offensive content filter
  for (const pattern of BUILTIN_BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { approved: false, reason: "Message contains prohibited content" };
    }
  }

  // Layer 3: Heuristics
  // Excessive capitalization (>80% caps for messages > 20 chars)
  if (trimmed.length > 20) {
    const letters = trimmed.replace(/[^a-zA-Z]/g, "");
    if (letters.length > 0) {
      const capsRatio = (letters.match(/[A-Z]/g) || []).length / letters.length;
      if (capsRatio > 0.8) {
        return { approved: false, reason: "Excessive capitalization" };
      }
    }
  }

  // Excessive repeated characters (e.g., "aaaaaaaaaa")
  if (/(.)\1{9,}/i.test(trimmed)) {
    return { approved: false, reason: "Excessive repeated characters" };
  }

  return { approved: true };
}
