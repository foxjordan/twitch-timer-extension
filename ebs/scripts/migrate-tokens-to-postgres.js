#!/usr/bin/env node
/**
 * One-time migration: copy every entry from the encrypted twitch-tokens.enc.json
 * file (taken from the Fly volume) into the Postgres twitch_tokens table.
 *
 * Idempotent — running it twice replaces existing rows with the same uid.
 *
 * Usage:
 *   1. Pull the file off Fly:
 *        fly ssh sftp shell -a twitch-timer-extension
 *        > get /data/twitch-tokens.enc.json
 *
 *   2. From the ebs/ directory:
 *        node scripts/migrate-tokens-to-postgres.js path/to/twitch-tokens.enc.json
 *
 * Required env (in ebs/.env):
 *   DATABASE_URL              Supabase pooler connection string (port 6543)
 *   TWITCH_CLIENT_SECRET      Must match the EBS that wrote the file — it's the
 *                             encryption key derivation source. (We don't decrypt
 *                             here, but writeTokenToDb in twitch_tokens.js will
 *                             use it later, so confirming env parity now avoids
 *                             surprises after the cutover deploy.)
 */

import 'dotenv/config';
import { readFile } from 'fs/promises';
import { db } from '../db.js';

async function main() {
  const tokenFile = process.argv[2];
  if (!tokenFile) {
    console.error('Usage: node scripts/migrate-tokens-to-postgres.js <path-to-twitch-tokens.enc.json>');
    process.exit(1);
  }

  const raw = await readFile(tokenFile, 'utf-8');
  const obj = JSON.parse(raw);

  let migrated = 0;
  let skipped = 0;

  for (const [uid, entry] of Object.entries(obj)) {
    if (!entry || !entry.token) {
      skipped++;
      continue;
    }
    // The values in the file are already AES-256-GCM ciphertext in iv:tag:hex
    // form — exactly the format the new schema stores. Copy ciphertext through;
    // no decrypt/re-encrypt step is needed, and the encryption key (derived
    // from TWITCH_CLIENT_SECRET) doesn't change across the migration.
    const expiresAt = entry.expiresAt ? new Date(entry.expiresAt) : null;
    await db.query(
      `insert into twitch_tokens (uid, access_token, refresh_token, expires_at, updated_at)
         values ($1, $2, $3, $4, now())
       on conflict (uid) do update set
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at,
         updated_at = now()`,
      [String(uid), entry.token, entry.refreshToken || null, expiresAt],
    );
    migrated++;
  }

  console.log(`Migrated ${migrated} tokens (skipped ${skipped} empty entries).`);
  await db.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
