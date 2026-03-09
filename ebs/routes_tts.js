import { logger } from "./logger.js";
import { isPro } from "./subscription_store.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import path from "path";
import { writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { getTtsSettings, setTtsSettings, getPublicTtsSettings, getGlobalTtsConfig } from "./tts_store.js";
import { getVoices, isValidVoice } from "./tts_voices.js";
import { moderateMessage } from "./tts_moderation.js";
import { createApprovalToken, consumeApprovalToken } from "./tts_tokens.js";
import { synthesizeSpeech } from "./tts_provider.js";
import { fetchUserDisplayName } from "./twitch_api.js";
import { isViewerBanned, checkBlockedTerms } from "./twitch_moderation.js";
import { VALID_TIERS } from "./tiers.js";

const EXT_SECRET = process.env.EXTENSION_SECRET
  ? Buffer.from(process.env.EXTENSION_SECRET, "base64")
  : null;

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const TTS_AUDIO_DIR = path.resolve(DATA_DIR, "tts_audio");

// Temporary audio file tracking for cleanup
const audioFiles = new Map(); // fileId -> { path, createdAt }
const AUDIO_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Cleanup expired audio files every 5 minutes
setInterval(async () => {
  const now = Date.now();
  for (const [id, file] of audioFiles.entries()) {
    if (now - file.createdAt > AUDIO_TTL_MS) {
      try { await unlink(file.path); } catch {}
      audioFiles.delete(id);
    }
  }
}, 5 * 60 * 1000);

function verifyExtensionJwt(req) {
  if (!EXT_SECRET) return null;
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  try {
    return jwt.verify(token, EXT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

export function mountTtsRoutes(app, deps = {}) {
  const {
    requireOverlayAuth,
    getSessionUserId,
    getUserIdForKey,
    onTtsAlert,
    onSkipAlert,
    deduplicateTx,
  } = deps;

  function requireBroadcaster(req, res) {
    if (req?.session?.isAdmin) {
      const uid =
        (typeof getSessionUserId === "function" && getSessionUserId(req)) ||
        req.session?.twitchUser?.id;
      if (uid) return String(uid);
    }
    const claims = verifyExtensionJwt(req);
    if (claims && claims.role === "broadcaster") {
      return String(claims.channel_id);
    }
    res.status(401).json({ error: "Broadcaster auth required" });
    return null;
  }

  function requireExtensionAuth(req, res) {
    const claims = verifyExtensionJwt(req);
    if (claims) return claims;
    res.status(401).json({ error: "Extension auth required" });
    return null;
  }

  // Check if TTS is accessible for this broadcaster (Pro or admin-granted)
  function isTtsAccessible(uid) {
    return isPro(uid) || getTtsSettings(uid).granted;
  }

  // ===== Broadcaster endpoints =====

  // Get TTS settings + curated voices + Pro status + global config
  app.get("/api/tts/settings", (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;

    const settings = getTtsSettings(uid);
    const globalConfig = getGlobalTtsConfig();
    // Filter voices to only admin-available ones (empty = all available)
    let voices = getVoices();
    if (globalConfig.availableVoices.length > 0) {
      voices = voices.filter((v) => globalConfig.availableVoices.includes(v.id));
    }
    const proActive = isPro(uid);

    res.json({ settings, voices, proActive, minTier: globalConfig.minTier });
  });

  // Update TTS settings
  app.post("/api/tts/settings", (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;

    if (!isTtsAccessible(uid)) {
      return res.status(403).json({ error: "TTS requires a Pro plan or admin grant" });
    }

    const updated = setTtsSettings(uid, req.body || {});
    logger.info("tts_settings_updated", { userId: uid });
    res.json({ settings: updated });
  });

  // Test TTS — generate audio and send to overlay (no Bits required)
  app.post("/api/tts/test", async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;

    if (!isTtsAccessible(uid)) {
      return res.status(403).json({ error: "TTS requires a Pro plan or admin grant" });
    }

    const { message, voiceId } = req.body || {};
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }
    if (!voiceId || !isValidVoice(voiceId)) {
      return res.status(400).json({ error: "Invalid voice" });
    }

    try {
      const audioBuffer = await synthesizeSpeech(message.trim().slice(0, 300), voiceId);
      const fileId = `tts_${crypto.randomUUID().slice(0, 12)}`;
      await ensureTtsAudioDir();
      const filePath = path.resolve(TTS_AUDIO_DIR, `${fileId}.mp3`);
      await writeFile(filePath, audioBuffer);
      audioFiles.set(fileId, { path: filePath, createdAt: Date.now() });

      const voice = getVoices().find((v) => v.id === voiceId);
      if (typeof onTtsAlert === "function") {
        onTtsAlert({
          channelId: uid,
          message: message.trim().slice(0, 300),
          voiceName: voice?.name || voiceId,
          voiceId,
          fileId,
          volume: getTtsSettings(uid).volume,
          txId: null,
          viewerUserId: null,
        });
      }

      res.json({ ok: true, fileId });
    } catch (err) {
      logger.error("tts_test_failed", { userId: uid, message: err?.message });
      res.status(500).json({ error: "TTS generation failed" });
    }
  });

  // Preview a voice — returns audio directly (no overlay, no Bits)
  // Accepts any auth: session (EBS dashboard / admin), or extension JWT (broadcaster / viewer)
  app.get("/api/tts/preview/:voiceId", async (req, res) => {
    const hasSession = req?.session?.isAdmin || req?.session?.twitchUser?.id;
    const claims = !hasSession ? verifyExtensionJwt(req) : null;
    if (!hasSession && !claims) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { voiceId } = req.params;
    if (!isValidVoice(voiceId)) {
      return res.status(400).json({ error: "Invalid voice" });
    }

    try {
      const audioBuffer = await synthesizeSpeech("Hello! This is a preview of my voice.", voiceId);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(audioBuffer);
    } catch (err) {
      logger.error("tts_preview_failed", { voiceId, message: err?.message });
      res.status(500).json({ error: "Voice preview failed" });
    }
  });

  // ===== Viewer endpoints =====

  // Get public TTS config for a channel
  app.get("/api/tts/public", (req, res) => {
    const claims = requireExtensionAuth(req, res);
    if (!claims) return;

    const channelId = req.query.channelId || claims.channel_id;
    if (!channelId) return res.status(400).json({ error: "channelId required" });

    const settings = getPublicTtsSettings(String(channelId));
    // Only show as enabled if the broadcaster has TTS access
    if (!isTtsAccessible(String(channelId))) {
      settings.enabled = false;
    }

    const globalConfig = getGlobalTtsConfig();
    let allVoices = getVoices();
    if (globalConfig.availableVoices.length > 0) {
      allVoices = allVoices.filter((v) => globalConfig.availableVoices.includes(v.id));
    }
    const voices = allVoices.filter((v) => settings.allowedVoices.includes(v.id));
    res.json({ ...settings, voices });
  });

  // Pre-charge validation
  app.post("/api/tts/validate", async (req, res) => {
    const claims = requireExtensionAuth(req, res);
    if (!claims) return;

    // Twitch policy: user content requires a linked Twitch ID (not opaque)
    if (!claims.user_id) {
      return res.json({ approved: false, reason: "You must share your identity with the extension to use TTS. Click the extension settings gear and grant access." });
    }

    const { message, voiceId, channelId } = req.body || {};
    if (!message || !voiceId || !channelId) {
      return res.status(400).json({ approved: false, reason: "message, voiceId, and channelId are required" });
    }

    const uid = String(channelId);

    // Check TTS accessible
    if (!isTtsAccessible(uid)) {
      return res.json({ approved: false, reason: "TTS is not available on this channel" });
    }

    const settings = getTtsSettings(uid);

    // Check TTS enabled
    if (!settings.enabled) {
      return res.json({ approved: false, reason: "TTS is not enabled on this channel" });
    }

    // Check if viewer is banned/timed-out in this channel (Twitch Moderation API)
    try {
      const viewerBanned = await isViewerBanned(uid, claims.user_id);
      if (viewerBanned) {
        return res.json({ approved: false, reason: "You are currently banned or timed out in this channel" });
      }
    } catch (err) {
      // Non-blocking: if the API call fails, continue with local moderation
      logger.warn("twitch_ban_check_failed", { channelId: uid, viewerUserId: claims.user_id, message: err?.message });
    }

    // Check voice allowed
    if (!settings.allowedVoices.includes(voiceId)) {
      return res.json({ approved: false, reason: "Selected voice is not available" });
    }

    // Check voice valid
    if (!isValidVoice(voiceId)) {
      return res.json({ approved: false, reason: "Invalid voice" });
    }

    // Check message length
    const trimmed = message.trim();
    if (trimmed.length === 0 || trimmed.length > settings.maxMessageLength) {
      return res.json({ approved: false, reason: `Message must be between 1 and ${settings.maxMessageLength} characters` });
    }

    // Run local moderation (per-streamer + global admin config)
    const globalMod = getGlobalTtsConfig().moderation;
    const modResult = moderateMessage(trimmed, settings.bannedWords, settings.moderationEnabled, globalMod);
    if (!modResult.approved) {
      return res.json({ approved: false, reason: modResult.reason });
    }

    // Check against broadcaster's Twitch blocked terms (Moderation API)
    try {
      const blockedResult = await checkBlockedTerms(uid, trimmed);
      if (blockedResult.blocked) {
        return res.json({ approved: false, reason: "Message contains a blocked word" });
      }
    } catch (err) {
      // Non-blocking: if the API call fails, continue (local moderation already ran)
      logger.warn("twitch_blocked_terms_check_failed", { channelId: uid, message: err?.message });
    }

    // Create approval token
    const approvalToken = createApprovalToken(uid, claims.user_id, voiceId, trimmed);
    res.json({ approved: true, approvalToken });
  });

  // Post-charge redemption
  app.post("/api/tts/redeem", async (req, res) => {
    const claims = requireExtensionAuth(req, res);
    if (!claims) return;

    const { receipt, approvalToken, channelId } = req.body || {};
    if (!receipt || !approvalToken || !channelId) {
      return res.status(400).json({ error: "receipt, approvalToken, and channelId are required" });
    }

    // Verify transaction receipt JWT
    let txClaims;
    try {
      txClaims = jwt.verify(receipt, EXT_SECRET, { algorithms: ["HS256"] });
    } catch {
      return res.status(400).json({ error: "Invalid transaction receipt" });
    }

    // Deduplicate by transaction ID
    const receiptData = txClaims.data || txClaims;
    const txId = receiptData.transactionId || receiptData.transactionID || receiptData.id;
    if (txId && typeof deduplicateTx === "function" && deduplicateTx(txId)) {
      return res.json({ ok: true, duplicate: true });
    }

    // Consume approval token (single-use)
    const tokenData = consumeApprovalToken(approvalToken);
    if (!tokenData) {
      return res.status(400).json({ error: "Invalid or expired approval token" });
    }

    // Verify token matches channelId
    if (tokenData.channelId !== String(channelId)) {
      return res.status(400).json({ error: "Channel mismatch" });
    }

    const uid = String(channelId);
    const settings = getTtsSettings(uid);

    // Generate TTS audio
    try {
      const audioBuffer = await synthesizeSpeech(tokenData.message, tokenData.voiceId);
      const fileId = `tts_${crypto.randomUUID().slice(0, 12)}`;
      await ensureTtsAudioDir();
      const filePath = path.resolve(TTS_AUDIO_DIR, `${fileId}.mp3`);
      await writeFile(filePath, audioBuffer);
      audioFiles.set(fileId, { path: filePath, createdAt: Date.now() });

      const voice = getVoices().find((v) => v.id === tokenData.voiceId);

      // Resolve viewer display name for overlay attribution (Twitch policy)
      let viewerDisplayName = null;
      if (claims.user_id) {
        try {
          viewerDisplayName = await fetchUserDisplayName(claims.user_id);
        } catch {}
      }

      logger.info("tts_redeemed", {
        channelId: uid,
        voiceId: tokenData.voiceId,
        messageLength: tokenData.message.length,
        txId,
        viewerUserId: claims.user_id,
        viewerDisplayName,
      });

      // Notify overlay
      if (typeof onTtsAlert === "function") {
        onTtsAlert({
          channelId: uid,
          message: tokenData.message,
          voiceName: voice?.name || tokenData.voiceId,
          voiceId: tokenData.voiceId,
          fileId,
          volume: settings.volume,
          txId,
          viewerUserId: claims.user_id,
          viewerDisplayName,
          tier: settings.tier,
        });
      }

      res.json({ ok: true, fileId });
    } catch (err) {
      logger.error("tts_redeem_failed", { channelId: uid, message: err?.message });
      res.status(500).json({ error: "TTS generation failed" });
    }
  });

  // Skip/stop current alert (broadcaster only)
  app.post("/api/tts/skip", (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;

    logger.info("tts_skip", { userId: uid });
    if (typeof onSkipAlert === "function") {
      onSkipAlert({ channelId: uid });
    }
    res.json({ ok: true });
  });

  // ===== Overlay endpoints =====

  // Serve generated TTS audio file
  app.get("/api/tts/audio/:fileId", (req, res) => {
    if (!requireOverlayAuth(req, res)) return;

    const { fileId } = req.params;
    const file = audioFiles.get(fileId);
    if (!file) {
      return res.status(404).json({ error: "Audio file not found or expired" });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(file.path, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: "File not found" });
      }
    });
  });
}

async function ensureTtsAudioDir() {
  if (!existsSync(TTS_AUDIO_DIR)) {
    await mkdir(TTS_AUDIO_DIR, { recursive: true });
  }
}

/**
 * Register an externally-created audio file so it can be served via /api/tts/audio/:fileId.
 * Used by the alert replay system.
 */
export function registerAudioFile(fileId, filePath) {
  audioFiles.set(fileId, { path: filePath, createdAt: Date.now() });
}
