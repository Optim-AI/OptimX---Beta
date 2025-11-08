// pages/auth/signin.tsx
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function SignInPage(): React.ReactElement {
  const router = useRouter();

  const [mode, setMode] = useState<'magic' | 'password'>('magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Listen for auth state changes so we catch OAuth/magic-link sign-ins after redirect
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        router.replace('/welcome');
      }
    });

    return () => {
      // cleanup listener
      try {
        // @ts-ignore - subscription exists on returned object
        listener?.subscription?.unsubscribe?.();
      } catch {
        // ignore
      }
    };
  }, [router]);

  // If already signed in, immediately go to /welcome
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          router.replace('/welcome');
        }
      } catch {
        // ignore
      }
    })();
  }, [router]);

  const sendMagicLink = async () => {
    setError(null);
    setInfo(null);
    if (!email) {
      setError('Please enter an email.');
      return;
    }
    setLoading(true);
    try {
      const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/welcome`;
      const { error: signError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (signError) setError(signError.message);
      else setInfo('Check your email — we sent a magic link for password-free sign in.');
      // magic link flow will redirect to redirectTo once clicked — onAuthStateChange handles signed-in redirect
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const signInWithPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
      if (signError) {
        setError(signError.message);
      } else {
        // successful sign-in -> redirect
        router.replace('/welcome');
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const oauthLogin = async (provider: 'google' | 'facebook') => {
    setError(null);
    setInfo(null);
    try {
      const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/welcome`;
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (oauthError) {
        setError(oauthError.message);
      } else if (data?.url) {
        window.location.href = data.url; // Supabase-hosted OAuth flow
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  return (
    <>
      <style jsx global>{`
        :root { --optim-blue: #0088FF; --border: #C2C2C2; --link-color:#0a66ff; --muted:#6F6F6F; }
        *{box-sizing:border-box}
        html,body,#__next{height:100%;margin:0}
        body{font-family:Poppins,Inter,system-ui;-webkit-font-smoothing:antialiased}
        .page-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#fff,#fbfeff);position:relative;overflow:hidden}
        .bg-shape{position:absolute;border-radius:9999px;pointer-events:none;filter:blur(120px);opacity:.95;z-index:0}
        .bg-shape.left{width:520px;height:520px;left:-140px;top:-80px;background:radial-gradient(circle at 30% 30%, rgba(8,102,255,.17), rgba(8,102,255,.02))}
        .bg-shape.mid{width:380px;height:380px;left:420px;top:120px;background:radial-gradient(circle at 50% 50%, rgba(116,190,255,.24), rgba(116,190,255,.03))}
        .bg-shape.right{width:600px;height:600px;right:-160px;bottom:-60px;background:radial-gradient(circle at 70% 70%, rgba(116,190,255,.14), rgba(116,190,255,.02))}
        .auth-card{z-index:3;width:532px;border-radius:32px;background:rgba(255,255,255,.78);backdrop-filter:blur(6px);padding:32px;box-shadow:0 20px 80px rgba(2,6,23,.12);border:1px solid rgba(226,232,240,.6);display:flex;flex-direction:column;align-items:center}
        .brand-badge{width:90px;height:90px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#36A7FF,#0F62FF);box-shadow:0 0 9.65px rgba(188,215,255,.24)}
        .brand-title{margin-top:14px;font-weight:700;font-size:43px;line-height:65px;color:#1E1E1E;text-align:center}
        .brand-sub{margin-top:6px;color:#5f6b73;font-weight:500;font-size:16px;text-align:center}
        .oauth-row{margin-top:18px;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .oauth-btn{display:flex;align-items:center;justify-content:center;gap:10px;background:#fff;border:1px solid var(--border);border-radius:12px;padding:10px 12px;cursor:pointer;font-weight:500;height:44px}
        .segmented{display:flex;background:#fafafa;padding:6px;border-radius:12px;gap:8px;border:1px solid #F0F0F0}
        .segmented button{border-radius:9999px;padding:12px 24px;border:1px solid transparent;background:transparent;cursor:pointer;font-weight:700;min-width:120px}
        .segmented .active{background:linear-gradient(180deg,var(--optim-blue),#0a7df0);color:white;box-shadow:0 10px 30px rgba(8,136,255,.18)}
        .form{margin-top:12px;width:100%;display:flex;flex-direction:column;gap:12px}
        label{font-size:12px;font-weight:500;color:#1E1E1E;margin-bottom:6px;display:block}
        .input{height:48px;border-radius:12px;border:1px solid var(--border);padding:10px 14px;font-size:16px;background:#fff;width:100%}
        .pw-toggle{position:absolute;right:12px;top:8px;height:32px;width:40px;border:none;background:transparent;cursor:pointer}
        .cta{margin-top:6px;height:56px;border-radius:12px;background:var(--optim-blue);color:white;display:flex;align-items:center;justify-content:center;font-weight:800;border:none;font-size:16px;width:100%}
        .policy{font-size:12px;text-align:center;color:#7E7E7E;margin-top:10px}
        .policy a{color:var(--link-color);text-decoration:underline;font-weight:600}
        .msg{margin-top:8px;font-size:13px;text-align:center}
        @media (max-width:640px){ .auth-card{width:calc(100% - 40px);padding:20px;border-radius:20px} .brand-title{font-size:32px} .segmented button{min-width:90px;padding:8px 12px} }
      `}</style>

      <div className="page-wrap" role="region" aria-label="Sign in page">
        <div className="bg-shape left" />
        <div className="bg-shape mid" />
        <div className="bg-shape right" />

        <main className="auth-card" role="main" aria-labelledby="signin-title">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="brand-badge" aria-hidden>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 2 L20 7 v10 l-8 5 l-8 -5 V7 Z" fill="#ffffff" opacity="0.96" />
                <circle cx="12" cy="11.5" r="2.5" fill="#60A5FA" />
              </svg>
            </div>

            <h1 id="signin-title" className="brand-title">Optim<span className="x">X</span></h1>
            <div className="brand-sub">Welcome, Please create an account.</div>
          </div>

          <div className="oauth-row" role="group" aria-label="Third party sign in">
            <button className="oauth-btn" onClick={() => oauthLogin('google')} type="button" aria-label="Sign in with Google">
              <img src="/shape3421-rnx.svg" alt="Google" style={{ width: 18, height: 18 }} />
              <span>Sign in with Google</span>
            </button>

            <button className="oauth-btn" onClick={() => oauthLogin('facebook')} type="button" aria-label="Sign in with Facebook">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path d="M22 12c0-5.5-4.5-10-10-10S2 6.5 2 12c0 4.9 3.5 9 8.1 9.9v-7H7.9v-2.9h2.2V9.7c0-2.2 1.3-3.4 3.3-3.4.95 0 1.9.17 1.9.17v2.1h-1.08c-1.06 0-1.39.66-1.39 1.33v1.6h2.36l-.38 2.9h-1.98v7C18.5 21 22 16.9 22 12z" fill="#0866FF" />
              </svg>
              <span>Sign in with Facebook</span>
            </button>
          </div>

          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
            <div style={{ flex: 1, height: 1, background: '#E6E6E6' }} />
            <div style={{ color: '#9aa0a6', fontSize: 13 }}>Or continue with</div>
            <div style={{ flex: 1, height: 1, background: '#E6E6E6' }} />
          </div>

          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            <div className={`segmented`} role="tablist" aria-label="Choose sign in method">
              <button type="button" aria-pressed={mode === 'magic'} className={mode === 'magic' ? 'active' : ''} onClick={() => setMode('magic')}>Magic Link</button>
              <button type="button" aria-pressed={mode === 'password'} className={mode === 'password' ? 'active' : ''} onClick={() => setMode('password')}>Password</button>
            </div>
          </div>

          <div className="form" aria-labelledby="signin-title">
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@domain.com" autoComplete="email" />
            </div>

            {mode === 'password' && (
              <div>
                <label htmlFor="password">Password</label>
                <div style={{ position: 'relative' }}>
                  <input id="password" className="input" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" style={{ paddingRight: 56 }} />
                  <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, textAlign: 'center', color: '#6F6F6F', marginTop: 6 }}>we will send you a magic link for password free sign in</div>

            {error && <div className="msg" style={{ color: '#d9534f' }}>{error}</div>}
            {info && <div className="msg" style={{ color: '#2f855a' }}>{info}</div>}

            <div className="policy" style={{ marginTop: 12 }}>
              By proceeding, you consent to our <a href="#" onClick={(e) => e.preventDefault()}>Privacy policy</a> &amp; <a href="#" onClick={(e) => e.preventDefault()}>Terms &amp; Conditions</a>
            </div>

            {mode === 'magic' ? (
              <button className="cta" onClick={sendMagicLink} disabled={loading} type="button">{loading ? 'Sending...' : 'Send Magic Link'}</button>
            ) : (
              <button className="cta" onClick={(e) => signInWithPassword(e)} disabled={loading} type="button">{loading ? 'Signing in...' : 'Sign In'}</button>
            )}
          </div>

          <div style={{ marginTop: 12, fontSize: 13, color: '#8b8b8b' }}>© {new Date().getFullYear()} OptimX</div>
        </main>
      </div>
    </>
  );
}
