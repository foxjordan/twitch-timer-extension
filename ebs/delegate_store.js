import { db } from './db.js';

export async function addDelegate(channelId, delegateUserId, grantedBy) {
  await db.query(
    `INSERT INTO channel_delegates (channel_id, delegate_user_id, granted_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (channel_id, delegate_user_id) DO NOTHING`,
    [String(channelId), String(delegateUserId), String(grantedBy)],
  );
}

export async function removeDelegate(channelId, delegateUserId) {
  await db.query(
    `DELETE FROM channel_delegates WHERE channel_id = $1 AND delegate_user_id = $2`,
    [String(channelId), String(delegateUserId)],
  );
}

export async function listDelegates(channelId) {
  const res = await db.query(
    `SELECT delegate_user_id, granted_at FROM channel_delegates
      WHERE channel_id = $1 ORDER BY granted_at`,
    [String(channelId)],
  );
  return res.rows;
}

export async function getDelegatableChannels(userId) {
  const res = await db.query(
    `SELECT channel_id, granted_at FROM channel_delegates
      WHERE delegate_user_id = $1 ORDER BY granted_at`,
    [String(userId)],
  );
  return res.rows;
}

export async function isDelegate(channelId, userId) {
  const res = await db.query(
    `SELECT 1 FROM channel_delegates
      WHERE channel_id = $1 AND delegate_user_id = $2 LIMIT 1`,
    [String(channelId), String(userId)],
  );
  return res.rows.length > 0;
}
