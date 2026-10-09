import { logger } from "./logger.js";
import {
  parseFundraiserSlug,
  fetchFundraiserCounts,
  disconnectGoFundMe,
  getGoFundMeStatus,
} from "./gofundme.js";

// EXPERIMENTAL: see gofundme.js for why this polls an unofficial feed.
export function mountGoFundMeRoutes(app, ctx) {
  const {
    getUserSettings,
    setUserSettings,
    startGoFundMeForUser,
    resolveTimerUserId,
  } = ctx;

  // The broadcaster whose timer this dashboard is driving — honours delegate
  // and super-admin "manage as" sessions, same as the rules routes. Using the
  // logged-in user's own id here would attach the fundraiser to the manager.
  const timerUid = (req) => String(resolveTimerUserId(req));

  // Start watching a fundraiser
  app.post("/api/gofundme/connect", async (req, res) => {
    if (!req.session?.isAdmin || !req.session?.twitchUser?.id) {
      return res.status(401).json({ error: "Admin login required" });
    }
    const uid = timerUid(req);
    const slug = parseFundraiserSlug(req.body?.url);
    if (!slug) {
      return res.status(400).json({ error: "Paste your fundraiser link, e.g. gofundme.com/f/your-fundraiser" });
    }

    try {
      await fetchFundraiserCounts(slug);
    } catch (err) {
      logger.warn("gfm_connect_lookup_failed", { userId: uid, slug, error: err?.message });
      return res.status(400).json({ error: "Couldn't find that fundraiser on GoFundMe" });
    }

    // A new fundraiser starts with no cursor, so its existing donations are
    // baselined rather than credited.
    const prev = getUserSettings(uid);
    const patch = { gfmSlug: slug };
    if (prev.gfmSlug !== slug) patch.gfmLastDonationId = null;
    setUserSettings(uid, patch);
    startGoFundMeForUser(uid);

    logger.info("gfm_connect_requested", { userId: uid, slug });
    res.json({ ok: true, slug, ...getGoFundMeStatus(uid) });
  });

  // Stop watching
  app.post("/api/gofundme/disconnect", (req, res) => {
    if (!req.session?.isAdmin || !req.session?.twitchUser?.id) {
      return res.status(401).json({ error: "Admin login required" });
    }
    const uid = timerUid(req);
    disconnectGoFundMe(uid);
    setUserSettings(uid, { gfmSlug: "", gfmLastDonationId: null });
    logger.info("gfm_disconnect_requested", { userId: uid });
    res.json({ ok: true, status: "disconnected" });
  });

  app.get("/api/gofundme/status", (req, res) => {
    if (!req.session?.isAdmin || !req.session?.twitchUser?.id) {
      return res.status(401).json({ error: "Admin login required" });
    }
    const uid = timerUid(req);
    res.json({
      ...getGoFundMeStatus(uid),
      savedSlug: getUserSettings(uid).gfmSlug || "",
    });
  });
}
