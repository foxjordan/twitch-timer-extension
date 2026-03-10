import { logger } from "./logger.js";
import { isSuperAdmin } from "./routes_admin.js";
import { isPro } from "./subscription_store.js";
import multer from "multer";
import { rename, stat as fsStat, unlink as fsUnlink } from "fs/promises";
import { createWriteStream } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { pipeline } from "stream/promises";
import path from "path";
import crypto from "crypto";
import fetch from "node-fetch";
import { fetchClipInfo, downloadClipVideo } from "./twitch_api.js";
import { DEFAULT_TIER } from "./tiers.js";
import {
  listSounds,
  getSound,
  createSound,
  updateSound,
  deleteSound,
  getSoundSettings,
  setSoundSettings,
  getSoundFilePath,
  ensureSoundDir,
  generateFilename,
  generateImageFilename,
  seedDefaultSounds,
  ALLOWED_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_FILE_SIZE,
  VALID_TIERS,
  SOUNDS_FILE_DIR,
} from "./sounds_store.js";

const execFileAsync = promisify(execFile);

// Multer setup for admin sound uploads
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

function requireSuperAdmin(req, res) {
  if (!req.session?.isAdmin || !isSuperAdmin(req)) {
    res.status(403).json({ error: "Access denied" });
    return false;
  }
  return true;
}

/**
 * Compress a video file in-place with H.264 CRF 28.
 * Skips replacement if the compressed file is larger than the original.
 */
async function compressVideo(filePath) {
  const tmpPath = filePath + ".compress_tmp.mp4";
  try {
    await execFileAsync("ffmpeg", [
      "-i", filePath,
      "-c:v", "libx264", "-crf", "28", "-preset", "fast",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      "-y", tmpPath,
    ], { timeout: 120000 });
    const tmpStat = await fsStat(tmpPath);
    if (tmpStat.size === 0) throw new Error("ffmpeg produced empty file");
    const origStat = await fsStat(filePath);
    if (tmpStat.size < origStat.size) {
      await rename(tmpPath, filePath);
      return tmpStat.size;
    }
    await fsUnlink(tmpPath);
    return origStat.size;
  } catch (err) {
    try { await fsUnlink(tmpPath); } catch {}
    throw err;
  }
}

/**
 * Extract audio from a video file using ffmpeg.
 */
async function extractAudio(videoPath, audioPath) {
  try {
    await execFileAsync("ffmpeg", [
      "-i", videoPath, "-vn",
      "-c:a", "aac", "-b:a", "128k",
      "-y", audioPath,
    ], { timeout: 120000 });
    const audioStat = await fsStat(audioPath);
    if (audioStat.size === 0) throw new Error("ffmpeg produced empty audio file");
    try { await fsUnlink(videoPath); } catch {}
    return audioStat.size;
  } catch (err) {
    try { await fsUnlink(audioPath); } catch {}
    throw err;
  }
}

function extractClipSlug(url) {
  if (!url || typeof url !== "string") return null;
  let m = url.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/twitch\.tv\/[^/]+\/clip\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return null;
}

export function mountAdminSoundRoutes(app, ctx = {}) {
  const { onSoundAlert } = ctx;

  // List all sounds for a user
  app.get("/api/admin/sounds/:userId", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const uid = String(req.params.userId);
    await seedDefaultSounds(uid);
    const sounds = listSounds(uid);
    const settings = getSoundSettings(uid);
    if (isPro(uid)) settings.videoClipsEnabled = true;
    res.json({ sounds, settings, tiers: VALID_TIERS });
  });

  // Upload a new sound for a user
  app.post("/api/admin/sounds/:userId", upload.single("file"), async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const uid = String(req.params.userId);

    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided or unsupported format" });
    }

    try {
      const soundId = `snd_${crypto.randomUUID().slice(0, 12)}`;
      const filename = generateFilename(uid, soundId, req.file.mimetype);
      await ensureSoundDir(uid);
      const destPath = path.resolve(SOUNDS_FILE_DIR, String(uid), filename);
      await rename(req.file.path, destPath);

      const result = createSound(uid, {
        id: soundId,
        name: req.body.name || req.file.originalname || "Untitled Sound",
        filename,
        originalFilename: req.file.originalname || "",
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        tier: req.body.tier || undefined,
        volume: req.body.volume ? Number(req.body.volume) : 80,
        cooldownMs: req.body.cooldownMs ? Number(req.body.cooldownMs) : 5000,
        enabled: req.body.enabled !== "false",
      });

      if (result.error) {
        try { await fsUnlink(destPath); } catch {}
        return res.status(400).json(result);
      }

      logger.info("admin_sound_uploaded", { admin: req.session.twitchUser.id, userId: uid, soundId, filename });
      res.status(201).json({ sound: result });
    } catch (err) {
      logger.error("admin_sound_upload_failed", { userId: uid, message: err?.message });
      res.status(500).json({ error: "Failed to upload sound" });
    }
  });

  // Upload a video alert for a user
  app.post("/api/admin/sounds/:userId/video", videoUpload.single("file"), async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const uid = String(req.params.userId);

    if (!req.file) {
      return res.status(400).json({ error: "No video file provided or unsupported format. Accepted: MP4, WebM (max 10 MB)" });
    }

    try {
      const soundId = `snd_${crypto.randomUUID().slice(0, 12)}`;
      const filename = generateFilename(uid, soundId, req.file.mimetype);
      await ensureSoundDir(uid);
      const destPath = path.resolve(SOUNDS_FILE_DIR, String(uid), filename);
      await rename(req.file.path, destPath);

      let sizeBytes = req.file.size;
      try {
        sizeBytes = await compressVideo(destPath);
      } catch (err) {
        logger.warn("admin_video_compress_failed", { userId: uid, soundId, message: err?.message });
      }

      const result = createSound(uid, {
        id: soundId,
        type: "video",
        name: req.body.name || req.file.originalname || "Untitled Video",
        filename,
        originalFilename: req.file.originalname || "",
        mimeType: req.file.mimetype,
        sizeBytes,
        tier: req.body.tier || undefined,
        volume: req.body.volume ? Number(req.body.volume) : 80,
        cooldownMs: req.body.cooldownMs ? Number(req.body.cooldownMs) : 5000,
        enabled: true,
      });

      if (result.error) {
        try { await fsUnlink(destPath); } catch {}
        return res.status(400).json(result);
      }

      logger.info("admin_video_uploaded", { admin: req.session.twitchUser.id, userId: uid, soundId });
      res.status(201).json({ sound: result });
    } catch (err) {
      logger.error("admin_video_upload_failed", { userId: uid, message: err?.message });
      res.status(500).json({ error: "Failed to upload video" });
    }
  });

  // Create a Twitch Clip alert for a user
  app.post("/api/admin/sounds/:userId/clip", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const uid = String(req.params.userId);
    const { name, clipUrl, tier, volume, cooldownMs, audioOnly } = req.body || {};
    if (!clipUrl) return res.status(400).json({ error: "clipUrl is required" });

    const clipSlug = extractClipSlug(clipUrl);
    if (!clipSlug) return res.status(400).json({ error: "Invalid Twitch Clip URL" });

    try {
      const soundId = `snd_${crypto.randomUUID().slice(0, 12)}`;
      const clipInfo = await fetchClipInfo(clipSlug, { userId: uid });
      if (!clipInfo) return res.status(400).json({ error: "Could not fetch clip info from Twitch" });
      if (!clipInfo.video_url) return res.status(400).json({ error: "Could not determine video URL for this clip" });

      const videoFilename = `${soundId}.mp4`;
      await ensureSoundDir(uid);
      const videoDestPath = path.resolve(SOUNDS_FILE_DIR, String(uid), videoFilename);
      const dlResult = await downloadClipVideo(clipInfo.video_url, videoDestPath);
      if (!dlResult.ok) return res.status(400).json({ error: "Failed to download clip video" });

      let sizeBytes = 0;
      try { sizeBytes = (await fsStat(videoDestPath)).size; } catch {}

      let finalFilename, finalMimeType, finalType;
      if (audioOnly) {
        finalFilename = `${soundId}.m4a`;
        finalMimeType = "audio/mp4";
        finalType = "sound";
        const audioDestPath = path.resolve(SOUNDS_FILE_DIR, String(uid), finalFilename);
        try {
          sizeBytes = await extractAudio(videoDestPath, audioDestPath);
        } catch (err) {
          try { await fsUnlink(videoDestPath); } catch {}
          try { await fsUnlink(audioDestPath); } catch {}
          return res.status(500).json({ error: "Failed to extract audio from clip" });
        }
      } else {
        finalFilename = videoFilename;
        finalMimeType = "video/mp4";
        finalType = "clip";
        try { sizeBytes = await compressVideo(videoDestPath); } catch {}
      }

      const finalPath = path.resolve(SOUNDS_FILE_DIR, String(uid), finalFilename);
      if (sizeBytes < 1024) {
        try { await fsUnlink(finalPath); } catch {}
        return res.status(400).json({ error: "Downloaded file is too small to be valid" });
      }

      // Download clip thumbnail
      let imageFilename = "";
      if (clipInfo.thumbnail_url) {
        try {
          imageFilename = generateImageFilename(soundId, "image/jpeg");
          const imgPath = path.resolve(SOUNDS_FILE_DIR, String(uid), imageFilename);
          const imgRes = await fetch(clipInfo.thumbnail_url);
          if (imgRes.ok) await pipeline(imgRes.body, createWriteStream(imgPath));
          else imageFilename = "";
        } catch { imageFilename = ""; }
      }

      const result = createSound(uid, {
        id: soundId,
        type: finalType,
        name: name || clipInfo.title || `Clip ${clipSlug.slice(0, 20)}`,
        filename: finalFilename,
        mimeType: finalMimeType,
        sizeBytes,
        imageFilename,
        clipUrl: String(clipUrl),
        clipSlug,
        tier: tier || DEFAULT_TIER,
        volume: volume ? Number(volume) : 80,
        cooldownMs: cooldownMs ? Number(cooldownMs) : 5000,
        enabled: true,
      });
      if (result.error) return res.status(400).json(result);

      logger.info("admin_clip_created", { admin: req.session.twitchUser.id, userId: uid, soundId, clipSlug });
      res.status(201).json({ sound: result });
    } catch (err) {
      logger.error("admin_clip_create_failed", { userId: uid, message: err?.message });
      res.status(500).json({ error: "Failed to create clip alert" });
    }
  });

  // Update sound metadata for a user
  app.put("/api/admin/sounds/:userId/:soundId", (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const uid = String(req.params.userId);
    const sound = updateSound(uid, req.params.soundId, req.body || {});
    if (!sound) return res.status(404).json({ error: "Sound not found" });
    logger.info("admin_sound_updated", { admin: req.session.twitchUser.id, userId: uid, soundId: req.params.soundId });
    res.json({ sound });
  });

  // Delete a sound for a user
  app.delete("/api/admin/sounds/:userId/:soundId", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const uid = String(req.params.userId);
    const ok = await deleteSound(uid, req.params.soundId);
    if (!ok) return res.status(404).json({ error: "Sound not found" });
    logger.info("admin_sound_deleted", { admin: req.session.twitchUser.id, userId: uid, soundId: req.params.soundId });
    res.json({ ok: true });
  });

  // Get sound settings for a user
  app.get("/api/admin/sounds/:userId/settings", (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const uid = String(req.params.userId);
    const settings = getSoundSettings(uid);
    if (isPro(uid)) settings.videoClipsEnabled = true;
    res.json({ settings });
  });

  // Update sound settings for a user
  app.post("/api/admin/sounds/:userId/settings", (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const uid = String(req.params.userId);
    const settings = setSoundSettings(uid, req.body || {});
    logger.info("admin_sound_settings_updated", { admin: req.session.twitchUser.id, userId: uid });
    res.json({ settings });
  });

  // Serve sound/video file for admin preview
  app.get("/api/admin/sounds/:userId/:soundId/audio", (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const uid = String(req.params.userId);
    const sound = getSound(uid, req.params.soundId);
    if (!sound) return res.status(404).json({ error: "Sound not found" });
    const filePath = getSoundFilePath(uid, sound);
    res.setHeader("Content-Type", sound.mimeType);
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: "Sound file not found" });
    });
  });

  // Upload/replace image for a user's sound
  app.post("/api/admin/sounds/:userId/:soundId/image", imageUpload.single("image"), async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const uid = String(req.params.userId);
    const sound = getSound(uid, req.params.soundId);
    if (!sound) return res.status(404).json({ error: "Sound not found" });
    if (!req.file) return res.status(400).json({ error: "No image file provided or unsupported format" });

    try {
      if (sound.imageFilename) {
        const oldPath = path.resolve(SOUNDS_FILE_DIR, String(uid), sound.imageFilename);
        try { await fsUnlink(oldPath); } catch {}
      }
      const imageFilename = generateImageFilename(sound.id, req.file.mimetype);
      await ensureSoundDir(uid);
      const destPath = path.resolve(SOUNDS_FILE_DIR, String(uid), imageFilename);
      await rename(req.file.path, destPath);
      const updated = updateSound(uid, sound.id, { imageFilename });
      logger.info("admin_sound_image_uploaded", { admin: req.session.twitchUser.id, userId: uid, soundId: sound.id });
      res.json({ sound: updated });
    } catch (err) {
      logger.error("admin_sound_image_upload_failed", { userId: uid, soundId: req.params.soundId, message: err?.message });
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Get sound image for admin preview
  app.get("/api/admin/sounds/:userId/:soundId/image", (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const uid = String(req.params.userId);
    const sound = getSound(uid, req.params.soundId);
    if (!sound || !sound.imageFilename) return res.status(404).json({ error: "Image not found" });
    const filePath = path.resolve(SOUNDS_FILE_DIR, String(uid), sound.imageFilename);
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: "Image file not found" });
    });
  });

  // Delete image for a user's sound
  app.delete("/api/admin/sounds/:userId/:soundId/image", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const uid = String(req.params.userId);
    const sound = getSound(uid, req.params.soundId);
    if (!sound) return res.status(404).json({ error: "Sound not found" });
    if (sound.imageFilename) {
      const imgPath = path.resolve(SOUNDS_FILE_DIR, String(uid), sound.imageFilename);
      try { await fsUnlink(imgPath); } catch {}
    }
    const updated = updateSound(uid, sound.id, { imageFilename: "" });
    res.json({ sound: updated });
  });

  // Get audio duration for a user's sound (for trim UI)
  app.get("/api/admin/sounds/:userId/:soundId/duration", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const uid = String(req.params.userId);
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
      res.status(500).json({ error: "Could not determine audio duration" });
    }
  });

  // Trim a user's sound (server-side ffmpeg)
  app.post("/api/admin/sounds/:userId/:soundId/trim", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const uid = String(req.params.userId);
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
      try {
        await execFileAsync("ffmpeg", [
          "-i", filePath, "-ss", String(trimStart), "-to", String(trimEnd),
          "-c", "copy", "-y", tmpPath,
        ], { timeout: 10000 });
      } catch {
        await execFileAsync("ffmpeg", [
          "-i", filePath, "-ss", String(trimStart), "-to", String(trimEnd),
          "-y", tmpPath,
        ], { timeout: 10000 });
      }
      const tmpStat = await fsStat(tmpPath);
      if (tmpStat.size === 0) throw new Error("ffmpeg produced an empty file");
      await rename(tmpPath, filePath);
      const fileStat = await fsStat(filePath);
      const updated = updateSound(uid, sound.id, { sizeBytes: fileStat.size });
      logger.info("admin_sound_trimmed", { admin: req.session.twitchUser.id, userId: uid, soundId: sound.id, trimStart, trimEnd });
      res.json({ sound: updated });
    } catch (err) {
      try { await fsUnlink(tmpPath); } catch {}
      res.status(500).json({ error: "Trim failed: " + (err?.stderr || err?.message || "Unknown error") });
    }
  });

  // Test a sound alert for a user (trigger playback, no Bits)
  app.post("/api/admin/sounds/:userId/test/:soundId", (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const uid = String(req.params.userId);
    const sound = getSound(uid, req.params.soundId);
    if (!sound) return res.status(404).json({ error: "Sound not found" });
    if (typeof onSoundAlert === "function") {
      onSoundAlert({
        channelId: uid,
        soundId: sound.id,
        soundName: sound.name,
        tier: sound.tier,
        txId: `admin_test_${Date.now()}`,
        type: sound.type || "sound",
        clipSlug: sound.clipSlug || "",
        volume: sound.volume || 80,
      });
    }
    res.json({ ok: true, sound: { id: sound.id, name: sound.name } });
  });
}
