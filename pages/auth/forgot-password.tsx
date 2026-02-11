'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/auth/supabase/client';
import colors from '@/lib/ui/colors';

export default function ForgotPasswordPage(): React.ReactElement {
  const router = useRouter();

  const [email, setEmail] = useState('');
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
      const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`;

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
      const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/welcome`;
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

        .oauth-row{margin-top:28px;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .oauth-btn{display:flex;align-items:center;justify-content:flex-start;gap:12px;background:#fff;border:1px solid var(--border);border-radius:12px;padding:10px 12px;cursor:pointer;font-weight:600;height:44px;width:100%}

        .form{margin-top:12px;width:100%;display:flex;flex-direction:column;gap:10px}
        label{font-size:12px;font-weight:500;color:#1E1E1E;margin-bottom:6px;display:block}
        .input{height:44px;border-radius:10px;border:1px solid var(--border);padding:10px 12px;font-size:15px;background:#fff;width:100%;display:block}
        .cta{margin-top:6px;height:44px;border-radius:12px;background:var(--optim-blue);color:white;display:flex;align-items:center;justify-content:center;font-weight:800;border:none;font-size:15px;width:100%}
        .msg{margin-top:8px;font-size:13px;text-align:center}
        .policy{font-size:12px;text-align:center;color:#7E7E7E;margin-top:10px}
        .policy a{color:var(--link-color);text-decoration:underline;font-weight:600}

        @media (max-width:820px){
          .auth-card{width:calc(100% - 40px);padding:16px;border-radius:14px}
          .brand-title{font-size:26px}
          .oauth-row{grid-template-columns:1fr;gap:10px}
        }
      `}</style>

      <div className="page-wrap" role="region" aria-label="Forgot password page">
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

        <main className="auth-card" role="main" aria-labelledby="forgot-title"
          style={{
            background:
              ((colors as any)?.gradientCard
                ? (colors as any)?.gradientCard
                : `linear-gradient(180deg, ${withAlpha((colors as any)?.background ?? '#ffffff', 0.12)}, ${withAlpha((colors as any)?.primary ?? 'hsl(213 90% 96%)', 0.04)})`),
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="brand-badge" aria-hidden style={{ background: 'transparent', boxShadow: 'none' }}>
              <img src="/images/Oli_AI_Logo.svg" alt="Oli AI" style={{ width: 56, height: 56, objectFit: 'contain' }} />
            </div>

            <h1 id="forgot-title" className="brand-title">Reset password</h1>
            <div className="brand-sub">Enter your email and we'll send a reset link.</div>
          </div>

          <div className="oauth-row" role="group" aria-label="Third party sign in" style={{ display: 'none' }}>
            {/* keep markup for visual parity; hidden by default to avoid confusion */}
          </div>

          <form className="form" onSubmit={handleSendReset} aria-labelledby="forgot-title">
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@domain.com" autoComplete="email" />
            </div>

            {error && <div className="msg" style={{ color: '#d9534f' }}>{error}</div>}
            {info && <div className="msg" style={{ color: '#2f855a' }}>{info}</div>}

            <div className="policy" style={{ marginTop: 20 }}>
              If you don't receive the email, check your spam folder or try again. The link will redirect you to a secure page to set a new password.
            </div>

            <button className="cta" type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send reset email'}</button>
          </form>

          <div style={{ marginTop: 12, fontSize: 13, color: '#8b8b8b' }}>
            <a href="/signin" onClick={(e) => { e.preventDefault(); router.push('/signin'); }} style={{ color: (colors as any)?.primary ?? '#0088FF', textDecoration: 'none', fontWeight: 700 }}>Back to sign in</a>
          </div>
        </main>
      </div>
    </>
  );
}
