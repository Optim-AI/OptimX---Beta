// database/client.ts
// Drizzle Client Singleton for Next.js
// PostgreSQL: local Supabase (dev) + production Supabase
//
// Local Supabase DB: postgresql://postgres:postgres@localhost:54322/postgres
// Production: Your Supabase project's connection string
//
// Lazy init: DATABASE_URL is only read when db is first used, so build succeeds
// when the var is not set (e.g. in Vercel build). Set DATABASE_URL in deployment
// env for runtime.

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle> | undefined;
  pool: Pool | undefined;
};

function getPool(): Pool {
  if (globalForDb.pool) return globalForDb.pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined in environment variables');
  }
  const pool = new Pool({
    connectionString,
    max: 10,
  });
  globalForDb.pool = pool;
  return pool;
}

function getDb(): ReturnType<typeof drizzle> {
  if (globalForDb.db) return globalForDb.db;
  const pool = getPool();
  const d = drizzle(pool);
  globalForDb.db = d;
  return d;
}

// Lazy: only touches DATABASE_URL when first used (at request time), not at import/build time
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    return (getDb() as Record<string | symbol, unknown>)[prop];
  },
});
