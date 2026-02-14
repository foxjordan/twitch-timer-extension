import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import { logger } from "./logger.js";

function signExtensionJwt(channelId, extra = {}) {
  return jwt.sign(
    {
      exp: Math.floor(Date.now() / 1000) + 60,
      user_id: channelId,
      role: "external",
      channel_id: channelId,
      ...extra,
    },
    Buffer.from(process.env.EXTENSION_SECRET, "base64"),
    { algorithm: "HS256" },
  );
}

export async function broadcastToChannel({ broadcasterId, type, payload }) {
  const token = signExtensionJwt(broadcasterId, {
    pubsub_perms: { broadcast: ["*"] },
  });

  await fetch("https://api.twitch.tv/helix/extensions/pubsub", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": process.env.EXTENSION_CLIENT_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      broadcaster_id: broadcasterId,
      target: ["broadcast"],
      message: JSON.stringify({ type, payload, ts: Date.now() }),
    }),
  });
}

export async function sendExtensionChatMessage({ broadcasterId, text }) {
  const clientId = process.env.EXTENSION_CLIENT_ID;
  const secret = process.env.EXTENSION_SECRET;
  const version = process.env.EXTENSION_VERSION || "0.0.1";
  if (!clientId || !secret) return;

  const token = signExtensionJwt(broadcasterId);

  const res = await fetch(
    `https://api.twitch.tv/helix/extensions/chat?broadcaster_id=${broadcasterId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-Id": clientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        extension_id: clientId,
        extension_version: version,
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    logger.warn("extension_chat_message_failed", {
      status: res.status,
      body,
      broadcasterId,
    });
  }
}
