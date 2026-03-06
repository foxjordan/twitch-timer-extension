import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logger } from './logger.js';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const TOKENS_PATH = path.resolve(DATA_DIR, 'twitch-tokens.enc.json');

// Encryption key derived from TWITCH_CLIENT_SECRET (always available).
// Tokens at rest are AES-256-GCM encrypted so the file alone is not useful.
const ENC_KEY_SOURCE = process.env.TWITCH_CLIENT_SECRET || 'default-key';
const ENC_KEY = crypto.createHash('sha256').update(ENC_KEY_SOURCE).digest();

const accessTokens = new Map();

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

export function storeUserAccessToken(uid, token, expiresIn) {
  if (!uid || !token) return;
  const ttl = Number(expiresIn) || 0;
  const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
  accessTokens.set(String(uid), { token, expiresAt });
}

export function deleteUserAccessToken(uid) {
  accessTokens.delete(String(uid));
}

export function getUserAccessToken(uid) {
  const entry = accessTokens.get(String(uid));
  if (!entry) return null;
  if (entry.expiresAt && Date.now() >= entry.expiresAt - 60000) {
    accessTokens.delete(String(uid));
    return null;
  }
  return entry.token;
}

/** Returns all user IDs that have a valid (non-expired) access token. */
export function getAllTokenUserIds() {
  const ids = [];
  for (const [uid, entry] of accessTokens) {
    if (entry.expiresAt && Date.now() >= entry.expiresAt - 60000) continue;
    ids.push(uid);
  }
  return ids;
}

/** Persist tokens to disk (encrypted). Called during graceful shutdown. */
export async function persistTokens() {
  try {
    const obj = {};
    for (const [uid, entry] of accessTokens) {
      // Skip expired tokens
      if (entry.expiresAt && Date.now() >= entry.expiresAt - 60000) continue;
      obj[uid] = {
        token: encrypt(entry.token),
        expiresAt: entry.expiresAt,
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
      // Skip expired tokens
      if (entry.expiresAt && Date.now() >= entry.expiresAt - 60000) continue;
      try {
        const token = decrypt(entry.token);
        accessTokens.set(String(uid), { token, expiresAt: entry.expiresAt });
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
