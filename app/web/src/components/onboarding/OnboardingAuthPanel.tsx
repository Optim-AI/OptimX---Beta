'use client';

import React, { useState } from 'react';
import { supabase } from '@/auth/supabase/client';
import colors from '@/lib/ui/colors';
import { profileClient } from '@/database/client-helpers';
import { getAuthRedirectUrl } from '@/lib/routing/safe-next';

type Props = {
  onAuthenticated: () => void;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function OnboardingAuthPanel({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function upsertProfile(user: { id?: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
    if (!user?.id) return;
    const emailValue = user.email || null;
    const fullName =
      (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
      (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
      null;
    const payload: Record<string, string> = {};
    if (emailValue) payload.email = emailValue;
    if (fullName) payload.full_name = fullName;
    await profileClient.upsert(payload);
  }

  const continueGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getAuthRedirectUrl('/try') },
      });
      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
        return;
      }
      if (data?.url) window.location.href = data.url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed');
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: getAuthRedirectUrl('/try') },
        });
        if (signUpError) {
          const message = signUpError.message || 'Could not create an account.';
          if (/already registered|already exists|already been registered/i.test(message)) {
            setError('An account with this email already exists. Log in instead.');
            setMode('login');
          } else {
            setError(message);
          }
          return;
        }
        const user = data.user;
        if (data.session && user) {
          await upsertProfile(user);
          onAuthenticated();
          return;
        }
        setInfo('Account created. Confirm the email we sent, then come back to this page to continue.');
        return;
      }

      const { data, error: signError } = await supabase.auth.signInWithPassword({ email, password });
      if (signError) {
        setError(signError.message);
        return;
      }
      if (data.user) await upsertProfile(data.user);
      onAuthenticated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 sm:mt-16">
      <h1 className="text-3xl sm:text-4xl font-normal mb-2">Continue with SkalX</h1>
      <p className="mb-8 font-light" style={{ color: colors.mutedForeground }}>
        Your Brand DNA and creatives stay with this session.
      </p>
      <div className="rounded-2xl p-6 space-y-4" style={{ background: 'hsl(0 0% 12% / 0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          type="button"
          onClick={continueGoogle}
          disabled={loading}
          className="w-full h-12 rounded-xl font-medium disabled:opacity-60"
          style={{ background: colors.foreground, color: '#121212', border: 'none' }}
        >
          Continue with Google
        </button>
        <div className="text-center text-xs uppercase tracking-[0.16em]" style={{ color: colors.mutedForeground }}>
          or email
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full h-12 rounded-xl px-4"
            style={{ background: '#0c0c0c', color: colors.foreground, border: `1px solid ${colors.border}` }}
          />
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-12 rounded-xl px-4 pr-16"
              style={{ background: '#0c0c0c', color: colors.foreground, border: `1px solid ${colors.border}` }}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
              style={{ color: colors.mutedForeground, background: 'transparent', border: 'none' }}
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
          {error && <p className="text-sm" role="alert" style={{ color: 'hsl(0 84% 60%)' }}>{error}</p>}
          {info && <p className="text-sm" style={{ color: colors.mutedForeground }}>{info}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl font-medium disabled:opacity-60"
            style={{ background: colors.gradientPrimary, color: colors.primaryForeground, border: 'none' }}
          >
            {loading ? 'Working…' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>
        <button
          type="button"
          className="w-full text-sm"
          style={{ color: colors.primary, background: 'transparent', border: 'none' }}
          onClick={() => {
            setMode((m) => (m === 'signup' ? 'login' : 'signup'));
            setError(null);
          }}
        >
          {mode === 'signup' ? 'Already have an account? Log in' : 'New to SkalX? Create an account'}
        </button>
      </div>
    </div>
  );
}
