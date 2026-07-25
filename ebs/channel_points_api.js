import fetch from "node-fetch";
import { logger } from "./logger.js";

const REWARDS_URL = "https://api.twitch.tv/helix/channel_points/custom_rewards";

function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Client-Id": process.env.TWITCH_CLIENT_ID,
    "Content-Type": "application/json",
  };
}

// Twitch caps custom reward titles at 45 characters and requires them to be
// unique per channel (case-insensitive) — prefixing keeps ours identifiable
// among whatever other rewards a streamer already has configured.
function rewardTitleForSound(soundName) {
  const title = `Play: ${soundName || "Sound"}`;
  return title.length > 45 ? title.slice(0, 45) : title;
}

// should_redemptions_skip_request_queue is what makes a redemption fire
// immediately instead of sitting in the streamer's mod-approval queue —
// without it, this wouldn't behave anything like an instant Bits alert.
export async function createChannelPointsReward({ broadcasterId, accessToken, soundName, cost }) {
  if (!accessToken) return { error: "no_access_token" };
  const res = await fetch(`${REWARDS_URL}?broadcaster_id=${encodeURIComponent(broadcasterId)}`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      title: rewardTitleForSound(soundName),
      cost,
      is_enabled: true,
      should_redemptions_skip_request_queue: true,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.warn("channel_points_reward_create_failed", { status: res.status, body, broadcasterId });
    return { error: body?.message || `Twitch API error (${res.status})` };
  }
  const reward = body?.data?.[0];
  if (!reward?.id) return { error: "Unexpected response from Twitch" };
  return { rewardId: reward.id };
}

export async function updateChannelPointsReward({ broadcasterId, accessToken, rewardId, soundName, cost }) {
  if (!accessToken) return { error: "no_access_token" };
  const params = new URLSearchParams({ broadcaster_id: broadcasterId, id: rewardId });
  const patch = {};
  if (typeof cost === "number") patch.cost = cost;
  if (typeof soundName === "string") patch.title = rewardTitleForSound(soundName);
  const res = await fetch(`${REWARDS_URL}?${params.toString()}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn("channel_points_reward_update_failed", { status: res.status, body, broadcasterId, rewardId });
    return { error: `Twitch API error (${res.status})` };
  }
  return { ok: true };
}

export async function deleteChannelPointsReward({ broadcasterId, accessToken, rewardId }) {
  if (!accessToken) return { error: "no_access_token" };
  const params = new URLSearchParams({ broadcaster_id: broadcasterId, id: rewardId });
  const res = await fetch(`${REWARDS_URL}?${params.toString()}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
  // A reward that's already gone (e.g. the streamer deleted it manually on
  // Twitch) isn't a failure from our side — nothing left to clean up.
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "");
    logger.warn("channel_points_reward_delete_failed", { status: res.status, body, broadcasterId, rewardId });
    return { error: `Twitch API error (${res.status})` };
  }
  return { ok: true };
}
