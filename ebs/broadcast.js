import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

export async function broadcastToChannel({ broadcasterId, type, payload }) {
  const token = jwt.sign(
    {
      exp: Math.floor(Date.now() / 1000) + 60,
      user_id: broadcasterId,
      role: 'external',
      channel_id: broadcasterId,
      pubsub_perms: { broadcast: ['*'] }
    },
    Buffer.from(process.env.EXTENSION_SECRET, 'base64'),
    { algorithm: 'HS256' }
  );

  await fetch('https://api.twitch.tv/helix/extensions/pubsub', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Client-Id': process.env.EXTENSION_CLIENT_ID,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      broadcaster_id: broadcasterId,
      target: ['broadcast'],
      message: JSON.stringify({ type, payload, ts: Date.now() })
    })
  });
}
