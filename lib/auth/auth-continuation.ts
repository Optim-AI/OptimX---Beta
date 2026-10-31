/**
 * Remembers where a new signup should continue after auth.
 * OAuth and email links sometimes land on the site root instead of /auth/callback
 * (Supabase falls back to the Site URL when the redirect is not allow-listed).
 * The stored path lets that landing page resume the funnel.
 */

import { getSafeNextPath } from '@/lib/routing/safe-next';

const KEY = 'skalx_auth_next';
const MAX_AGE_MS = 30 * 60_000;

export function rememberAuthContinuation(next: unknown, fallback = '/try'): string {
  const path = getSafeNextPath(next, fallback);
  if (typeof window === 'undefined') return path;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    /* storage unavailable */
  }
  return path;
}

export function readAuthContinuation(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { path?: string; at?: number };
    if (!parsed.path || !parsed.at || Date.now() - parsed.at > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    const path = getSafeNextPath(parsed.path, '');
    return path.startsWith('/') ? path : null;
  } catch {
    return null;
  }
}

export function clearAuthContinuation() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Query param wins; otherwise the path saved before leaving for the provider. */
export function authNextFrom(queryNext: unknown): string | null {
  if (typeof queryNext === 'string' && queryNext.trim()) {
    const safe = getSafeNextPath(queryNext, '');
    if (safe.startsWith('/')) return safe;
  }
  return readAuthContinuation();
}
