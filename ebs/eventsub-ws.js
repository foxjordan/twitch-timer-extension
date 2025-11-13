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

      // Subscribe to common channel events. For standard Bits, use channel.cheer.
      const wants = [
        { type: 'channel.subscribe', version: '1' },
        { type: 'channel.subscription.gift', version: '1' },
        { type: 'channel.subscription.message', version: '1' },
        { type: 'channel.cheer', version: '1' },
        // Keep Bits-in-Extensions as optional; if not used, it will simply not fire.
        { type: 'channel.bits.use', version: '1' },
        { type: 'channel.charity_campaign.donate', version: '1' },
        { type: 'channel.hype_train.begin', version: '1' },
        { type: 'channel.hype_train.progress', version: '1' },
        { type: 'channel.hype_train.end', version: '1' },
        { type: 'channel.follow', version: '2' }
      ];

      for (const { type, version } of wants) {
        try {
          const body = {
            type, version,
            condition: { broadcaster_user_id: broadcasterId },
            transport: { method: 'websocket', session_id: sessionId }
          };
          if (type === 'channel.follow') {
            body.condition = { broadcaster_user_id: broadcasterId, moderator_user_id: broadcasterId };
          }
          const r = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
            method: 'POST',
            headers: {
              'Client-Id': clientId,
              'Authorization': `Bearer ${userAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
          });
          if (!r.ok && r.status !== 202) {
            const t = await r.text().catch(() => '');
            console.error('EventSub subscribe failed', { type, version, status: r.status, body: t });
          } else {
            // 202 Accepted is typical; Twitch will send a notification once enabled
            if (process.env.DEBUG) console.log('EventSub subscribe requested', type, version);
          }
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
