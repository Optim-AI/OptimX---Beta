// lib/supabaseClient.ts
// ⚠️ IMPORTANT: This file is for Supabase Auth and Storage ONLY
// For database operations, use Prisma DAOs from @/lib/db instead
//
// Usage:
// - Authentication: Use supabase client for auth operations
// - Storage: Use supabase.storage for file uploads (campaign-assets bucket)
// - Database: DO NOT USE - Use Prisma DAOs instead (IntegrationDAO, CreditsDAO, etc.)
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

// Basic sanity checks (won't crash in client builds, but helpful server-side)
if (!SUPABASE_URL) {
  console.warn("Missing SUPABASE_URL env var (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL).");
}
if (!SUPABASE_ANON_KEY) {
  console.warn("Missing SUPABASE_ANON_KEY env var (NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY).");
}

// Browser / client safe Supabase instance (use this in React components)
export const supabase: SupabaseClient =
  (typeof window !== "undefined")
    ? createClient(String(SUPABASE_URL), String(SUPABASE_ANON_KEY), {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : createClient(String(SUPABASE_URL), String(SUPABASE_ANON_KEY), {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

// Admin server-side client — use **only** in server code (API routes, server functions).
// WARNING: keep SERVICE_ROLE_KEY secret; do NOT import/use this inside client-side code.
export const supabaseAdmin: SupabaseClient = createClient(
  String(SUPABASE_URL),
  String(SUPABASE_SERVICE_ROLE_KEY),
  {
    auth: {
      // don't persist sessions server-side
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);
