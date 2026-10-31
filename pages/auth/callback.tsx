'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/auth/supabase/client';
import { auditReturnPath, fetchPostAuthDestination, resolvePostAuthPath } from '@/lib/auth/client-post-auth';
import { authNextFrom, clearAuthContinuation } from '@/lib/auth/auth-continuation';
import { trackAuditEvent } from '@/lib/audit/analytics';
import { PulseSpinner } from '@/app/web/src/components/ui/skeletons';
import colors from '@/lib/ui/colors';

/**
 * Canonical OAuth return page.
 * Exchanges the code, ensures profile via /api/auth/destination, then routes
 * with the same resolver as email/password.
 */
export default function AuthCallbackPage(): React.ReactElement {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;

    let cancelled = false;

    (async () => {
      try {
        setError(null);

        // PKCE: exchange ?code= if present. detectSessionInUrl may already have
        // done this during client init; exchange is idempotent enough via getSession.
        const code =
          typeof router.query.code === 'string' ? router.query.code : null;
        const tokenHash =
          typeof router.query.token_hash === 'string' ? router.query.token_hash : null;
        const otpType = typeof router.query.type === 'string' ? router.query.type : null;
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            // Session may already exist if initialize() consumed the code.
            const { data: existing } = await supabase.auth.getSession();
            if (!existing?.session) {
              throw new Error(
                exchangeError.message || 'Could not complete sign-in.'
              );
            }
          }
        } else if (tokenHash && otpType && otpType !== 'recovery') {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType as 'signup' | 'magiclink' | 'email' | 'invite',
          });
          if (verifyError) {
            const { data: existing } = await supabase.auth.getSession();
            if (!existing?.session) {
              throw new Error(verifyError.message || 'Could not complete sign-in.');
            }
          }
        }

        const { data, error: userError } = await supabase.auth.getUser();
        if (userError || !data?.user) {
          throw new Error(
            userError?.message || 'Sign-in session was not established.'
          );
        }

        const decision = await fetchPostAuthDestination();
        if (cancelled) return;

        if (!decision.ok) {
          setError(decision.error);
          return;
        }

        const authUser = data.user as { created_at?: string; app_metadata?: { provider?: string } };
        const createdAt = Date.parse(authUser.created_at || '');
        const provider = authUser.app_metadata?.provider || 'unknown';
        const next = authNextFrom(router.query.next);
        if (provider !== 'email' && Number.isFinite(createdAt) && Date.now() - createdAt < 10 * 60_000) {
          trackAuditEvent('signup_completed', { method: provider, fromAudit: Boolean(auditReturnPath(next)) });
        }

        // Existing accounts enter the product. New accounts continue
        // audit → pricing, checkout, or /try — never back to the marketing site.
        clearAuthContinuation();
        router.replace(resolvePostAuthPath(decision.path, next));
      } catch (e: unknown) {
        if (cancelled) return;
        setError(
          e instanceof Error
            ? e.message
            : 'Could not complete sign-in. Please try again.'
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, router]);

  return (
    <div
      className="app-page"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#121212',
        color: colors.foreground,
        fontFamily: 'Poppins, Inter, system-ui',
        padding: 24,
        textAlign: 'center',
      }}
    >
      {error ? (
        <div style={{ maxWidth: 420 }}>
          <p style={{ marginBottom: 16, color: colors.destructive ?? '#ef4444' }}>
            {error}
          </p>
          <button
            type="button"
            onClick={() => router.replace('/auth/signin')}
            style={{
              background: colors.primary,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 18px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back to sign in
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginLeft: 12,
              background: 'transparent',
              color: colors.mutedForeground,
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 10,
              padding: '10px 18px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <div>
          <PulseSpinner />
          <p style={{ marginTop: 16, color: colors.mutedForeground }}>
            Signing you in…
          </p>
        </div>
      )}
    </div>
  );
}
