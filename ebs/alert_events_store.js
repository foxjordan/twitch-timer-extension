import { db } from './db.js';
import { logger } from './logger.js';

function parseBitsFromTier(tier) {
  if (!tier) return null;
  const n = parseInt(tier.replace(/^[^_]+_/, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export function logSoundEvent({
  channelId, viewerUserId, soundId, soundName, alertType,
  tier, txId, clipSlug, eventKind, failureReason,
}) {
  db.query(
    `INSERT INTO sound_alert_events
       (channel_id, viewer_user_id, sound_id, sound_name, alert_type,
        bits_amount, tx_id, clip_slug, event_kind, failure_reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      channelId, viewerUserId || null, soundId, soundName || soundId,
      alertType || 'sound', parseBitsFromTier(tier), txId || null,
      clipSlug || null, eventKind, failureReason || null,
    ],
  ).catch(err => logger.error('alert_event_log_failed', { table: 'sound_alert_events', message: err?.message }));
}

export function logTtsEvent({
  channelId, viewerUserId, voiceId, voiceName,
  message, tier, txId, eventKind, rejectionReason,
}) {
  db.query(
    `INSERT INTO tts_events
       (channel_id, viewer_user_id, voice_id, voice_name, message,
        bits_amount, tx_id, event_kind, rejection_reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      channelId, viewerUserId || null, voiceId || null, voiceName || null,
      message || null, parseBitsFromTier(tier), txId || null,
      eventKind, rejectionReason || null,
    ],
  ).catch(err => logger.error('alert_event_log_failed', { table: 'tts_events', message: err?.message }));
}
