import { logger } from "./logger.js";
import jwt from "jsonwebtoken";
import multer from "multer";
import { rename } from "fs/promises";
import path from "path";
import { getOrCreateUserKey } from "./keys.js";
import {
  listSounds,
  getSound,
  createSound,
  updateSound,
  deleteSound,
  getSoundSettings,
  setSoundSettings,
  getPublicSoundList,
  getSoundFilePath,
  ensureSoundDir,
  generateFilename,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  VALID_TIERS,
  SOUNDS_FILE_DIR,
} from "./sounds_store.js";

const EXT_SECRET = process.env.EXTENSION_SECRET
  ? Buffer.from(process.env.EXTENSION_SECRET, "base64")
  : null;

// Multer setup for sound uploads
const upload = multer({
  dest: path.resolve(SOUNDS_FILE_DIR, "tmp"),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIME_TYPES.includes(file.mimetype));
  },
});

// ===== Extension JWT helpers =====

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

export function mountSoundRoutes(app, deps = {}) {
  const {
    requireOverlayAuth,
    getSessionUserId,
    onSoundAlert,
    deduplicateTx,
  } = deps;

  // Resolve broadcaster from session OR extension JWT
  function requireBroadcaster(req, res) {
    // Try session auth first (web configurator)
    if (req?.session?.isAdmin) {
      const uid =
        (typeof getSessionUserId === "function" && getSessionUserId(req)) ||
        req.session?.twitchUser?.id;
      if (uid) return String(uid);
    }
    // Try Extension JWT (config view in Twitch iframe)
    const claims = verifyExtensionJwt(req);
    if (claims && claims.role === "broadcaster") {
      return String(claims.channel_id);
    }
    res.status(401).json({ error: "Broadcaster auth required" });
    return null;
  }

  // Require any valid extension JWT (viewer, broadcaster, moderator)
  function requireExtensionAuth(req, res) {
    const claims = verifyExtensionJwt(req);
    if (claims) return claims;
    res.status(401).json({ error: "Extension auth required" });
    return null;
  }

  const notify = (channelId, soundId, soundName, tier, txId, viewerUserId) => {
    try {
      if (typeof onSoundAlert === "function") {
        onSoundAlert({ channelId, soundId, soundName, tier, txId, viewerUserId });
      }
    } catch {}
  };

  // ===== Admin endpoints =====

  // List all sounds for logged-in broadcaster
  app.get("/api/sounds", (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    const sounds = listSounds(uid);
    const settings = getSoundSettings(uid);
    res.json({ sounds, settings, tiers: VALID_TIERS });
  });

  // Upload a new sound
  app.post("/api/sounds", upload.single("file"), async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;

    if (!req.file) {
      return res.status(400).json({
        error: "No audio file provided or unsupported format",
      });
    }

    try {
      const soundId = `snd_${crypto.randomUUID().slice(0, 12)}`;
      const filename = generateFilename(uid, soundId, req.file.mimetype);

      // Ensure user sound directory exists
      await ensureSoundDir(uid);

      // Move file from tmp to final location
      const destPath = path.resolve(SOUNDS_FILE_DIR, String(uid), filename);
      await rename(req.file.path, destPath);

      const result = createSound(uid, {
        id: soundId,
        name: req.body.name || req.file.originalname || "Untitled Sound",
        filename,
        originalFilename: req.file.originalname || "",
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        tier: req.body.tier || VALID_TIERS[0],
        volume: req.body.volume ? Number(req.body.volume) : 80,
        cooldownMs: req.body.cooldownMs ? Number(req.body.cooldownMs) : 5000,
        enabled: req.body.enabled !== "false",
      });

      if (result.error) {
        // Clean up uploaded file
        try {
          const { unlink: unlinkFile } = await import("fs/promises");
          await unlinkFile(destPath);
        } catch {}
        return res.status(400).json(result);
      }

      logger.info("sound_uploaded", {
        userId: uid,
        soundId,
        filename,
        size: req.file.size,
      });
      res.status(201).json({ sound: result });
    } catch (err) {
      logger.error("sound_upload_failed", {
        userId: uid,
        message: err?.message,
      });
      res.status(500).json({ error: "Failed to upload sound" });
    }
  });

  // Update sound metadata
  app.put("/api/sounds/:soundId", (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    const sound = updateSound(uid, req.params.soundId, req.body || {});
    if (!sound) return res.status(404).json({ error: "Sound not found" });
    logger.info("sound_updated", {
      userId: uid,
      soundId: req.params.soundId,
    });
    res.json({ sound });
  });

  // Delete a sound
  app.delete("/api/sounds/:soundId", async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    const ok = await deleteSound(uid, req.params.soundId);
    if (!ok) return res.status(404).json({ error: "Sound not found" });
    logger.info("sound_deleted", {
      userId: uid,
      soundId: req.params.soundId,
    });
    res.json({ ok: true });
  });

  // Get sound alert settings
  app.get("/api/sounds/settings", (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    res.json({ settings: getSoundSettings(uid) });
  });

  // Update sound alert settings
  app.post("/api/sounds/settings", (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    const settings = setSoundSettings(uid, req.body || {});
    logger.info("sound_settings_updated", { userId: uid });
    res.json({ settings });
  });

  // Get the OBS overlay URL for the broadcaster
  app.get("/api/sounds/overlay-url", (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    const key = getOrCreateUserKey(uid);
    const base =
      process.env.SERVER_BASE_URL || `${req.protocol}://${req.get("host")}`;
    res.json({
      url: `${base}/overlay/sounds?key=${encodeURIComponent(key)}`,
    });
  });

  // Test a sound alert (admin only, no Bits required)
  app.post("/api/sounds/test/:soundId", (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    const sound = getSound(uid, req.params.soundId);
    if (!sound) return res.status(404).json({ error: "Sound not found" });
    notify(String(uid), sound.id, sound.name, sound.tier, null, null);
    res.json({ ok: true, sound: { id: sound.id, name: sound.name } });
  });

  // ===== Public endpoints =====

  // Preview a sound (Extension JWT auth — any viewer/broadcaster/mod)
  app.get("/api/sounds/preview/:soundId", (req, res) => {
    const claims = requireExtensionAuth(req, res);
    if (!claims) return;
    const channelId = req.query.channelId || claims.channel_id;
    if (!channelId) {
      return res.status(400).json({ error: "channelId required" });
    }
    const sound = getSound(String(channelId), req.params.soundId);
    if (!sound || !sound.enabled) {
      return res.status(404).json({ error: "Sound not found or disabled" });
    }
    const filePath = getSoundFilePath(String(channelId), sound);
    res.setHeader("Content-Type", sound.mimeType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: "Sound file not found" });
      }
    });
  });

  // Get enabled sounds for a channel (viewer panel)
  app.get("/api/sounds/public", (req, res) => {
    const claims = verifyExtensionJwt(req);
    const channelId = claims?.channel_id || req.query.channelId;
    if (!channelId) {
      return res.status(400).json({ error: "channelId required" });
    }
    const sounds = getPublicSoundList(String(channelId));
    const settings = getSoundSettings(String(channelId));
    res.setHeader("Cache-Control", "no-store");
    res.json({
      sounds,
      settings: { enabled: settings.enabled },
      tiers: VALID_TIERS,
    });
  });

  // Serve sound file (for overlay playback)
  app.get("/api/sounds/file/:soundId", (req, res) => {
    if (!requireOverlayAuth(req, res)) return;

    // Find the sound across all users (keyed by overlay key → userId)
    const { getUserIdForKey } = deps;
    const key = req.query.key;
    let uid = null;
    if (typeof getUserIdForKey === "function" && key) {
      uid = getUserIdForKey(key);
    }
    if (!uid && req?.session?.twitchUser?.id) {
      uid = req.session.twitchUser.id;
    }
    if (!uid) {
      return res.status(400).json({ error: "Cannot resolve channel" });
    }

    const sound = getSound(String(uid), req.params.soundId);
    if (!sound) return res.status(404).json({ error: "Sound not found" });

    const filePath = getSoundFilePath(String(uid), sound);
    res.setHeader("Content-Type", sound.mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: "Sound file not found" });
      }
    });
  });

  // Redeem a Bits transaction for a sound alert
  app.post("/api/sounds/redeem", async (req, res) => {
    // 1. Verify extension JWT from Authorization header
    const claims = requireExtensionAuth(req, res);
    if (!claims) return;

    const { receipt, soundId, channelId } = req.body || {};
    if (!receipt || !soundId || !channelId) {
      return res
        .status(400)
        .json({ error: "receipt, soundId, and channelId are required" });
    }

    // 2. Verify transaction receipt JWT
    let txClaims;
    try {
      txClaims = jwt.verify(receipt, EXT_SECRET, { algorithms: ["HS256"] });
    } catch {
      return res.status(400).json({ error: "Invalid transaction receipt" });
    }

    // 3. Validate sound exists and is enabled
    const sound = getSound(String(channelId), soundId);
    if (!sound || !sound.enabled) {
      return res.status(404).json({ error: "Sound not found or disabled" });
    }

    const settings = getSoundSettings(String(channelId));
    if (!settings.enabled) {
      return res.status(400).json({ error: "Sound alerts are disabled" });
    }

    // 4. Verify SKU matches sound tier
    const receiptData = txClaims.data || txClaims;
    const receiptSku =
      receiptData.product?.sku || receiptData.product?.domainID;
    if (receiptSku && receiptSku !== sound.tier) {
      return res.status(400).json({ error: "Product SKU mismatch" });
    }

    // 5. Deduplicate by transactionId
    const txId =
      receiptData.transactionId ||
      receiptData.transactionID ||
      receiptData.id;
    if (txId && typeof deduplicateTx === "function" && deduplicateTx(txId)) {
      return res.json({ ok: true, sound: { id: sound.id, name: sound.name }, duplicate: true });
    }

    // 6. Trigger sound alert
    logger.info("sound_redeemed", {
      channelId,
      soundId,
      soundName: sound.name,
      tier: sound.tier,
      txId,
      viewerUserId: claims.user_id,
    });

    notify(String(channelId), sound.id, sound.name, sound.tier, txId, claims.user_id);

    res.json({ ok: true, sound: { id: sound.id, name: sound.name } });
  });
}

// Need crypto for UUID generation in upload handler
import crypto from "crypto";