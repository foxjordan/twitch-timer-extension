import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { logger } from './logger.js';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const TOKENS_PATH = path.resolve(DATA_DIR, 'twitch-tokens.enc.json');

// Encryption key derived from TWITCH_CLIENT_SECRET (always available).
// Tokens at rest are AES-256-GCM encrypted so the file alone is not useful.
const ENC_KEY_SOURCE = process.env.TWITCH_CLIENT_SECRET || 'default-key';
const ENC_KEY = crypto.createHash('sha256').update(ENC_KEY_SOURCE).digest();

const accessTokens = new Map();

// Track in-flight refresh promises to avoid duplicate refresh calls
const refreshInFlight = new Map();

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(data) {
  const [ivHex, tagHex, encHex] = data.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}

export function storeUserAccessToken(uid, token, expiresIn, refreshToken) {
  if (!uid || !token) return;
  const ttl = Number(expiresIn) || 0;
  const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
  const existing = accessTokens.get(String(uid));
  accessTokens.set(String(uid), {
    token,
    expiresAt,
    // Keep existing refresh token if a new one isn't provided
    refreshToken: refreshToken || existing?.refreshToken || null,
  });
}

export function deleteUserAccessToken(uid) {
  accessTokens.delete(String(uid));
}

export function getUserAccessToken(uid) {
  const entry = accessTokens.get(String(uid));
  if (!entry) return null;
  if (entry.expiresAt && Date.now() >= entry.expiresAt - 60000) {
    // Token expired — kick off background refresh if we have a refresh token
    if (entry.refreshToken) {
      refreshAccessToken(String(uid)).catch(() => {});
    }
    return null;
  }
  return entry.token;
}

/**
 * Refresh a user's access token using their stored refresh token.
 * Returns the new access token, or null on failure.
 */
export async function refreshAccessToken(uid) {
  uid = String(uid);
  const entry = accessTokens.get(uid);
  if (!entry?.refreshToken) return null;

  // Deduplicate concurrent refresh calls for the same user
  if (refreshInFlight.has(uid)) return refreshInFlight.get(uid);

  const promise = (async () => {
    try {
      const clientId = process.env.TWITCH_CLIENT_ID;
      const clientSecret = process.env.TWITCH_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        logger.error('token_refresh_missing_env', { uid });
        return null;
      }

      const res = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: entry.refreshToken,
        }),
      });

      const json = await res.json();
      if (!json.access_token) {
        logger.error('token_refresh_failed', { uid, error: json.error, message: json.message });
        // If refresh token is invalid/revoked, clean up
        if (json.error === 'invalid_grant' || json.status === 400) {
          accessTokens.delete(uid);
        }
        return null;
      }

      const ttl = Number(json.expires_in) || 0;
      const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
      accessTokens.set(uid, {
        token: json.access_token,
        expiresAt,
        refreshToken: json.refresh_token || entry.refreshToken,
      });

      logger.info('token_refreshed', { uid, expiresIn: json.expires_in });
      return json.access_token;
    } catch (e) {
      logger.error('token_refresh_exception', { uid, message: e?.message });
      return null;
    } finally {
      refreshInFlight.delete(uid);
    }
  })();

  refreshInFlight.set(uid, promise);
  return promise;
}

/** Returns all user IDs that have a valid access token or a refresh token. */
export function getAllTokenUserIds() {
  const ids = [];
  for (const [uid, entry] of accessTokens) {
    // Include users with unexpired tokens OR with a refresh token
    const expired = entry.expiresAt && Date.now() >= entry.expiresAt - 60000;
    if (!expired || entry.refreshToken) {
      ids.push(uid);
    }
  }
  return ids;
}

/** Persist tokens to disk (encrypted). Called during graceful shutdown. */
export async function persistTokens() {
  try {
    const obj = {};
    for (const [uid, entry] of accessTokens) {
      // Keep entries that have a refresh token even if access token is expired
      const expired = entry.expiresAt && Date.now() >= entry.expiresAt - 60000;
      if (expired && !entry.refreshToken) continue;
      obj[uid] = {
        token: encrypt(entry.token),
        expiresAt: entry.expiresAt,
        refreshToken: entry.refreshToken ? encrypt(entry.refreshToken) : null,
      };
    }
    await writeFile(TOKENS_PATH, JSON.stringify(obj, null, 2), 'utf-8');
    logger.info('tokens_persisted', { count: Object.keys(obj).length });
  } catch (e) {
    logger.error('tokens_persist_failed', { message: e?.message });
  }
}

/** Load persisted tokens from disk. Called on startup. */
export async function loadTokens() {
  try {
    const raw = await readFile(TOKENS_PATH, 'utf-8');
    const obj = JSON.parse(raw);
    let loaded = 0;
    for (const [uid, entry] of Object.entries(obj)) {
      if (!entry || !entry.token) continue;
      try {
        const token = decrypt(entry.token);
        const refreshToken = entry.refreshToken ? decrypt(entry.refreshToken) : null;
        // Load even if expired — we can refresh it
        const expired = entry.expiresAt && Date.now() >= entry.expiresAt - 60000;
        if (expired && !refreshToken) continue;
        accessTokens.set(String(uid), { token, expiresAt: entry.expiresAt, refreshToken });
        loaded++;
      } catch {
        // Decryption failed (key changed, corrupted) – skip this token
      }
    }
    if (loaded > 0) logger.info('tokens_loaded', { count: loaded });
  } catch {
    // File doesn't exist on first boot – that's fine
  }
}
