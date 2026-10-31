// auth/supabase/client.ts
// Browser / shared anon Supabase client for Auth and Storage ONLY.
// For service-role operations, import from '@/auth/supabase/admin' (server-only).
//
// Lazy init: env is read on first use so `next build` page-data collection does
// not crash when NEXT_PUBLIC_* vars are missing from the build machine.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const isValidUrl = (value: string) =>
    Boolean(value) && (value.startsWith("http://") || value.startsWith("https://"));

  if (!isValidUrl(url || "")) {
    throw new Error(
      "Invalid supabaseUrl: Add NEXT_PUBLIC_SUPABASE_URL to .env.local (e.g. https://your-project.supabase.co or http://localhost:54321 for local dev)"
    );
  }
  if (!anonKey) {
    throw new Error(
      "Missing SUPABASE_ANON_KEY: Add NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local"
    );
  }

  const isBrowser = typeof window !== "undefined";
  _client = createClient(String(url), String(anonKey), {
    auth: {
      persistSession: isBrowser,
      autoRefreshToken: isBrowser,
      detectSessionInUrl: isBrowser,
    },
  });
  return _client;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
