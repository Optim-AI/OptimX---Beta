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
        :root { --optim-blue: hsl(213 100% 55%); --border: hsl(0 0% 22%); --link-color: hsl(213 100% 65%); --muted: hsl(0 0% 60%); }
        *{box-sizing:border-box}
        html,body,#__next{height:100%;margin:0}
        body{font-family:Poppins,Inter,system-ui;-webkit-font-smoothing:antialiased}
        .page-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;background-color:#121212}
        .animation-float{ animation: float 8s ease-in-out infinite; transform-origin:center; }
        @keyframes float {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: .9; }
          50% { transform: translateY(-18px) translateX(6px) scale(1.02); opacity: .95; }
          100% { transform: translateY(0) translateX(0) scale(1); opacity: .9; }
        }

        .auth-card{
          z-index:3;
          width:480px;
          border-radius:20px;
          backdrop-filter:blur(20px);
          -webkit-backdrop-filter:blur(20px);
          padding:24px;
          box-shadow:0 1px 2px hsl(0 0% 0% / 0.04), 0 4px 12px hsl(0 0% 0% / 0.04), 0 12px 40px hsl(0 0% 0% / 0.06);
          border:1px solid rgba(255, 255, 255, 0.08);
          display:flex;
          flex-direction:column;
          align-items:center;
          position:relative;
          overflow:hidden;
        }

        .brand-badge{width:64px;height:64px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, hsl(213 100% 55%) 0%, hsl(213 100% 65%) 100%);box-shadow:0 0 24px hsl(213 100% 55% / 0.2)}
        .brand-title{margin-top:8px;font-weight:700;font-size:32px;line-height:40px;color:hsl(0 0% 95%);text-align:center}
        .brand-sub{margin-top:4px;color:hsl(0 0% 60%);font-weight:500;font-size:13px;text-align:center;margin-bottom:12px}

        .oauth-row{margin-top:28px;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .oauth-btn{display:flex;align-items:center;justify-content:flex-start;gap:12px;background:hsl(0 0% 15%);border:1px solid var(--border);border-radius:12px;padding:10px 12px;cursor:pointer;font-weight:600;height:44px;width:100%;color:hsl(0 0% 95%)}

        .form{margin-top:12px;width:100%;display:flex;flex-direction:column;gap:10px}
        label{font-size:12px;font-weight:500;color:hsl(0 0% 95%);margin-bottom:6px;display:block}
        .input{height:44px;border-radius:10px;border:1px solid var(--border);padding:10px 12px;font-size:15px;background:hsl(0 0% 15%);color:hsl(0 0% 95%);width:100%;display:block}
        .input::placeholder{color:hsl(0 0% 50%)}
        .cta{margin-top:6px;height:44px;border-radius:12px;background:linear-gradient(135deg, hsl(213 100% 55%) 0%, hsl(213 100% 65%) 100%);color:white;display:flex;align-items:center;justify-content:center;font-weight:800;border:none;font-size:15px;width:100%;box-shadow:0 0 24px hsl(213 100% 55% / 0.2)}
        .msg{margin-top:8px;font-size:13px;text-align:center}
        .policy{font-size:12px;text-align:center;color:var(--muted);margin-top:10px}
        .policy a{color:var(--link-color);text-decoration:underline;font-weight:600}

        @media (max-width:820px){
          .auth-card{width:calc(100% - 40px);padding:16px;border-radius:14px}
          .brand-title{font-size:26px}
          .oauth-row{grid-template-columns:1fr;gap:10px}
        }
      `}</style>

      <div className="page-wrap" role="region" aria-label="Forgot password page" style={{ backgroundColor: colors.background }}>
        <main className="auth-card" role="main" aria-labelledby="forgot-title"
          style={{
            background: `linear-gradient(135deg, ${withAlpha(colors.card, 0.85)} 0%, ${withAlpha(colors.card, 0.92)} 100%)`,
            border: "1px solid rgba(97, 97, 97, 1)",
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="brand-badge" aria-hidden style={{ background: 'transparent', boxShadow: 'none' }}>
              <img src="/images/Oli_AI_Logo.svg" alt="SkalX AI" style={{ width: 56, height: 56, objectFit: 'contain' }} />
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

          <div style={{ marginTop: 12, fontSize: 13, color: colors.mutedForeground }}>
            <a href="/auth/signin" onClick={(e) => { e.preventDefault(); router.push('/auth/signin'); }} style={{ color: colors.primary, textDecoration: 'none', fontWeight: 700 }}>Back to sign in</a>
          </div>
        </main>
      </div>
    </>
  );
}
