import { logger } from "./logger.js";
import {
  connectStreamElements,
  disconnectStreamElements,
  getStreamElementsStatus,
} from "./streamelements.js";

export function mountStreamElementsRoutes(app, ctx) {
  const {
    getUserSettings,
    setUserSettings,
    handleStreamElementsTip,
  } = ctx;

  // Connect to StreamElements
  app.post("/api/streamelements/connect", (req, res) => {
    if (!req.session?.isAdmin || !req.session?.twitchUser?.id) {
      return res.status(401).json({ error: "Admin login required" });
    }
    const uid = String(req.session.twitchUser.id);
    const jwtToken = req.body?.jwtToken;
    if (!jwtToken || typeof jwtToken !== "string" || jwtToken.length < 10) {
      return res.status(400).json({ error: "Valid StreamElements JWT token required" });
    }

    // Store the token in user settings
    setUserSettings(uid, { seJwtToken: jwtToken });

    // Connect to SE realtime
    connectStreamElements(uid, jwtToken, (tip) => {
      handleStreamElementsTip(uid, tip);
    });

    logger.info("se_connect_requested", { userId: uid });
    res.json({ ok: true, status: "connecting" });
  });

  // Disconnect from StreamElements
  app.post("/api/streamelements/disconnect", (req, res) => {
    if (!req.session?.isAdmin || !req.session?.twitchUser?.id) {
      return res.status(401).json({ error: "Admin login required" });
    }
    const uid = String(req.session.twitchUser.id);
    disconnectStreamElements(uid);
    // Clear stored token
    setUserSettings(uid, { seJwtToken: "" });
    logger.info("se_disconnect_requested", { userId: uid });
    res.json({ ok: true, status: "disconnected" });
  });

  // Get StreamElements connection status
  app.get("/api/streamelements/status", (req, res) => {
    if (!req.session?.isAdmin || !req.session?.twitchUser?.id) {
      return res.status(401).json({ error: "Admin login required" });
    }
    const uid = String(req.session.twitchUser.id);
    const status = getStreamElementsStatus(uid);
    const settings = getUserSettings(uid);
    res.json({
      ...status,
      hasToken: Boolean(settings.seJwtToken),
    });
  });
}
