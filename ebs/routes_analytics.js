import jwt from "jsonwebtoken";
import { db } from "./db.js";
import { logger } from "./logger.js";

const EXT_SECRET = process.env.EXTENSION_SECRET
  ? Buffer.from(process.env.EXTENSION_SECRET, "base64")
  : null;

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

const MAX_STRING_LEN = 100;

function sanitizeString(val) {
  return typeof val === "string" ? val.slice(0, MAX_STRING_LEN) : null;
}

function sanitizeParams(rawParams) {
  if (!rawParams || typeof rawParams !== "object") return null;
  try {
    const json = JSON.stringify(rawParams);
    return json.length <= 2000 ? json : null;
  } catch {
    return null;
  }
}

function insertClientEvent({ channelId, event, surface, language = null, theme = null, params = null }) {
  db.query(
    `INSERT INTO client_events (channel_id, event_name, surface, language, theme, params)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [String(channelId), event, surface, language, theme, params],
  ).catch((err) => logger.error("client_event_log_failed", { message: err?.message }));
}

export function mountAnalyticsRoutes(app) {
  // First-party client analytics — replaces the removed Firebase SDK, which
  // caused CSP violations inside Twitch's extension sandbox. Events are
  // fire-and-forget: the client never waits on this beyond a 204.
  app.post("/api/analytics/event", (req, res) => {
    const claims = verifyExtensionJwt(req);
    if (!claims?.channel_id) return res.status(401).end();

    const event = sanitizeString(req.body?.event);
    if (!event) return res.status(400).end();

    insertClientEvent({
      channelId: claims.channel_id,
      event,
      surface: sanitizeString(req.body?.surface),
      language: sanitizeString(req.body?.language),
      theme: sanitizeString(req.body?.theme),
      params: sanitizeParams(req.body?.params),
    });

    res.status(204).end();
  });

  // Session-authenticated variant for the streamer dashboard (ebs/views
  // pages), which renders outside the extension sandbox and has no
  // extension JWT to verify — it authenticates off the login cookie instead.
  app.post("/api/analytics/dashboard-event", (req, res) => {
    if (!req?.session?.isAdmin) return res.status(401).end();
    const channelId = req.session?.managingAs || req.session?.twitchUser?.id;
    if (!channelId) return res.status(400).end();

    const event = sanitizeString(req.body?.event);
    if (!event) return res.status(400).end();

    insertClientEvent({
      channelId,
      event,
      surface: sanitizeString(req.body?.surface) || "dashboard",
      params: sanitizeParams(req.body?.params),
    });

    res.status(204).end();
  });
}
