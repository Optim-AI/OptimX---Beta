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

const isValidUrl = (url: string) =>
  url && (url.startsWith("http://") || url.startsWith("https://"));

if (!isValidUrl(SUPABASE_URL || "")) {
  throw new Error(
    "Invalid supabaseUrl: Add NEXT_PUBLIC_SUPABASE_URL to .env.local (e.g. https://your-project.supabase.co or http://localhost:54321 for local dev)"
  );
}
if (!SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing SUPABASE_ANON_KEY: Add NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local"
  );
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
// Lazy-initialized to avoid throwing during page loads (when only supabase is needed).
let _supabaseAdmin: SupabaseClient | null = null;
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!_supabaseAdmin) {
      const key = SUPABASE_SERVICE_ROLE_KEY;
      if (!key) {
        throw new Error(
          "Missing SUPABASE_SERVICE_ROLE_KEY: Required for server-side admin operations. Add to .env.local"
        );
      }
      _supabaseAdmin = createClient(String(SUPABASE_URL), String(key), {
        auth: {
          persistSession: false,
          detectSessionInUrl: false,
        },
      });
    }
    return (_supabaseAdmin as any)[prop];
  },
});
