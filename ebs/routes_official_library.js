import path from "path";
import os from "os";
import crypto from "crypto";
import multer from "multer";
import { logger } from "./logger.js";
import { isSuperAdmin } from "./routes_admin.js";
import { r2Enabled } from "./r2.js";
import { uploadToStorage, deleteFileFromStorage, serveFileFromStorage } from "./routes_sounds.js";
import {
  OFFICIAL_LIBRARY_UID,
  listSounds,
  getSound,
  createSound,
  updateSound,
  deleteSound,
  generateFilename,
  ALLOWED_MIME_TYPES,
  MAX_OFFICIAL_LIBRARY_FILE_SIZE,
  SOUNDS_FILE_DIR,
} from "./sounds_store.js";

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
}
