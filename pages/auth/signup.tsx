"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Check, Eye, EyeOff } from "lucide-react";
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
import { authErrorMessage } from "@/lib/auth/auth-errors";

export default function SignUpPage(): React.ReactElement {
  const router = useRouter();

  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);

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
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Never await Supabase calls inside this callback (it holds the auth lock
      // and can deadlock); route once it has returned.
      if (event === "SIGNED_IN" && session?.user) {
        window.setTimeout(() => {
          void routeAfterAuth();
        }, 0);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const oauthLogin = async (provider: "google") => {
    setError(null);
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          businessName: businessName.trim(),
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        code?: string;
        error?: string;
      } | null;

      if (!res.ok || !body?.ok) {
        setError(
          body?.code === "already_registered"
            ? alreadyRegistered()
            : body?.error || "Could not create your account. Please try again."
        );
        return;
      }

      const { data, error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signError) {
        setError(authErrorMessage(signError));
        return;
      }
      if ((data as { user?: unknown } | null)?.user) {
        trackAuditEvent("signup_completed", { method: "email", fromAudit: Boolean(auditNext) });
        await routeAfterAuth();
      }
    } catch (e: unknown) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      variant="signup"
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
      info={null}
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
        <label className="auth-label" htmlFor="business-name">
          Business name
        </label>
        <input
          id="business-name"
          className="auth-input"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="e.g. Chai Point Snacks"
          autoComplete="organization"
        />
      </div>

      <div>
        <label className="auth-label" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          className="auth-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourbrand.com"
          autoComplete="email"
        />
      </div>

      <div>
        <label className="auth-label" htmlFor="password">
          Create a password
        </label>
        <div className="auth-field">
          <input
            id="password"
            className="auth-input"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            aria-describedby="password-hint"
            style={{ paddingRight: 48 }}
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
        {/* Live hint for the same 6-character rule the submit check enforces. */}
        <p id="password-hint" className="auth-hint" data-ok={password.length >= 6 ? "true" : "false"}>
          {password.length >= 6 ? <Check size={13} aria-hidden /> : null}
          At least 6 characters
        </p>
      </div>
    </AuthShell>
  );
}
