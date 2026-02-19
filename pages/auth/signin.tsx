"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from '@/auth/supabase/client';
import colors from '@/lib/ui/colors';
import { profileClient } from '@/database/client-helpers';

export default function SignInPage(): React.ReactElement {
  const router = useRouter();

  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function isValidEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  function withAlpha(tokenInput: string | undefined | null, alpha: number) {
    const token = String(tokenInput ?? "").trim();
    if (!token) return token;

    const hslMatch = token.match(
      /hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i
    );
    if (hslMatch) {
      const [, h, s, l] = hslMatch;
      return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
    }

    if (/hsla\(/i.test(token)) return token;

    const rgbMatch = token.match(
      /rgb\(\s*([0-9]{1,3})[,\s]+([0-9]{1,3})[,\s]+([0-9]{1,3})\s*\)/i
    );
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    if (/rgba\(/i.test(token)) return token;

    const hex = token.replace(/^#/, "");
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

  // Derive a sane full name from metadata or email when missing
  function deriveFullName(user: any): string | null {
    if (!user) return null;
    const m = user.user_metadata ?? {};
    // Common metadata fields
    const candidates = [
      m.full_name,
      m.name,
      m.preferred_username,
      m.given_name && (m.family_name ? `${m.given_name} ${m.family_name}` : m.given_name),
      m.given_name,
      m.family_name,
    ];
    for (const c of candidates) {
      if (c && typeof c === "string" && c.trim().length > 0) return c.trim();
    }
    // as a last resort, try to get from email local part
    if (user.email && typeof user.email === "string") {
      const local = user.email.split("@")[0] ?? null;
      if (local) return local.replace(/[._\-0-9]+/g, " ").trim();
    }
    return null;
  }

  // Derive a sensible username fallback
  function deriveUsername(user: any): string | null {
    if (!user) return null;
    const m = user.user_metadata ?? {};
    if (m.username) return String(m.username);
    if (m.preferred_username) return String(m.preferred_username);
    if (user.email && typeof user.email === "string") return user.email.split("@")[0];
    return null;
  }

  // Upsert profile row for a signed-in user.
  // Writes id (supabase user id), email and full_name (as requested).
  async function upsertProfile(user: any) {
    if (!user || !user.id) return;
    try {
      const id = user.id;
      // Prefer explicit fields, then metadata fallbacks
      const emailValue = user.email ?? user.user_metadata?.email ?? null;
      const full_name_value = deriveFullName(user);
      const username = deriveUsername(user);

      const payload: Record<string, any> = {};
      if (emailValue) payload.email = emailValue;
      if (full_name_value) payload.full_name = full_name_value;
      if (username) payload.username = username;

      // Upsert profile using Prisma via API (replaces direct Supabase call)
      const result = await profileClient.upsert(payload);

      if (result.success) {
        console.debug("profiles upserted for user:", id, result.data);
      } else {
        console.error("profiles upsert error:", result.error);
      }
    } catch (err) {
      console.error("upsertProfile unexpected error:", err);
    }
  }

  useEffect(() => {
    const subscription = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // when user completes sign-in (magic link / oauth / password) this fires
        if (event === "SIGNED_IN" && session?.user) {
          try {
            // ensure profile row exists / updated
            await upsertProfile(session.user);
          } catch (e) {
            console.error("error upserting profile on SIGNED_IN:", e);
          } finally {
            // keep original behaviour: redirect to welcome
            router.replace("/welcome");
          }
        }
      }
    );

    const cleanup = () => {
      try {
        // @ts-ignore
        if (subscription?.data?.subscription?.unsubscribe)
          subscription.data.subscription.unsubscribe();
        // @ts-ignore
        else if (subscription?.unsubscribe) subscription.unsubscribe();
      } catch {
        // ignore
      }
    };

    return cleanup;
  }, [router]);

  useEffect(() => {
    (async () => {
      try {
        // if user already signed in (page load), upsert profile and redirect
        const { data } = await supabase.auth.getUser();
        const user = (data as any)?.user ?? null;
        if (user) {
          try {
            await upsertProfile(user);
          } catch (e) {
            console.error("error upserting profile on mount:", e);
          }
          router.replace("/welcome");
        }
      } catch (e) {
        // ignore, but log for debugging
        console.debug("getUser failed on mount:", e);
      }
    })();
  }, [router]);

  const sendMagicLink = async () => {
    setError(null);
    setInfo(null);

    if (!email) {
      setError("Please enter an email.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const isDev = process.env.NODE_ENV === "development";
      const redirectTo = isDev
        ? "http://localhost:3000/welcome"
        : `${process.env.NEXT_PUBLIC_SITE_URL || "https://optimx.app"}/welcome`;

      const { data, error: signError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });

      if (signError) {
        setError(signError.message || "Failed to send magic link. Try again.");
        setLoading(false);
        return;
      }

      // Inform user; actual profile creation happens after they click the link which triggers SIGNED_IN.
      setInfo("Magic link sent — check your email (and spam) to complete sign-in.");
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
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signError) {
        setError(signError.message);
      } else {
        // sign-in succeeded immediately; ensure profile upsert before redirect
        const user = (data as any)?.user ?? null;
        if (user && user.id) {
          try {
            await upsertProfile(user);
          } catch (err) {
            console.error("upsert after password sign-in failed:", err);
          }
        }
        router.replace("/welcome");
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const oauthLogin = async (provider: "google" | "facebook") => {
    setError(null);
    setInfo(null);
    try {
      const redirectTo = `${
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
      }/welcome`;
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (oauthError) {
        setError(oauthError.message);
      } else if (data?.url) {
        // redirect to provider consent screen; after redirect back, onAuthStateChange will upsert profile
        window.location.href = data.url;
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  return (
    <>
      <style jsx global>{`
        :root {
          --optim-blue: hsl(213 100% 55%);
          --border: hsl(0 0% 22%);
          --link-color: hsl(213 100% 65%);
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
          background-color: #121212;
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

        .auth-card {
          z-index: 3;
          width: 500px;
          border-radius: 20px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          padding: 24px;
          box-shadow: 0 1px 2px hsl(0 0% 0% / 0.04), 0 4px 12px hsl(0 0% 0% / 0.04), 0 12px 40px hsl(0 0% 0% / 0.06);
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
          background: linear-gradient(135deg, hsl(213 100% 55%) 0%, hsl(213 100% 65%) 100%);
          box-shadow: 0 0 24px hsl(213 100% 55% / 0.2);
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
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .oauth-btn {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          background: hsl(0 0% 15%);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 10px 12px;
          cursor: pointer;
          font-weight: 600;
          height: 44px;
          width: 100%;
          color: hsl(0 0% 95%);
        }
        .oauth-btn img,
        .oauth-btn svg {
          flex: 0 0 20px;
          height: 20px;
          width: 20px;
        }
        .oauth-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .segmented {
          display: flex;
          background: hsl(0 0% 18%);
          padding: 6px;
          border-radius: 12px;
          gap: 8px;
          border: 1px solid var(--border);
        }
        .segmented button {
          border-radius: 9999px;
          padding: 8px 14px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          font-weight: 700;
          min-width: 88px;
        }
        .segmented .active {
          background: linear-gradient(135deg, hsl(213 100% 55%) 0%, hsl(213 100% 65%) 100%);
          color: white;
          box-shadow: 0 0 24px hsl(213 100% 55% / 0.2);
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
          background: linear-gradient(135deg, hsl(213 100% 55%) 0%, hsl(213 100% 65%) 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          border: none;
          font-size: 15px;
          width: 100%;
          box-shadow: 0 0 24px hsl(213 100% 55% / 0.2);
        }
        .cta:disabled {
          opacity: 0.5;
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
          .segmented button {
            min-width: 76px;
            padding: 6px 10px;
          }
          .oauth-row {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }
      `}</style>

      <div className="page-wrap" role="region" aria-label="Sign in page" style={{ backgroundColor: colors.background }}>
        <main
          className="auth-card"
          role="main"
          aria-labelledby="signin-title"
          style={{
            background: `linear-gradient(135deg, ${withAlpha(colors.card, 0.85)} 0%, ${withAlpha(colors.card, 0.92)} 100%)`,
            border: "1px solid rgba(97, 97, 97, 1)",
          }}
        >
          <div className="card-bg" aria-hidden />

          <div className="auth-content" role="region" aria-label="Sign in form">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div className="brand-badge" aria-hidden style={{ background: "transparent", boxShadow: "none" }}>
                <img src="/images/Oli_AI_Logo.svg" alt="SkalX AI" style={{ width: 56, height: 56, objectFit: "contain" }} />
              </div>

              <h1 id="signin-title" className="brand-title">
                SkalX AI
              </h1>
              <div className="brand-sub">Welcome, Please create an account.</div>
            </div>

            <p
              className="policy"
              style={{
                marginTop: 20,
                marginBottom: 8,
                textAlign: "left",
                width: "100%",
                fontSize: 12,
                color: "var(--muted)",
              }}
            >
              By signing in, you acknowledge our{" "}
              <Link href="/privacy-policy" style={{ color: "var(--link-color)", textDecoration: "underline", fontWeight: 600 }}>
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/terms-and-conditions" style={{ color: "var(--link-color)", textDecoration: "underline", fontWeight: 600 }}>
                Terms &amp; Conditions
              </Link>
              .
            </p>

            <div className="oauth-row" role="group" aria-label="Third party sign in">
              <button className="oauth-btn" onClick={() => oauthLogin("google")} type="button" aria-label="Google Signin">
                {/* Inline Google 'G' logo so you don't need an external image file */}
                <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path fill="#fbc02d" d="M43.6 20.4H42V20H24v8h11.3C33.6 33 29.1 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8.1 2.9l6-6C34.6 4.9 29.6 3 24 3 12.9 3 4 11.9 4 23s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.6z" />
                  <path fill="#e53935" d="M6.3 14.9l6.6 4.8C14 16.1 18.6 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6-6C34.6 4.9 29.6 3 24 3 16.7 3 10.2 7.9 6.3 14.9z" />
                  <path fill="#4caf50" d="M24 43c5.1 0 9.6-2 13-5.2l-6-4.9C29.9 34.9 27.1 36 24 36c-5.1 0-9.6-2-13-5.2l-6.6 4.8C10.2 40.1 16.7 44 24 44z" />
                  <path fill="#1565c0" d="M43.6 20.4H42V20H24v8h11.3c-1 2.8-3 5.2-5.5 6.8l6 4.9C39.9 36.3 44 30 44 23c0-1.3-.1-2.6-.4-3.6z" />
                </svg>
                <span style={{ marginLeft: 6 }}>Google Signin</span>
              </button>

              <button className="oauth-btn" onClick={() => oauthLogin("facebook")} type="button" aria-label="Facebook Signin">
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                  <path d="M22 12c0-5.5-4.5-10-10-10S2 6.5 2 12c0 4.9 3.5 9 8.1 9.9v-7H7.9v-2.9h2.2V9.7c0-2.2 1.3-3.4 3.3-3.4.95 0 1.9.17 1.9.17v2.1h-1.08c-1.06 0-1.39.66-1.39 1.33v1.6h2.36l-.38 2.9h-1.98v7C18.5 21 22 16.9 22 12z" fill="#0866FF" />
                </svg>
                <span style={{ marginLeft: 6 }}>Facebook Signin</span>
              </button>
            </div>

            <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, marginTop: 24 }}>
              <div style={{ flex: 1, height: 1, background: colors.border }} />
              <div style={{ color: colors.mutedForeground, fontSize: 13 }}>Or continue with</div>
              <div style={{ flex: 1, height: 1, background: colors.border }} />
            </div>

            <div style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: 26 }}>
              <div style={{ width: "100%" }} className={`segmented`} role="tablist" aria-label="Choose sign in method">
                <button type="button" style={{ width: "50%" }} aria-pressed={mode === "magic"} className={mode === "magic" ? "active" : ""} onClick={() => setMode("magic")}>
                  Magic Link
                </button>
                <button type="button" style={{ width: "50%" }} aria-pressed={mode === "password"} className={mode === "password" ? "active" : ""} onClick={() => setMode("password")}>
                  Password
                </button>
              </div>
            </div>

            <div className="form" aria-labelledby="signin-title">
              <div>
                <label htmlFor="email">Email</label>
                <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@domain.com" autoComplete="email" />
              </div>

              {mode === "password" && (
                <div>
                  <label htmlFor="password">Password</label>
                  <div className="pw-wrap">
                    <input id="password" className="input" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" style={{ paddingRight: 56 }} />
                    <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"}>
                      {showPw ? "🙈" : "👁️"}
                    </button>
                  </div>

                  {/* helper row with New user and Forgot password */}
                  <div className="helper-row" role="group" aria-label="Password helpers">
                    <a href="/auth/signup" onClick={(e) => { e.preventDefault(); router.push("/auth/signup"); }}>
                      New user? Create account
                    </a>

                    <a href="/auth/forgot-password" className="secondary" onClick={(e) => { e.preventDefault(); router.push("/auth/forgot-password"); }}>
                      Forgot password?
                    </a>
                  </div>
                </div>
              )}

              <div style={{ fontSize: 11, textAlign: "center", color: colors.mutedForeground, marginTop: 6 }}>we will send you a magic link for password free sign in</div>

              {error && <div className="msg" style={{ color: "#d9534f" }}>{error}</div>}
              {info && <div className="msg" style={{ color: "#2f855a" }}>{info}</div>}

              {mode === "magic" ? (
                <button className="cta" onClick={sendMagicLink} disabled={loading} type="button">
                  {loading ? "Sending..." : "Send Magic Link"}
                </button>
              ) : (
                <button className="cta" onClick={(e) => signInWithPassword(e)} disabled={loading} type="button">
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              )}
            </div>

            <div style={{ marginTop: 12, fontSize: 13, color: colors.mutedForeground }}>© {new Date().getFullYear()} SkalX AI</div>
          </div>
        </main>
      </div>
    </>
  );
}