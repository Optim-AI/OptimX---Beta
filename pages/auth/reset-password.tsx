'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import colors from '../../lib/colors';

export default function ResetPasswordPage(): React.ReactElement {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState('');
  const [rePassword, setRePassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExists, setSessionExists] = useState<boolean | null>(null);

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
    <>
      <style jsx global>{`
        :root { --optim-blue: #0088FF; --border: #C2C2C2; --link-color:#0a66ff; --muted:#6F6F6F; }
        *{box-sizing:border-box}
        html,body,#__next{height:100%;margin:0}
        body{font-family:Poppins,Inter,system-ui;-webkit-font-smoothing:antialiased}
        .page-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
        .animation-float{ animation: float 8s ease-in-out infinite; transform-origin:center; }
        @keyframes float {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: .9; }
          50% { transform: translateY(-18px) translateX(6px) scale(1.02); opacity: .95; }
          100% { transform: translateY(0) translateX(0) scale(1); opacity: .9; }
        }

        .auth-card{
          z-index:3;
          width:480px;
          border-radius:18px;
          backdrop-filter:blur(6px);
          padding:20px;
          box-shadow:0 20px 80px rgba(2,6,23,.12);
          border:1px solid rgba(226,232,240,.6);
          display:flex;
          flex-direction:column;
          align-items:center;
          position:relative;
          overflow:hidden;
        }

        .brand-badge{width:64px;height:64px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#36A7FF,#0F62FF);box-shadow:0 0 9.65px rgba(188,215,255,.24)}
        .brand-title{margin-top:8px;font-weight:700;font-size:32px;line-height:40px;color:#1E1E1E;text-align:center}
        .brand-sub{margin-top:4px;color:#5f6b73;font-weight:500;font-size:13px;text-align:center;margin-bottom:12px}

        .form{margin-top:12px;width:100%;display:flex;flex-direction:column;gap:10px}
        label{font-size:12px;font-weight:500;color:#1E1E1E;margin-bottom:6px;display:block}
        .input{height:44px;border-radius:10px;border:1px solid var(--border);padding:10px 12px;font-size:15px;background:#fff;width:100%;display:block}
        .pw-wrap{position:relative;width:100%}
        .pw-toggle{position:absolute;right:12px;top:10px;height:28px;width:36px;border:none;background:transparent;cursor:pointer}
        .cta{margin-top:6px;height:44px;border-radius:12px;background:var(--optim-blue);color:white;display:flex;align-items:center;justify-content:center;font-weight:800;border:none;font-size:15px;width:100%}
        .msg{margin-top:8px;font-size:13px;text-align:center}
        .policy{font-size:12px;text-align:center;color:#7E7E7E;margin-top:10px}
        .policy a{color:var(--link-color);text-decoration:underline;font-weight:600}

        @media (max-width:820px){
          .auth-card{width:calc(100% - 40px);padding:16px;border-radius:14px}
          .brand-title{font-size:26px}
        }
      `}</style>

      <div className="page-wrap" role="region" aria-label="Reset password page">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(135deg, ${(colors as any)?.background ?? '#ffffff'} 0%, ${withAlpha((colors as any)?.primary ?? 'hsl(213 90% 96%)', 0.3)} 50%, ${(colors as any)?.background ?? '#ffffff'} 100%)`,
            zIndex: 0,
          }}
        />
        <div
          className="absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl animation-float"
          style={{ backgroundColor: withAlpha((colors as any)?.primary ?? 'hsl(213 90% 50%)', 0.3), zIndex: 0 }}
        />
        <div
          className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl animation-float"
          style={{ backgroundColor: withAlpha((colors as any)?.primary ?? 'hsl(213 90% 50%)', 0.18), zIndex: 0, animationDelay: '2s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl animation-float"
          style={{ backgroundImage: `linear-gradient(90deg, ${withAlpha((colors as any)?.primary ?? 'hsl(213 90% 50%)', 0.1)} 0%, ${withAlpha(((colors as any)?.primaryGlow ?? (colors as any)?.primary) ?? 'hsl(213 90% 50%)', 0.06)} 100%)`, zIndex: 0, animationDelay: '4s' }}
        />

        <main className="auth-card" role="main" aria-labelledby="reset-title"
          style={{
            background:
              ((colors as any)?.gradientCard
                ? (colors as any)?.gradientCard
                : `linear-gradient(180deg, ${withAlpha((colors as any)?.background ?? '#ffffff', 0.12)}, ${withAlpha((colors as any)?.primary ?? 'hsl(213 90% 96%)', 0.04)})`),
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="brand-badge" aria-hidden style={{ background: 'transparent', boxShadow: 'none' }}>
              <img src="/images/OptimX_Logo.svg" alt="OptimX" style={{ width: 56, height: 56, objectFit: 'contain' }} />
            </div>

            <h1 id="reset-title" className="brand-title">Set a new password</h1>
            <div className="brand-sub">{sessionExists === null ? 'Verifying link...' : sessionExists ? 'Enter your new password' : 'Invalid or unsupported link'}</div>
          </div>

          <form className="form" onSubmit={handleChangePassword} aria-labelledby="reset-title">
            <div>
              <label htmlFor="newpassword">New password</label>
              <div className="pw-wrap">
                <input id="newpassword" className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" autoComplete="new-password" />
              </div>
            </div>

            <div>
              <label htmlFor="repassword">Re-enter new password</label>
              <div className="pw-wrap">
                <input id="repassword" className="input" type="password" value={rePassword} onChange={(e) => setRePassword(e.target.value)} placeholder="Re-enter new password" autoComplete="new-password" />
              </div>
            </div>

            {error && <div className="msg" style={{ color: '#d9534f' }}>{error}</div>}
            {info && <div className="msg" style={{ color: '#2f855a' }}>{info}</div>}

            <div className="policy" style={{ marginTop: 8 }}>
              Password will only update after you arrived here via the secure email verification link.
            </div>

            <button className="cta" type="submit" disabled={loading || sessionExists === false}>
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>

          <div style={{ marginTop: 12, fontSize: 13, color: '#8b8b8b' }}>
            <a href="/signin" onClick={(e) => { e.preventDefault(); router.push('/signin'); }} style={{ color: (colors as any)?.primary ?? '#0088FF', textDecoration: 'none', fontWeight: 700 }}>Back to sign in</a>
          </div>
        </main>
      </div>
    </>
  );
}
