import crypto from 'crypto';
import fetch from 'node-fetch';
import { logger } from './logger.js';
import { db } from './db.js';

// Encryption key derived from TWITCH_CLIENT_SECRET (always available).
// Tokens are AES-256-GCM encrypted before being stored in Postgres so a DB
// leak alone is not enough to compromise tokens. The same scheme was used by
// the previous file-backed implementation, so existing ciphertexts migrate
// over unchanged.
const ENC_KEY_SOURCE = process.env.TWITCH_CLIENT_SECRET || 'default-key';
const ENC_KEY = crypto.createHash('sha256').update(ENC_KEY_SOURCE).digest();

// Hot in-memory cache of decrypted tokens. All read paths (getUserAccessToken,
// getValidAccessToken, getAllTokenUserIds) hit this Map so per-request
// hot-path latency stays unchanged. Writes go through to Postgres so any
// crash/restart loses zero tokens.
const accessTokens = new Map();

// Track in-flight refresh promises to avoid duplicate refresh calls for the
// same user when many parallel requests notice the same expired token.
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

async function writeTokenToDb(uid, entry) {
  try {
    const access = encrypt(entry.token);
    const refresh = entry.refreshToken ? encrypt(entry.refreshToken) : null;
    const expiresAt = entry.expiresAt ? new Date(entry.expiresAt) : null;
    await db.query(
      `insert into twitch_tokens (uid, access_token, refresh_token, expires_at, updated_at)
         values ($1, $2, $3, $4, now())
       on conflict (uid) do update set
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at,
         updated_at = now()`,
      [uid, access, refresh, expiresAt],
    );
  } catch (e) {
    logger.error('token_db_write_failed', { uid, message: e?.message });
  }
}

async function deleteTokenFromDb(uid) {
  try {
    await db.query('delete from twitch_tokens where uid = $1', [uid]);
  } catch (e) {
    logger.error('token_db_delete_failed', { uid, message: e?.message });
  }
}

/**
 * Store / update a user's tokens. Updates the in-memory cache immediately and
 * persists to Postgres in the background. Returns a promise that resolves once
 * the DB write completes — callers may await it but are not required to (errors
 * are logged internally and never thrown).
 */
export function storeUserAccessToken(uid, token, expiresIn, refreshToken) {
  if (!uid || !token) return Promise.resolve();
  uid = String(uid);
  const ttl = Number(expiresIn) || 0;
  const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
  const existing = accessTokens.get(uid);
  const entry = {
    token,
    expiresAt,
    // Keep existing refresh token if a new one isn't provided
    refreshToken: refreshToken || existing?.refreshToken || null,
  };
  accessTokens.set(uid, entry);
  return writeTokenToDb(uid, entry);
}

export function deleteUserAccessToken(uid) {
  uid = String(uid);
  accessTokens.delete(uid);
  return deleteTokenFromDb(uid);
}

export function getUserAccessToken(uid) {
  const entry = accessTokens.get(String(uid));
  if (!entry) return null;
  if (entry.expiresAt && Date.now() >= entry.expiresAt - 60000) {
    if (entry.refreshToken) {
      refreshAccessToken(String(uid)).catch(() => {});
    }
    return null;
  }
  return entry.token;
}

/**
 * Async version that awaits a token refresh if the current token is expired.
 * Use this in any async code path that needs a guaranteed-valid token.
 */
export async function getValidAccessToken(uid) {
  uid = String(uid);
  const entry = accessTokens.get(uid);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() >= entry.expiresAt - 60000) {
    if (entry.refreshToken) {
      return await refreshAccessToken(uid);
    }
    return null;
  }
  return entry.token;
}

/**
 * Refresh a user's access token using their stored refresh token. The new
 * token is persisted to Postgres before this returns, closing the previous
 * window where a process crash could lose a freshly-issued refresh token and
 * force the user to re-authorize.
 */
export async function refreshAccessToken(uid) {
  uid = String(uid);
  const entry = accessTokens.get(uid);
  if (!entry?.refreshToken) return null;

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
        if (json.error === 'invalid_grant' || json.status === 400) {
          accessTokens.delete(uid);
          await deleteTokenFromDb(uid);
        }
        return null;
      }

      const ttl = Number(json.expires_in) || 0;
      const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
      const newEntry = {
        token: json.access_token,
        expiresAt,
        refreshToken: json.refresh_token || entry.refreshToken,
      };
      accessTokens.set(uid, newEntry);
      await writeTokenToDb(uid, newEntry);

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
    const expired = entry.expiresAt && Date.now() >= entry.expiresAt - 60000;
    if (!expired || entry.refreshToken) {
      ids.push(uid);
    }
  }
  return ids;
}

/**
 * Compatibility shim. Postgres writes happen inline on every store / refresh,
 * so there's nothing to flush here. server.js still calls this on a 5-minute
 * timer and on graceful shutdown — left as a no-op so call-sites don't need
 * coordinated changes; can be removed in a follow-up.
 */
export async function persistTokens() {
  return;
}

/** Load all tokens from Postgres into the in-memory cache. Called on startup. */
export async function loadTokens() {
  try {
    const { rows } = await db.query(
      'select uid, access_token, refresh_token, expires_at from twitch_tokens'
    );
    let loaded = 0;
    for (const row of rows) {
      try {
        const token = decrypt(row.access_token);
        const refreshToken = row.refresh_token ? decrypt(row.refresh_token) : null;
        const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : null;
        const expired = expiresAt && Date.now() >= expiresAt - 60000;
        if (expired && !refreshToken) continue;
        accessTokens.set(String(row.uid), { token, expiresAt, refreshToken });
        loaded++;
      } catch {
        // Decryption failed (key changed, corrupted) – skip this token
      }
    }
    if (loaded > 0) logger.info('tokens_loaded', { count: loaded });
  } catch (e) {
    logger.error('tokens_load_failed', { message: e?.message });
  }
}
