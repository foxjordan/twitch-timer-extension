# YouTube Livestream Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a streamer who simulcasts to Twitch and YouTube feed their existing subathon timer from YouTube Super Chats, Super Stickers, and membership events, on top of the Twitch events it already handles.

**Architecture:** A second, self-contained event pipeline (OAuth → token storage → poll loop → normalizer → seconds calculator) that terminates in the same `addSeconds(uid, seconds)` call the Twitch pipeline already uses. The poll loop's lifecycle rides the existing `handleBroadcasterWentLive`/`handleBroadcasterWentOffline` hooks that already open/pause the Twitch EventSub connection on real `stream.online`/`stream.offline` webhooks, so it survives Twitch's ~48h forced ingest reconnect with no manual action.

**Tech Stack:** Node.js (ESM), Express, `node-fetch`, Postgres (Supabase, via existing `db.js` pool), `node:test` + `node:assert/strict` for unit tests (no test framework currently installed — Node 20's built-in runner is used to avoid adding a dependency for this alone).

Design doc: [docs/superpowers/specs/2026-08-06-youtube-livestream-integration-design.md](../specs/2026-08-06-youtube-livestream-integration-design.md)

## Global Constraints

- Zero added cost — code path, UI, or quota — for any broadcaster who has not connected a YouTube account. No new backend work may run, and no new UI may render, until a broadcaster opts in.
- Event coverage for v1: Super Chat, Super Sticker, new membership, membership milestone, membership gifting. No raid equivalent exists on YouTube; `giftMembershipReceivedEvent` is intentionally not handled (it's the recipient-side echo of `membershipGiftingEvent` and would double-count).
- YouTube polling only ever runs while the broadcaster is live on Twitch — its start/stop is driven entirely by Twitch's own `stream.online`/`stream.offline` signal, never by YouTube's live status independently.
- New rule keys follow the existing `enabled: false`-by-default convention (see `raid`, `follow` in `rules.js`).
- YouTube Data API quota (10,000 units/day default) is pooled per Google Cloud project across every connected broadcaster — the poll loop must track usage process-wide and refuse to start new loops near the daily cap.
- No dedicated worker service, no auto-detection of YouTube-only creators — both explicitly out of scope for v1 per the design doc.

---

## File Structure

| File | Responsibility |
|---|---|
| `ebs/rules.js` (modify) | Add 4 new rule key defaults |
| `ebs/rules_store.js` (modify) | Add `mergeRules` handling for the 4 new keys |
| `ebs/youtube_tokens.js` (new) | Encrypted Postgres storage + refresh for Google OAuth tokens, mirrors `twitch_tokens.js` |
| `ebs/youtube_accounts_store.js` (new) | File-based per-broadcaster metadata (channel id/title, poll-intent flag), mirrors `rules_store.js` |
| `ebs/routes_youtube_auth.js` (new) | Google OAuth connect/callback/disconnect/poll-intent routes |
| `ebs/youtube_live_api.js` (new) | Thin wrapper around `liveBroadcasts.list` / `liveChatMessages.list` |
| `ebs/youtube_live_events.js` (new) | Event normalizer, seconds calculator, poll loop orchestration, quota tracking |
| `ebs/state.js` (modify) | Extract hype/bonus multiplier math into a reusable `applyMultipliers` export |
| `ebs/server.js` (modify) | Use `applyMultipliers`; wire YouTube poll start/stop into the existing stream online/offline handlers; mount the new auth routes |
| `ebs/views/overlayConfigPage.js` (modify) | Collapsed "Multistreaming" UI section |

---

### Task 1: Rule config schema

**Files:**
- Modify: `ebs/rules.js`
- Modify: `ebs/rules_store.js:62` (add new blocks after the existing `raid` block)
- Test: `ebs/rules_store.test.js`

**Interfaces:**
- Produces: `RULES.youtube_superchat`, `RULES.youtube_member`, `RULES.youtube_member_milestone`, `RULES.youtube_membership_gift` — all consumed by Task 6's `secondsFromYoutubeEvent(rules, event)`.

- [ ] **Step 1: Write the failing test**

Create `ebs/rules_store.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';

process.env.DATA_DIR = os.tmpdir();
const { getRules, setRules } = await import('./rules_store.js');

test('getRules returns youtube_* keys disabled by default', () => {
  const rules = getRules('yt-test-user-1');
  assert.equal(rules.youtube_superchat.enabled, false);
  assert.equal(rules.youtube_superchat.per_usd, 60);
  assert.equal(rules.youtube_superchat.min_amount, 1);
  assert.equal(rules.youtube_member.enabled, false);
  assert.equal(rules.youtube_member.base_seconds, 300);
  assert.equal(rules.youtube_member_milestone.enabled, false);
  assert.equal(rules.youtube_membership_gift.enabled, false);
});

test('setRules merges a youtube_superchat patch and preserves untouched fields', () => {
  const updated = setRules('yt-test-user-2', { youtube_superchat: { enabled: true, per_usd: 100 } });
  assert.equal(updated.youtube_superchat.enabled, true);
  assert.equal(updated.youtube_superchat.per_usd, 100);
  assert.equal(updated.youtube_superchat.min_amount, 1);
});

test('setRules merges youtube_member_milestone independently of youtube_member', () => {
  const updated = setRules('yt-test-user-3', { youtube_member_milestone: { enabled: true, base_seconds: 120 } });
  assert.equal(updated.youtube_member_milestone.enabled, true);
  assert.equal(updated.youtube_member_milestone.base_seconds, 120);
  assert.equal(updated.youtube_member.enabled, false);
});

test('setRules merges youtube_membership_gift', () => {
  const updated = setRules('yt-test-user-4', { youtube_membership_gift: { enabled: true, per_gift_seconds: 90 } });
  assert.equal(updated.youtube_membership_gift.enabled, true);
  assert.equal(updated.youtube_membership_gift.per_gift_seconds, 90);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ebs && node --test rules_store.test.js`
Expected: FAIL — `rules.youtube_superchat` is `undefined`.

- [ ] **Step 3: Add the rule defaults**

In `ebs/rules.js`, add after the existing `thirdPartyTip` line:

```js
  youtube_superchat:        { enabled: false, per_usd: 60, min_amount: 1 },  // Super Chat/Sticker USD -> seconds
  youtube_member:            { enabled: false, base_seconds: 300 },          // new YouTube membership
  youtube_member_milestone:  { enabled: false, base_seconds: 300 },          // membership milestone chat
  youtube_membership_gift:   { enabled: false, per_gift_seconds: 300 },      // gifted memberships, per gift
```

- [ ] **Step 4: Add the `mergeRules` blocks**

In `ebs/rules_store.js`, add immediately after the existing `if (patch.raid) { ... }` block (after line 70):

```js
  if (patch.youtube_superchat) {
    next.youtube_superchat = {
      enabled: (typeof patch.youtube_superchat.enabled === 'boolean') ? patch.youtube_superchat.enabled : (next.youtube_superchat?.enabled ?? false),
      per_usd: numberOr(next.youtube_superchat?.per_usd ?? 60, patch.youtube_superchat.per_usd, 0),
      min_amount: numberOr(next.youtube_superchat?.min_amount ?? 1, patch.youtube_superchat.min_amount, 0),
    };
  }
  if (patch.youtube_member) {
    next.youtube_member = {
      enabled: (typeof patch.youtube_member.enabled === 'boolean') ? patch.youtube_member.enabled : (next.youtube_member?.enabled ?? false),
      base_seconds: numberOr(next.youtube_member?.base_seconds ?? 300, patch.youtube_member.base_seconds, 0),
    };
  }
  if (patch.youtube_member_milestone) {
    next.youtube_member_milestone = {
      enabled: (typeof patch.youtube_member_milestone.enabled === 'boolean') ? patch.youtube_member_milestone.enabled : (next.youtube_member_milestone?.enabled ?? false),
      base_seconds: numberOr(next.youtube_member_milestone?.base_seconds ?? 300, patch.youtube_member_milestone.base_seconds, 0),
    };
  }
  if (patch.youtube_membership_gift) {
    next.youtube_membership_gift = {
      enabled: (typeof patch.youtube_membership_gift.enabled === 'boolean') ? patch.youtube_membership_gift.enabled : (next.youtube_membership_gift?.enabled ?? false),
      per_gift_seconds: numberOr(next.youtube_membership_gift?.per_gift_seconds ?? 300, patch.youtube_membership_gift.per_gift_seconds, 0),
    };
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ebs && node --test rules_store.test.js`
Expected: PASS (4 tests)

- [ ] **Step 6: Add a `test` script and commit**

Add to `ebs/package.json` `scripts`: `"test": "node --test"`.

```bash
git add ebs/rules.js ebs/rules_store.js ebs/rules_store.test.js ebs/package.json
git commit -m "Add YouTube rule config keys (superchat, member, milestone, gift)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: YouTube token storage (Postgres)

**Files:**
- Create: `ebs/youtube_tokens.js`
- Test: `ebs/youtube_tokens.test.js`

**Interfaces:**
- Consumes: `db` from `ebs/db.js` (existing Postgres pool).
- Produces: `storeYoutubeToken(uid, token, expiresIn, refreshToken)`, `getValidYoutubeAccessToken(uid): Promise<string|null>`, `refreshYoutubeToken(uid): Promise<string|null>`, `deleteYoutubeToken(uid): Promise<void>`, `loadYoutubeTokens(): Promise<void>` — consumed by Task 4 (routes) and Task 5 (API wrapper).

This mirrors `ebs/twitch_tokens.js` exactly (same encryption scheme, same in-memory-cache-plus-Postgres pattern) — that file has no automated tests today, and its DB-touching functions aren't unit-testable without a live connection because `ebs/db.js` throws at import time if `DATABASE_URL` isn't set. This task follows the same shape: the pure crypto helpers get automated tests; the DB-touching functions get a documented manual verification against the real dev database.

- [ ] **Step 1: Create the `youtube_tokens` table**

Run this migration against the Supabase project (via the Supabase MCP `apply_migration` tool, or paste into Supabase Studio's SQL editor):

```sql
create table public.youtube_tokens (
  uid text primary key,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.youtube_tokens enable row level security;

comment on table public.youtube_tokens is 'YouTube (Google) OAuth tokens per Twitch broadcaster uid. access_token and refresh_token are AES-256-GCM ciphertext from ebs/youtube_tokens.js (encrypt() format: iv:tag:hex). RLS is on with no policies — only the service role (used by the EBS via the pooler connection string) can read/write.';
```

Verify: query `select * from public.youtube_tokens limit 1;` returns zero rows with no error (table exists, RLS on, no policies — matches `twitch_tokens`).

- [ ] **Step 2: Write the failing test for the crypto round-trip**

Create `ebs/youtube_tokens.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.TWITCH_CLIENT_SECRET ||= 'test-secret-for-encryption';
process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
const { __encryptForTest, __decryptForTest } = await import('./youtube_tokens.js');

test('encrypt/decrypt round-trips a token string', () => {
  const original = 'ya29.some-fake-google-access-token';
  const ciphertext = __encryptForTest(original);
  assert.notEqual(ciphertext, original);
  assert.equal(__decryptForTest(ciphertext), original);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd ebs && node --test youtube_tokens.test.js`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 4: Write `ebs/youtube_tokens.js`**

```js
import crypto from 'crypto';
import fetch from 'node-fetch';
import { logger } from './logger.js';
import { db } from './db.js';

// Same key-derivation convention as twitch_tokens.js — TWITCH_CLIENT_SECRET is
// the app-wide secret already used for symmetric encryption elsewhere in this
// codebase, so YouTube tokens reuse it rather than introducing a second
// required secret.
const ENC_KEY_SOURCE = process.env.TWITCH_CLIENT_SECRET || 'default-key';
const ENC_KEY = crypto.createHash('sha256').update(ENC_KEY_SOURCE).digest();

const accessTokens = new Map();
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

// Exported only for youtube_tokens.test.js — not part of the module's real API.
export const __encryptForTest = encrypt;
export const __decryptForTest = decrypt;

async function writeTokenToDb(uid, entry) {
  try {
    const access = encrypt(entry.token);
    const refresh = entry.refreshToken ? encrypt(entry.refreshToken) : null;
    const expiresAt = entry.expiresAt ? new Date(entry.expiresAt) : null;
    await db.query(
      `insert into youtube_tokens (uid, access_token, refresh_token, expires_at, updated_at)
         values ($1, $2, $3, $4, now())
       on conflict (uid) do update set
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at,
         updated_at = now()`,
      [uid, access, refresh, expiresAt],
    );
  } catch (e) {
    logger.error('youtube_token_db_write_failed', { uid, message: e?.message });
  }
}

async function deleteTokenFromDb(uid) {
  try {
    await db.query('delete from youtube_tokens where uid = $1', [uid]);
  } catch (e) {
    logger.error('youtube_token_db_delete_failed', { uid, message: e?.message });
  }
}

export function storeYoutubeToken(uid, token, expiresIn, refreshToken) {
  if (!uid || !token) return Promise.resolve();
  uid = String(uid);
  const ttl = Number(expiresIn) || 0;
  const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
  const existing = accessTokens.get(uid);
  const entry = {
    token,
    expiresAt,
    refreshToken: refreshToken || existing?.refreshToken || null,
  };
  accessTokens.set(uid, entry);
  return writeTokenToDb(uid, entry);
}

export function deleteYoutubeToken(uid) {
  uid = String(uid);
  accessTokens.delete(uid);
  return deleteTokenFromDb(uid);
}

export function hasYoutubeToken(uid) {
  return accessTokens.has(String(uid));
}

export async function getValidYoutubeAccessToken(uid) {
  uid = String(uid);
  const entry = accessTokens.get(uid);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() >= entry.expiresAt - 60000) {
    if (entry.refreshToken) return await refreshYoutubeToken(uid);
    return null;
  }
  return entry.token;
}

export async function refreshYoutubeToken(uid) {
  uid = String(uid);
  const entry = accessTokens.get(uid);
  if (!entry?.refreshToken) return null;
  if (refreshInFlight.has(uid)) return refreshInFlight.get(uid);

  const promise = (async () => {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        logger.error('youtube_token_refresh_missing_env', { uid });
        return null;
      }
      const res = await fetch('https://oauth2.googleapis.com/token', {
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
        logger.error('youtube_token_refresh_failed', { uid, error: json.error, message: json.error_description });
        if (json.error === 'invalid_grant') {
          accessTokens.delete(uid);
          await deleteTokenFromDb(uid);
        }
        return null;
      }
      const ttl = Number(json.expires_in) || 0;
      const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
      // Google only returns a refresh_token on the first consent grant (or
      // when prompt=consent forces re-consent) — every later refresh response
      // omits it, so keep the one already stored.
      const newEntry = {
        token: json.access_token,
        expiresAt,
        refreshToken: json.refresh_token || entry.refreshToken,
      };
      accessTokens.set(uid, newEntry);
      await writeTokenToDb(uid, newEntry);
      logger.info('youtube_token_refreshed', { uid, expiresIn: json.expires_in });
      return json.access_token;
    } catch (e) {
      logger.error('youtube_token_refresh_exception', { uid, message: e?.message });
      return null;
    } finally {
      refreshInFlight.delete(uid);
    }
  })();
  refreshInFlight.set(uid, promise);
  return promise;
}

export async function loadYoutubeTokens() {
  try {
    const { rows } = await db.query('select uid, access_token, refresh_token, expires_at from youtube_tokens');
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
        // Decryption failed (key changed, corrupted row) — skip it.
      }
    }
    if (loaded > 0) logger.info('youtube_tokens_loaded', { count: loaded });
  } catch (e) {
    logger.error('youtube_tokens_load_failed', { message: e?.message });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ebs && node --test youtube_tokens.test.js`
Expected: PASS (1 test)

- [ ] **Step 6: Manual verification against the real database**

With `ebs/.env` pointing at the real `DATABASE_URL` and `TWITCH_CLIENT_SECRET` set:

```bash
cd ebs && node -e "
import('./youtube_tokens.js').then(async (m) => {
  await m.storeYoutubeToken('manual-test-uid', 'fake-access-token', 3600, 'fake-refresh-token');
  console.log('stored');
  console.log('valid token:', await m.getValidYoutubeAccessToken('manual-test-uid'));
  await m.deleteYoutubeToken('manual-test-uid');
  console.log('deleted, now:', await m.getValidYoutubeAccessToken('manual-test-uid'));
});
"
```

Expected output: `stored`, then `valid token: fake-access-token`, then `deleted, now: null`. Also confirm via Supabase Studio (or `select count(*) from youtube_tokens where uid = 'manual-test-uid';`) that the row is gone after the delete.

- [ ] **Step 7: Commit**

```bash
git add ebs/youtube_tokens.js ebs/youtube_tokens.test.js
git commit -m "Add encrypted Postgres storage for YouTube OAuth tokens

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: YouTube account metadata store

**Files:**
- Create: `ebs/youtube_accounts_store.js`
- Test: `ebs/youtube_accounts_store.test.js`

**Interfaces:**
- Produces: `getYoutubeAccount(uid): {channelId, channelTitle, pollIntentEnabled, connectedAt}|null`, `setYoutubeAccount(uid, {channelId, channelTitle})`, `setPollIntent(uid, enabled): account|null`, `disconnectYoutubeAccount(uid): boolean`, `loadYoutubeAccounts(): Promise<void>` — consumed by Task 4 (routes) and Task 8 (server.js lifecycle hooks).

- [ ] **Step 1: Write the failing test**

Create `ebs/youtube_accounts_store.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'yt-accounts-'));
const {
  getYoutubeAccount,
  setYoutubeAccount,
  setPollIntent,
  disconnectYoutubeAccount,
} = await import('./youtube_accounts_store.js');

test('getYoutubeAccount returns null for an unconnected user', () => {
  assert.equal(getYoutubeAccount('nobody'), null);
});

test('setYoutubeAccount stores channel info with pollIntentEnabled defaulting false', () => {
  const account = setYoutubeAccount('uid-1', { channelId: 'UC123', channelTitle: 'Test Channel' });
  assert.equal(account.channelId, 'UC123');
  assert.equal(account.channelTitle, 'Test Channel');
  assert.equal(account.pollIntentEnabled, false);
  assert.equal(getYoutubeAccount('uid-1').channelId, 'UC123');
});

test('setPollIntent flips the flag for a connected user', () => {
  setYoutubeAccount('uid-2', { channelId: 'UC456', channelTitle: 'Another Channel' });
  const updated = setPollIntent('uid-2', true);
  assert.equal(updated.pollIntentEnabled, true);
  assert.equal(getYoutubeAccount('uid-2').pollIntentEnabled, true);
});

test('setPollIntent on an unconnected user returns null and does nothing', () => {
  assert.equal(setPollIntent('never-connected', true), null);
});

test('disconnectYoutubeAccount removes the account', () => {
  setYoutubeAccount('uid-3', { channelId: 'UC789', channelTitle: 'Third Channel' });
  assert.equal(disconnectYoutubeAccount('uid-3'), true);
  assert.equal(getYoutubeAccount('uid-3'), null);
  assert.equal(disconnectYoutubeAccount('uid-3'), false); // already gone
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ebs && node --test youtube_accounts_store.test.js`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Write `ebs/youtube_accounts_store.js`**

```js
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const ACCOUNTS_PATH = path.resolve(DATA_DIR, 'youtube-accounts.json');

// Per-broadcaster YouTube connection metadata. Keys are Twitch user IDs, same
// convention as rules_store.js. Deliberately separate from youtube_tokens.js
// (Postgres, encrypted) — this file holds nothing sensitive, just channel
// display info and the poll-intent toggle, so it follows the same
// file-backed pattern as rules_store.js / user_profiles.js instead.
let byUser = {};

export async function loadYoutubeAccounts() {
  try {
    const raw = await readFile(ACCOUNTS_PATH, 'utf-8');
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') byUser = obj;
  } catch {}
}

async function persistYoutubeAccounts() {
  try {
    await writeFile(ACCOUNTS_PATH, JSON.stringify(byUser, null, 2), 'utf-8');
  } catch {}
}

export function getYoutubeAccount(uid) {
  const id = String(uid || '').trim();
  if (!id) return null;
  return byUser[id] || null;
}

export function setYoutubeAccount(uid, { channelId, channelTitle } = {}) {
  const id = String(uid || '').trim();
  if (!id) throw new Error('User id required');
  const existing = byUser[id] || {};
  byUser[id] = {
    channelId: channelId ?? existing.channelId ?? null,
    channelTitle: channelTitle ?? existing.channelTitle ?? null,
    pollIntentEnabled: existing.pollIntentEnabled ?? false,
    connectedAt: existing.connectedAt || new Date().toISOString(),
  };
  persistYoutubeAccounts().catch(() => {});
  return byUser[id];
}

export function setPollIntent(uid, enabled) {
  const id = String(uid || '').trim();
  if (!id || !byUser[id]) return null;
  byUser[id].pollIntentEnabled = Boolean(enabled);
  persistYoutubeAccounts().catch(() => {});
  return byUser[id];
}

export function disconnectYoutubeAccount(uid) {
  const id = String(uid || '').trim();
  if (!id) return false;
  const existed = id in byUser;
  delete byUser[id];
  if (existed) persistYoutubeAccounts().catch(() => {});
  return existed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ebs && node --test youtube_accounts_store.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add ebs/youtube_accounts_store.js ebs/youtube_accounts_store.test.js
git commit -m "Add file-backed store for YouTube account connection metadata

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Google OAuth routes

**Files:**
- Create: `ebs/routes_youtube_auth.js`
- Test: `ebs/routes_youtube_auth.test.js`

**Interfaces:**
- Consumes: `storeYoutubeToken`, `deleteYoutubeToken` (Task 2); `setYoutubeAccount`, `disconnectYoutubeAccount`, `getYoutubeAccount`, `setPollIntent` (Task 3); `getBaseUrl(req)` from `ebs/base_url.js` (existing).
- Produces: `mountYoutubeAuthRoutes(app, opts)` where `opts.onPollIntentChanged(uid, enabled)` is called whenever the toggle changes — consumed by Task 8 to start/stop polling immediately if the broadcaster is currently live.

- [ ] **Step 1: Write the failing test**

Create `ebs/routes_youtube_auth.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { __buildSignedStateForTest, __verifySignedStateForTest } = await import('./routes_youtube_auth.js');

test('buildSignedState/verifySignedState round-trips origin and next', () => {
  const state = __buildSignedStateForTest('https://example.com', 'user-123', 'secret-key');
  const result = __verifySignedStateForTest(state, 'secret-key');
  assert.equal(result.valid, true);
  assert.equal(result.origin, 'https://example.com');
  assert.equal(result.next, 'user-123');
});

test('verifySignedState rejects a tampered state', () => {
  const state = __buildSignedStateForTest('https://example.com', 'user-123', 'secret-key');
  const tampered = state.slice(0, -1) + (state.at(-1) === 'a' ? 'b' : 'a');
  assert.equal(__verifySignedStateForTest(tampered, 'secret-key').valid, false);
});

test('verifySignedState rejects the wrong secret', () => {
  const state = __buildSignedStateForTest('https://example.com', 'user-123', 'secret-key');
  assert.equal(__verifySignedStateForTest(state, 'wrong-secret').valid, false);
});

test('verifySignedState rejects malformed input', () => {
  assert.equal(__verifySignedStateForTest('not-a-real-state', 'secret-key').valid, false);
  assert.equal(__verifySignedStateForTest(null, 'secret-key').valid, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ebs && node --test routes_youtube_auth.test.js`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Write `ebs/routes_youtube_auth.js`**

```js
import crypto from 'crypto';
import fetch from 'node-fetch';
import { logger } from './logger.js';
import { getBaseUrl } from './base_url.js';
import { storeYoutubeToken, deleteYoutubeToken } from './youtube_tokens.js';
import {
  setYoutubeAccount,
  disconnectYoutubeAccount,
  getYoutubeAccount,
  setPollIntent,
} from './youtube_accounts_store.js';

// Same signed-state approach as routes_auth.js's Twitch OAuth flow (see that
// file for full rationale). Duplicated rather than shared: the two flows use
// different providers/scopes, and routes_auth.js is stable, security-
// sensitive code that's better left untouched for this.
function buildSignedState(origin, next, secret) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const originB64 = Buffer.from(origin).toString('base64url');
  const nextB64 = Buffer.from(next || '').toString('base64url');
  const payload = `${nonce}.${originB64}.${nextB64}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

function verifySignedState(state, secret) {
  if (!state || typeof state !== 'string') return { valid: false };
  const parts = state.split('.');
  if (parts.length !== 4) return { valid: false };
  const [nonce, originB64, nextB64, hmac] = parts;
  const payload = `${nonce}.${originB64}.${nextB64}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (hmac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'))) {
    return { valid: false };
  }
  try {
    const origin = Buffer.from(originB64, 'base64url').toString();
    const next = Buffer.from(nextB64 || '', 'base64url').toString();
    return { valid: true, origin, next };
  } catch {
    return { valid: false };
  }
}

// Exported only for routes_youtube_auth.test.js — not part of the route API.
export const __buildSignedStateForTest = buildSignedState;
export const __verifySignedStateForTest = verifySignedState;

const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

export function mountYoutubeAuthRoutes(app, opts = {}) {
  const stateSigningKey = process.env.SESSION_SECRET || process.env.TWITCH_CLIENT_SECRET || 'fallback-oauth-state-key';

  app.get('/youtube/oauth/start', (req, res) => {
    const userId = req?.session?.twitchUser?.id;
    if (!userId) return res.status(401).send('Must be logged in with Twitch first');

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(500).send('Missing GOOGLE_CLIENT_ID');

    const origin = getBaseUrl(req);
    const state = buildSignedState(origin, String(userId), stateSigningKey);
    const redirectUri = `${origin}/youtube/oauth/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: YOUTUBE_SCOPE,
      access_type: 'offline',
      // Force the consent screen every time so Google always issues a
      // refresh_token — without this it's only returned on a user's very
      // first authorization, which would break reconnect-after-disconnect.
      prompt: 'consent',
      state,
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  app.get('/youtube/oauth/callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      const verified = verifySignedState(state, stateSigningKey);
      if (!code || !state || !verified.valid) {
        logger.warn('youtube_oauth_state_invalid', { hasCode: !!code, hasState: !!state });
        return res.status(400).send('Invalid OAuth state');
      }
      const userId = verified.next; // Twitch uid, carried through `next`
      if (!userId) return res.status(400).send('Missing user context');

      const redirectUri = `${verified.origin}/youtube/oauth/callback`;
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          code: String(code),
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });
      const tokenJson = await tokenRes.json();
      if (!tokenJson.access_token) {
        logger.error('youtube_oauth_token_exchange_failed', { error: tokenJson.error, message: tokenJson.error_description });
        return res.status(400).send('YouTube OAuth token exchange failed');
      }

      const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      const channelJson = await channelRes.json();
      const channel = channelJson?.items?.[0];
      if (!channel) {
        logger.error('youtube_oauth_no_channel', { userId });
        return res.status(400).send('No YouTube channel found for this Google account');
      }

      await storeYoutubeToken(userId, tokenJson.access_token, tokenJson.expires_in, tokenJson.refresh_token || null);
      setYoutubeAccount(userId, { channelId: channel.id, channelTitle: channel.snippet?.title || null });

      logger.info('youtube_oauth_connected', { userId, channelId: channel.id });
      res.redirect('/overlay/config');
    } catch (e) {
      logger.error('youtube_oauth_callback_error', { message: e?.message });
      res.status(500).send('YouTube OAuth error');
    }
  });

  app.post('/youtube/disconnect', async (req, res) => {
    const userId = req?.session?.twitchUser?.id;
    if (!userId) return res.status(401).json({ error: 'Not logged in' });
    await deleteYoutubeToken(String(userId));
    disconnectYoutubeAccount(String(userId));
    try { if (typeof opts.onPollIntentChanged === 'function') opts.onPollIntentChanged(String(userId), false); } catch {}
    res.json({ ok: true });
  });

  app.post('/youtube/poll-intent', (req, res) => {
    const userId = req?.session?.twitchUser?.id;
    if (!userId) return res.status(401).json({ error: 'Not logged in' });
    const account = getYoutubeAccount(String(userId));
    if (!account) return res.status(400).json({ error: 'YouTube not connected' });
    const enabled = Boolean(req.body?.enabled);
    const updated = setPollIntent(String(userId), enabled);
    try { if (typeof opts.onPollIntentChanged === 'function') opts.onPollIntentChanged(String(userId), enabled); } catch {}
    res.json({ ok: true, pollIntentEnabled: updated.pollIntentEnabled });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ebs && node --test routes_youtube_auth.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Manual verification (requires a Google Cloud OAuth client)**

1. In Google Cloud Console, enable the "YouTube Data API v3" for a project, create an OAuth 2.0 Client ID (Web application), and add `<your-base-url>/youtube/oauth/callback` as an authorized redirect URI.
2. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `ebs/.env`.
3. This route isn't mounted yet (that's Task 8) — for now, confirm the file has no syntax errors: `cd ebs && node --check routes_youtube_auth.js`.
4. Full click-through verification happens at the end of Task 8, once the routes are actually mounted.

- [ ] **Step 6: Commit**

```bash
git add ebs/routes_youtube_auth.js ebs/routes_youtube_auth.test.js
git commit -m "Add Google OAuth routes for connecting a YouTube channel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: YouTube Live API wrapper

**Files:**
- Create: `ebs/youtube_live_api.js`
- Test: `ebs/youtube_live_api.test.js`

**Interfaces:**
- Consumes: `getValidYoutubeAccessToken(uid)` (Task 2), injectable as `getTokenImpl` for testing.
- Produces: `resolveActiveLiveChatId(uid, opts?): Promise<string|null>`, `listLiveChatMessages(uid, liveChatId, pageToken, opts?): Promise<{messages, nextPageToken, pollingIntervalMillis}|null>` — consumed by Task 7's poll loop.

- [ ] **Step 1: Write the failing test**

Create `ebs/youtube_live_api.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveActiveLiveChatId, listLiveChatMessages } from './youtube_live_api.js';

const fakeToken = async () => 'fake-token';

test('resolveActiveLiveChatId returns liveChatId from the active broadcast', async () => {
  const fetchImpl = async (url) => {
    assert.match(url, /broadcastStatus=active/);
    return { ok: true, json: async () => ({ items: [{ snippet: { liveChatId: 'chat-123' } }] }) };
  };
  const result = await resolveActiveLiveChatId('uid-1', { fetchImpl, getTokenImpl: fakeToken });
  assert.equal(result, 'chat-123');
});

test('resolveActiveLiveChatId returns null when nothing is active', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ items: [] }) });
  const result = await resolveActiveLiveChatId('uid-1', { fetchImpl, getTokenImpl: fakeToken });
  assert.equal(result, null);
});

test('resolveActiveLiveChatId returns null with no valid token', async () => {
  const result = await resolveActiveLiveChatId('uid-1', { getTokenImpl: async () => null });
  assert.equal(result, null);
});

test('resolveActiveLiveChatId returns null on a non-ok response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401 });
  const result = await resolveActiveLiveChatId('uid-1', { fetchImpl, getTokenImpl: fakeToken });
  assert.equal(result, null);
});

test('listLiveChatMessages returns messages, nextPageToken, and pollingIntervalMillis', async () => {
  const fetchImpl = async (url) => {
    assert.match(url, /liveChatId=chat-123/);
    return {
      ok: true,
      json: async () => ({
        items: [{ id: 'msg-1', snippet: { type: 'superChatEvent' } }],
        nextPageToken: 'token-abc',
        pollingIntervalMillis: 7000,
      }),
    };
  };
  const result = await listLiveChatMessages('uid-1', 'chat-123', null, { fetchImpl, getTokenImpl: fakeToken });
  assert.equal(result.messages.length, 1);
  assert.equal(result.nextPageToken, 'token-abc');
  assert.equal(result.pollingIntervalMillis, 7000);
});

test('listLiveChatMessages includes pageToken in the request when provided', async () => {
  const fetchImpl = async (url) => {
    assert.match(url, /pageToken=prev-token/);
    return { ok: true, json: async () => ({ items: [], nextPageToken: null, pollingIntervalMillis: 5000 }) };
  };
  await listLiveChatMessages('uid-1', 'chat-123', 'prev-token', { fetchImpl, getTokenImpl: fakeToken });
});

test('listLiveChatMessages returns null on a non-ok response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 403 });
  const result = await listLiveChatMessages('uid-1', 'chat-123', null, { fetchImpl, getTokenImpl: fakeToken });
  assert.equal(result, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ebs && node --test youtube_live_api.test.js`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Write `ebs/youtube_live_api.js`**

```js
import fetch from 'node-fetch';
import { logger } from './logger.js';
import { getValidYoutubeAccessToken } from './youtube_tokens.js';

/**
 * Finds the caller's currently active YouTube broadcast and returns its live
 * chat id, or null if nothing is live right now. `fetchImpl`/`getTokenImpl`
 * are injectable for testing; production callers should omit both.
 */
export async function resolveActiveLiveChatId(uid, { fetchImpl = fetch, getTokenImpl = getValidYoutubeAccessToken } = {}) {
  const token = await getTokenImpl(uid);
  if (!token) return null;
  const url = 'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet&broadcastStatus=active&broadcastType=all';
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    logger.warn('youtube_live_broadcasts_list_failed', { uid, status: res.status });
    return null;
  }
  const json = await res.json();
  return json?.items?.[0]?.snippet?.liveChatId || null;
}

/**
 * Fetches one page of live chat messages. Returns
 * { messages, nextPageToken, pollingIntervalMillis } or null on failure.
 * `pageToken` should be the previous call's nextPageToken; omit on the first
 * call for a given chat.
 */
export async function listLiveChatMessages(uid, liveChatId, pageToken, { fetchImpl = fetch, getTokenImpl = getValidYoutubeAccessToken } = {}) {
  const token = await getTokenImpl(uid);
  if (!token) return null;
  const params = new URLSearchParams({ liveChatId, part: 'snippet,authorDetails' });
  if (pageToken) params.set('pageToken', pageToken);
  const url = `https://www.googleapis.com/youtube/v3/liveChatMessages?${params.toString()}`;
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    logger.warn('youtube_live_chat_messages_failed', { uid, status: res.status });
    return null;
  }
  const json = await res.json();
  return {
    messages: json.items || [],
    nextPageToken: json.nextPageToken || null,
    pollingIntervalMillis: json.pollingIntervalMillis || 5000,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ebs && node --test youtube_live_api.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add ebs/youtube_live_api.js ebs/youtube_live_api.test.js
git commit -m "Add YouTube Live Streaming API wrapper (broadcasts + chat messages)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Event normalizer and seconds calculator

**Files:**
- Create: `ebs/youtube_live_events.js` (pure functions only in this task; Task 7 adds the poll loop to the same file)
- Test: `ebs/youtube_live_events.test.js`

**Interfaces:**
- Produces: `normalizeYoutubeChatMessage(raw): NormalizedEvent|null`, `secondsFromYoutubeEvent(rules, event): number` — consumed by Task 7's poll loop.
- `NormalizedEvent` shapes:
  - `{ type: 'youtube.superchat', amountUsd: number, currency: string, author: string|null }`
  - `{ type: 'youtube.member', memberLevelName: string|null, isUpgrade: boolean, author: string|null }`
  - `{ type: 'youtube.member_milestone', memberMonth: number, memberLevelName: string|null, author: string|null }`
  - `{ type: 'youtube.membership_gift', giftCount: number, memberLevelName: string|null, author: string|null }`

- [ ] **Step 1: Write the failing test**

Create `ebs/youtube_live_events.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeYoutubeChatMessage, secondsFromYoutubeEvent } from './youtube_live_events.js';
import { RULES as DEFAULT_RULES } from './rules.js';

test('normalizeYoutubeChatMessage: superChatEvent', () => {
  const raw = {
    authorDetails: { displayName: 'Alice' },
    snippet: { type: 'superChatEvent', superChatDetails: { amountMicros: '5000000', currency: 'USD' } },
  };
  const event = normalizeYoutubeChatMessage(raw);
  assert.deepEqual(event, { type: 'youtube.superchat', amountUsd: 5, currency: 'USD', author: 'Alice' });
});

test('normalizeYoutubeChatMessage: superStickerEvent', () => {
  const raw = {
    authorDetails: { displayName: 'Bob' },
    snippet: { type: 'superStickerEvent', superStickerDetails: { amountMicros: '2000000', currency: 'USD' } },
  };
  const event = normalizeYoutubeChatMessage(raw);
  assert.deepEqual(event, { type: 'youtube.superchat', amountUsd: 2, currency: 'USD', author: 'Bob' });
});

test('normalizeYoutubeChatMessage: newSponsorEvent', () => {
  const raw = {
    authorDetails: { displayName: 'Carol' },
    snippet: { type: 'newSponsorEvent', newSponsorDetails: { memberLevelName: 'Tier 1', isUpgrade: false } },
  };
  const event = normalizeYoutubeChatMessage(raw);
  assert.deepEqual(event, { type: 'youtube.member', memberLevelName: 'Tier 1', isUpgrade: false, author: 'Carol' });
});

test('normalizeYoutubeChatMessage: memberMilestoneChatEvent', () => {
  const raw = {
    authorDetails: { displayName: 'Dave' },
    snippet: { type: 'memberMilestoneChatEvent', memberMilestoneChatDetails: { memberMonth: 6, memberLevelName: 'Tier 1' } },
  };
  const event = normalizeYoutubeChatMessage(raw);
  assert.deepEqual(event, { type: 'youtube.member_milestone', memberMonth: 6, memberLevelName: 'Tier 1', author: 'Dave' });
});

test('normalizeYoutubeChatMessage: membershipGiftingEvent', () => {
  const raw = {
    authorDetails: { displayName: 'Erin' },
    snippet: { type: 'membershipGiftingEvent', membershipGiftingDetails: { giftMembershipsCount: 5, giftMembershipsLevelName: 'Tier 1' } },
  };
  const event = normalizeYoutubeChatMessage(raw);
  assert.deepEqual(event, { type: 'youtube.membership_gift', giftCount: 5, memberLevelName: 'Tier 1', author: 'Erin' });
});

test('normalizeYoutubeChatMessage: ignores textMessageEvent', () => {
  const raw = { snippet: { type: 'textMessageEvent', textMessageDetails: { messageText: 'hi' } } };
  assert.equal(normalizeYoutubeChatMessage(raw), null);
});

test('normalizeYoutubeChatMessage: ignores giftMembershipReceivedEvent (recipient-side echo)', () => {
  const raw = { snippet: { type: 'giftMembershipReceivedEvent', giftMembershipReceivedDetails: {} } };
  assert.equal(normalizeYoutubeChatMessage(raw), null);
});

test('normalizeYoutubeChatMessage: returns null with no type', () => {
  assert.equal(normalizeYoutubeChatMessage({}), null);
  assert.equal(normalizeYoutubeChatMessage(null), null);
});

test('secondsFromYoutubeEvent: superchat disabled returns 0', () => {
  const seconds = secondsFromYoutubeEvent(DEFAULT_RULES, { type: 'youtube.superchat', amountUsd: 10 });
  assert.equal(seconds, 0);
});

test('secondsFromYoutubeEvent: superchat below min_amount returns 0', () => {
  const rules = { ...DEFAULT_RULES, youtube_superchat: { enabled: true, per_usd: 60, min_amount: 5 } };
  const seconds = secondsFromYoutubeEvent(rules, { type: 'youtube.superchat', amountUsd: 2 });
  assert.equal(seconds, 0);
});

test('secondsFromYoutubeEvent: superchat computes per_usd * amount', () => {
  const rules = { ...DEFAULT_RULES, youtube_superchat: { enabled: true, per_usd: 60, min_amount: 1 } };
  const seconds = secondsFromYoutubeEvent(rules, { type: 'youtube.superchat', amountUsd: 5 });
  assert.equal(seconds, 300);
});

test('secondsFromYoutubeEvent: member returns base_seconds when enabled', () => {
  const rules = { ...DEFAULT_RULES, youtube_member: { enabled: true, base_seconds: 300 } };
  assert.equal(secondsFromYoutubeEvent(rules, { type: 'youtube.member' }), 300);
});

test('secondsFromYoutubeEvent: member_milestone returns base_seconds when enabled', () => {
  const rules = { ...DEFAULT_RULES, youtube_member_milestone: { enabled: true, base_seconds: 120 } };
  assert.equal(secondsFromYoutubeEvent(rules, { type: 'youtube.member_milestone', memberMonth: 6 }), 120);
});

test('secondsFromYoutubeEvent: membership_gift multiplies giftCount by per_gift_seconds', () => {
  const rules = { ...DEFAULT_RULES, youtube_membership_gift: { enabled: true, per_gift_seconds: 90 } };
  assert.equal(secondsFromYoutubeEvent(rules, { type: 'youtube.membership_gift', giftCount: 3 }), 270);
});

test('secondsFromYoutubeEvent: unknown event type returns 0', () => {
  assert.equal(secondsFromYoutubeEvent(DEFAULT_RULES, { type: 'youtube.unknown' }), 0);
  assert.equal(secondsFromYoutubeEvent(DEFAULT_RULES, null), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ebs && node --test youtube_live_events.test.js`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Write the pure functions in `ebs/youtube_live_events.js`**

```js
// Normalizer + seconds calculator for YouTube live chat events. The poll
// loop that drives these (startYoutubePolling / stopYoutubePolling) is added
// in a later step of this same file — kept together because they change
// together, per this module's single responsibility (turning YouTube live
// chat activity into timer seconds).

/**
 * Converts one raw liveChatMessages item into the internal event shape
 * secondsFromYoutubeEvent consumes. Returns null for message types this
 * feature doesn't act on (plain chat, moderation events, and
 * giftMembershipReceivedEvent — the recipient-side echo of
 * membershipGiftingEvent, which would double-count if also handled).
 */
export function normalizeYoutubeChatMessage(raw) {
  const snippet = raw?.snippet;
  const type = snippet?.type;
  const author = raw?.authorDetails?.displayName || null;
  if (!type) return null;

  switch (type) {
    case 'superChatEvent': {
      const d = snippet.superChatDetails;
      if (!d) return null;
      return { type: 'youtube.superchat', amountUsd: microsToUsd(d.amountMicros), currency: d.currency, author };
    }
    case 'superStickerEvent': {
      const d = snippet.superStickerDetails;
      if (!d) return null;
      return { type: 'youtube.superchat', amountUsd: microsToUsd(d.amountMicros), currency: d.currency, author };
    }
    case 'newSponsorEvent': {
      const d = snippet.newSponsorDetails;
      return { type: 'youtube.member', memberLevelName: d?.memberLevelName || null, isUpgrade: Boolean(d?.isUpgrade), author };
    }
    case 'memberMilestoneChatEvent': {
      const d = snippet.memberMilestoneChatDetails;
      return { type: 'youtube.member_milestone', memberMonth: Number(d?.memberMonth) || 0, memberLevelName: d?.memberLevelName || null, author };
    }
    case 'membershipGiftingEvent': {
      const d = snippet.membershipGiftingDetails;
      return { type: 'youtube.membership_gift', giftCount: Math.max(0, Number(d?.giftMembershipsCount) || 0), memberLevelName: d?.giftMembershipsLevelName || null, author };
    }
    default:
      return null;
  }
}

function microsToUsd(amountMicros) {
  const n = Number(amountMicros);
  if (!Number.isFinite(n)) return 0;
  return n / 1_000_000;
}

/**
 * Given resolved rules for a broadcaster and one normalized event, returns
 * how many seconds to add to their timer (before any hype/bonus multiplier —
 * the caller applies that separately, same as the Twitch pipeline does).
 */
export function secondsFromYoutubeEvent(rules, event) {
  if (!event) return 0;
  switch (event.type) {
    case 'youtube.superchat': {
      const cfg = rules.youtube_superchat;
      if (!cfg?.enabled) return 0;
      if (event.amountUsd < Number(cfg.min_amount || 0)) return 0;
      return Math.floor(event.amountUsd * Number(cfg.per_usd || 0));
    }
    case 'youtube.member': {
      const cfg = rules.youtube_member;
      if (!cfg?.enabled) return 0;
      return Math.max(0, Number(cfg.base_seconds || 0));
    }
    case 'youtube.member_milestone': {
      const cfg = rules.youtube_member_milestone;
      if (!cfg?.enabled) return 0;
      return Math.max(0, Number(cfg.base_seconds || 0));
    }
    case 'youtube.membership_gift': {
      const cfg = rules.youtube_membership_gift;
      if (!cfg?.enabled) return 0;
      return event.giftCount * Math.max(0, Number(cfg.per_gift_seconds || 0));
    }
    default:
      return 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ebs && node --test youtube_live_events.test.js`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git add ebs/youtube_live_events.js ebs/youtube_live_events.test.js
git commit -m "Add YouTube chat event normalizer and seconds calculator

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Poll loop orchestration and quota tracking

**Files:**
- Modify: `ebs/youtube_live_events.js` (add to the file from Task 6)
- Test: `ebs/youtube_live_events.test.js` (add to the file from Task 6)

**Interfaces:**
- Consumes: `resolveActiveLiveChatId`, `listLiveChatMessages` (Task 5); `getRules` (existing, `rules_store.js`); `addSeconds`, `applyMultipliers` (existing/Task 8 — see note below); `addLogEntry` (existing, `event_log.js`); `normalizeYoutubeChatMessage`, `secondsFromYoutubeEvent` (Task 6, same file).
- Produces: `startYoutubePolling(uid)`, `stopYoutubePolling(uid)`, `isYoutubePolling(uid): boolean` — consumed by Task 8's lifecycle hooks.

Note on ordering: this task calls `applyMultipliers` from `state.js`, which Task 8 creates by extracting existing inline logic out of `server.js`. Do Task 8's `state.js` extraction (its Step 1) first if executing out of order, or stub `applyMultipliers` locally in this task and switch the import in Task 8 — the version below assumes `state.js` already exports it.

- [ ] **Step 1: Write the failing test for quota gating**

Add to `ebs/youtube_live_events.test.js`:

```js
import { startYoutubePolling, stopYoutubePolling, isYoutubePolling, __resetQuotaForTest, __setQuotaUsedForTest } from './youtube_live_events.js';

test('startYoutubePolling refuses to start when quota is exhausted', () => {
  __resetQuotaForTest();
  __setQuotaUsedForTest(1_000_000); // force past the safety margin
  startYoutubePolling('quota-test-uid');
  assert.equal(isYoutubePolling('quota-test-uid'), false);
  __resetQuotaForTest();
});

test('startYoutubePolling is a no-op if already running for that uid', () => {
  __resetQuotaForTest();
  // Two starts in a row must not throw or create a second loop record —
  // isYoutubePolling should simply report true either way. Immediately stop
  // to avoid a real network call from the async poll cycle leaking into
  // other tests.
  startYoutubePolling('dup-test-uid');
  startYoutubePolling('dup-test-uid');
  assert.equal(isYoutubePolling('dup-test-uid'), true);
  stopYoutubePolling('dup-test-uid');
  assert.equal(isYoutubePolling('dup-test-uid'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ebs && node --test youtube_live_events.test.js`
Expected: FAIL — `startYoutubePolling` etc. don't exist yet.

- [ ] **Step 3: Append the poll loop to `ebs/youtube_live_events.js`**

```js
import { logger } from './logger.js';
import { getRules } from './rules_store.js';
import { addSeconds, applyMultipliers } from './state.js';
import { addLogEntry } from './event_log.js';
import { resolveActiveLiveChatId, listLiveChatMessages } from './youtube_live_api.js';

const loops = new Map(); // uid -> { stopped: boolean, liveChatId: string|null, pageToken: string|null }

// Process-wide YouTube Data API quota tracking. Google allocates quota per
// Cloud project, not per end user, so every connected broadcaster draws from
// the same daily pool — see the design doc's Quota Safety section.
const DAILY_QUOTA_UNITS = Number(process.env.YOUTUBE_DAILY_QUOTA_UNITS || 10000);
const QUOTA_SAFETY_MARGIN = 0.9; // stop starting new loops at 90% of the cap
let quotaUnitsUsedToday = 0;
let quotaDayKey = currentUtcDay();

function currentUtcDay() {
  return new Date().toISOString().slice(0, 10);
}

function rolloverQuotaIfNewDay() {
  const day = currentUtcDay();
  if (day !== quotaDayKey) {
    quotaDayKey = day;
    quotaUnitsUsedToday = 0;
  }
}

function recordQuotaUsage(units) {
  rolloverQuotaIfNewDay();
  quotaUnitsUsedToday += units;
}

function quotaAvailable() {
  rolloverQuotaIfNewDay();
  return quotaUnitsUsedToday < DAILY_QUOTA_UNITS * QUOTA_SAFETY_MARGIN;
}

// Exported only for youtube_live_events.test.js.
export function __resetQuotaForTest() {
  quotaUnitsUsedToday = 0;
  quotaDayKey = currentUtcDay();
}
export function __setQuotaUsedForTest(units) {
  quotaUnitsUsedToday = units;
}

export function isYoutubePolling(uid) {
  return loops.has(String(uid));
}

export function startYoutubePolling(uid) {
  uid = String(uid);
  if (loops.has(uid)) return;
  if (!quotaAvailable()) {
    logger.warn('youtube_poll_start_blocked_quota', { uid, quotaUnitsUsedToday });
    return;
  }
  const loop = { stopped: false, liveChatId: null, pageToken: null };
  loops.set(uid, loop);
  logger.info('youtube_poll_started', { uid });
  runPollCycle(uid, loop);
}

export function stopYoutubePolling(uid) {
  uid = String(uid);
  const loop = loops.get(uid);
  if (!loop) return;
  loop.stopped = true;
  loops.delete(uid);
  logger.info('youtube_poll_stopped', { uid });
}

async function runPollCycle(uid, loop) {
  if (loop.stopped) return;
  try {
    if (!loop.liveChatId) {
      loop.liveChatId = await resolveActiveLiveChatId(uid);
      recordQuotaUsage(1);
      if (!loop.liveChatId) {
        // Live on Twitch but not (yet, or anymore) on YouTube — check back
        // slowly instead of burning quota at chat-polling speed for nothing.
        scheduleNext(uid, loop, 60_000);
        return;
      }
    }

    const page = await listLiveChatMessages(uid, loop.liveChatId, loop.pageToken);
    recordQuotaUsage(5);
    if (!page) {
      // Broadcast likely ended or auth failed — drop the cached chat id and
      // fall back to slow re-detection rather than hammering a dead chat.
      loop.liveChatId = null;
      scheduleNext(uid, loop, 60_000);
      return;
    }

    loop.pageToken = page.nextPageToken;

    if (!quotaAvailable()) {
      logger.warn('youtube_poll_quota_exhausted', { uid, quotaUnitsUsedToday });
      stopYoutubePolling(uid);
      return;
    }

    const rules = getRules(uid);
    for (const raw of page.messages) {
      const event = normalizeYoutubeChatMessage(raw);
      if (!event) continue;
      const baseSeconds = secondsFromYoutubeEvent(rules, event);
      if (baseSeconds <= 0) continue;
      const { appliedSeconds, hypeMultiplier, bonusMultiplier } = applyMultipliers(uid, baseSeconds, rules);
      if (appliedSeconds <= 0) continue;
      addSeconds(uid, appliedSeconds);
      addLogEntry({
        type: event.type,
        baseSeconds,
        appliedSeconds,
        hypeMultiplier,
        bonusMultiplier,
        amountUsd: event.amountUsd,
        memberLevelName: event.memberLevelName,
        giftCount: event.giftCount,
        userId: uid,
        userName: event.author || undefined,
      });
    }

    scheduleNext(uid, loop, Math.max(2000, page.pollingIntervalMillis));
  } catch (e) {
    logger.error('youtube_poll_cycle_error', { uid, message: e?.message });
    scheduleNext(uid, loop, 60_000);
  }
}

function scheduleNext(uid, loop, delayMs) {
  if (loop.stopped) return;
  const timer = setTimeout(() => runPollCycle(uid, loop), delayMs);
  if (typeof timer.unref === 'function') timer.unref();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ebs && node --test youtube_live_events.test.js`
Expected: PASS (18 tests). Note: this depends on `state.js` exporting `applyMultipliers` — complete Task 8's Step 1 first if it isn't there yet.

- [ ] **Step 5: Manual verification**

Against a real YouTube test broadcast (YouTube Studio → Create → Live → a private/unlisted test stream) with a connected account that has posted a Super Chat to it:

```bash
cd ebs && node -e "
import('./youtube_live_events.js').then(async (m) => {
  m.startYoutubePolling('your-real-connected-uid');
  console.log('polling:', m.isYoutubePolling('your-real-connected-uid'));
  setTimeout(() => { m.stopYoutubePolling('your-real-connected-uid'); process.exit(0); }, 30000);
});
"
```

Watch the logs for `youtube_poll_started`, then confirm the timer's remaining seconds increased by the expected amount after a test Super Chat is sent in that broadcast's chat.

- [ ] **Step 6: Commit**

```bash
git add ebs/youtube_live_events.js ebs/youtube_live_events.test.js
git commit -m "Add YouTube poll loop with process-wide quota tracking

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Wire into server.js lifecycle and mount routes

**Files:**
- Modify: `ebs/state.js` (extract `applyMultipliers`)
- Modify: `ebs/server.js:1927-1951` (use `applyMultipliers`), `ebs/server.js:1114` (`handleBroadcasterWentLive`), `ebs/server.js:1144` (`handleBroadcasterWentOffline`), and near line 106 (mount routes)

**Interfaces:**
- Consumes: `startYoutubePolling`, `stopYoutubePolling` (Task 7); `getYoutubeAccount` (Task 3); `mountYoutubeAuthRoutes` (Task 4).
- Produces: `applyMultipliers(uid, baseSeconds, rules): {appliedSeconds, hypeMultiplier, bonusMultiplier}` in `state.js` — consumed by both the Twitch path (`server.js`) and the YouTube path (Task 7, already written against this signature).

This task has no new automated tests of its own (the logic it touches is either already covered — `secondsFromEvent` behavior is unchanged — or is server startup/wiring code this codebase doesn't unit test anywhere else). Verification is the refactor being behavior-preserving (Step 2) plus an end-to-end manual run (Step 5).

- [ ] **Step 1: Extract `applyMultipliers` into `ebs/state.js`**

Add near `addSeconds` in `ebs/state.js`:

```js
/**
 * Applies the active Hype Train / Bonus Time multiplier (if any) to a base
 * seconds amount for a broadcaster. Shared by both the Twitch event pipeline
 * (server.js's processEventTimer) and the YouTube poll loop
 * (youtube_live_events.js) so a multiplier applies uniformly regardless of
 * which platform's event triggered it.
 */
export function applyMultipliers(uid, baseSeconds, rules) {
  if (baseSeconds <= 0) return { appliedSeconds: 0, hypeMultiplier: 1, bonusMultiplier: 1 };
  const userState = state.users.get(String(uid));
  let hypeMultiplier = 1;
  let bonusMultiplier = 1;
  if (userState?.hypeActive) hypeMultiplier = Number(rules.hypeTrain?.multiplier || 1);
  if (userState?.bonusActive) bonusMultiplier = Number(rules.bonusTime?.multiplier || 1);
  const totalMultiplier = rules.bonusTime?.stackWithHype
    ? hypeMultiplier * bonusMultiplier
    : Math.max(hypeMultiplier, bonusMultiplier);
  const appliedSeconds = Math.floor(baseSeconds * totalMultiplier);
  return { appliedSeconds, hypeMultiplier, bonusMultiplier };
}
```

- [ ] **Step 2: Use it in `server.js`'s `processEventTimer` (behavior-preserving refactor)**

In `ebs/server.js`, replace lines 1932-1951:

```js
  let appliedSeconds = baseSeconds;
  let hypeMultiplier = 1;
  let bonusMultiplier = 1;
  const userState = state.users.get(String(timerUid));
  if (baseSeconds > 0) {
    const R = getRules(timerUid);
    if (userState?.hypeActive) {
      hypeMultiplier = Number(R.hypeTrain?.multiplier || 1);
    }
    if (userState?.bonusActive) {
      bonusMultiplier = Number(R.bonusTime?.multiplier || 1);
    }
    let totalMultiplier;
    if (R.bonusTime?.stackWithHype) {
      totalMultiplier = hypeMultiplier * bonusMultiplier;
    } else {
      totalMultiplier = Math.max(hypeMultiplier, bonusMultiplier);
    }
    appliedSeconds = Math.floor(baseSeconds * totalMultiplier);
  }
```

with:

```js
  let appliedSeconds = baseSeconds;
  let hypeMultiplier = 1;
  let bonusMultiplier = 1;
  if (baseSeconds > 0) {
    const R = getRules(timerUid);
    ({ appliedSeconds, hypeMultiplier, bonusMultiplier } = applyMultipliers(timerUid, baseSeconds, R));
  }
```

Add `applyMultipliers` to the existing `import { ... } from "./state.js"` block at the top of `server.js`.

Verify this is behavior-preserving: the multiplier math (hype/bonus lookup, `stackWithHype` branch, `Math.floor`) is copied verbatim into `state.js`'s new function — no logic changed, only moved.

- [ ] **Step 3: Wire the YouTube poll lifecycle into the existing online/offline handlers**

In `ebs/server.js`, add the import:

```js
import { startYoutubePolling, stopYoutubePolling } from "./youtube_live_events.js";
import { getYoutubeAccount } from "./youtube_accounts_store.js";
import { mountYoutubeAuthRoutes } from "./routes_youtube_auth.js";
```

Modify `handleBroadcasterWentLive` (around line 1114) — after the existing `startEventSubForUser(userId)` call at the end of the function, add:

```js
  const youtubeAccount = getYoutubeAccount(userId);
  if (youtubeAccount?.pollIntentEnabled) {
    startYoutubePolling(userId);
  }
```

Modify `handleBroadcasterWentOffline` (around line 1144) — after the existing `pauseEventSubForUser(userId)` call, add:

```js
  stopYoutubePolling(userId);
```

- [ ] **Step 4: Mount the YouTube auth routes and wire the immediate-start callback**

Near the existing `mountAuthRoutes(app, { ... })` call, add:

```js
mountYoutubeAuthRoutes(app, {
  // If the broadcaster is already live when they flip the toggle, start (or
  // stop) polling immediately rather than waiting for the next stream.online
  // — the toggle otherwise wouldn't take effect until their next go-live.
  onPollIntentChanged: (userId, enabled) => {
    const connection = broadcasterConnections.get(String(userId));
    const isCurrentlyLive = Boolean(connection?.ws && connection.ws.readyState === 1);
    if (!isCurrentlyLive) return;
    if (enabled) startYoutubePolling(userId);
    else stopYoutubePolling(userId);
  },
});
```

Place this call after `broadcasterConnections` is declared (it's referenced inside the callback closure, not called immediately, so declaration order only needs `broadcasterConnections` to exist by the time a request comes in — but keep it near the other route-mounting calls for readability).

Also call `loadYoutubeAccounts()` and `loadYoutubeTokens()` alongside the existing `loadRules()` / `loadTokens()` calls made at startup, so a process restart doesn't lose connected accounts.

- [ ] **Step 5: Manual end-to-end verification**

1. Start the EBS locally with `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` set and a real `DATABASE_URL`.
2. Log in with Twitch, visit `/youtube/oauth/start`, complete the Google consent flow, confirm redirect back to `/overlay/config` with no error.
3. Confirm a row now exists in `youtube_tokens` for your uid, and `youtube-accounts.json` (in `DATA_DIR`) has your channel info.
4. `POST /youtube/poll-intent` with `{ "enabled": true }` while NOT live on Twitch — confirm `isYoutubePolling(uid)` stays `false` (nothing starts yet).
5. Go live on Twitch (or use the existing "Verify Connection" test path if this app has one) — confirm `youtube_poll_started` appears in logs.
6. End the Twitch stream — confirm `youtube_poll_stopped` appears in logs, and the connection record survives (a subsequent go-live restarts polling without reconnecting YouTube).
7. Simulate the 48h-reconnect case directly: with polling active, manually call `handleBroadcasterWentOffline` then `handleBroadcasterWentLive` in quick succession (or trigger real stream.offline/online webhooks via the Twitch CLI's event-simulation, if available) and confirm polling stops then restarts with no manual toggle interaction, and the timer's remaining seconds is unaffected by the blip itself.

- [ ] **Step 6: Commit**

```bash
git add ebs/state.js ebs/server.js
git commit -m "Wire YouTube polling into existing stream online/offline lifecycle

Ties poll loop start/stop to the same handleBroadcasterWentLive/
handleBroadcasterWentOffline hooks that already manage the Twitch
EventSub connection, so it survives Twitch's ~48h forced ingest
reconnect with no manual action. Also extracts the hype/bonus
multiplier math into state.js so it applies uniformly to both
the Twitch and YouTube event pipelines.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Config UI — Multistreaming section

**Files:**
- Modify: `ebs/views/overlayConfigPage.js`

**Interfaces:**
- Consumes: `GET` of current rules/account state (existing rules-fetch endpoint, plus a small addition to also return `getYoutubeAccount(uid)` — add this field to whatever endpoint already serves `getRules` to the config page), `POST /youtube/oauth/start` (redirect), `POST /youtube/disconnect`, `POST /youtube/poll-intent`, and the existing rules-save endpoint (extended to accept the 4 new rule keys from Task 1 — no server change needed there since `setRules` already merges any patch keys it recognizes).

This task has no automated tests — `overlayConfigPage.js` is server-rendered HTML with inline `<script>`, and this codebase has no browser/DOM test harness anywhere else in it. Verification is manual, per Step 4.

- [ ] **Step 1: Add the collapsed section markup**

In `ebs/views/overlayConfigPage.js`, near the existing `raid` controls (around line 495), add a new collapsed section using the same `<details>`-based collapse pattern already used elsewhere on the page if one exists — otherwise a simple hidden `<div>` toggled by a button, matching whatever the page's existing convention is for optional sections. Contents when collapsed/not-connected:

```html
<div class="section" id="youtube-section">
  <h3>Multistreaming (optional)</h3>
  <p class="hint">Also feed this timer from YouTube Super Chats and memberships if you simulcast there.</p>
  <div id="youtube-not-connected">
    <a class="btn" href="/youtube/oauth/start">Connect YouTube</a>
  </div>
  <div id="youtube-connected" style="display:none;">
    <p>Connected: <span id="youtube-channel-title"></span></p>
    <label style="display:flex; gap:6px; align-items:center;">
      <input id="youtube-poll-intent" type="checkbox" /> Also poll YouTube while live on Twitch
    </label>
    <div class="control"><label>Super Chat / Sticker (sec per $1)</label>
      <input id="r_youtube_superchat_enabled" type="checkbox" /> Enabled
      <input id="r_youtube_superchat_per_usd" type="number" min="0" step="1" value="60" style="max-width:120px" />
      <input id="r_youtube_superchat_min_amount" type="number" min="0" step="0.5" value="1" style="max-width:100px" />
    </div>
    <div class="control"><label>New membership (sec)</label>
      <input id="r_youtube_member_enabled" type="checkbox" /> Enabled
      <input id="r_youtube_member_base" type="number" min="0" step="1" value="300" style="max-width:120px" />
    </div>
    <div class="control"><label>Membership milestone (sec)</label>
      <input id="r_youtube_member_milestone_enabled" type="checkbox" /> Enabled
      <input id="r_youtube_member_milestone_base" type="number" min="0" step="1" value="300" style="max-width:120px" />
    </div>
    <div class="control"><label>Gifted memberships (sec per gift)</label>
      <input id="r_youtube_membership_gift_enabled" type="checkbox" /> Enabled
      <input id="r_youtube_membership_gift_per_gift" type="number" min="0" step="1" value="300" style="max-width:120px" />
    </div>
    <button id="youtube-disconnect-btn" class="btn-secondary">Disconnect YouTube</button>
  </div>
</div>
```

- [ ] **Step 2: Wire the load/populate logic**

Wherever the page's existing rule-loading code populates `r_raid_*` fields from the fetched rules object (see the pattern at the `r_raid_enabled` load site), add analogous lines for the four new rule keys, plus a fetch of the YouTube account state to toggle between `#youtube-not-connected` and `#youtube-connected`:

```js
if (rr && rr.youtube_superchat) {
  document.getElementById('r_youtube_superchat_enabled').checked = Boolean(rr.youtube_superchat.enabled);
  document.getElementById('r_youtube_superchat_per_usd').value = rr.youtube_superchat.per_usd ?? 60;
  document.getElementById('r_youtube_superchat_min_amount').value = rr.youtube_superchat.min_amount ?? 1;
}
if (rr && rr.youtube_member) {
  document.getElementById('r_youtube_member_enabled').checked = Boolean(rr.youtube_member.enabled);
  document.getElementById('r_youtube_member_base').value = rr.youtube_member.base_seconds ?? 300;
}
if (rr && rr.youtube_member_milestone) {
  document.getElementById('r_youtube_member_milestone_enabled').checked = Boolean(rr.youtube_member_milestone.enabled);
  document.getElementById('r_youtube_member_milestone_base').value = rr.youtube_member_milestone.base_seconds ?? 300;
}
if (rr && rr.youtube_membership_gift) {
  document.getElementById('r_youtube_membership_gift_enabled').checked = Boolean(rr.youtube_membership_gift.enabled);
  document.getElementById('r_youtube_membership_gift_per_gift').value = rr.youtube_membership_gift.per_gift_seconds ?? 300;
}

if (youtubeAccount) {
  document.getElementById('youtube-not-connected').style.display = 'none';
  document.getElementById('youtube-connected').style.display = '';
  document.getElementById('youtube-channel-title').textContent = youtubeAccount.channelTitle || youtubeAccount.channelId;
  document.getElementById('youtube-poll-intent').checked = Boolean(youtubeAccount.pollIntentEnabled);
}
```

- [ ] **Step 3: Wire the save/toggle logic**

Add the four new keys to wherever the page's existing save handler builds the rules patch object (same pattern as the `raid:` block):

```js
youtube_superchat: {
  enabled: Boolean((document.getElementById('r_youtube_superchat_enabled')||{}).checked),
  per_usd: Number((document.getElementById('r_youtube_superchat_per_usd')||{}).value || 60),
  min_amount: Number((document.getElementById('r_youtube_superchat_min_amount')||{}).value || 1),
},
youtube_member: {
  enabled: Boolean((document.getElementById('r_youtube_member_enabled')||{}).checked),
  base_seconds: Number((document.getElementById('r_youtube_member_base')||{}).value || 300),
},
youtube_member_milestone: {
  enabled: Boolean((document.getElementById('r_youtube_member_milestone_enabled')||{}).checked),
  base_seconds: Number((document.getElementById('r_youtube_member_milestone_base')||{}).value || 300),
},
youtube_membership_gift: {
  enabled: Boolean((document.getElementById('r_youtube_membership_gift_enabled')||{}).checked),
  per_gift_seconds: Number((document.getElementById('r_youtube_membership_gift_per_gift')||{}).value || 300),
},
```

And wire the toggle/disconnect button handlers:

```js
document.getElementById('youtube-poll-intent').addEventListener('change', async (e) => {
  await fetch('/youtube/poll-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: e.target.checked }),
  });
});

document.getElementById('youtube-disconnect-btn').addEventListener('click', async () => {
  await fetch('/youtube/disconnect', { method: 'POST' });
  location.reload();
});
```

- [ ] **Step 4: Manual verification**

1. Load `/overlay/config` as a broadcaster with no YouTube connection — confirm the Multistreaming section shows only "Connect YouTube" and every other section on the page is unchanged (this is the "no drag for Twitch-only users" check — compare a screenshot before/after this task for a non-connected account).
2. Click "Connect YouTube", complete the OAuth flow, confirm the page now shows the connected channel name and the four rule controls.
3. Toggle "Also poll YouTube while live on Twitch" on and off, confirm the `/youtube/poll-intent` request succeeds (check network tab).
4. Set a Super Chat rule value, save, reload the page, confirm it persisted.
5. Click "Disconnect YouTube", confirm the section reverts to the "Connect YouTube" state.

- [ ] **Step 5: Commit**

```bash
git add ebs/views/overlayConfigPage.js
git commit -m "Add Multistreaming config UI section for YouTube integration

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

**Spec coverage:** Event coverage (Task 6), architecture/parallel pipeline (Tasks 5-7), OAuth (Task 4), rule config (Task 1), lifecycle tied to stream online/offline (Task 8), quota safety (Task 7), UI placement (Task 9), error handling (token refresh failures in Task 2, no-active-broadcast and quota-exhausted handling in Task 7) are all covered. Out-of-scope items (YouTube-only creators, auto-detection, dedicated worker service) have no tasks, as intended.

**Type/interface consistency check:** `secondsFromYoutubeEvent(rules, event)` (Task 6) is called from the poll loop (Task 7) with `(rules, event)` — matches. `applyMultipliers(uid, baseSeconds, rules)` (Task 8, `state.js`) is called identically from both `server.js`'s `processEventTimer` and Task 7's poll loop — matches. `getYoutubeAccount(uid)` (Task 3) return shape (`{channelId, channelTitle, pollIntentEnabled, connectedAt}`) is consumed consistently in Task 8 (`.pollIntentEnabled`) and Task 9 (`.channelTitle`, `.channelId`, `.pollIntentEnabled`).
