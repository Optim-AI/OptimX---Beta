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
import { fetchPostAuthDestination, resolvePostAuthPath } from "@/lib/auth/client-post-auth";
import { authNextFrom, clearAuthContinuation, rememberAuthContinuation } from "@/lib/auth/auth-continuation";
import AuthShell from "@/components/auth/AuthShell";
import { authErrorMessage, classifyAuthError } from "@/lib/auth/auth-errors";

const LAST_EMAIL_KEY = "skalx_last_signin_email";

export default function SignInPage(): React.ReactElement {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  /** Email last used to log in on this device; lets returning users skip retyping it. */
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAST_EMAIL_KEY);
      if (saved) {
        setRememberedEmail(saved);
        setEmail((current) => current || saved);
        window.setTimeout(() => passwordRef.current?.focus(), 0);
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const nextSuffix =
    typeof router.query.next === "string"
      ? `?next=${encodeURIComponent(getSafeNextPath(router.query.next, "/try"))}`
      : "";

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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        try {
          await routeAfterAuth();
        } catch (e) {
          console.error("post-auth routing failed on SIGNED_IN:", e);
          setError("Could not determine where to send you. Please try again.");
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = (data as { user?: unknown } | null)?.user ?? null;
        if (user) {
          await routeAfterAuth();
        }
      } catch (e) {
        console.debug("getUser failed on mount:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const signInWithPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
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
        const kind = classifyAuthError(signError);
        if (kind === "invalid_credentials") {
          // Could be a new person on the wrong page, or a typo: offer both.
          const signupHref = `/auth/signup?${new URLSearchParams({
            email,
            ...(typeof router.query.next === "string" ? { next: getSafeNextPath(router.query.next, "/try") } : {}),
          })}`;
          setError(
            <>
              {authErrorMessage(signError)} New to SkalX?{" "}
              <Link href={signupHref} style={{ textDecoration: "underline" }}>Create an account</Link>
              {" · "}
              <Link href="/auth/forgot-password" style={{ textDecoration: "underline" }}>Reset password</Link>
            </>
          );
        } else {
          setError(authErrorMessage(signError));
        }
      } else if ((data as { user?: unknown } | null)?.user) {
        try {
          window.localStorage.setItem(LAST_EMAIL_KEY, email);
        } catch {
          /* storage unavailable */
        }
        await routeAfterAuth();
      }
    } catch (e: unknown) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

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
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <AuthShell
      accountSwitch={
        <p className="auth-switch">
          Don&apos;t have an account? <Link href={`/auth/signup${nextSuffix}`}>Sign up</Link>
        </p>
      }
      title="Welcome back"
      titleId="signin-title"
      lead="Sign in to keep building campaigns with SkalX AI."
      onGoogle={() => oauthLogin("google")}
      onSubmit={signInWithPassword}
      submitLabel="Log in"
      loadingLabel="Signing in..."
      loading={loading}
      error={error}
      info={null}
    >
      {rememberedEmail && email === rememberedEmail ? (
        /* Returning on this device: show who they're logging in as instead of an empty field. */
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-paper/15 bg-paper/[0.04] px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-paper/55">Logging in as</p>
            <p className="truncate text-[15px] font-medium text-paper">{rememberedEmail}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full px-3 py-1.5 text-sm text-paper/70 underline decoration-paper/30 underline-offset-4 hover:text-paper"
            onClick={() => {
              setEmail("");
              setRememberedEmail(null);
              try {
                window.localStorage.removeItem(LAST_EMAIL_KEY);
              } catch {
                /* storage unavailable */
              }
            }}
          >
            Not you?
          </button>
        </div>
      ) : (
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
      )}

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label className="auth-label" htmlFor="password">
            Password
          </label>
          <span className="auth-helpers">
            <Link href="/auth/forgot-password" className="quiet">
              Forgot password?
            </Link>
          </span>
        </div>
        <div className="auth-field">
          <input
            id="password"
            ref={passwordRef}
            className="auth-input"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
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
      </div>
    </AuthShell>
  );
}
