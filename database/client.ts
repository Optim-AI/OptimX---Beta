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
  // Log connection host (not full URL) for debugging
  try {
    const url = new URL(connectionString);
    console.log(`[DB] Connecting to ${url.hostname}:${url.port || 5432}/${url.pathname.slice(1)}`);
  } catch {
    console.log('[DB] Connecting with provided DATABASE_URL');
  }
  const pool = new Pool({
    connectionString,
    max: 10,
  });
  pool.on('error', (err) => {
    console.error('[DB] Pool error:', err.message, '| code:', (err as any).code);
  });
  pool.on('connect', () => {
    console.log('[DB] New client connected to pool');
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

type DbType = ReturnType<typeof drizzle>;

// Lazy: only touches DATABASE_URL when first used (at request time), not at import/build time
export const db: DbType = new Proxy({} as DbType, {
  get(_target, prop: string | symbol) {
    const database = getDb();
    return (database as any)[prop];
  },
});

/**
 * Extract meaningful error details from a Drizzle/pg error.
 * Drizzle wraps the original pg error, so the real cause is often in error.cause.
 */
export function extractDbError(error: any): {
  message: string;
  pgCode?: string;
  pgDetail?: string;
  pgHint?: string;
  pgSeverity?: string;
  pgTable?: string;
  pgConstraint?: string;
  cause?: string;
} {
  // The original pg error is often in error.cause
  const cause = error?.cause ?? error;
  return {
    message: error?.message ?? 'Unknown error',
    pgCode: cause?.code,
    pgDetail: cause?.detail,
    pgHint: cause?.hint,
    pgSeverity: cause?.severity,
    pgTable: cause?.table,
    pgConstraint: cause?.constraint,
    cause: cause !== error ? cause?.message : undefined,
  };
}
