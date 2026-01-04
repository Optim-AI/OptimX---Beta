// api/fetch.ts
// Robust helper for browser -> Next API calls that attach Supabase session token (if present).
// Works with Supabase JS v1 and v2 client shapes, and falls back to reading cookies when necessary.

import { supabase } from "@/auth/supabase/client";

/**
 * Read a cookie by name (browser only).
 */
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.split(";").map((s) => s.trim()).find((s) => s.startsWith(name + "="));
  if (!m) return null;
  return decodeURIComponent(m.split("=")[1] ?? "");
}

/**
 * Try to obtain an access token from Supabase client (v2) or older shapes, or cookies.
 */
async function resolveSupabaseAccessToken(): Promise<string | null> {
  try {
    // 1) Supabase v2: supabase.auth.getSession()
    if (supabase && typeof supabase.auth?.getSession === "function") {
      try {
        const r: any = await supabase.auth.getSession();
        const token = r?.data?.session?.access_token ?? null;
        if (token) return token;
      } catch {
        // ignore and continue to other attempts
      }
    }

    // 2) Older SDK: supabase.auth.session() or supabase.auth.session
    try {
      // @ts-ignore
      const maybeSession = typeof supabase.auth.session === "function" ? supabase.auth.session() : (supabase.auth as any)?.session ?? null;
      const token = maybeSession?.access_token ?? maybeSession?.accessToken ?? null;
      if (token) return token;
    } catch {
      // ignore
    }

    // 3) fall back to common Supabase cookie keys (browser)
    const cookieNames = ["sb-access-token", "sb:token", "sb_access_token", "sb"];
    for (const n of cookieNames) {
      const v = readCookie(n);
      if (v) {
        // some cookies store a JSON with .access_token; try parse
        try {
          const parsed = JSON.parse(v);
          if (parsed?.access_token) return parsed.access_token;
          if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token;
        } catch {
          // not JSON — treat as token
          return v;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * apiFetch
 * - input: RequestInfo (relative path like '/api/...')
 * - init: RequestInit
 *
 * Attaches Authorization: Bearer <token> when possible, and ALWAYS sends credentials: 'include'
 * (so Supabase auth cookies are present for server-side API routes that rely on cookies).
 */
export async function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  // Make a shallow copy of init so we can modify headers
  const initCopy: RequestInit = { ...(init ?? {}) };

  // ensure headers is a Headers instance for ease of use
  const headers = new Headers(initCopy.headers ?? {});

  try {
    const token = await resolveSupabaseAccessToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    // If body exists and content-type not set and body is not FormData, set json content-type
    if (initCopy.body && !(initCopy.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    initCopy.credentials = "include";
    initCopy.headers = headers;

    return await fetch(input, initCopy);
  } catch (err) {
    // Last-resort fallback: call fetch with credentials only (no Authorization header)
    try {
      const fallbackInit: RequestInit = { ...(init ?? {}), credentials: "include" };
      return await fetch(input, fallbackInit);
    } catch (e) {
      // rethrow to let caller handle
      throw e;
    }
  }
}
