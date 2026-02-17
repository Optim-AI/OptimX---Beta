'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/auth/supabase/client';
import { authFetch } from '@/lib/utils';
import colors from '@/lib/ui/colors';
import { profileClient } from '@/database/client-helpers';

export default function SignUpPage(): React.ReactElement {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rePassword, setRePassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function isValidEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  function withAlpha(tokenInput: string | undefined | null, alpha: number) {
    const token = String(tokenInput ?? '').trim();
    if (!token) return token;

    const hslMatch = token.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i);
    if (hslMatch) {
      const [, h, s, l] = hslMatch;
      return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
    }

    if (/hsla\(/i.test(token)) return token;

    const rgbMatch = token.match(/rgb\(\s*([0-9]{1,3})[,\s]+([0-9]{1,3})[,\s]+([0-9]{1,3})\s*\)/i);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    if (/rgba\(/i.test(token)) return token;

    const hex = token.replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(hex)) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (/^[0-9a-f]{6}$/i.test(hex)) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    return token;
  }

  // Upsert profile row for a signed-in user.
  // Uses common profile fields: id (supabase auth user id), email, full_name and username.
  // Adjust field names if your `profiles` table uses different column names.
  async function upsertProfile(user: any) {
    if (!user || !user.id) return;
    try {
      const id = user.id;
      const emailVal = user.email ?? user.user_metadata?.email ?? null;
      const full_name =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.user_metadata?.given_name ??
        null;
      // derive a sensible username fallback from email if not present
      const usernameFallback =
        (emailVal && typeof emailVal === 'string' ? emailVal.split('@')[0] : null) ?? null;
      const username =
        user.user_metadata?.username ??
        user.user_metadata?.preferred_username ??
        usernameFallback;

      const payload: Record<string, any> = {};
      if (emailVal) payload.email = emailVal;
      if (full_name) payload.full_name = full_name;
      if (username) payload.username = username;

      // Upsert profile using Prisma via API (replaces direct Supabase call)
      const result = await profileClient.upsert(payload);

      if (result.success) {
        console.debug('profiles upserted for user:', id, result.data);
      } else {
        console.error('profiles upsert error:', result.error);
      }
    } catch (err) {
      console.error('upsertProfile unexpected error:', err);
    }
  }

  useEffect(() => {
    // Upsert profile and redirect to welcome (no subscription check needed for pay-as-you-go)
    async function checkAndRedirect(user: any) {
      try {
        await upsertProfile(user);
      } catch (err) {
        console.error('upsert failed:', err);
      }

      // Redirect directly to welcome page
      router.replace('/welcome');
    }

    // If already signed in, check subscription
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          await checkAndRedirect(data.user);
        }
      } catch {
        // ignore
      }
    })();

    // Also subscribe to auth state changes to catch OAuth sign-up flows (provider redirect back).
    const subscription = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await checkAndRedirect(session.user);
      }
    });

    return () => {
      try {
        // @ts-ignore
        if (subscription?.data?.subscription?.unsubscribe) subscription.data.subscription.unsubscribe();
        // @ts-ignore
        else if (subscription?.unsubscribe) subscription.unsubscribe();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const oauthLogin = async (provider: 'google' | 'facebook') => {
    setError(null);
    setInfo(null);
    try {
      const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/welcome`;
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (oauthError) {
        setError(oauthError.message);
      } else if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const handleSignUp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email) {
      setError('Please enter an email.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter a password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== rePassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // Use Supabase signUp to create the user with email & password
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

      if (signUpError) {
        setError(signUpError.message || 'Failed to create account.');
        setLoading(false);
        return;
      }

      // If Supabase returns a user immediately (depends on auth settings), upsert profile now
      const user = (data as any)?.user ?? null;
      if (user && user.id) {
        try {
          await upsertProfile(user);
        } catch (err) {
          console.error('upsert after signUp failed:', err);
        }
        // redirect directly to welcome (pay-as-you-go - no plan required)
        router.replace('/welcome');
        return;
      }

      // Otherwise (email confirmation flows), inform the user to check email.
      setInfo('Account created. Please check your email to confirm and then sign in.');
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style jsx global>{`
        :root {
          --optim-blue: #0088ff;
          --border: hsl(0 0% 22%);
          --link-color: #5ba3ff;
          --muted: hsl(0 0% 60%);
        }
        * {
          box-sizing: border-box;
        }
        html,
        body,
        #__next {
          height: 100%;
          margin: 0;
        }
        body {
          font-family: Poppins, Inter, system-ui;
          -webkit-font-smoothing: antialiased;
        }
        .page-wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .bg-shape {
          position: absolute;
          border-radius: 9999px;
          pointer-events: none;
          filter: blur(120px);
          opacity: 0.95;
          z-index: 0;
        }
        .bg-shape.left {
          width: 520px;
          height: 520px;
          left: -140px;
          top: -80px;
        }
        .bg-shape.mid {
          width: 380px;
          height: 380px;
          left: 420px;
          top: 120px;
        }
        .bg-shape.right {
          width: 600px;
          height: 600px;
          right: -160px;
          bottom: -60px;
        }
        .mesh-gradient {
          mix-blend-mode: overlay;
        }
        .animation-float {
          animation: float 8s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes float {
          0% {
            transform: translateY(0) translateX(0) scale(1);
            opacity: 0.9;
          }
          50% {
            transform: translateY(-18px) translateX(6px) scale(1.02);
            opacity: 0.95;
          }
          100% {
            transform: translateY(0) translateX(0) scale(1);
            opacity: 0.9;
          }
        }

        /* CARD + LAYOUT - match SignIn dark theme */
        .auth-card {
          z-index: 3;
          width: 500px;
          border-radius: 18px;
          backdrop-filter: blur(6px);
          padding: 20px;
          box-shadow: 0 20px 80px rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          overflow: hidden;
        }
        .card-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .auth-content {
          position: relative;
          z-index: 2;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .brand-badge {
          width: 64px;
          height: 64px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #36a7ff, #0f62ff);
          box-shadow: 0 0 9.65px rgba(188, 215, 255, 0.24);
        }
        .brand-title {
          margin-top: 8px;
          font-weight: 700;
          font-size: 32px;
          line-height: 40px;
          color: hsl(0 0% 95%);
          text-align: center;
        }
        .brand-sub {
          margin-top: 4px;
          color: hsl(0 0% 60%);
          font-weight: 500;
          font-size: 13px;
          text-align: center;
          margin-bottom: 12px;
        }

        .oauth-row {
          margin-top: 28px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .oauth-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: hsl(0 0% 18%);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px 20px;
          cursor: pointer;
          font-weight: 600;
          font-size: 15px;
          height: 48px;
          width: 100%;
          color: hsl(0 0% 95%);
          transition: all 0.2s ease;
        }
        .oauth-btn:hover {
          background: hsl(0 0% 20%);
          border-color: hsl(0 0% 30%);
        }
        .oauth-btn img,
        .oauth-btn svg {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
        }
        .oauth-btn span {
          white-space: nowrap;
        }

        .form {
          margin-top: 12px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        label {
          font-size: 12px;
          font-weight: 500;
          color: hsl(0 0% 95%);
          margin-bottom: 6px;
          display: block;
        }
        .input {
          height: 44px;
          border-radius: 10px;
          border: 1px solid var(--border);
          padding: 10px 12px;
          font-size: 15px;
          background: hsl(0 0% 15%);
          color: hsl(0 0% 95%);
          width: 100%;
          display: block;
        }
        .input::placeholder {
          color: hsl(0 0% 50%);
        }
        .pw-wrap {
          position: relative;
          width: 100%;
        }
        .pw-toggle {
          position: absolute;
          right: 12px;
          top: 10px;
          height: 28px;
          width: 36px;
          border: none;
          background: transparent;
          cursor: pointer;
        }
        .cta {
          margin-top: 6px;
          height: 44px;
          border-radius: 12px;
          background: var(--optim-blue);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          border: none;
          font-size: 15px;
          width: 100%;
          cursor: pointer;
        }
        .cta:hover:not(:disabled) {
          background: hsl(213 100% 60%);
        }
        .cta:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .policy {
          font-size: 12px;
          text-align: center;
          color: var(--muted);
          margin-top: 10px;
        }
        .policy a {
          color: var(--link-color);
          text-decoration: underline;
          font-weight: 600;
        }
        .msg {
          margin-top: 8px;
          font-size: 13px;
          text-align: center;
        }

        .helper-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-top: 8px;
        }
        .helper-row a {
          font-size: 13px;
          color: var(--link-color);
          text-decoration: none;
          font-weight: 600;
        }
        .helper-row a.secondary {
          color: var(--muted);
          font-weight: 600;
          text-decoration: underline;
        }

        @media (max-width: 820px) {
          .auth-card {
            width: calc(100% - 40px);
            padding: 16px;
            border-radius: 14px;
          }
          .brand-title {
            font-size: 26px;
          }
        }
      `}</style>

      <div className="page-wrap" role="region" aria-label="Sign up page">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(135deg, ${(colors as any)?.background ?? '#ffffff'} 0%, ${withAlpha((colors as any)?.primary ?? 'hsl(213 90% 96%)', 0.3)} 50%, ${(colors as any)?.background ?? '#ffffff'} 100%)`,
            zIndex: 0,
          }}
        />
        <div
          className="absolute inset-0 mesh-gradient"
          style={{
            background: (colors as any)?.gradientMesh ?? 'linear-gradient(180deg,#f0f8ff00,#ffffff00)',
            opacity: 0.4,
            zIndex: 0,
          }}
        />

        <div
          className="absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl animation-float"
          style={{ backgroundColor: withAlpha((colors as any)?.primary ?? 'hsl(213 90% 50%)', 0.3), zIndex: 0 }}
        />
        <div
          className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl animation-float"
          style={{
            backgroundColor: withAlpha((colors as any)?.primary ?? 'hsl(213 90% 50%)', 0.2),
            animationDelay: '2s',
            zIndex: 0,
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl animation-float"
          style={{
            backgroundImage: `linear-gradient(90deg, ${withAlpha((colors as any)?.primary ?? 'hsl(213 90% 50%)', 0.1)} 0%, ${withAlpha(((colors as any)?.primaryGlow ?? (colors as any)?.primary) ?? 'hsl(213 90% 50%)', 0.08)} 100%)`,
            animationDelay: '4s',
            zIndex: 0,
          }}
        />

        <main
          className="auth-card"
          role="main"
          aria-labelledby="signup-title"
          style={{
            background:
              ((colors as any)?.gradientCard
                ? (colors as any)?.gradientCard
                : `linear-gradient(180deg, ${withAlpha((colors as any)?.background ?? '#ffffff', 0.12)}, ${withAlpha((colors as any)?.primary ?? 'hsl(213 90% 96%)', 0.04)})`),
          }}
        >
          <div className="card-bg" aria-hidden>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 0,
                opacity: 1,
                pointerEvents: 'none',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: (colors as any)?.gradientMesh ?? 'linear-gradient(180deg,#f0f8ff00,#ffffff00)',
                  mixBlendMode: 'overlay',
                  opacity: 0.5,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  width: 220,
                  height: 220,
                  borderRadius: 9999,
                  filter: 'blur(84px)',
                  transformOrigin: 'center',
                  animation: 'float 8s ease-in-out infinite',
                  backgroundColor: withAlpha((colors as any)?.primary ?? 'hsl(213 90% 50%)', 0.28),
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 10,
                  right: 20,
                  width: 300,
                  height: 300,
                  borderRadius: 9999,
                  filter: 'blur(84px)',
                  transformOrigin: 'center',
                  animation: 'float 8s ease-in-out infinite',
                  animationDelay: '2s',
                  backgroundColor: withAlpha((colors as any)?.primary ?? 'hsl(213 90% 50%)', 0.18),
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: 420,
                  height: 420,
                  borderRadius: 9999,
                  transform: 'translate(-50%,-50%)',
                  filter: 'blur(84px)',
                  transformOrigin: 'center',
                  animation: 'float 8s ease-in-out infinite',
                  animationDelay: '4s',
                  backgroundImage: `linear-gradient(90deg, ${withAlpha((colors as any)?.primary ?? 'hsl(213 90% 50%)', 0.1)} 0%, ${withAlpha(((colors as any)?.primaryGlow ?? (colors as any)?.primary) ?? 'hsl(213 90% 50%)', 0.06)} 100%)`,
                }}
              />
            </div>
          </div>

          <div className="auth-content" role="region" aria-label="Sign up form">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="brand-badge" aria-hidden style={{ background: 'transparent', boxShadow: 'none' }}>
                <img src="/images/Oli_AI_Logo.svg" alt="SkalX AI" style={{ width: 56, height: 56, objectFit: 'contain' }} />
              </div>

              <h1 id="signup-title" className="brand-title">
                SkalX AI
              </h1>
              <div className="brand-sub">Create an account to get started.</div>
            </div>

            <div className="oauth-row" role="group" aria-label="Third party sign in">
              <button
                className="oauth-btn"
                onClick={() => oauthLogin('google')}
                type="button"
                aria-label="Sign up with Google"
              >
                <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path fill="#fbc02d" d="M43.6 20.4H42V20H24v8h11.3C33.6 33 29.1 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8.1 2.9l6-6C34.6 4.9 29.6 3 24 3 12.9 3 4 11.9 4 23s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.6z"/>
                  <path fill="#e53935" d="M6.3 14.9l6.6 4.8C14 16.1 18.6 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6-6C34.6 4.9 29.6 3 24 3 16.7 3 10.2 7.9 6.3 14.9z"/>
                  <path fill="#4caf50" d="M24 43c5.1 0 9.6-2 13-5.2l-6-4.9C29.9 34.9 27.1 36 24 36c-5.1 0-9.6-2-13-5.2l-6.6 4.8C10.2 40.1 16.7 44 24 44z"/>
                  <path fill="#1565c0" d="M43.6 20.4H42V20H24v8h11.3c-1 2.8-3 5.2-5.5 6.8l6 4.9C39.9 36.3 44 30 44 23c0-1.3-.1-2.6-.4-3.6z"/>
                </svg>
                <span>Continue with Google</span>
              </button>

              <button
                className="oauth-btn"
                onClick={() => oauthLogin('facebook')}
                type="button"
                aria-label="Sign up with Facebook"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                  <path d="M22 12c0-5.5-4.5-10-10-10S2 6.5 2 12c0 4.9 3.5 9 8.1 9.9v-7H7.9v-2.9h2.2V9.7c0-2.2 1.3-3.4 3.3-3.4.95 0 1.9.17 1.9.17v2.1h-1.08c-1.06 0-1.39.66-1.39 1.33v1.6h2.36l-.38 2.9h-1.98v7C18.5 21 22 16.9 22 12z" fill="#0866FF" />
                </svg>
                <span>Continue with Facebook</span>
              </button>
            </div>

            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, marginTop: 32 }}>
              <div style={{ flex: 1, height: 1, background: 'hsl(0 0% 22%)' }} />
              <div style={{ color: 'hsl(0 0% 60%)', fontSize: 13 }}>Or sign up with email</div>
              <div style={{ flex: 1, height: 1, background: 'hsl(0 0% 22%)' }} />
            </div>

            <form className="form" aria-labelledby="signup-title" onSubmit={handleSignUp}>
              <div>
                <label htmlFor="email">Email</label>
                <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@domain.com" autoComplete="email" />
              </div>

              <div>
                <label htmlFor="password">Password</label>
                <div className="pw-wrap">
                  <input id="password" className="input" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" autoComplete="new-password" style={{ paddingRight: 56 }} />
                  <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="repassword">Re-enter password</label>
                <div className="pw-wrap">
                  <input id="repassword" className="input" type={showPw ? 'text' : 'password'} value={rePassword} onChange={(e) => setRePassword(e.target.value)} placeholder="Re-enter password" autoComplete="new-password" style={{ paddingRight: 56 }} />
                  <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="helper-row" style={{ marginTop: 6 }}>
                <a href="/signin" onClick={(e) => { e.preventDefault(); router.push('/signin'); }}>Already have an account? Sign in</a>
                <a href="/help" className="secondary" onClick={(e) => { e.preventDefault(); router.push('/help'); }}>Need help?</a>
              </div>

              {error && <div className="msg" style={{ color: '#d9534f' }}>{error}</div>}
              {info && <div className="msg" style={{ color: '#2f855a' }}>{info}</div>}

              <div className="policy" style={{ marginTop: 40 }}>
                By creating an account, you agree to our <a href="#" onClick={(e) => e.preventDefault()}>Privacy policy</a> &amp; <a href="#" onClick={(e) => e.preventDefault()}>Terms &amp; Conditions</a>
              </div>

              <button className="cta" type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create account'}</button>
            </form>

            <div style={{ marginTop: 12, fontSize: 13, color: '#8b8b8b' }}>© {new Date().getFullYear()} SkalX AI</div>
          </div>
        </main>
      </div>
    </>
  );
}
