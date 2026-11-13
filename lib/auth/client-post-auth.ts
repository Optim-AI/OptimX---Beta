/**
 * Browser helper: ensure session → ask server for canonical destination → navigate.
 */

import { authFetch } from '@/lib/utils';
import { POST_AUTH_WORKSPACE_PATH } from '@/lib/auth/post-auth-decision';
import { auditReturnPath, resolvePostAuthPath } from '@/lib/audit/analytics';

export { auditReturnPath, resolvePostAuthPath };

export type ClientPostAuthResult =
  | { ok: true; destination: 'workspace' | 'try'; step: string | null; path: string }
  | { ok: false; error: string };

/** Per attempt. The server gives up at 12s, so this only trips on a stuck network. */
const DESTINATION_TIMEOUT_MS = 15_000;

export async function fetchPostAuthDestination(): Promise<ClientPostAuthResult> {
  const first = await fetchPostAuthDestinationOnce();
  if (first.ok) return first;
  // One retry: a cold serverless start or a briefly busy database often clears.
  return fetchPostAuthDestinationOnce();
}

async function fetchPostAuthDestinationOnce(): Promise<ClientPostAuthResult> {
  try {
    const res = await authFetch('/api/auth/destination', {
      method: 'POST',
      signal: AbortSignal.timeout(DESTINATION_TIMEOUT_MS),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        error:
          (typeof data?.error === 'string' && data.error) ||
          'Could not determine where to send you. Please try again.',
      };
    }
    return {
      ok: true,
      destination: data.destination === 'workspace' ? 'workspace' : 'try',
      step: typeof data.step === 'string' ? data.step : null,
      path:
        typeof data.path === 'string'
          ? data.path
          : data.destination === 'workspace'
            ? POST_AUTH_WORKSPACE_PATH
            : '/try',
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error:
        err instanceof Error && err.name !== 'TimeoutError' && err.name !== 'AbortError'
          ? err.message
          : 'Signing in is taking too long. Please check your internet and try again.',
    };
  }
}
