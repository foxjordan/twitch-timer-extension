import { isSuperAdmin } from "./routes_admin.js";
import { getPendingLibrarySounds, updateSound } from "./sounds_store.js";
import { logger } from "./logger.js";

const ID_RE = /^[\w-]+$/;

export function mountLibraryModerationRoutes(app) {
  // List shared sounds awaiting moderation approval
  app.get("/api/admin/library/pending", (req, res) => {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Super admin access required" });
    }
    res.json({ sounds: getPendingLibrarySounds() });
  });

  // Approve a pending shared sound — it becomes visible in the public library
  app.post("/api/admin/library/:ownerUserId/:soundId/approve", (req, res) => {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Super admin access required" });
    }
    const { ownerUserId, soundId } = req.params;
    if (!ID_RE.test(ownerUserId) || !ID_RE.test(soundId)) {
      return res.status(400).json({ error: "Invalid parameters" });
    }
    const sound = updateSound(ownerUserId, soundId, { moderationStatus: "approved" });
    if (!sound) return res.status(404).json({ error: "Sound not found" });
    logger.info("library_sound_approved", {
      adminUserId: req.session?.twitchUser?.id,
      ownerUserId,
      soundId,
    });
    res.json({ ok: true, sound });
  });

  // Reject a pending shared sound — also un-shares it so the uploader's own
  // dashboard honestly reflects "not in the library" rather than "shared but invisible"
  app.post("/api/admin/library/:ownerUserId/:soundId/reject", (req, res) => {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ error: "Super admin access required" });
    }
    const { ownerUserId, soundId } = req.params;
    if (!ID_RE.test(ownerUserId) || !ID_RE.test(soundId)) {
      return res.status(400).json({ error: "Invalid parameters" });
    }
    const sound = updateSound(ownerUserId, soundId, { moderationStatus: "rejected", shared: false });
    if (!sound) return res.status(404).json({ error: "Sound not found" });
    logger.info("library_sound_rejected", {
      adminUserId: req.session?.twitchUser?.id,
      ownerUserId,
      soundId,
    });
    res.json({ ok: true, sound });
  });
}
