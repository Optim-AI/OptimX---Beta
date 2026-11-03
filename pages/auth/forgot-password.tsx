'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/auth/supabase/client';
import { getAuthRedirectUrl } from '@/lib/routing/safe-next';
import { ArrowRight } from 'lucide-react';
import { AuthCard, AuthMessage } from '@/components/auth/AuthShell';

export default function ForgotPasswordPage(): React.ReactElement {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function isValidEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  const handleSendReset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email) {
      setError('Please enter an email address.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const redirectTo = getAuthRedirectUrl('/reset-password');

      // Supabase: send password reset email with redirect back to reset page
      const { data, error: supaErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (supaErr) {
        setError(supaErr.message || 'Failed to send reset email. Try again.');
        setLoading(false);
        return;
      }

      setInfo('Password reset email sent — check your inbox and spam. Click the link to set a new password.');
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const oauthLogin = async (provider: 'google' | 'facebook') => {
    try {
      const redirectTo = getAuthRedirectUrl('/welcome');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) setError(error.message);
      else if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  return (
    <AuthCard
      title="Reset password"
      titleId="forgot-title"
      lead="Enter your email and we'll send a reset link."
      footer={
        <>
          Remembered it?{' '}
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
      <form onSubmit={handleSendReset} aria-labelledby="forgot-title" noValidate className="flex flex-col gap-4">
        <div>
          <label className="auth-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="auth-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourbrand.com"
            autoComplete="email"
            autoFocus
          />
        </div>

        {error && <AuthMessage kind="error">{error}</AuthMessage>}
        {info && <AuthMessage kind="info">{info}</AuthMessage>}

        <p className="text-[13px] leading-relaxed text-paper/55">
          If you don&apos;t receive the email, check your spam folder or try again. The link will redirect you to a secure page to set a new password.
        </p>

        <button
          type="submit"
          disabled={loading}
          className="ob-btn group mt-1 h-12 w-full rounded-full text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Sending...' : 'Send reset email'}
          {loading ? null : <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-0.5" />}
        </button>
      </form>
    </AuthCard>
  );
}
