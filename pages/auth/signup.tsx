"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/auth/supabase/client";
import {
  getOAuthCallbackUrl,
  getSafeNextPath,
  redirectWwwToCanonicalForOAuth,
} from "@/lib/routing/safe-next";
import {
  auditReturnPath,
  fetchPostAuthDestination,
  resolvePostAuthPath,
} from "@/lib/auth/client-post-auth";
import { trackAuditEvent } from "@/lib/audit/analytics";
import { authNextFrom, clearAuthContinuation, rememberAuthContinuation } from "@/lib/auth/auth-continuation";
import AuthShell from "@/components/auth/AuthShell";
import { authErrorMessage, classifyAuthError } from "@/lib/auth/auth-errors";

export default function SignUpPage(): React.ReactElement {
  const router = useRouter();

  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const nextSuffix =
    typeof router.query.next === "string"
      ? `?next=${encodeURIComponent(getSafeNextPath(router.query.next, "/try"))}`
      : "";

  function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  // Coming from "Log in" with an unknown email: keep what they typed.
  useEffect(() => {
    if (typeof router.query.email === "string" && !email) setEmail(router.query.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.email]);

  const alreadyRegistered = () => (
    <>
      You already have an account with this email.{" "}
      <Link href={`/auth/signin${nextSuffix}`} style={{ textDecoration: "underline" }}>Log in</Link>
      {" · "}
      <Link href="/auth/forgot-password" style={{ textDecoration: "underline" }}>Reset password</Link>
    </>
  );

  async function routeAfterAuth() {
    const decision = await fetchPostAuthDestination();
    if (!decision.ok) {
      setError(decision.error);
      return;
    }
    const next = authNextFrom(router.query.next);
    clearAuthContinuation();
    router.replace(resolvePostAuthPath(decision.path, next));
  }

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          await routeAfterAuth();
        }
      } catch {
        // ignore
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        await routeAfterAuth();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const oauthLogin = async (provider: "google") => {
    setError(null);
    setInfo(null);
    try {
      if (redirectWwwToCanonicalForOAuth()) return;

      const nextPath = rememberAuthContinuation(router.query.next, "/try");
      const redirectTo = getOAuthCallbackUrl(nextPath);
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (oauthError) {
        setError(authErrorMessage(oauthError));
      } else if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e: unknown) {
      setError(authErrorMessage(e));
    }
  };

  const handleSignUp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
    if (!password) {
      setError("Please enter a password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!businessName.trim()) {
      setError("Please enter your business name.");
      return;
    }
    if (!agreed) {
      setError("Please agree to the Terms & Conditions and Privacy Policy.");
      return;
    }

    setLoading(true);
    try {
      const nextPath = rememberAuthContinuation(router.query.next, "/try");
      const auditNext = auditReturnPath(nextPath);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            business_name: businessName.trim(),
          },
          emailRedirectTo: getOAuthCallbackUrl(nextPath),
        },
      });

      if (signUpError) {
        setError(classifyAuthError(signUpError) === "already_registered" ? alreadyRegistered() : authErrorMessage(signUpError));
        setLoading(false);
        return;
      }

      const user = (data as { user?: { id?: string; identities?: unknown[] } } | null)?.user ?? null;
      // With email confirmation on, Supabase hides an existing account by returning a
      // user with no identities and no session.
      if (user && Array.isArray(user.identities) && user.identities.length === 0) {
        setError(alreadyRegistered());
        return;
      }
      trackAuditEvent("signup_completed", { method: "email", fromAudit: Boolean(auditNext) });
      // Only a session means they're signed in; otherwise they must confirm their email first.
      if (data?.session) {
        await routeAfterAuth();
        return;
      }

      setInfo(`Account created. We sent a confirmation link to ${email} — open it to finish signing up.`);
    } catch (e: unknown) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      accountSwitch={
        <p className="auth-switch">
          Already have an account? <Link href={`/auth/signin${nextSuffix}`}>Log in</Link>
        </p>
      }
      title="Create your account"
      titleId="signup-title"
      lead="Start building high-performing marketing campaigns with SkalX AI."
      onGoogle={() => oauthLogin("google")}
      onSubmit={handleSignUp}
      submitLabel="Create account"
      loadingLabel="Creating..."
      loading={loading}
      error={error}
      info={info}
      secondary={
        <label className="auth-agree">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I agree to the <Link href="/terms-and-conditions">Terms &amp; Conditions</Link> and{" "}
            <Link href="/privacy-policy">Privacy Policy</Link>.
          </span>
        </label>
      }
    >
      <div>
        <label className="sr-only" htmlFor="business-name">
          Business name
        </label>
        <input
          id="business-name"
          className="auth-input"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Business name"
          autoComplete="organization"
        />
      </div>

      <div>
        <label className="sr-only" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          className="auth-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          autoComplete="email"
        />
      </div>

      <div className="auth-field">
        <label className="sr-only" htmlFor="password">
          Create a password
        </label>
        <input
          id="password"
          className="auth-input"
          type={showPw ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a password"
          autoComplete="new-password"
          style={{ paddingRight: 44 }}
        />
        <button
          type="button"
          className="auth-eye"
          onClick={() => setShowPw((s) => !s)}
          aria-label={showPw ? "Hide password" : "Show password"}
        >
          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </AuthShell>
  );
}
