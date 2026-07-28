import pg from 'pg';
import { logger } from './logger.js';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. EBS requires a Postgres connection (Supabase pooler URL, port 6543).');
}

// Supabase's transaction-mode pooler accepts up to ~15 connections per project
// on the free/pro tiers. Cap our pools below that so ad-hoc queries from psql /
// Supabase Studio still have headroom.
//
// Measured directly against prod (see incident notes): a single new pooled
// connection (TLS + Postgres auth via Supavisor) takes ~300-500ms, but 10
// opened concurrently take 1.8-2.4s EACH — Supavisor visibly serializes/
// throttles concurrent connection setup rather than our own pool being the
// bottleneck. That makes a burst of simultaneous cold-starts (which happens
// whenever the pool has fully idled out between page loads) genuinely able
// to exceed connectionTimeoutMillis under real traffic, independent of `max`.
// idleTimeoutMillis was 30s, which is short enough that pools drain to zero
// between ordinary browsing gaps, guaranteeing a cold-start burst on most
// fresh page loads. Raised well past typical between-request gaps so warm
// connections persist across normal usage, and `min` raised so routine
// bursts are absorbed without needing new connections at all.
export const db = new Pool({
  connectionString,
  max: 6,
  min: 3,
  idleTimeoutMillis: 10 * 60_000,
  connectionTimeoutMillis: 8_000,
});

db.on('error', (err) => {
  logger.error('pg_pool_error', { message: err?.message });
});

// Dedicated pool for express-session (connect-pg-simple). Session reads
// happen on nearly every request, so they must never queue behind a burst of
// heavier app queries sharing the same pool — that starvation is exactly what
// caused "Connection terminated due to connection timeout" crashes across
// the whole site. Sized at 8 (not the original 3) because a single dashboard
// page load fires a dozen or so concurrent API calls, each needing a session
// read — three connections meant most of those twelve queued and several
// timed out, on one person's one page load, independent of any other
// traffic. Paired with session_read_cache.js, which collapses concurrent
// reads for the same session id so this pool absorbs a burst rather than
// serving twelve near-identical queries for it.
export const sessionDb = new Pool({
  connectionString,
  max: 8,
  min: 5,
  idleTimeoutMillis: 10 * 60_000,
  connectionTimeoutMillis: 8_000,
});

sessionDb.on('error', (err) => {
  logger.error('pg_session_pool_error', { message: err?.message });
});
