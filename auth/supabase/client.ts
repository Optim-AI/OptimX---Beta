// auth/supabase/client.ts
// Browser / shared anon Supabase client for Auth and Storage ONLY.
// For service-role operations, import from '@/auth/supabase/admin' (server-only).
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

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
