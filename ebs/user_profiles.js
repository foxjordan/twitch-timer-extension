import { readFile } from 'fs/promises';
import path from 'path';
import { fetchUserProfile, fetchChannelInfo } from './twitch_api.js';
import { atomicWriteFile } from './atomic_write.js';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const PROFILES_PATH = path.resolve(DATA_DIR, 'user-profiles.json');
const profiles = new Map(); // userId -> { login, displayName, firstSeenAt }

export async function loadUserProfiles() {
  try {
    const raw = await readFile(PROFILES_PATH, 'utf-8');
    const obj = JSON.parse(raw);
    for (const [uid, profile] of Object.entries(obj)) {
      if (profile && typeof profile === 'object') {
        profiles.set(String(uid), profile);
      }
    }
  } catch {}
}

async function persistUserProfiles() {
  try {
    const obj = {};
    for (const [uid, profile] of profiles.entries()) obj[uid] = profile;
    await atomicWriteFile(PROFILES_PATH, JSON.stringify(obj, null, 2));
  } catch {}
}

export function setUserProfile(userId, login, displayName) {
  const uid = String(userId);
  const existing = profiles.get(uid);
  profiles.set(uid, {
    // Preserve any other fields already stored on this profile (e.g.
    // broadcasterLanguage, eventSubWebhookSubIds) — this used to only keep
    // login/displayName/firstSeenAt, silently dropping everything else on
    // the next login.
    ...existing,
    login: login || existing?.login || null,
    displayName: displayName || login || existing?.displayName || null,
    // Set once, the first time we ever learn about this broadcaster — not a
    // true "joined" date (we may not have known about them immediately) but
    // the best available proxy for one, and never overwritten afterward.
    firstSeenAt: existing?.firstSeenAt || new Date().toISOString(),
  });
  persistUserProfiles().catch(() => {});
}

export function getUserProfile(userId) {
  return profiles.get(String(userId)) || null;
}

// Fetches and stores { login, displayName } for a broadcaster who's missing
// one or both — shared by any code path that discovers a broadcaster without
// a complete profile (extension-JWT-only users who never did the full OAuth
// login, so we never got their login from that flow). Rate-limited per
// process lifetime via attemptedBackfills so repeated callers (e.g. the
// admin stats poll) don't hammer Twitch every 10 seconds for a user whose
// fetch already failed.
const attemptedBackfills = new Set();
export async function backfillUserProfile(userId, channelId = null) {
  const uid = String(userId);
  const existing = getUserProfile(uid);
  if (existing?.login) return existing;
  if (attemptedBackfills.has(uid)) return existing;
  attemptedBackfills.add(uid);
  try {
    const profile = await fetchUserProfile(uid, channelId || uid);
    if (profile?.login) {
      setUserProfile(uid, profile.login, profile.displayName);
    }
  } catch {}
  return getUserProfile(uid);
}

// Broadcaster's declared stream language (Twitch's broadcaster_language
// field), separate from backfillUserProfile's login/displayName — refetched
// periodically since a streamer's declared language can change, unlike their
// login. Lazy: only called where the value is actually needed (currently
// just the admin funnel query), not on every login, to avoid spending Twitch
// API calls on data nothing is reading yet.
const LANGUAGE_REFRESH_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export async function ensureBroadcasterLanguage(userId) {
  const uid = String(userId);
  const existing = profiles.get(uid) || {};
  const fetchedAt = existing.languageFetchedAt ? new Date(existing.languageFetchedAt).getTime() : 0;
  if (existing.broadcasterLanguage && Date.now() - fetchedAt < LANGUAGE_REFRESH_MS) {
    return existing.broadcasterLanguage;
  }
  const info = await fetchChannelInfo(uid).catch(() => null);
  const language = info?.broadcasterLanguage || existing.broadcasterLanguage || null;
  profiles.set(uid, { ...existing, broadcasterLanguage: language, languageFetchedAt: new Date().toISOString() });
  persistUserProfiles().catch(() => {});
  return language;
}

// Tracks EventSub webhook subscription ids (stream.online/stream.offline)
// created for this broadcaster, so GDPR account deletion can explicitly
// remove them from Twitch's side instead of leaving them to accumulate
// against the app's subscription-count limits. ensureStreamStatusWebhookSubs
// only returns ids for subscriptions it actually just created (empty on a
// 409-already-exists), so this merges rather than replaces.
export function addEventSubWebhookSubIds(userId, ids) {
  if (!ids || ids.length === 0) return;
  const uid = String(userId);
  const existing = profiles.get(uid) || {};
  const merged = Array.from(new Set([...(existing.eventSubWebhookSubIds || []), ...ids]));
  profiles.set(uid, { ...existing, eventSubWebhookSubIds: merged });
  persistUserProfiles().catch(() => {});
}

export function getEventSubWebhookSubIds(userId) {
  return profiles.get(String(userId))?.eventSubWebhookSubIds || [];
}

export function deleteUserProfile(userId) {
  const uid = String(userId);
  const existed = profiles.has(uid);
  profiles.delete(uid);
  if (existed) persistUserProfiles().catch(() => {});
  return existed;
}
