import { deleteUserProfile, getEventSubWebhookSubIds } from "./user_profiles.js";
import { removeStreamStatusWebhookSubs } from "./eventsub_webhook.js";
import { getAppAccessToken } from "./twitch_api.js";
import { removeSubscription } from "./subscription_store.js";
import { unbanUser } from "./bans.js";
import { deleteAllSounds } from "./sounds_store.js";
import { deleteTtsSettings } from "./tts_store.js";
import { deleteAllGoals } from "./goals_store.js";
import { deleteRules } from "./rules_store.js";
import { deletePlinkoConfig } from "./plinko_store.js";
import { deleteStyle } from "./styles.js";
import { deleteUserKey } from "./keys.js";
import { deleteTimerState } from "./state.js";
import { deleteUserAccessToken } from "./twitch_tokens.js";
import { clearLogEntries } from "./event_log.js";
import { logger } from "./logger.js";
import { db } from "./db.js";

/**
 * Delete all data associated with a user across every store.
 * Handles both in-memory state and persisted JSON files / uploaded content.
 *
 * @param {string} userId - Twitch user ID
 * @param {object} [ctx] - Optional server context for runtime cleanup
 * @param {Map} [ctx.userSettings] - The userSettings Map from server.js
 * @param {Function} [ctx.persistUserSettings] - Persist function for userSettings
 * @param {Map} [ctx.broadcasterConnections] - Active EventSub connections
 * @param {Set} [ctx.sseClients] - Active SSE clients
 * @param {Function} [ctx.closeEventSubForUser] - Close EventSub for a user
 * @returns {Promise<{ deleted: string[] }>} List of stores that had data deleted
 */
export async function deleteAllUserData(userId, ctx = {}) {
  const uid = String(userId);
  const deleted = [];

  // 1. EventSub webhook subscriptions (stream.online/offline) — must read
  // these off the profile before deleteUserProfile below removes it. Avoids
  // accumulating dead subscriptions against the app's subscription-count
  // limits on Twitch's side; best-effort, doesn't block the rest of deletion.
  const webhookSubIds = getEventSubWebhookSubIds(uid);
  if (webhookSubIds.length > 0) {
    try {
      await removeStreamStatusWebhookSubs(webhookSubIds, { getAppAccessToken });
      deleted.push("eventSubWebhookSubs");
    } catch (err) {
      logger.error("delete_eventsub_webhook_subs_failed", { userId: uid, message: err?.message });
    }
  }

  // 2. User profile
  if (deleteUserProfile(uid)) deleted.push("profile");

  // 3. Subscription record
  if (removeSubscription(uid)) deleted.push("subscription");

  // 4. Ban record
  if (unbanUser(uid)) deleted.push("ban");

  // 5. Sound alerts + uploaded files on disk
  try {
    if (await deleteAllSounds(uid)) deleted.push("sounds");
  } catch (err) {
    logger.error("delete_sounds_failed", { userId: uid, error: err.message });
  }

  // 6. TTS settings
  if (deleteTtsSettings(uid)) deleted.push("ttsSettings");

  // 7. Goals
  if (deleteAllGoals(uid)) deleted.push("goals");

  // 8. Timer rules
  if (deleteRules(uid)) deleted.push("rules");

  // 8b. Plinko board config
  if (deletePlinkoConfig(uid)) deleted.push("plinko");

  // Analytics events (first-party client_events table)
  try {
    const r = await db.query("DELETE FROM client_events WHERE channel_id = $1", [uid]);
    if (r.rowCount > 0) deleted.push("clientEvents");
  } catch (err) {
    logger.error("delete_client_events_failed", { userId: uid, message: err?.message });
  }

  // 9. Overlay styles
  if (deleteStyle(uid)) deleted.push("styles");

  // 10. Overlay keys
  if (deleteUserKey(uid)) deleted.push("overlayKey");

  // 11. Timer state
  if (deleteTimerState(uid)) deleted.push("timerState");

  // 12. Access tokens (in-memory only)
  deleteUserAccessToken(uid);
  deleted.push("accessToken");

  // 13. Event log entries (persisted in Postgres)
  await clearLogEntries(uid);
  deleted.push("eventLog");

  // 14. User settings (owned by server.js, passed via ctx)
  if (ctx.userSettings) {
    const existed = ctx.userSettings.has(uid);
    ctx.userSettings.delete(uid);
    if (existed) {
      deleted.push("userSettings");
      if (ctx.persistUserSettings) ctx.persistUserSettings().catch(() => {});
    }
  }

  // 15. Close active connections
  if (ctx.closeEventSubForUser) {
    try { ctx.closeEventSubForUser(uid); } catch {}
  }
  if (ctx.broadcasterConnections) {
    ctx.broadcasterConnections.delete(uid);
  }
  if (ctx.sseClients) {
    for (const client of Array.from(ctx.sseClients)) {
      if (String(client.timerUserId) === uid) {
        try { client.res.end(); } catch {}
        ctx.sseClients.delete(client);
      }
    }
  }

  logger.info("user_data_deleted", { userId: uid, stores: deleted });
  return { deleted };
}
