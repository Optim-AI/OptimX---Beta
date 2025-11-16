// pages/auth/signin.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import colors from '../../lib/colors';

export default function SignInPage(): React.ReactElement {
  const router = useRouter();

  const [mode, setMode] = useState<'magic' | 'password'>('magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // small helper: validate email format
  function isValidEmail(e: string) {
    // simple but effective check
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  // Robust helper — handles hsl(), rgb(), hex (#RGB/#RRGGBB) and returns hsla()/rgba(...)
  function withAlpha(tokenInput: string | undefined | null, alpha: number) {
    const token = String(tokenInput ?? '').trim();
    if (!token) return token;

    // hsl(...) -> hsla(...)
    const hslMatch = token.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i);
    if (hslMatch) {
      const [, h, s, l] = hslMatch;
      return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
    }

    // hsla(...) already
    if (/hsla\(/i.test(token)) return token;

    // rgb(r,g,b) -> rgba(r,g,b,a)
    const rgbMatch = token.match(/rgb\(\s*([0-9]{1,3})[,\s]+([0-9]{1,3})[,\s]+([0-9]{1,3})\s*\)/i);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // rgba already
    if (/rgba\(/i.test(token)) return token;

    // hex #RGB or #RRGGBB
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

    // fallback: return token unchanged
    return token;
  }

  // Listen for auth state changes so we catch OAuth/magic-link sign-ins after redirect
  useEffect(() => {
    const subscription = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        router.replace('/welcome');
      }
    });

    // the SDK returns { data: { subscription } } in older versions and a listener object in others.
    // handle both shapes safely:
    const cleanup = () => {
      try {
        // @ts-ignore
        if (subscription?.data?.subscription?.unsubscribe) subscription.data.subscription.unsubscribe();
        // @ts-ignore
        else if (subscription?.unsubscribe) subscription.unsubscribe();
      } catch {
        // ignore
      }
    };

    return cleanup;
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

  // --- Magic link wiring ---
  const sendMagicLink = async () => {
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

    setLoading(true);
    try {
      // ensure redirect points to your site welcome route after user clicks magic link
      const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/welcome`;

      // Using Supabase Auth: signInWithOtp sends magic link to the email
      // The response shape: { data, error }
      const { data, error: signError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });

      if (signError) {
        // better error messaging for debugging
        setError(signError.message || 'Failed to send magic link. Try again.');
        setLoading(false);
        return;
      }

      // success path: Supabase sends the email. You can give a friendly message.
      setInfo('Magic link sent — check your email (and spam) to complete sign-in.');

      // NOTE: Some Supabase configurations return data.url for hosted flows.
      // We do NOT force-redirect the user here; magic link email will handle sign-in.
      // If you want to start a hosted sign-in flow immediately, uncomment below:
      // if (data?.url) window.location.href = data.url;

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
      const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/welcome`;
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (oauthError) {
        setError(oauthError.message);
      } else if (data?.url) {
        // redirect to Supabase hosted OAuth flow
        window.location.href = data.url;
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
        .page-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
        .bg-shape{position:absolute;border-radius:9999px;pointer-events:none;filter:blur(120px);opacity:.95;z-index:0}
        .bg-shape.left{width:520px;height:520px;left:-140px;top:-80px}
        .bg-shape.mid{width:380px;height:380px;left:420px;top:120px}
        .bg-shape.right{width:600px;height:600px;right:-160px;bottom:-60px}
        .mesh-gradient{mix-blend-mode:overlay}
        .animation-float{ animation: float 8s ease-in-out infinite; transform-origin:center; }
        @keyframes float {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: .9; }
          50% { transform: translateY(-18px) translateX(6px) scale(1.02); opacity: .95; }
          100% { transform: translateY(0) translateX(0) scale(1); opacity: .9; }
        }

        /* CARD + LAYOUT */
        .auth-card{
          z-index:3;
          width:680px;
          border-radius:28px;
          backdrop-filter:blur(6px);
          padding:32px;
          box-shadow:0 20px 80px rgba(2,6,23,.12);
          border:1px solid rgba(226,232,240,.6);
          display:flex;
          flex-direction:column;
          align-items:center;
          position:relative;     /* contain inner bg */
          overflow:hidden;       /* clip inner background to card */
        }
        .card-bg{ position:absolute; inset:0; pointer-events:none; z-index:0; } /* inner card background layer */
        .auth-content{ position:relative; z-index:2; width:100%; display:flex; flex-direction:column; align-items:center; } /* content sits above inner bg */

        .brand-badge{width:90px;height:90px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#36A7FF,#0F62FF);box-shadow:0 0 9.65px rgba(188,215,255,.24)}
        .brand-title{margin-top:10px;font-weight:700;font-size:43px;line-height:65px;color:#1E1E1E;text-align:center}
        .brand-sub{margin-top:4px;color:#5f6b73;font-weight:500;font-size:15px;text-align:center;margin-bottom:18px} /* increased bottom gap */

        /* OAUTH ROW */
        .oauth-row{margin-top:50px;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:14px} /* increased top gap and gap */
        .oauth-btn{display:flex;align-items:center;justify-content:flex-start;gap:12px;background:#fff;border:1px solid var(--border);border-radius:12px;padding:12px 16px;cursor:pointer;font-weight:600;height:56px;width:100%}
        .oauth-btn img, .oauth-btn svg{flex:0 0 20px;height:20px;width:20px}

        .segmented{display:flex;background:#fafafa;padding:6px;border-radius:12px;gap:8px;border:1px solid #F0F0F0}
        .segmented button{border-radius:9999px;padding:12px 24px;border:1px solid transparent;background:transparent;cursor:pointer;font-weight:700;min-width:120px}
        .segmented .active{background:linear-gradient(180deg,var(--optim-blue),#0a7df0);color:white;box-shadow:0 10px 30px rgba(8,136,255,.18)}

        /* FORM + INPUTS - extended widths and spacing */
        .form{margin-top:18px;width:100%;display:flex;flex-direction:column;gap:12px}
        label{font-size:12px;font-weight:500;color:#1E1E1E;margin-bottom:6px;display:block}
        .input{height:56px;border-radius:12px;border:1px solid var(--border);padding:12px 14px;font-size:16px;background:#fff;width:100%;display:block}
        .pw-wrap{position:relative;width:100%} /* ensure password wrapper is full width */
        .pw-toggle{position:absolute;right:12px;top:12px;height:32px;width:40px;border:none;background:transparent;cursor:pointer}
        .cta{margin-top:6px;height:56px;border-radius:12px;background:var(--optim-blue);color:white;display:flex;align-items:center;justify-content:center;font-weight:800;border:none;font-size:16px;width:100%}
        .policy{font-size:12px;text-align:center;color:#7E7E7E;margin-top:10px}
        .policy a{color:var(--link-color);text-decoration:underline;font-weight:600}
        .msg{margin-top:8px;font-size:13px;text-align:center}

        @media (max-width:820px){
          .auth-card{width:calc(100% - 40px);padding:20px;border-radius:20px}
          .brand-title{font-size:32px}
          .segmented button{min-width:90px;padding:8px 12px}
          .oauth-row{grid-template-columns:1fr;gap:10px}
        }
      `}</style>

      <div className="page-wrap" role="region" aria-label="Sign in page">
        {/* Original Background Layers (kept exactly as requested) */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(135deg, ${
              (colors as any)?.background ?? '#ffffff'
            } 0%, ${withAlpha((colors as any)?.primary ?? 'hsl(213 90% 96%)', 0.3)} 50%, ${
              (colors as any)?.background ?? '#ffffff'
            } 100%)`,
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

        {/* Animated Orbs (outside the card) - unchanged */}
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
          aria-labelledby="signin-title"
          style={{
            background:
              ((colors as any)?.gradientCard
                ? (colors as any)?.gradientCard
                : `linear-gradient(180deg, ${withAlpha((colors as any)?.background ?? '#ffffff', 0.12)}, ${withAlpha((colors as any)?.primary ?? 'hsl(213 90% 96%)', 0.04)})`),
          }}
        >
          {/* Card-local background layer: mirrors the outside animated orbs + mesh, clipped inside the card */}
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
              {/* inner mesh overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: (colors as any)?.gradientMesh ?? 'linear-gradient(180deg,#f0f8ff00,#ffffff00)',
                  mixBlendMode: 'overlay',
                  opacity: 0.5,
                }}
              />
              {/* smaller inner orbs - placed inside the card */}
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

          {/* Actual card content sits above the inner background */}
          <div className="auth-content" role="region" aria-label="Sign in form">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="brand-badge" aria-hidden>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 2 L20 7 v10 l-8 5 l-8 -5 V7 Z" fill="#ffffff" opacity="0.96" />
                  <circle cx="12" cy="11.5" r="2.5" fill="#60A5FA" />
                </svg>
              </div>

              <h1 id="signin-title" className="brand-title">
                Optim<span className="x" style={{ color: (colors as any)?.primary ?? '#0088FF' }}>X</span>
              </h1>
              <div className="brand-sub">Welcome, Please create an account.</div>
            </div>

            {/* OAUTH - spacing increased top-to-bottom */}
            <div className="oauth-row" role="group" aria-label="Third party sign in">
              <button
                className="oauth-btn"
                onClick={() => oauthLogin('google')}
                type="button"
                aria-label="Sign in with Google"
              >
                <img src="/shape3421-rnx.svg" alt="Google" style={{ width: 20, height: 20 }} />
                <span style={{ marginLeft: 6 }}>Sign in with Google</span>
              </button>

              <button
                className="oauth-btn"
                onClick={() => oauthLogin('facebook')}
                type="button"
                aria-label="Sign in with Facebook"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                  <path d="M22 12c0-5.5-4.5-10-10-10S2 6.5 2 12c0 4.9 3.5 9 8.1 9.9v-7H7.9v-2.9h2.2V9.7c0-2.2 1.3-3.4 3.3-3.4.95 0 1.9.17 1.9.17v2.1h-1.08c-1.06 0-1.39.66-1.39 1.33v1.6h2.36l-.38 2.9h-1.98v7C18.5 21 22 16.9 22 12z" fill="#0866FF" />
                </svg>
                <span style={{ marginLeft: 6 }}>Sign in with Facebook</span>
              </button>
            </div>

            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, marginTop: 50 }}>
              <div style={{ flex: 1, height: 1, background: '#E6E6E6' }} />
              <div style={{ color: '#9aa0a6', fontSize: 13 }}>Or continue with</div>
              <div style={{ flex: 1, height: 1, background: '#E6E6E6' }} />
            </div>

            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 50 }}>
              <div style={{ width: '100%'}} className={`segmented`} role="tablist" aria-label="Choose sign in method">
                <button type="button" style={{ width: '50%'}} aria-pressed={mode === 'magic'} className={mode === 'magic' ? 'active' : ''} onClick={() => setMode('magic')}>Magic Link</button>
                <button type="button" style={{ width: '50%'}} aria-pressed={mode === 'password'} className={mode === 'password' ? 'active' : ''} onClick={() => setMode('password')}>Password</button>
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
                  <div className="pw-wrap">
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

              <div className="policy" style={{ marginTop: 80 }}>
                By proceeding, you consent to our <a href="#" onClick={(e) => e.preventDefault()}>Privacy policy</a> &amp; <a href="#" onClick={(e) => e.preventDefault()}>Terms &amp; Conditions</a>
              </div>

              {mode === 'magic' ? (
                <button className="cta" onClick={sendMagicLink} disabled={loading} type="button">{loading ? 'Sending...' : 'Send Magic Link'}</button>
              ) : (
                <button className="cta" onClick={(e) => signInWithPassword(e)} disabled={loading} type="button">{loading ? 'Signing in...' : 'Sign In'}</button>
              )}
            </div>

            <div style={{ marginTop: 12, fontSize: 13, color: '#8b8b8b' }}>© {new Date().getFullYear()} OptimX</div>
          </div>
        </main>
      </div>
    </>
  );
}
