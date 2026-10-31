'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/auth/supabase/client';
import { fetchPostAuthDestination } from '@/lib/auth/client-post-auth';
import { authNextFrom, clearAuthContinuation, readAuthContinuation } from '@/lib/auth/auth-continuation';
import { resolvePostAuthPath } from '@/lib/audit/analytics';

/** Pages that already finish sign-in themselves. */
const SKIP_PREFIXES = [
  '/auth',
  '/try',
  '/workspace',
  '/subscribe',
  '/content-studio',
  '/brand-kit',
  '/brand-studio',
  '/photo-studio',
  '/image-library',
  '/create-campaign',
  '/library',
  '/integrations',
  '/analytics',
  '/settings',
  '/buy-credits',
];

const FRESH_SIGN_IN_MS = 3 * 60_000;

function looksLikeAuthReturn(): boolean {
  const hash = window.location.hash;
  const search = window.location.search;
  if (/access_token|refresh_token|error_description|type=/.test(hash)) return true;
  if (/[?&](code|token_hash)=/.test(search)) return true;
  return readAuthContinuation() != null;
}

/**
 * If Google / email confirmation drops the browser on the marketing site,
 * continue into pricing, checkout, or /try for a new account — or the product
 * for an existing one. A normal visit to the homepage does not redirect.
 */
export default function AuthReturnResume() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (!router.isReady || started.current) return;
    const path = router.pathname;
    if (SKIP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return;
    if (!looksLikeAuthReturn()) return;
    started.current = true;

    const queryNext = router.query.next;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const tokenHash = params.get('token_hash');
        const otpType = params.get('type');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            const { data: existing } = await supabase.auth.getSession();
            if (!existing.session) return;
          }
        } else if (tokenHash && otpType && otpType !== 'recovery') {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType as 'signup' | 'magiclink' | 'email' | 'invite',
          });
          if (error) {
            const { data: existing } = await supabase.auth.getSession();
            if (!existing.session) return;
          }
        }

        let session = (await supabase.auth.getSession()).data.session;
        if (!session && (code || tokenHash || /access_token|refresh_token/.test(window.location.hash))) {
          await new Promise((resolve) => window.setTimeout(resolve, 400));
          session = (await supabase.auth.getSession()).data.session;
        }
        if (!session) return;

        const hashOrCode =
          Boolean(code) ||
          Boolean(tokenHash) ||
          /access_token|refresh_token|error_description/.test(window.location.hash);
        if (!hashOrCode) {
          const signedInAt = Date.parse(session.user.last_sign_in_at || '');
          if (!Number.isFinite(signedInAt) || Date.now() - signedInAt > FRESH_SIGN_IN_MS) {
            clearAuthContinuation();
            return;
          }
        }

        const decision = await fetchPostAuthDestination();
        if (!decision.ok) return;

        const next = authNextFrom(queryNext);
        clearAuthContinuation();
        const dest = resolvePostAuthPath(decision.path, next);
        const destPath = dest.split('?')[0];
        if (destPath === window.location.pathname && !window.location.hash && !code && !tokenHash) return;
        await router.replace(dest);
      } catch {
        /* stay on the page */
      }
    })();
    // Run once when the landing URL is ready. Router identity changes must not cancel it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  return null;
}
