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
  max: 8,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

db.on('error', (err) => {
  logger.error('pg_pool_error', { message: err?.message });
});

// Dedicated, small pool for express-session (connect-pg-simple). Session reads
// happen on nearly every request, so they must never queue behind a burst of
// heavier app queries sharing the same pool — that starvation is exactly what
// caused "Connection terminated due to connection timeout" crashes on /admin,
// whose dashboard fires 6+ concurrent DB-backed requests on load.
export const sessionDb = new Pool({
  connectionString,
  max: 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

sessionDb.on('error', (err) => {
  logger.error('pg_session_pool_error', { message: err?.message });
});
