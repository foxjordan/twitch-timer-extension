import WebSocket from 'ws';
import fetch from 'node-fetch';
import { logger } from './logger.js';

const WS_URL = 'wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30';

export async function connectEventSubWS({
  userAccessToken,
  clientId,
  broadcasterId,
  onEvent,
  onStatus,
  url = WS_URL,
}) {
  const ws = new WebSocket(url);
  let sessionId = null;

  const emitStatus = (status) => {
    try {
      if (typeof onStatus === 'function') onStatus(status);
    } catch {}
  };

  ws.on('open', () => {
    emitStatus({ type: 'open', url });
  });

  ws.on('message', async (buf) => {
    const msg = JSON.parse(buf.toString());
    const messageType = msg?.metadata?.message_type;

    if (messageType === 'session_keepalive') {
      emitStatus({ type: 'keepalive' });
      return;
    }

    if (messageType === 'session_reconnect') {
      emitStatus({
        type: 'session_reconnect',
        reconnectUrl: msg?.payload?.session?.reconnect_url,
      });
      return;
    }

    if (messageType === 'session_welcome') {
      sessionId = msg.payload.session.id;
      emitStatus({
        type: 'welcome',
        sessionId,
        keepaliveTimeout: msg?.payload?.session?.keepalive_timeout_seconds,
      });

      // Subscribe to common channel events. For standard Bits, use channel.cheer.
      const wants = [
        { type: 'channel.subscribe', version: '1' },
        { type: 'channel.subscription.gift', version: '1' },
        { type: 'channel.subscription.message', version: '1' },
        { type: 'channel.cheer', version: '1' },
        // Skip channel.bits.use to avoid double-counting standard Cheers; enable later if running a Bits-in-Extensions flow.
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
            const info = { type, version, status: r.status, body: t };
            logger.error('eventsub_subscription_failed', info);
            emitStatus({ type: 'subscription_failed', info });
          } else {
            // 202 Accepted is typical; Twitch will send a notification once enabled
            if (process.env.DEBUG) logger.debug('eventsub_subscription_requested', { type, version });
          }
        } catch (e) {
          logger.error('eventsub_subscription_exception', { type, message: e?.message });
          emitStatus({ type: 'subscription_exception', info: { type, message: e?.message } });
        }
      }
    }

    if (messageType === 'notification') {
      onEvent(msg);
      return;
    }

    if (messageType === 'revocation') {
      emitStatus({
        type: 'revocation',
        subscription: msg?.payload?.subscription,
      });
    }
  });

  ws.on('error', (err) => {
    logger.error('eventsub_ws_error_event', { message: err?.message });
    emitStatus({ type: 'socket_error', message: err?.message });
  });

  ws.on('close', () => {
    logger.warn('eventsub_ws_closed');
    emitStatus({ type: 'closed' });
  });

  return ws;
}
