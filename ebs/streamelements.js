import { io } from "socket.io-client";
import { logger } from "./logger.js";

const SE_REALTIME_URL = "https://realtime.streamelements.com";

// Per-user SE connections: userId -> { socket, jwtToken, channelId, status }
const connections = new Map();

/**
 * Connect to StreamElements realtime socket for a given user.
 * @param {string} userId - Twitch user ID (our internal key)
 * @param {string} jwtToken - StreamElements JWT token from user's SE dashboard
 * @param {function} onTip - callback({ amount, currency, username, message }) called on tip events
 * @returns {{ status: string }}
 */
export function connectStreamElements(userId, jwtToken, onTip) {
  const uid = String(userId);

  // Disconnect existing connection first
  disconnectStreamElements(uid);

  const socket = io(SE_REALTIME_URL, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 5000,
  });

  const conn = {
    socket,
    jwtToken,
    status: "connecting",
    connectedAt: null,
    lastTipAt: null,
    tipCount: 0,
    error: null,
  };
  connections.set(uid, conn);

  socket.on("connect", () => {
    logger.info("se_socket_connected", { userId: uid });
    socket.emit("authenticate", { method: "jwt", token: jwtToken });
  });

  socket.on("authenticated", (data) => {
    conn.status = "connected";
    conn.connectedAt = new Date().toISOString();
    conn.channelId = data?.channelId || null;
    conn.error = null;
    logger.info("se_authenticated", { userId: uid, channelId: conn.channelId });
  });

  socket.on("unauthorized", (err) => {
    conn.status = "auth_failed";
    conn.error = err?.message || "Authentication failed";
    logger.error("se_auth_failed", { userId: uid, error: conn.error });
    // Don't auto-reconnect on auth failure
    socket.disconnect();
  });

  socket.on("event:test", (data) => {
    // Test events from SE dashboard - handle the same way for testing
    if (data?.listener === "tip-latest") {
      handleTipEvent(uid, conn, data.event, onTip);
    }
  });

  socket.on("event", (data) => {
    if (data?.type === "tip") {
      handleTipEvent(uid, conn, data.data, onTip);
    }
  });

  socket.on("disconnect", (reason) => {
    conn.status = "disconnected";
    logger.warn("se_socket_disconnected", { userId: uid, reason });
  });

  socket.on("reconnect", () => {
    logger.info("se_socket_reconnected", { userId: uid });
    socket.emit("authenticate", { method: "jwt", token: jwtToken });
  });

  socket.on("connect_error", (err) => {
    conn.status = "error";
    conn.error = err?.message || "Connection error";
    logger.error("se_socket_error", { userId: uid, error: conn.error });
  });

  return { status: "connecting" };
}

function handleTipEvent(userId, conn, event, onTip) {
  if (!event) return;
  const amount = Number(event.amount);
  if (!Number.isFinite(amount) || amount <= 0) return;

  conn.lastTipAt = new Date().toISOString();
  conn.tipCount++;

  const tip = {
    amount,
    currency: event.currency || "USD",
    username: event.username || event.name || "Anonymous",
    message: event.message || "",
  };

  logger.info("se_tip_received", {
    userId,
    amount: tip.amount,
    currency: tip.currency,
    username: tip.username,
  });

  try {
    onTip(tip);
  } catch (err) {
    logger.error("se_tip_handler_error", { userId, error: err?.message });
  }
}

/**
 * Disconnect a user's StreamElements socket.
 */
export function disconnectStreamElements(userId) {
  const uid = String(userId);
  const conn = connections.get(uid);
  if (!conn) return false;
  try {
    conn.socket.disconnect();
  } catch {}
  connections.delete(uid);
  logger.info("se_disconnected", { userId: uid });
  return true;
}

/**
 * Get connection status for a user.
 */
export function getStreamElementsStatus(userId) {
  const conn = connections.get(String(userId));
  if (!conn) return { connected: false, status: "disconnected" };
  return {
    connected: conn.status === "connected",
    status: conn.status,
    channelId: conn.channelId || null,
    connectedAt: conn.connectedAt,
    lastTipAt: conn.lastTipAt,
    tipCount: conn.tipCount,
    error: conn.error,
  };
}

/**
 * Check if a user has an active SE connection.
 */
export function isStreamElementsConnected(userId) {
  const conn = connections.get(String(userId));
  return conn?.status === "connected";
}

/**
 * Disconnect all SE connections (for graceful shutdown).
 */
export function disconnectAllStreamElements() {
  for (const [uid] of connections) {
    disconnectStreamElements(uid);
  }
}
