'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/auth/supabase/client';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { AuthCard, AuthMessage } from '@/components/auth/AuthShell';

export default function ResetPasswordPage(): React.ReactElement {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState('');
  const [rePassword, setRePassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExists, setSessionExists] = useState<boolean | null>(null);
  const [showPw, setShowPw] = useState(false);

  // Parse token values from either the fragment (#...) or query (?...) and return strings or nulls
  function extractTokensFromUrl(): { access_token: string | null; refresh_token: string | null } {
    if (typeof window === 'undefined') return { access_token: null, refresh_token: null };

    const { hash, search } = window.location;
    const parse = (raw: string) => {
      const trimmed = raw.replace(/^#|^\?/, '');
      const params = new URLSearchParams(trimmed);
      const at = params.get('access_token');
      const rt = params.get('refresh_token');
      return { access_token: at ?? null, refresh_token: rt ?? null };
    };

    // Prefer hash (fragment) if it contains tokens; otherwise try search
    if (hash && hash.includes('access_token')) return parse(hash);
    if (search && search.includes('access_token')) return parse(search);
    return { access_token: null, refresh_token: null };
  }

  useEffect(() => {
    (async () => {
      setError(null);
      setInfo(null);
      setSessionExists(null);

      // If already signed in, no need to extract tokens
      try {
        const userResp = await supabase.auth.getUser();
        if (userResp?.data?.user) {
          setSessionExists(true);
          setInfo('You are already signed in. You can update your password here.');
          return;
        }
      } catch {
        // ignore
      }

      // Extract tokens from URL
      try {
        const { access_token, refresh_token } = extractTokensFromUrl();

        // We require BOTH tokens to be present for setSession (typical Supabase recovery link)
        if (access_token && refresh_token) {
          // Runtime-check for setSession to avoid calling non-existent methods
          // Use any to avoid strict TS mismatch at call site; runtime check ensures safety
          const maybeSetSession = (supabase.auth as any)?.setSession;
          if (typeof maybeSetSession === 'function') {
            const result = await maybeSetSession.call(supabase.auth, {
              access_token,
              refresh_token,
            });

            // result may contain error in different client versions
            if (result?.error) {
              setSessionExists(false);
              setError('Failed to establish session from the link. The link may be expired.');
              return;
            }

            setSessionExists(true);
            setInfo('Link verified. Enter a new password to complete the reset.');

            // clean tokens from URL for security/UX
            try {
              if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
                const url = new URL(window.location.href);
                url.hash = '';
                url.search = '';
                window.history.replaceState({}, '', url.toString());
              }
            } catch {
              // ignore
            }
            return;
          }

          // If setSession doesn't exist on this client, we can't programmatically establish a session.
          // This is a compatibility guard: inform the user to request another reset (or provide client version).
          setSessionExists(false);
          setError('This Supabase client does not expose setSession; unable to complete the recovery in-app. Request a new reset or provide your supabase client config.');
          return;
        }

        // No tokens found in URL
        setSessionExists(false);
        setError('No valid recovery link detected. Please request a password reset first.');
      } catch (e: any) {
        setSessionExists(false);
        setError(e?.message ?? String(e));
      }
    })();
    // run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChangePassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setInfo(null);

    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== rePassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // updateUser will succeed only if there is a valid session established above
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setError(error.message || 'Failed to update password.');
        setLoading(false);
        return;
      }

      setInfo('Password updated — redirecting to sign in.');
      setTimeout(() => {
        router.replace('/signin');
      }, 900);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Set a new password"
      titleId="reset-title"
      lead={sessionExists === null ? 'Verifying link...' : sessionExists ? 'Enter your new password' : 'Invalid or unsupported link'}
      footer={
        <>
          {sessionExists === false ? (
            <>
              <Link
                href="/auth/forgot-password"
                className="font-medium text-paper underline decoration-paper/30 underline-offset-4 hover:decoration-paper"
              >
                Request a new reset link
              </Link>
              {' · '}
            </>
          ) : null}
          <Link
            href="/auth/signin"
            onClick={(e) => {
              e.preventDefault();
              router.push('/auth/signin');
            }}
            className="font-medium text-paper underline decoration-paper/30 underline-offset-4 hover:decoration-paper"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleChangePassword} aria-labelledby="reset-title" noValidate className="flex flex-col gap-4">
        <div>
          <label className="auth-label" htmlFor="newpassword">
            New password
          </label>
          <div className="auth-field">
            <input
              id="newpassword"
              className="auth-input"
              type={showPw ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              aria-describedby="newpassword-hint"
              style={{ paddingRight: 48 }}
            />
            <button
              type="button"
              className="auth-eye"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Hide passwords' : 'Show passwords'}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p id="newpassword-hint" className="auth-hint" data-ok={newPassword.length >= 6 ? 'true' : 'false'}>
            At least 6 characters
          </p>
        </div>

        <div>
          <label className="auth-label" htmlFor="repassword">
            Re-enter new password
          </label>
          <input
            id="repassword"
            className="auth-input"
            type={showPw ? 'text' : 'password'}
            value={rePassword}
            onChange={(e) => setRePassword(e.target.value)}
            autoComplete="new-password"
          />
          {rePassword ? (
            <p className="auth-hint" data-ok={rePassword === newPassword ? 'true' : 'false'} aria-live="polite">
              {rePassword === newPassword ? 'Passwords match' : 'Passwords do not match yet'}
            </p>
          ) : null}
        </div>

        {error && <AuthMessage kind="error">{error}</AuthMessage>}
        {info && <AuthMessage kind="info">{info}</AuthMessage>}

        <p className="text-[13px] leading-relaxed text-paper/55">
          Password will only update after you arrived here via the secure email verification link.
        </p>

        <button
          type="submit"
          disabled={loading || sessionExists === false}
          className="ob-btn group mt-1 h-12 w-full rounded-full text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Updating...' : 'Update password'}
          {loading ? null : <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-0.5" />}
        </button>
      </form>
    </AuthCard>
  );
}
