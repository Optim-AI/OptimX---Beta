/**
 * Browser helper: ensure session → ask server for canonical destination → navigate.
 */

import { authFetch } from '@/lib/utils';
import { POST_AUTH_WORKSPACE_PATH } from '@/lib/auth/post-auth-decision';

export type ClientPostAuthResult =
  | { ok: true; destination: 'workspace' | 'try'; step: string | null; path: string }
  | { ok: false; error: string };

export async function fetchPostAuthDestination(): Promise<ClientPostAuthResult> {
  try {
    const res = await authFetch('/api/auth/destination', { method: 'POST' });
    const data = await res.json();
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
        err instanceof Error
          ? err.message
          : 'Could not determine where to send you. Please try again.',
    };
  }
}
