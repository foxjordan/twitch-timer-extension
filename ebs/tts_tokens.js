import crypto from "crypto";

// In-memory Map: tokenId -> { channelId, userId, voiceId, message, createdAt }
const approvalTokens = new Map();
const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Cleanup expired tokens every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [id, token] of approvalTokens.entries()) {
    if (now - token.createdAt > TOKEN_TTL_MS) approvalTokens.delete(id);
  }
}, 60 * 1000);

/**
 * Create a short-lived, single-use approval token.
 * Stores the exact message and voice to prevent client-side tampering.
 */
export function createApprovalToken(channelId, userId, voiceId, message) {
  const tokenId = crypto.randomUUID();
  approvalTokens.set(tokenId, {
    channelId: String(channelId),
    userId: String(userId),
    voiceId,
    message,
    createdAt: Date.now(),
  });
  return tokenId;
}

/**
 * Consume an approval token (single-use).
 * Returns the stored token data or null if expired/invalid/already used.
 */
export function consumeApprovalToken(tokenId) {
  const token = approvalTokens.get(tokenId);
  if (!token) return null;
  if (Date.now() - token.createdAt > TOKEN_TTL_MS) {
    approvalTokens.delete(tokenId);
    return null;
  }
  approvalTokens.delete(tokenId); // single-use
  return token;
}
