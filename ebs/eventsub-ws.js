import WebSocket from 'ws';
import fetch from 'node-fetch';

const WS_URL = 'wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30';

export async function connectEventSubWS({ userAccessToken, clientId, broadcasterId, onEvent }) {
  const ws = new WebSocket(WS_URL);
  let sessionId = null;

  ws.on('message', async (buf) => {
    const msg = JSON.parse(buf.toString());

    if (msg.metadata?.message_type === 'session_welcome') {
      sessionId = msg.payload.session.id;

      const wants = [
        { type: 'channel.subscribe', version: '1' },
        { type: 'channel.subscription.gift', version: '1' },
        { type: 'channel.subscription.message', version: '1' },
        { type: 'channel.bits.use', version: '1' },
        { type: 'channel.charity_campaign.donate', version: '1' },
        { type: 'channel.hype_train.begin', version: '2' },
        { type: 'channel.hype_train.progress', version: '2' },
        { type: 'channel.hype_train.end', version: '2' }
      ];

      for (const { type, version } of wants) {
        try {
          await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
            method: 'POST',
            headers: {
              'Client-Id': clientId,
              'Authorization': `Bearer ${userAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              type, version,
              condition: { broadcaster_user_id: broadcasterId },
              transport: { method: 'websocket', session_id: sessionId }
            })
          });
        } catch (e) {
          console.error('Failed to create subscription', type, e?.message);
        }
      }
    }

    if (msg.metadata?.message_type === 'notification') {
      onEvent(msg);
    }
  });

  ws.on('close', () => {
    console.log('EventSub WS closed');
  });

  return ws;
}
