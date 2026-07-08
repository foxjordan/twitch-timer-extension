import path from "path";
import os from "os";
import crypto from "crypto";
import multer from "multer";
import { execFile } from "child_process";
import { promisify } from "util";
import { stat as fsStat, unlink as fsUnlink, rename } from "fs/promises";
import { createReadStream } from "fs";
import { logger } from "./logger.js";
import { isSuperAdmin } from "./routes_admin.js";
import { r2Enabled, r2SoundKey, putR2Object, getR2PresignedUrl } from "./r2.js";
import {
  uploadToStorage,
  deleteFileFromStorage,
  serveFileFromStorage,
  downloadFromR2ToTemp,
} from "./routes_sounds.js";
import {
  OFFICIAL_LIBRARY_UID,
  listSounds,
  getSound,
  createSound,
  updateSound,
  deleteSound,
  generateFilename,
  getSoundFilePath,
  ALLOWED_MIME_TYPES,
  MAX_OFFICIAL_LIBRARY_FILE_SIZE,
  SOUNDS_FILE_DIR,
} from "./sounds_store.js";

const execFileAsync = promisify(execFile);

const MULTER_TMP_DIR = r2Enabled ? os.tmpdir() : path.resolve(SOUNDS_FILE_DIR, "tmp");

const upload = multer({
  dest: MULTER_TMP_DIR,
  limits: { fileSize: MAX_OFFICIAL_LIBRARY_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIME_TYPES.includes(file.mimetype));
  },
});

function requireSuperAdmin(req, res) {
  if (!req.session?.isAdmin || !isSuperAdmin(req)) {
    res.status(403).json({ error: "Access denied" });
    return false;
  }
  return true;
}

function parseTags(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") return raw.split(",").map((t) => t.trim()).filter(Boolean);
  return [];
}

// Admin-curated "official" starter content library — properly licensed
// (CC0/public domain) sounds every broadcaster sees pre-populated in the
// community library, no moderation queue (the admin uploading it IS the
// review). Deliberately a separate, small, R2-aware route set rather than
// extending routes_admin_sounds.js, which has broader (video/clip/trim)
// surface area that predates R2 support and isn't R2-safe today.
export function mountOfficialLibraryRoutes(app) {
  app.get("/api/admin/official-library", (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    res.json({ sounds: listSounds(OFFICIAL_LIBRARY_UID) });
  });

  app.post("/api/admin/official-library", upload.single("file"), async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided or unsupported format" });
    }
    try {
      const soundId = `snd_${crypto.randomUUID().slice(0, 12)}`;
      const filename = generateFilename(OFFICIAL_LIBRARY_UID, soundId, req.file.mimetype);
      await uploadToStorage(OFFICIAL_LIBRARY_UID, filename, req.file.path, req.file.mimetype);

      const result = createSound(OFFICIAL_LIBRARY_UID, {
        id: soundId,
        name: req.body.name || req.file.originalname || "Untitled Sound",
        filename,
        originalFilename: req.file.originalname || "",
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        volume: req.body.volume ? Number(req.body.volume) : 80,
        tags: parseTags(req.body.tags),
        sourceUrl: req.body.sourceUrl || "",
        sourceLicense: req.body.sourceLicense || "",
      });

      if (result.error) {
        await deleteFileFromStorage(OFFICIAL_LIBRARY_UID, filename);
        return res.status(400).json(result);
      }

      logger.info("official_library_sound_uploaded", {
        admin: req.session.twitchUser.id,
        soundId,
        filename,
      });
      res.status(201).json({ sound: result });
    } catch (err) {
      logger.error("official_library_upload_failed", { message: err?.message });
      res.status(500).json({ error: "Failed to upload sound" });
    }
  });

  app.put("/api/admin/official-library/:soundId", (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const patch = { ...(req.body || {}) };
    if ("tags" in patch) patch.tags = parseTags(patch.tags);
    const sound = updateSound(OFFICIAL_LIBRARY_UID, req.params.soundId, patch);
    if (!sound) return res.status(404).json({ error: "Sound not found" });
    res.json({ sound });
  });

  app.delete("/api/admin/official-library/:soundId", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const sound = getSound(OFFICIAL_LIBRARY_UID, req.params.soundId);
    if (sound) {
      await deleteFileFromStorage(OFFICIAL_LIBRARY_UID, sound.filename);
      await deleteFileFromStorage(OFFICIAL_LIBRARY_UID, sound.imageFilename);
    }
    const ok = await deleteSound(OFFICIAL_LIBRARY_UID, req.params.soundId);
    if (!ok) return res.status(404).json({ error: "Sound not found" });
    logger.info("official_library_sound_deleted", {
      admin: req.session.twitchUser.id,
      soundId: req.params.soundId,
    });
    res.json({ ok: true });
  });

  // Admin preview only (session-gated) — plain redirect/pipe is fine here
  // since it's played via a direct <audio> src, never fetch()+blob (that
  // would need CORS on the R2 response; media playback doesn't).
  app.get("/api/admin/official-library/:soundId/audio", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const sound = getSound(OFFICIAL_LIBRARY_UID, req.params.soundId);
    if (!sound) return res.status(404).json({ error: "Sound not found" });
    await serveFileFromStorage(res, OFFICIAL_LIBRARY_UID, sound, "no-store");
  });

  // Get audio duration (for the trim UI's range slider)
  app.get("/api/admin/official-library/:soundId/duration", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const sound = getSound(OFFICIAL_LIBRARY_UID, req.params.soundId);
    if (!sound) return res.status(404).json({ error: "Sound not found" });

    let probeTarget;
    if (r2Enabled) {
      probeTarget = await getR2PresignedUrl(r2SoundKey(OFFICIAL_LIBRARY_UID, sound.filename), 300);
    } else {
      probeTarget = getSoundFilePath(OFFICIAL_LIBRARY_UID, sound);
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
      logger.error("official_library_duration_failed", { soundId: sound.id, message: err?.message });
      res.status(500).json({ error: "Could not determine audio duration" });
    }
  });

  // Trim a sound in place (server-side ffmpeg) — mirrors the broadcaster-facing
  // /api/sounds/:soundId/trim in routes_sounds.js exactly (same R2-safe
  // download-trim-reupload approach), just scoped to the official library.
  app.post("/api/admin/official-library/:soundId/trim", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const sound = getSound(OFFICIAL_LIBRARY_UID, req.params.soundId);
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
    const filePath = r2Enabled ? localTmpBase + ext : getSoundFilePath(OFFICIAL_LIBRARY_UID, sound);
    const tmpPath = r2Enabled ? localTmpBase + ".trim_tmp" + ext : filePath + ".trim_tmp" + ext;

    try {
      if (r2Enabled) {
        await downloadFromR2ToTemp(OFFICIAL_LIBRARY_UID, sound.filename, filePath);
      }

      let usedCopy = true;
      try {
        await execFileAsync("ffmpeg", [
          "-i", filePath, "-ss", String(trimStart), "-to", String(trimEnd),
          "-c", "copy", "-y", tmpPath,
        ], { timeout: 10000 });
      } catch (copyErr) {
        usedCopy = false;
        logger.info("official_library_trim_copy_fallback", { soundId: sound.id, reason: copyErr?.stderr || copyErr?.message });
        await execFileAsync("ffmpeg", [
          "-i", filePath, "-ss", String(trimStart), "-to", String(trimEnd),
          "-y", tmpPath,
        ], { timeout: 10000 });
      }

      const tmpStat = await fsStat(tmpPath);
      if (tmpStat.size === 0) throw new Error("ffmpeg produced an empty file");

      if (r2Enabled) {
        await putR2Object(r2SoundKey(OFFICIAL_LIBRARY_UID, sound.filename), createReadStream(tmpPath), sound.mimeType);
        await fsUnlink(tmpPath).catch(() => {});
        await fsUnlink(filePath).catch(() => {});
        const updated = updateSound(OFFICIAL_LIBRARY_UID, sound.id, { sizeBytes: tmpStat.size });
        logger.info("official_library_trimmed", { soundId: sound.id, trimStart, trimEnd, newSize: tmpStat.size, usedCopy });
        return res.json({ sound: updated });
      }

      await rename(tmpPath, filePath);
      const fileStat = await fsStat(filePath);
      const updated = updateSound(OFFICIAL_LIBRARY_UID, sound.id, { sizeBytes: fileStat.size });
      logger.info("official_library_trimmed", { soundId: sound.id, trimStart, trimEnd, newSize: fileStat.size, usedCopy });
      res.json({ sound: updated });
    } catch (err) {
      try { await fsUnlink(tmpPath); } catch {}
      if (r2Enabled) try { await fsUnlink(filePath); } catch {}
      const detail = err?.stderr || err?.message || "Unknown error";
      logger.error("official_library_trim_failed", { soundId: req.params.soundId, detail });
      res.status(500).json({ error: "Trim failed: " + detail });
    }
  });
}
