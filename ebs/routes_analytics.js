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

export function mountAnalyticsRoutes(app) {
  // First-party client analytics — replaces the removed Firebase SDK, which
  // caused CSP violations inside Twitch's extension sandbox. Events are
  // fire-and-forget: the client never waits on this beyond a 204.
  app.post("/api/analytics/event", (req, res) => {
    const claims = verifyExtensionJwt(req);
    if (!claims?.channel_id) return res.status(401).end();

    const event = sanitizeString(req.body?.event);
    if (!event) return res.status(400).end();

    const surface = sanitizeString(req.body?.surface);
    const language = sanitizeString(req.body?.language);
    const theme = sanitizeString(req.body?.theme);
    let params = req.body?.params;
    if (params && typeof params === "object") {
      try {
        const json = JSON.stringify(params);
        params = json.length <= 2000 ? json : null;
      } catch {
        params = null;
      }
    } else {
      params = null;
    }

    db.query(
      `INSERT INTO client_events (channel_id, event_name, surface, language, theme, params)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [String(claims.channel_id), event, surface, language, theme, params],
    ).catch((err) => logger.error("client_event_log_failed", { message: err?.message }));

    res.status(204).end();
  });
}
