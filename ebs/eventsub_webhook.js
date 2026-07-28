import crypto from "crypto";
import fetch from "node-fetch";
import express from "express";
import { logger } from "./logger.js";

const HELIX_SUBS_URL = "https://api.twitch.tv/helix/eventsub/subscriptions";

function webhookCallbackUrl() {
  return process.env.EVENTSUB_WEBHOOK_CALLBACK_URL || "https://livestreamerhub.com/api/eventsub/webhook";
}

// Creates stream.online + stream.offline webhook subscriptions for a
// broadcaster, authenticated with the app access token (not the
// broadcaster's own token — webhook subs don't need a per-user connection
// at all, which is the whole point of this transport over websocket).
// Safe to call unconditionally on every login and every boot-restore: a 409
// (duplicate active subscription for this exact type+condition+transport)
// is treated as success rather than tracking subscription state ourselves.
// Returns the subscription ids actually created this call (empty for 409s),
// for optional cleanup bookkeeping by the caller.
export async function ensureStreamStatusWebhookSubs(broadcasterId, { getAppAccessToken }) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.EVENTSUB_WEBHOOK_SECRET;
  const callback = webhookCallbackUrl();
  if (!clientId || !secret) {
    logger.error("eventsub_webhook_subs_missing_config", { broadcasterId });
    return [];
  }
  const token = await getAppAccessToken();
  if (!token) return [];

  const createdIds = [];
  for (const type of ["stream.online", "stream.offline"]) {
    try {
      const res = await fetch(HELIX_SUBS_URL, {
        method: "POST",
        headers: {
          "Client-Id": clientId,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          version: "1",
          condition: { broadcaster_user_id: String(broadcasterId) },
          transport: { method: "webhook", callback, secret },
        }),
      });
      if (res.status === 409) continue; // already subscribed — fine
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        logger.error("eventsub_webhook_sub_create_failed", { broadcasterId, type, status: res.status, body });
        continue;
      }
      const json = await res.json().catch(() => null);
      const id = json?.data?.[0]?.id;
      if (id) createdIds.push(id);
    } catch (e) {
      logger.error("eventsub_webhook_sub_create_exception", { broadcasterId, type, message: e?.message });
    }
  }
  return createdIds;
}

// Deletes previously-created webhook subscriptions by id — used for GDPR
// account deletion so we don't accumulate dead subscriptions against the
// app's subscription-count limits over time.
export async function removeStreamStatusWebhookSubs(subscriptionIds, { getAppAccessToken }) {
  if (!subscriptionIds || subscriptionIds.length === 0) return;
  const clientId = process.env.TWITCH_CLIENT_ID;
  const token = await getAppAccessToken();
  if (!clientId || !token) return;

  for (const id of subscriptionIds) {
    try {
      const url = new URL(HELIX_SUBS_URL);
      url.searchParams.set("id", id);
      await fetch(url.toString(), {
        method: "DELETE",
        headers: { "Client-Id": clientId, Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      logger.error("eventsub_webhook_sub_delete_exception", { id, message: e?.message });
    }
  }
}

function verifySignature(messageId, timestamp, rawBody, signatureHeader) {
  const secret = process.env.EVENTSUB_WEBHOOK_SECRET;
  if (!secret || !signatureHeader || !messageId || !timestamp) return false;
  const hmac = crypto.createHmac("sha256", secret).update(messageId + timestamp + rawBody).digest("hex");
  const expected = `sha256=${hmac}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signatureHeader));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Mounts the EventSub webhook receiver. Must be mounted BEFORE
// app.use(express.json()) — Twitch's signature is computed over the raw
// request body, same reasoning as the existing Stripe webhook route
// (routes_stripe.js), which this mirrors.
export function mountEventSubWebhookRoute(app, { onStreamOnline, onStreamOffline, seen }) {
  app.post(
    "/api/eventsub/webhook",
    express.raw({ type: "application/json" }),
    (req, res) => {
      const messageId = req.header("Twitch-Eventsub-Message-Id");
      const timestamp = req.header("Twitch-Eventsub-Message-Timestamp");
      const signature = req.header("Twitch-Eventsub-Message-Signature");
      const messageType = req.header("Twitch-Eventsub-Message-Type");
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body || "");

      if (!verifySignature(messageId, timestamp, rawBody, signature)) {
        logger.warn("eventsub_webhook_bad_signature", { messageId, hasSignature: Boolean(signature) });
        return res.status(403).send("Invalid signature");
      }

      // Twitch redelivers on non-2xx / timeout, and may occasionally
      // redeliver even after a 200 — dedup by message id. Reuses the same
      // Map (and existing 10-min sweep) server.js already keeps for
      // WS-notification dedup rather than adding a second store.
      if (seen.has(messageId)) return res.status(200).send("OK");
      seen.set(messageId, Date.now() + 24 * 3600 * 1000);

      let payload;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return res.status(400).send("Bad JSON");
      }

      if (messageType === "webhook_callback_verification") {
        // One-time dance at subscription-creation time — must echo the
        // challenge back as plain text within a few seconds.
        res.set("Content-Type", "text/plain");
        return res.status(200).send(payload.challenge);
      }

      if (messageType === "revocation") {
        logger.warn("eventsub_webhook_revoked", {
          type: payload?.subscription?.type,
          status: payload?.subscription?.status,
          broadcasterId: payload?.subscription?.condition?.broadcaster_user_id,
        });
        return res.status(200).send("OK");
      }

      if (messageType === "notification") {
        // Ack immediately — Twitch expects a fast 2xx and treats a slow
        // response as a delivery failure. Actual work happens after.
        res.status(200).send("OK");
        const subType = payload?.subscription?.type;
        const broadcasterId = payload?.event?.broadcaster_user_id;
        if (!broadcasterId) return;
        try {
          if (subType === "stream.online") onStreamOnline(String(broadcasterId));
          else if (subType === "stream.offline") onStreamOffline(String(broadcasterId));
        } catch (e) {
          logger.error("eventsub_webhook_handler_error", { subType, broadcasterId, message: e?.message });
        }
        return;
      }

      res.status(200).send("OK");
    },
  );
}
