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
export const db = new Pool({
  connectionString,
  max: 6,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
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
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

sessionDb.on('error', (err) => {
  logger.error('pg_session_pool_error', { message: err?.message });
});
