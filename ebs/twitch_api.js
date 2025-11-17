import fetch from "node-fetch";
import { getUserAccessToken } from "./twitch_tokens.js";
import { logger } from "./logger.js";

export async function fetchActiveSubscriberCount({ broadcasterId }) {
  const id = broadcasterId ? String(broadcasterId) : null;
  if (!id) return null;
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) return null;
  const token =
    getUserAccessToken(id) || process.env.BROADCASTER_USER_TOKEN || null;
  if (!token) return null;
  const url = new URL("https://api.twitch.tv/helix/subscriptions");
  url.searchParams.set("broadcaster_id", id);
  url.searchParams.set("first", "1");
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "Client-Id": clientId,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      logger.warn("twitch_subs_fetch_failed", {
        status: res.status,
        body,
      });
      return null;
    }
    const json = await res.json();
    if (typeof json.total === "number") return json.total;
    return null;
  } catch (err) {
    logger.error("twitch_subs_fetch_error", { message: err?.message });
    return null;
  }
}
