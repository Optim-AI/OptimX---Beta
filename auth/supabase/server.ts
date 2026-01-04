// lib/supabase.server.ts
// SECURITY FIX: Removed hardcoded credentials, now uses environment variables only
// NOTE: This file should only be used for Supabase Auth and Storage operations
// For database queries, use Prisma DAOs from @/lib/db instead
import { createClient } from '@supabase/supabase-js';

export function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  return createClient(url, key, { auth: { persistSession: false } });
}
