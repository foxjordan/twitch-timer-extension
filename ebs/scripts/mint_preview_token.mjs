#!/usr/bin/env node
/**
 * Mints a real, correctly-shaped Twitch-extension broadcaster JWT for local
 * preview use (see extension/preview.html) — signed with the same
 * EXTENSION_SECRET the EBS's verifyExtensionJwt() already trusts, so the
 * preview hits real production data as the given channel.
 *
 * Usage:
 *   cd ebs && node scripts/mint_preview_token.mjs --channel <twitch-user-id>
 *
 * Prints two lines to paste into extension/.env.local (already gitignored).
 */
import 'dotenv/config';
import jwt from 'jsonwebtoken';

function parseChannelArg() {
  const idx = process.argv.indexOf('--channel');
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error('Usage: node scripts/mint_preview_token.mjs --channel <twitch-user-id>');
    process.exit(1);
  }
  return process.argv[idx + 1];
}

const channelId = parseChannelArg();

const secretRaw = process.env.EXTENSION_SECRET;
if (!secretRaw) {
  console.error('EXTENSION_SECRET is not set in ebs/.env');
  process.exit(1);
}
// Same base64 decode verifyExtensionJwt()'s EXT_SECRET derivation uses
// (see ebs/routes_sounds.js) — Twitch issues this secret base64-encoded.
const secret = Buffer.from(secretRaw, 'base64');

const token = jwt.sign(
  { role: 'broadcaster', channel_id: channelId, user_id: channelId },
  secret,
  { algorithm: 'HS256', expiresIn: '7d' },
);

console.log(`VITE_PREVIEW_TOKEN=${token}`);
console.log(`VITE_PREVIEW_CHANNEL_ID=${channelId}`);
