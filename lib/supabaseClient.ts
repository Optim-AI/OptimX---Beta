// lib/supabaseClient.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jjfoymnhchfpjstomipr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZm95bW5oY2hmcGpzdG9taXByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0NTk1MDUsImV4cCI6MjA3NzAzNTUwNX0.VaUzagxiKKxzA6r9EFkdPN42_3mT8JjfKO-oG1WjiSY";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZm95bW5oY2hmcGpzdG9taXByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ1OTUwNSwiZXhwIjoyMDc3MDM1NTA1fQ.Rry3VbRnWialnVj40ywzVUxsl8Jt4DXZaWWBLvDpMBE";

// Basic sanity checks (won't crash in client builds, but helpful server-side)
if (!SUPABASE_URL) {
  console.warn("Missing SUPABASE_URL env var (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL).");
}
if (!SUPABASE_ANON_KEY) {
  console.warn("Missing SUPABASE_ANON_KEY env var (NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY).");
}

// Browser / client safe Supabase instance (use this in React components)
// Use a global singleton pattern to prevent multiple instances (survives HMR)
const GLOBAL_SUPABASE_KEY = "__OPTIMX_SUPABASE_CLIENT__";

function getOrCreateSupabaseClient(): SupabaseClient {
  // Check global scope first (survives HMR)
  if (typeof window !== "undefined" && (window as any)[GLOBAL_SUPABASE_KEY]) {
    return (window as any)[GLOBAL_SUPABASE_KEY];
  }

  let client: SupabaseClient;

  if (typeof window !== "undefined") {
    // Browser/client-side: create with session persistence
    client = createClient(String(SUPABASE_URL), String(SUPABASE_ANON_KEY), {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: "sb-jjfoymnhchfpjstomipr-auth-token", // Explicit storage key to avoid conflicts
        },
    });
    // Store in global scope to survive HMR
    (window as any)[GLOBAL_SUPABASE_KEY] = client;
  } else {
    // Server-side: create without session persistence
    client = createClient(String(SUPABASE_URL), String(SUPABASE_ANON_KEY), {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
  }

  return client;
}

export const supabase: SupabaseClient = getOrCreateSupabaseClient();

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
 