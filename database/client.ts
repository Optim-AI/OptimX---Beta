// database/client.ts
// Drizzle Client Singleton for Next.js
// PostgreSQL: local Supabase (dev) + production Supabase
//
// Local Supabase DB: postgresql://postgres:postgres@localhost:54322/postgres
// Production: Your Supabase project's connection string

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle> | undefined;
  pool: Pool | undefined;
};

// Database connection string
// Local: postgresql://postgres:postgres@localhost:54322/postgres
// Prod: Your Supabase connection string from dashboard
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

// Use connection pooling for better performance
const pool = globalForDb.pool ?? new Pool({
  connectionString,
  max: 10, // Maximum number of clients in the pool
});

export const db = globalForDb.db ?? drizzle(pool);

// Cache pool and db in development to prevent connection exhaustion during HMR
if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool;
  globalForDb.db = db;
}
