import pg from 'pg';
import { logger } from './logger.js';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. EBS requires a Postgres connection (Supabase pooler URL, port 6543).');
}

// Supabase's transaction-mode pooler accepts up to ~15 connections per project
// on the free/pro tiers. Cap our pool below that so ad-hoc queries from psql /
// Supabase Studio still have headroom.
export const db = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

db.on('error', (err) => {
  logger.error('pg_pool_error', { message: err?.message });
});
