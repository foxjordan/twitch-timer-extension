import { logger } from "./logger.js";
import { isPro } from "./subscription_store.js";
import { isSuperAdmin } from "./routes_admin.js";
import jwt from "jsonwebtoken";
import multer from "multer";
import { rename, stat as fsStat, unlink as fsUnlink } from "fs/promises";
import { createReadStream, createWriteStream } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { pipeline } from "stream/promises";
import path from "path";
import os from "os";
import fetch from "node-fetch";
import {
  r2Enabled,
  r2SoundKey,
  putR2Object,
  deleteR2Object,
  getR2PresignedUrl,
  getR2ObjectStream,
  copyR2Object,
} from "./r2.js";
import { logSoundEvent } from "./alert_events_store.js";

const execFileAsync = promisify(execFile);

// ===== R2-aware storage helpers =====

// Upload a file from a local path to storage (R2 or local disk).
// In R2 mode: streams to R2 then deletes the local temp file.
// In disk mode: renames from tmpPath to the final path under SOUNDS_FILE_DIR/{uid}.
async function uploadToStorage(uid, filename, tmpPath, mimeType) {
  if (r2Enabled) {
    const key = r2SoundKey(String(uid), filename);
    const stream = createReadStream(tmpPath);
    await putR2Object(key, stream, mimeType);
    await fsUnlink(tmpPath).catch(() => {});
  } else {
    const destPath = path.resolve(SOUNDS_FILE_DIR, String(uid), filename);
    await ensureSoundDir(uid);
    await rename(tmpPath, destPath);
  }
}

// Serve a sound file (audio or video) from storage.
// In R2 mode: redirects to a presigned URL.
// In disk mode: pipes the local file.
async function serveFileFromStorage(res, uid, sound, cacheControl = 'no-store') {
  if (r2Enabled) {
    try {
      const key = r2SoundKey(String(uid), sound.filename);
      const url = await getR2PresignedUrl(key, 3600);
      res.setHeader('Cache-Control', cacheControl);
      return res.redirect(302, url);
    } catch (err) {
      if (!res.headersSent) res.status(500).json({ error: 'Storage error' });
      return;
    }
  }
  const filePath = getSoundFilePath(String(uid), sound);
  res.setHeader('Content-Type', sound.mimeType || 'application/octet-stream');
  res.setHeader('Cache-Control', cacheControl);
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'File not found' });
  });
}

// Serve an image file from storage.
async function serveImageFromStorage(res, uid, filename, cacheControl = 'public, max-age=3600') {
  if (r2Enabled) {
    try {
      const key = r2SoundKey(String(uid), filename);
      const url = await getR2PresignedUrl(key, 3600);
      res.setHeader('Cache-Control', cacheControl);
      return res.redirect(302, url);
    } catch (err) {
      if (!res.headersSent) res.status(500).json({ error: 'Storage error' });
      return;
    }
  }
  const filePath = path.resolve(SOUNDS_FILE_DIR, String(uid), filename);
  res.setHeader('Cache-Control', cacheControl);
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Image file not found' });
  });
}

// Delete a file from storage (best-effort, silent on failure).
async function deleteFileFromStorage(uid, filename) {
  if (r2Enabled && filename) {
    await deleteR2Object(r2SoundKey(String(uid), filename)).catch(() => {});
  }
  // Disk cleanup is handled by sounds_store deleteSound() via fsUnlink (silently fails in R2 mode)
}

// Download a file from R2 to a local temp path.
async function downloadFromR2ToTemp(uid, filename, tempPath) {
  const key = r2SoundKey(String(uid), filename);
  const stream = await getR2ObjectStream(key);
  await pipeline(stream, createWriteStream(tempPath));
}

/**
 * Compress a video file in-place with H.264 CRF 28.
 * Skips replacement if the compressed file is larger than the original.
 * Returns the final file size in bytes.
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
 * Returns the output file path and size in bytes.
 */
async function extractAudio(videoPath, audioPath) {
  try {
    await execFileAsync("ffmpeg", [
      "-i", videoPath,
      "-vn",
      "-c:a", "aac", "-b:a", "128k",
      "-y", audioPath,
    ], { timeout: 120000 });
    const audioStat = await fsStat(audioPath);
    if (audioStat.size === 0) throw new Error("ffmpeg produced empty audio file");
    // Remove the original video file
    try { await fsUnlink(videoPath); } catch {}
    return audioStat.size;
  } catch (err) {
    try { await fsUnlink(audioPath); } catch {}
    throw err;
  }
}

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
  DEFAULT_TIER,
  SOUNDS_FILE_DIR,
  seedDefaultSounds,
  getSharedLibrary,
  copySoundToUser,
} from "./sounds_store.js";

const EXT_SECRET = process.env.EXTENSION_SECRET
  ? Buffer.from(process.env.EXTENSION_SECRET, "base64")
  : null;

// Multer setup for sound uploads
// In R2 mode, upload files to the OS temp dir (always exists) instead of the
// Fly volume, which may not have user subdirs if no disk storage is in use.
const MULTER_TMP_DIR = r2Enabled ? os.tmpdir() : path.resolve(SOUNDS_FILE_DIR, "tmp");

const upload = multer({
  dest: MULTER_TMP_DIR,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIME_TYPES.includes(file.mimetype));
  },
});

const imageUpload = multer({
  dest: MULTER_TMP_DIR,
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype));
  },
});

const videoUpload = multer({
  dest: MULTER_TMP_DIR,
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

      await uploadToStorage(uid, filename, req.file.path, req.file.mimetype);

      const result = createSound(uid, {
        id: soundId,
        name: req.body.name || req.file.originalname || "Untitled Sound",
        filename,
        originalFilename: req.file.originalname || "",
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        tier: req.body.tier || DEFAULT_TIER,
        volume: req.body.volume ? Number(req.body.volume) : 80,
        cooldownMs: req.body.cooldownMs ? Number(req.body.cooldownMs) : 5000,
        enabled: req.body.enabled !== "false",
        shared: req.body.shared === true || req.body.shared === "true",
      });

      if (result.error) {
        await deleteFileFromStorage(uid, filename);
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
    if (!settings.videoClipsEnabled && !isPro(uid)) {
      return res.status(403).json({ error: "Video & clip alerts require a Pro plan" });
    }

    const { name, clipUrl, tier, volume, cooldownMs, audioOnly } = req.body || {};
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

      // Download the clip video file (to tmp dir in R2 mode, final dir in disk mode)
      const videoFilename = `${soundId}.mp4`;
      const videoDestPath = r2Enabled
        ? path.resolve(MULTER_TMP_DIR, videoFilename)
        : path.resolve(SOUNDS_FILE_DIR, String(uid), videoFilename);
      if (!r2Enabled) await ensureSoundDir(uid);
      const dlResult = await downloadClipVideo(clipInfo.video_url, videoDestPath);
      if (!dlResult.ok) {
        return res.status(400).json({
          error: "Failed to download clip video. The clip may be unavailable or region-restricted.",
          debug: {
            thumbnail_url: clipInfo.thumbnail_url,
            derived_video_url: clipInfo.video_url,
            download_error: dlResult.error,
            download_content_type: dlResult.contentType,
          },
        });
      }

      let sizeBytes = 0;
      try {
        const fileStat = await fsStat(videoDestPath);
        sizeBytes = fileStat.size;
      } catch {}

      let finalFilename;
      let finalMimeType;
      let finalType;
      let finalLocalPath;

      if (audioOnly) {
        // Extract audio only from the downloaded clip
        finalFilename = `${soundId}.m4a`;
        finalMimeType = "audio/mp4";
        finalType = "sound";
        finalLocalPath = r2Enabled
          ? path.resolve(MULTER_TMP_DIR, finalFilename)
          : path.resolve(SOUNDS_FILE_DIR, String(uid), finalFilename);
        try {
          const originalSize = sizeBytes;
          sizeBytes = await extractAudio(videoDestPath, finalLocalPath);
          logger.info("clip_audio_extracted", { userId: uid, soundId, originalSize, audioSize: sizeBytes });
        } catch (err) {
          try { await fsUnlink(videoDestPath); } catch {}
          try { await fsUnlink(finalLocalPath); } catch {}
          logger.error("clip_audio_extract_failed", { userId: uid, soundId, message: err?.message });
          return res.status(500).json({ error: "Failed to extract audio from clip" });
        }
      } else {
        // Compress the downloaded clip (existing behavior)
        finalFilename = videoFilename;
        finalMimeType = "video/mp4";
        finalType = "clip";
        finalLocalPath = videoDestPath;
        try {
          const originalSize = sizeBytes;
          sizeBytes = await compressVideo(finalLocalPath);
          logger.info("clip_compressed", { userId: uid, soundId, originalSize, compressedSize: sizeBytes });
        } catch (err) {
          logger.warn("clip_compress_failed", { userId: uid, soundId, message: err?.message });
        }
      }

      // Sanity check: file should be at least a few KB
      if (sizeBytes < 1024) {
        try { await fsUnlink(finalLocalPath); } catch {}
        return res.status(400).json({
          error: audioOnly
            ? "Extracted audio is too small. The clip may not contain an audio track."
            : "Downloaded file is too small to be a valid video. The clip URL may have changed.",
          debug: {
            thumbnail_url: clipInfo.thumbnail_url,
            derived_video_url: clipInfo.video_url,
            download_content_type: dlResult.contentType,
            sizeBytes,
          },
        });
      }

      logger.info("clip_processed", { userId: uid, soundId, clipSlug, sizeBytes, audioOnly: !!audioOnly });

      // Upload final clip/audio file to storage
      if (r2Enabled) {
        await putR2Object(r2SoundKey(String(uid), finalFilename), createReadStream(finalLocalPath), finalMimeType);
        await fsUnlink(finalLocalPath).catch(() => {});
      } else if (!r2Enabled && audioOnly) {
        // Video file already removed by extractAudio; disk file is already in place
      }

      // Download clip thumbnail as the card image
      let imageFilename = "";
      if (clipInfo.thumbnail_url) {
        try {
          imageFilename = generateImageFilename(soundId, "image/jpeg");
          const imgLocalPath = r2Enabled
            ? path.resolve(MULTER_TMP_DIR, imageFilename)
            : path.resolve(SOUNDS_FILE_DIR, String(uid), imageFilename);
          const imgRes = await fetch(clipInfo.thumbnail_url);
          if (imgRes.ok) {
            await pipeline(imgRes.body, createWriteStream(imgLocalPath));
            if (r2Enabled) {
              await putR2Object(r2SoundKey(String(uid), imageFilename), createReadStream(imgLocalPath), "image/jpeg");
              await fsUnlink(imgLocalPath).catch(() => {});
            }
          } else {
            logger.warn("clip_thumbnail_download_failed", { userId: uid, soundId, status: imgRes.status });
            imageFilename = "";
          }
        } catch (err) {
          logger.warn("clip_thumbnail_error", { userId: uid, soundId, message: err?.message });
          imageFilename = "";
        }
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
        shared: req.body.shared === true || req.body.shared === "true",
      });

      if (result.error) return res.status(400).json(result);

      logger.info("clip_created", { userId: uid, soundId, clipSlug });
      res.status(201).json({
        sound: result,
        debug: {
          thumbnail_url: clipInfo.thumbnail_url,
          derived_video_url: clipInfo.video_url,
          download_content_type: dlResult.contentType,
          sizeBytes,
        },
      });
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
      const destPath = r2Enabled
        ? path.resolve(MULTER_TMP_DIR, filename)
        : path.resolve(SOUNDS_FILE_DIR, String(uid), filename);
      if (!r2Enabled) await ensureSoundDir(uid);
      const dlResult = await downloadClipVideo(clipInfo.video_url, destPath);
      if (!dlResult.ok) {
        return res.status(400).json({
          error: "Failed to download clip video",
          debug: {
            thumbnail_url: clipInfo.thumbnail_url,
            derived_video_url: clipInfo.video_url,
            download_error: dlResult.error,
            download_content_type: dlResult.contentType,
          },
        });
      }

      let sizeBytes = 0;
      try {
        const fileStat = await fsStat(destPath);
        sizeBytes = fileStat.size;
      } catch {}

      // Compress the downloaded clip
      try {
        const originalSize = sizeBytes;
        sizeBytes = await compressVideo(destPath);
        logger.info("clip_redownload_compressed", { userId: uid, soundId: sound.id, originalSize, compressedSize: sizeBytes });
      } catch (err) {
        logger.warn("clip_redownload_compress_failed", { userId: uid, soundId: sound.id, message: err?.message });
      }

      if (r2Enabled) {
        // Delete old R2 object if it exists, then upload the new one
        await deleteR2Object(r2SoundKey(String(uid), filename)).catch(() => {});
        await putR2Object(r2SoundKey(String(uid), filename), createReadStream(destPath), "video/mp4");
        await fsUnlink(destPath).catch(() => {});
      }

      updateSound(uid, sound.id, {
        filename,
        mimeType: "video/mp4",
        sizeBytes,
      });

      logger.info("clip_redownloaded", { userId: uid, soundId: sound.id, sizeBytes });
      res.json({
        ok: true,
        sound: getSound(uid, sound.id),
        debug: {
          thumbnail_url: clipInfo.thumbnail_url,
          derived_video_url: clipInfo.video_url,
          download_content_type: dlResult.contentType,
          sizeBytes,
        },
      });
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
    if (!videoSettings.videoClipsEnabled && !isPro(uid)) {
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

      // Compress video in-place while it's still in the multer temp location
      let sizeBytes = req.file.size;
      try {
        sizeBytes = await compressVideo(req.file.path);
        logger.info("video_compressed", { userId: uid, soundId, originalSize: req.file.size, compressedSize: sizeBytes });
      } catch (err) {
        logger.warn("video_compress_failed", { userId: uid, soundId, message: err?.message });
      }

      await uploadToStorage(uid, filename, req.file.path, req.file.mimetype);

      const result = createSound(uid, {
        id: soundId,
        type: "video",
        name: req.body.name || req.file.originalname || "Untitled Video",
        filename,
        originalFilename: req.file.originalname || "",
        mimeType: req.file.mimetype,
        sizeBytes,
        tier: req.body.tier || DEFAULT_TIER,
        volume: req.body.volume ? Number(req.body.volume) : 80,
        cooldownMs: req.body.cooldownMs ? Number(req.body.cooldownMs) : 5000,
        enabled: true,
        shared: req.body.shared === true || req.body.shared === "true",
      });

      if (result.error) {
        await deleteFileFromStorage(uid, filename);
        return res.status(400).json(result);
      }

      logger.info("video_uploaded", { userId: uid, soundId, filename, size: req.file.size });
      res.status(201).json({ sound: result });
    } catch (err) {
      logger.error("video_upload_failed", { userId: uid, message: err?.message });
      res.status(500).json({ error: "Failed to upload video" });
    }
  });

  // ===== Community Library =====

  // Browse shared sounds from all users
  app.get("/api/sounds/library", (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    const library = getSharedLibrary(uid);
    res.json({ sounds: library });
  });

  // Serve image for a library sound (from original owner's directory)
  app.get("/api/sounds/library/:ownerUserId/:soundId/image", async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    if (!/^\w+$/.test(req.params.ownerUserId) || !/^\w+$/.test(req.params.soundId)) {
      return res.status(400).json({ error: "Invalid parameters" });
    }
    const sound = getSound(req.params.ownerUserId, req.params.soundId);
    if (!sound || !sound.shared || !sound.imageFilename) {
      return res.status(404).json({ error: "Image not found" });
    }
    await serveImageFromStorage(res, req.params.ownerUserId, sound.imageFilename);
  });

  // Serve audio preview for a library sound (from original owner's directory)
  app.get("/api/sounds/library/:ownerUserId/:soundId/preview", async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    if (!/^\w+$/.test(req.params.ownerUserId) || !/^\w+$/.test(req.params.soundId)) {
      return res.status(400).json({ error: "Invalid parameters" });
    }
    const sound = getSound(req.params.ownerUserId, req.params.soundId);
    if (!sound || !sound.shared) {
      return res.status(404).json({ error: "Sound not found or not shared" });
    }
    res.setHeader("Content-Type", sound.mimeType || "audio/mpeg");
    await serveFileFromStorage(res, req.params.ownerUserId, sound, "public, max-age=3600");
  });

  // Add a library sound to your own alerts (copies the file)
  app.post("/api/sounds/library/add", async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    const { ownerUserId, soundId } = req.body || {};
    if (!ownerUserId || !soundId) {
      return res.status(400).json({ error: "ownerUserId and soundId are required" });
    }
    try {
      const fileCopyFn = r2Enabled
        ? async (srcFilename, destFilename) => {
            const srcKey = r2SoundKey(String(ownerUserId), srcFilename);
            const destKey = r2SoundKey(String(uid), destFilename);
            await copyR2Object(srcKey, destKey);
            const src = getSound(String(ownerUserId), soundId);
            return { size: src?.sizeBytes || 0 };
          }
        : undefined;
      const result = await copySoundToUser(ownerUserId, soundId, uid, { fileCopyFn });
      if (result.error) return res.status(400).json(result);
      logger.info("library_sound_added", { userId: uid, sourceUserId: ownerUserId, sourceSoundId: soundId, newSoundId: result.id });
      res.status(201).json({ sound: result });
    } catch (err) {
      logger.error("library_add_failed", { userId: uid, message: err?.message });
      res.status(500).json({ error: "Failed to add sound from library" });
    }
  });

  // Super admin: delete any sound from the library
  app.delete("/api/sounds/library/:ownerUserId/:soundId", async (req, res) => {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Super admin access required" });
    }
    const { ownerUserId, soundId } = req.params;
    if (!/^[\w-]+$/.test(ownerUserId) || !/^[\w-]+$/.test(soundId)) {
      return res.status(400).json({ error: "Invalid parameters" });
    }
    const sound = getSound(ownerUserId, soundId);
    if (sound) {
      await deleteFileFromStorage(ownerUserId, sound.filename);
      await deleteFileFromStorage(ownerUserId, sound.imageFilename);
    }
    const ok = await deleteSound(ownerUserId, soundId);
    if (!ok) return res.status(404).json({ error: "Sound not found" });
    logger.info("library_sound_admin_deleted", {
      adminUserId: req.session?.twitchUser?.id,
      ownerUserId,
      soundId,
    });
    res.json({ ok: true });
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
        await deleteFileFromStorage(uid, sound.imageFilename);
        if (!r2Enabled) {
          const oldPath = path.resolve(SOUNDS_FILE_DIR, String(uid), sound.imageFilename);
          try { await fsUnlink(oldPath); } catch {}
        }
      }

      const imageFilename = generateImageFilename(sound.id, req.file.mimetype);
      await uploadToStorage(uid, imageFilename, req.file.path, req.file.mimetype);

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
      await deleteFileFromStorage(uid, sound.imageFilename);
      if (!r2Enabled) {
        const imgPath = path.resolve(SOUNDS_FILE_DIR, String(uid), sound.imageFilename);
        try { await fsUnlink(imgPath); } catch {}
      }
    }

    const updated = updateSound(uid, sound.id, { imageFilename: "" });
    res.json({ sound: updated });
  });

  // Serve sound image for admin preview (session/JWT auth)
  app.get("/api/sounds/:soundId/image", async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    const sound = getSound(uid, req.params.soundId);
    if (!sound || !sound.imageFilename) {
      return res.status(404).json({ error: "Image not found" });
    }
    await serveImageFromStorage(res, uid, sound.imageFilename, "no-store");
  });

  // Delete a sound
  app.delete("/api/sounds/:soundId", async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    const sound = getSound(uid, req.params.soundId);
    if (sound) {
      await deleteFileFromStorage(uid, sound.filename);
      await deleteFileFromStorage(uid, sound.imageFilename);
    }
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
    const settings = getSoundSettings(uid);
    // Reflect Pro subscription status so UI shows clip/video tabs
    if (isPro(uid)) {
      settings.videoClipsEnabled = true;
    }
    res.json({ settings });
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
    logSoundEvent({ channelId: uid, soundId: sound.id, soundName: sound.name, alertType: sound.type || 'sound', clipSlug: sound.clipSlug, eventKind: 'test' });
    notify(String(uid), sound.id, sound.name, sound.tier, null, null, {
      type: sound.type || "sound",
      clipSlug: sound.clipSlug || "",
      volume: sound.volume || 80,
    });
    res.json({ ok: true, sound: { id: sound.id, name: sound.name } });
  });

  // Serve sound file for admin preview/trim (session auth)
  app.get("/api/sounds/:soundId/audio", async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    const sound = getSound(uid, req.params.soundId);
    if (!sound) return res.status(404).json({ error: "Sound not found" });
    res.setHeader("Content-Type", sound.mimeType);
    await serveFileFromStorage(res, uid, sound, "no-store");
  });

  // Get audio duration for a sound (for trim UI)
  app.get("/api/sounds/:soundId/duration", async (req, res) => {
    const uid = requireBroadcaster(req, res);
    if (!uid) return;
    const sound = getSound(uid, req.params.soundId);
    if (!sound) return res.status(404).json({ error: "Sound not found" });

    let probeTarget;
    if (r2Enabled) {
      probeTarget = await getR2PresignedUrl(r2SoundKey(String(uid), sound.filename), 300);
    } else {
      probeTarget = getSoundFilePath(uid, sound);
    }
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "json",
        probeTarget,
      ], { timeout: 10000 });
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

    const ext = path.extname(sound.filename) || ".mp3";
    const localTmpBase = path.resolve(MULTER_TMP_DIR, `${sound.id}_trim_${Date.now()}`);
    // For disk mode: operate on the final file in-place (existing behavior)
    // For R2 mode: download to a temp file, trim, re-upload
    const filePath = r2Enabled ? localTmpBase + ext : getSoundFilePath(uid, sound);
    const tmpPath = r2Enabled ? localTmpBase + ".trim_tmp" + ext : filePath + ".trim_tmp" + ext;

    try {
      if (r2Enabled) {
        await downloadFromR2ToTemp(uid, sound.filename, filePath);
      }

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

      if (r2Enabled) {
        // Upload trimmed file to R2 under the original filename, then clean up locals
        await putR2Object(r2SoundKey(String(uid), sound.filename), createReadStream(tmpPath), sound.mimeType);
        await fsUnlink(tmpPath).catch(() => {});
        await fsUnlink(filePath).catch(() => {});
        const updated = updateSound(uid, sound.id, { sizeBytes: tmpStat.size });
        logger.info("sound_trimmed", { userId: uid, soundId: sound.id, trimStart, trimEnd, newSize: tmpStat.size, usedCopy });
        return res.json({ sound: updated });
      }

      // Disk mode: replace original atomically
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
      // Clean up temp files if they exist
      try { await fsUnlink(tmpPath); } catch {}
      if (r2Enabled) try { await fsUnlink(filePath); } catch {}
      const detail = err?.stderr || err?.message || "Unknown error";
      logger.error("sound_trim_failed", { userId: uid, soundId: req.params.soundId, detail });
      res.status(500).json({ error: "Trim failed: " + detail });
    }
  });

  // ===== Public endpoints =====

  // Serve sound image (Extension JWT auth — any viewer/broadcaster/mod)
  app.get("/api/sounds/image/:soundId", async (req, res) => {
    const claims = requireExtensionAuth(req, res);
    if (!claims) return;
    const channelId = req.query.channelId || claims.channel_id;
    if (!channelId) return res.status(400).json({ error: "channelId required" });

    const sound = getSound(String(channelId), req.params.soundId);
    if (!sound || !sound.imageFilename) {
      return res.status(404).json({ error: "Image not found" });
    }
    await serveImageFromStorage(res, channelId, sound.imageFilename);
  });

  // Preview a sound/video/clip (Extension JWT auth — any viewer/broadcaster/mod)
  app.get("/api/sounds/preview/:soundId", async (req, res) => {
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

    res.setHeader("Content-Type", sound.mimeType || "video/mp4");
    await serveFileFromStorage(res, channelId, sound, "public, max-age=3600");
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
  app.get("/api/sounds/file/:soundId", async (req, res) => {
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

    res.setHeader("Content-Type", sound.mimeType || "video/mp4");
    await serveFileFromStorage(res, uid, sound, "public, max-age=86400");
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

    // Extract receipt data and txId early so they're available for failure logging below
    const receiptData = txClaims.data || txClaims;
    const txId = receiptData.transactionId || receiptData.transactionID || receiptData.id;
    const viewerUserId = claims.user_id;

    // 3. Validate sound exists and is enabled
    const sound = getSound(String(channelId), soundId);
    if (!sound || !sound.enabled) {
      logSoundEvent({ channelId, viewerUserId, soundId, soundName: sound?.name, alertType: sound?.type, txId, eventKind: 'failed', failureReason: 'sound_not_found' });
      return res.status(404).json({ error: "Sound not found or disabled" });
    }

    const settings = getSoundSettings(String(channelId));
    if (!settings.enabled) {
      logSoundEvent({ channelId, viewerUserId, soundId, soundName: sound.name, alertType: sound.type, tier: sound.tier, txId, eventKind: 'failed', failureReason: 'alerts_disabled' });
      return res.status(400).json({ error: "Sound alerts are disabled" });
    }

    // 4. Verify SKU matches sound tier
    const receiptSku =
      receiptData.product?.sku || receiptData.product?.domainID;
    if (receiptSku && receiptSku !== sound.tier) {
      logSoundEvent({ channelId, viewerUserId, soundId, soundName: sound.name, alertType: sound.type, tier: sound.tier, txId, eventKind: 'failed', failureReason: 'sku_mismatch' });
      return res.status(400).json({ error: "Product SKU mismatch" });
    }

    // 5. Deduplicate by transactionId
    if (txId && typeof deduplicateTx === "function" && deduplicateTx(txId)) {
      logSoundEvent({ channelId, viewerUserId, soundId, soundName: sound.name, alertType: sound.type, tier: sound.tier, txId, eventKind: 'failed', failureReason: 'duplicate' });
      return res.json({ ok: true, sound: { id: sound.id, name: sound.name }, duplicate: true });
    }

    // 6. Trigger sound alert
    logger.info("sound_redeemed", {
      channelId,
      soundId,
      soundName: sound.name,
      tier: sound.tier,
      txId,
      viewerUserId,
    });

    notify(String(channelId), sound.id, sound.name, sound.tier, txId, viewerUserId, {
      type: sound.type || "sound",
      clipSlug: sound.clipSlug || "",
      volume: sound.volume || 80,
    });

    res.json({ ok: true, sound: { id: sound.id, name: sound.name } });
  });
}

// Need crypto for UUID generation in upload handler
import crypto from "crypto";