import { logger } from "./logger.js";
import jwt from "jsonwebtoken";
import multer from "multer";
import { rename, stat as fsStat, unlink as fsUnlink } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);
import { getBaseUrl } from "./base_url.js";
import { getOrCreateUserKey } from "./keys.js";
import { fetchClipInfo, downloadClipVideo } from "./twitch_api.js";
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
  generateImageFilename,
  ALLOWED_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_FILE_SIZE,
  VALID_TIERS,
  VALID_TYPES,
  SOUNDS_FILE_DIR,
  seedDefaultSounds,
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

const imageUpload = multer({
  dest: path.resolve(SOUNDS_FILE_DIR, "tmp"),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype));
  },
});

const videoUpload = multer({
  dest: path.resolve(SOUNDS_FILE_DIR, "tmp"),
  limits: { fileSize: MAX_VIDEO_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_VIDEO_MIME_TYPES.includes(file.mimetype));
  },
});

// Extract clip slug from Twitch clip URLs
function extractClipSlug(url) {
  if (!url || typeof url !== "string") return null;
  // https://clips.twitch.tv/SlugHere or https://clips.twitch.tv/SlugHere?...
  let m = url.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  // https://www.twitch.tv/channel/clip/SlugHere
  m = url.match(/twitch\.tv\/[^/]+\/clip\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return null;
}

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

  const notify = (channelId, soundId, soundName, tier, txId, viewerUserId, extra = {}) => {
    try {
      if (typeof onSoundAlert === "function") {
        onSoundAlert({ channelId, soundId, soundName, tier, txId, viewerUserId, ...extra });
      }
    } catch {}
  };

  // ===== Admin endpoints =====

  // List all sounds for logged-in broadcaster
  app.get("/api/sounds", async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    await seedDefaultSounds(uid);
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

  // Create a Twitch Clip alert (no file upload needed)
  app.post("/api/sounds/clip", async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;

    const settings = getSoundSettings(uid);
    if (!settings.videoClipsEnabled) {
      return res.status(403).json({ error: "Video & clip alerts require a Pro plan" });
    }

    const { name, clipUrl, tier, volume, cooldownMs } = req.body || {};
    if (!clipUrl) {
      return res.status(400).json({ error: "clipUrl is required" });
    }

    const clipSlug = extractClipSlug(clipUrl);
    if (!clipSlug) {
      return res.status(400).json({
        error: "Invalid Twitch Clip URL. Use a URL like https://clips.twitch.tv/SlugHere or https://twitch.tv/channel/clip/SlugHere",
      });
    }

    try {
      const soundId = `snd_${crypto.randomUUID().slice(0, 12)}`;

      // Fetch clip metadata from Twitch Helix API
      const clipInfo = await fetchClipInfo(clipSlug, { userId: uid });
      if (!clipInfo) {
        return res.status(400).json({
          error: "Could not fetch clip info from Twitch. Check that the clip URL is valid and the clip exists.",
        });
      }
      if (!clipInfo.video_url) {
        return res.status(400).json({
          error: "Could not determine video URL for this clip. The clip may not be available for download.",
        });
      }

      // Download the clip video file
      const filename = `${soundId}.mp4`;
      await ensureSoundDir(uid);
      const destPath = path.resolve(SOUNDS_FILE_DIR, String(uid), filename);
      const downloaded = await downloadClipVideo(clipInfo.video_url, destPath);
      if (!downloaded) {
        return res.status(400).json({
          error: "Failed to download clip video. The clip may be unavailable or region-restricted.",
        });
      }

      let sizeBytes = 0;
      try {
        const fileStat = await fsStat(destPath);
        sizeBytes = fileStat.size;
      } catch {}
      logger.info("clip_video_downloaded", { userId: uid, soundId, clipSlug, sizeBytes });

      const result = createSound(uid, {
        id: soundId,
        type: "clip",
        name: name || clipInfo.title || `Clip ${clipSlug.slice(0, 20)}`,
        filename,
        mimeType: "video/mp4",
        sizeBytes,
        clipUrl: String(clipUrl),
        clipSlug,
        tier: tier || "sound_100",
        volume: volume ? Number(volume) : 80,
        cooldownMs: cooldownMs ? Number(cooldownMs) : 5000,
        enabled: true,
      });

      if (result.error) return res.status(400).json(result);

      logger.info("clip_created", { userId: uid, soundId, clipSlug });
      res.status(201).json({ sound: result });
    } catch (err) {
      logger.error("clip_create_failed", { userId: uid, message: err?.message });
      res.status(500).json({ error: "Failed to create clip alert" });
    }
  });

  // Re-download clip video for an existing clip alert
  app.post("/api/sounds/clip/:soundId/redownload", async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;

    const sound = getSound(uid, req.params.soundId);
    if (!sound) return res.status(404).json({ error: "Sound not found" });
    if (sound.type !== "clip") return res.status(400).json({ error: "Not a clip alert" });
    if (!sound.clipSlug) return res.status(400).json({ error: "No clip slug stored" });

    try {
      const clipInfo = await fetchClipInfo(sound.clipSlug, { userId: uid });
      if (!clipInfo?.video_url) {
        return res.status(400).json({ error: "Could not resolve video URL for this clip" });
      }

      const filename = `${sound.id}.mp4`;
      await ensureSoundDir(uid);
      const destPath = path.resolve(SOUNDS_FILE_DIR, String(uid), filename);
      const downloaded = await downloadClipVideo(clipInfo.video_url, destPath);
      if (!downloaded) {
        return res.status(400).json({ error: "Failed to download clip video" });
      }

      let sizeBytes = 0;
      try {
        const fileStat = await fsStat(destPath);
        sizeBytes = fileStat.size;
      } catch {}

      updateSound(uid, sound.id, {
        filename,
        mimeType: "video/mp4",
        sizeBytes,
      });

      logger.info("clip_redownloaded", { userId: uid, soundId: sound.id, sizeBytes });
      res.json({ ok: true, sound: getSound(uid, sound.id) });
    } catch (err) {
      logger.error("clip_redownload_failed", { userId: uid, soundId: sound.id, message: err?.message });
      res.status(500).json({ error: "Failed to re-download clip" });
    }
  });

  // Upload a video alert
  app.post("/api/sounds/video", videoUpload.single("file"), async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;

    const videoSettings = getSoundSettings(uid);
    if (!videoSettings.videoClipsEnabled) {
      if (req.file) try { await fsUnlink(req.file.path); } catch {}
      return res.status(403).json({ error: "Video & clip alerts require a Pro plan" });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "No video file provided or unsupported format. Accepted: MP4, WebM (max 10 MB)",
      });
    }

    try {
      const soundId = `snd_${crypto.randomUUID().slice(0, 12)}`;
      const filename = generateFilename(uid, soundId, req.file.mimetype);

      await ensureSoundDir(uid);
      const destPath = path.resolve(SOUNDS_FILE_DIR, String(uid), filename);
      await rename(req.file.path, destPath);

      const result = createSound(uid, {
        id: soundId,
        type: "video",
        name: req.body.name || req.file.originalname || "Untitled Video",
        filename,
        originalFilename: req.file.originalname || "",
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        tier: req.body.tier || "sound_100",
        volume: req.body.volume ? Number(req.body.volume) : 80,
        cooldownMs: req.body.cooldownMs ? Number(req.body.cooldownMs) : 5000,
        enabled: true,
      });

      if (result.error) {
        try { await fsUnlink(destPath); } catch {}
        return res.status(400).json(result);
      }

      logger.info("video_uploaded", { userId: uid, soundId, filename, size: req.file.size });
      res.status(201).json({ sound: result });
    } catch (err) {
      logger.error("video_upload_failed", { userId: uid, message: err?.message });
      res.status(500).json({ error: "Failed to upload video" });
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

  // Upload/replace image for a sound
  app.post("/api/sounds/:soundId/image", imageUpload.single("image"), async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;

    const sound = getSound(uid, req.params.soundId);
    if (!sound) return res.status(404).json({ error: "Sound not found" });

    if (!req.file) {
      return res.status(400).json({ error: "No image file provided or unsupported format" });
    }

    try {
      // Delete old image if it exists
      if (sound.imageFilename) {
        const oldPath = path.resolve(SOUNDS_FILE_DIR, String(uid), sound.imageFilename);
        try { await fsUnlink(oldPath); } catch {}
      }

      const imageFilename = generateImageFilename(sound.id, req.file.mimetype);
      await ensureSoundDir(uid);
      const destPath = path.resolve(SOUNDS_FILE_DIR, String(uid), imageFilename);
      await rename(req.file.path, destPath);

      const updated = updateSound(uid, sound.id, { imageFilename });
      logger.info("sound_image_uploaded", { userId: uid, soundId: sound.id, imageFilename });
      res.json({ sound: updated });
    } catch (err) {
      logger.error("sound_image_upload_failed", { userId: uid, soundId: req.params.soundId, message: err?.message });
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Delete image for a sound
  app.delete("/api/sounds/:soundId/image", async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;

    const sound = getSound(uid, req.params.soundId);
    if (!sound) return res.status(404).json({ error: "Sound not found" });

    if (sound.imageFilename) {
      const imgPath = path.resolve(SOUNDS_FILE_DIR, String(uid), sound.imageFilename);
      try { await fsUnlink(imgPath); } catch {}
    }

    const updated = updateSound(uid, sound.id, { imageFilename: "" });
    res.json({ sound: updated });
  });

  // Serve sound image for admin preview (session/JWT auth)
  app.get("/api/sounds/:soundId/image", (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    const sound = getSound(uid, req.params.soundId);
    if (!sound || !sound.imageFilename) {
      return res.status(404).json({ error: "Image not found" });
    }
    const filePath = path.resolve(SOUNDS_FILE_DIR, String(uid), sound.imageFilename);
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: "Image file not found" });
      }
    });
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
    const base = getBaseUrl(req);
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
    notify(String(uid), sound.id, sound.name, sound.tier, null, null, {
      type: sound.type || "sound",
      clipSlug: sound.clipSlug || "",
      volume: sound.volume || 80,
    });
    res.json({ ok: true, sound: { id: sound.id, name: sound.name } });
  });

  // Serve sound file for admin preview/trim (session auth)
  app.get("/api/sounds/:soundId/audio", (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    const sound = getSound(uid, req.params.soundId);
    if (!sound) return res.status(404).json({ error: "Sound not found" });
    const filePath = getSoundFilePath(uid, sound);
    res.setHeader("Content-Type", sound.mimeType);
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: "Sound file not found" });
      }
    });
  });

  // Get audio duration for a sound (for trim UI)
  app.get("/api/sounds/:soundId/duration", async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    const sound = getSound(uid, req.params.soundId);
    if (!sound) return res.status(404).json({ error: "Sound not found" });

    const filePath = getSoundFilePath(uid, sound);
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "json",
        filePath,
      ], { timeout: 5000 });
      const info = JSON.parse(stdout);
      const duration = parseFloat(info.format?.duration || "0");
      res.json({ duration });
    } catch (err) {
      logger.error("sound_duration_failed", { userId: uid, soundId: req.params.soundId, message: err?.message });
      res.status(500).json({ error: "Could not determine audio duration" });
    }
  });

  // Trim a sound (server-side ffmpeg)
  app.post("/api/sounds/:soundId/trim", async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    const sound = getSound(uid, req.params.soundId);
    if (!sound) return res.status(404).json({ error: "Sound not found" });

    const trimStart = parseFloat(req.body.trimStart);
    const trimEnd = parseFloat(req.body.trimEnd);

    if (!Number.isFinite(trimStart) || !Number.isFinite(trimEnd) || trimStart < 0 || trimEnd <= trimStart) {
      return res.status(400).json({ error: "Invalid trim range" });
    }
    if (trimEnd - trimStart < 0.5) {
      return res.status(400).json({ error: "Trimmed clip must be at least 0.5 seconds" });
    }

    const filePath = getSoundFilePath(uid, sound);
    const ext = path.extname(sound.filename) || ".mp3";
    const tmpPath = filePath + ".trim_tmp" + ext;

    try {
      // Try stream copy first (fast, no re-encode)
      let usedCopy = true;
      try {
        await execFileAsync("ffmpeg", [
          "-i", filePath,
          "-ss", String(trimStart),
          "-to", String(trimEnd),
          "-c", "copy",
          "-y", tmpPath,
        ], { timeout: 10000 });
      } catch (copyErr) {
        usedCopy = false;
        logger.info("sound_trim_copy_fallback", { soundId: sound.id, reason: copyErr?.stderr || copyErr?.message });
        // Fall back to re-encode if copy fails
        await execFileAsync("ffmpeg", [
          "-i", filePath,
          "-ss", String(trimStart),
          "-to", String(trimEnd),
          "-y", tmpPath,
        ], { timeout: 10000 });
      }

      // Verify the output file was actually created and has content
      const tmpStat = await fsStat(tmpPath);
      if (tmpStat.size === 0) {
        throw new Error("ffmpeg produced an empty file");
      }

      // Replace original atomically
      await rename(tmpPath, filePath);

      // Update file size in sound record
      const fileStat = await fsStat(filePath);
      const updated = updateSound(uid, sound.id, { sizeBytes: fileStat.size });

      logger.info("sound_trimmed", {
        userId: uid,
        soundId: sound.id,
        trimStart,
        trimEnd,
        newSize: fileStat.size,
        usedCopy,
      });

      res.json({ sound: updated });
    } catch (err) {
      // Clean up temp file if it exists
      try { await fsUnlink(tmpPath); } catch {}
      const detail = err?.stderr || err?.message || "Unknown error";
      logger.error("sound_trim_failed", { userId: uid, soundId: req.params.soundId, detail });
      res.status(500).json({ error: "Trim failed: " + detail });
    }
  });

  // ===== Public endpoints =====

  // Serve sound image (Extension JWT auth — any viewer/broadcaster/mod)
  app.get("/api/sounds/image/:soundId", (req, res) => {
    const claims = requireExtensionAuth(req, res);
    if (!claims) return;
    const channelId = req.query.channelId || claims.channel_id;
    if (!channelId) return res.status(400).json({ error: "channelId required" });

    const sound = getSound(String(channelId), req.params.soundId);
    if (!sound || !sound.imageFilename) {
      return res.status(404).json({ error: "Image not found" });
    }

    const filePath = path.resolve(SOUNDS_FILE_DIR, String(channelId), sound.imageFilename);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: "Image file not found" });
      }
    });
  });

  // Preview a sound/video/clip (Extension JWT auth — any viewer/broadcaster/mod)
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

    // Clips without a downloaded file: no playable content
    if (sound.type === "clip" && !sound.filename) {
      return res.status(404).json({ error: "Clip video not downloaded" });
    }

    // Sound, video, and clip (with file) types: serve the file
    const filePath = getSoundFilePath(String(channelId), sound);
    res.setHeader("Content-Type", sound.mimeType || "video/mp4");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: "File not found" });
      }
    });
  });

  // Get enabled sounds for a channel (viewer panel)
  app.get("/api/sounds/public", async (req, res) => {
    const claims = verifyExtensionJwt(req);
    const channelId = claims?.channel_id || req.query.channelId;
    if (!channelId) {
      return res.status(400).json({ error: "channelId required" });
    }
    await seedDefaultSounds(String(channelId));
    const sounds = getPublicSoundList(String(channelId));
    const settings = getSoundSettings(String(channelId));
    res.setHeader("Cache-Control", "no-store");
    res.json({
      sounds,
      settings: { enabled: settings.enabled },
      tiers: VALID_TIERS,
    });
  });

  // Serve sound/video file (for overlay playback)
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

    // Clips without a downloaded file: no playable content
    if (sound.type === "clip" && !sound.filename) {
      return res.status(404).json({ error: "Clip video not downloaded" });
    }

    // Sound, video, and clip (with downloaded file) types: serve the file
    const filePath = getSoundFilePath(String(uid), sound);
    res.setHeader("Content-Type", sound.mimeType || "video/mp4");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: "File not found" });
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

    notify(String(channelId), sound.id, sound.name, sound.tier, txId, claims.user_id, {
      type: sound.type || "sound",
      clipSlug: sound.clipSlug || "",
      volume: sound.volume || 80,
    });

    res.json({ ok: true, sound: { id: sound.id, name: sound.name } });
  });
}

// Need crypto for UUID generation in upload handler
import crypto from "crypto";