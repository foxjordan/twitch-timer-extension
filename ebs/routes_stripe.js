import Stripe from "stripe";
import express from "express";
import { logger } from "./logger.js";
import { getBaseUrl } from "./base_url.js";
import {
  getSubscription,
  setSubscription,
  findUserByCustomerId,
} from "./subscription_store.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const PRO_PRICES = {
  monthly:   "price_1T6ZmcB5ZaYWBgZ8WfbZorXC",
  biannual:  "price_1T6ZmcB5ZaYWBgZ8cAbTAw8o",
  yearly:    "price_1T6ZmcB5ZaYWBgZ8tskDiYGx",
  lifetime:  "price_1T6ZpnB5ZaYWBgZ8U32PEAIx",
};
const VALID_PRICE_IDS = new Set(Object.values(PRO_PRICES));
const DEFAULT_PRICE_ID = PRO_PRICES.monthly;

/**
 * Mount the webhook route BEFORE express.json() so the raw body is available
 * for Stripe signature verification.
 */
export function mountStripeWebhookRoute(app) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          req.headers["stripe-signature"],
          WEBHOOK_SECRET,
        );
      } catch (err) {
        logger.warn("stripe_webhook_signature_failed", { message: err?.message });
        return res.status(400).send("Webhook signature verification failed");
      }

      try {
        await handleWebhookEvent(event);
      } catch (err) {
        logger.error("stripe_webhook_handler_error", { type: event.type, message: err?.message });
      }

      res.json({ received: true });
    },
  );
}

/**
 * Mount checkout and portal routes (require session auth).
 */
export function mountStripeRoutes(app) {
  // Create a Stripe Checkout session and redirect
  app.post("/api/stripe/checkout", async (req, res) => {
    if (!req.session?.isAdmin || !req.session?.twitchUser?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const uid = String(req.session.twitchUser.id);
    const base = getBaseUrl(req);

    try {
      const plan = req.body?.plan || req.query?.plan;
      const priceId = PRO_PRICES[plan] || DEFAULT_PRICE_ID;
      if (!VALID_PRICE_IDS.has(priceId)) {
        return res.status(400).json({ error: "Invalid plan" });
      }

      const isLifetime = priceId === PRO_PRICES.lifetime;
      const customerId = await getOrCreateCustomer(uid, req.session.twitchUser);

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: isLifetime ? "payment" : "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${base}/sounds/config?checkout=success`,
        cancel_url: `${base}/sounds/config?checkout=cancel`,
      });

      res.redirect(303, session.url);
    } catch (err) {
      logger.error("stripe_checkout_error", { userId: uid, message: err?.message });
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Redirect to Stripe Customer Portal
  app.get("/api/stripe/portal", async (req, res) => {
    if (!req.session?.isAdmin || !req.session?.twitchUser?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const uid = String(req.session.twitchUser.id);
    const sub = getSubscription(uid);

    if (!sub?.stripeCustomerId) {
      return res.status(400).json({ error: "No subscription found" });
    }

    const base = getBaseUrl(req);

    try {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${base}/sounds/config`,
      });

      res.redirect(303, portalSession.url);
    } catch (err) {
      logger.error("stripe_portal_error", { userId: uid, message: err?.message });
      res.status(500).json({ error: "Failed to create portal session" });
    }
  });
}

/**
 * Look up or create a Stripe Customer linked to a Twitch user.
 */
async function getOrCreateCustomer(uid, twitchUser) {
  const existing = getSubscription(uid);
  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    metadata: { twitchUserId: uid },
    name: twitchUser.display_name || twitchUser.login || undefined,
  });

  setSubscription(uid, { stripeCustomerId: customer.id });
  logger.info("stripe_customer_created", { userId: uid, customerId: customer.id });
  return customer.id;
}

/**
 * Process a Stripe webhook event.
 */
async function handleWebhookEvent(event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const customerId = session.customer;
      const uid = await resolveUserId(customerId);
      if (!uid) break;

      if (session.mode === "payment") {
        // Lifetime / one-time purchase
        setSubscription(uid, {
          stripeCustomerId: customerId,
          subscriptionId: null,
          status: "active",
          currentPeriodEnd: null,
          lifetime: true,
        });
        logger.info("stripe_lifetime_purchased", { userId: uid });
        break;
      }

      if (session.mode !== "subscription") break;
      const subscriptionId = session.subscription;

      // Fetch the full subscription to get status and period
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      setSubscription(uid, {
        stripeCustomerId: customerId,
        subscriptionId,
        status: sub.status,
        currentPeriodEnd: sub.current_period_end,
      });
      logger.info("stripe_subscription_created", { userId: uid, subscriptionId, status: sub.status });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object;
      const uid = await resolveUserId(sub.customer);
      if (!uid) break;

      setSubscription(uid, {
        subscriptionId: sub.id,
        status: sub.status,
        currentPeriodEnd: sub.current_period_end,
      });
      logger.info("stripe_subscription_updated", { userId: uid, status: sub.status });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const uid = await resolveUserId(sub.customer);
      if (!uid) break;

      setSubscription(uid, {
        subscriptionId: sub.id,
        status: "canceled",
        currentPeriodEnd: sub.current_period_end,
      });
      logger.info("stripe_subscription_deleted", { userId: uid });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const uid = await resolveUserId(invoice.customer);
      if (!uid) break;

      setSubscription(uid, { status: "past_due" });
      logger.info("stripe_payment_failed", { userId: uid });
      break;
    }
  }
}

/**
 * Resolve a Stripe customer ID to a Twitch user ID.
 * First checks local store, then falls back to Stripe customer metadata.
 */
async function resolveUserId(stripeCustomerId) {
  // Check local cache first
  const local = findUserByCustomerId(stripeCustomerId);
  if (local) return local;

  // Fall back to Stripe metadata
  try {
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    return customer.metadata?.twitchUserId || null;
  } catch {
    return null;
  }
}

/**
 * Sync subscription state from Stripe for a given user.
 * Called on login to reconcile local cache with Stripe.
 */
export async function syncSubscriptionFromStripe(userId) {
  const uid = String(userId);
  const sub = getSubscription(uid);
  if (!sub?.stripeCustomerId) return;
  // Lifetime purchases don't have subscriptions to sync
  if (sub.lifetime) return;

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: sub.stripeCustomerId,
      status: "all",
      limit: 1,
    });

    const active = subscriptions.data[0];
    if (active) {
      setSubscription(uid, {
        subscriptionId: active.id,
        status: active.status,
        currentPeriodEnd: active.current_period_end,
      });
    } else if (sub.status === "active" || sub.status === "trialing") {
      // No subscriptions found but we thought they were active — mark canceled
      setSubscription(uid, { status: "canceled" });
    }
  } catch (err) {
    logger.warn("stripe_sync_error", { userId: uid, message: err?.message });
  }
}
