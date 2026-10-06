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
import { fetchPostAuthDestination } from "@/lib/auth/client-post-auth";
import AuthShell from "@/components/auth/AuthShell";

export default function SignInPage(): React.ReactElement {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    router.replace(decision.path);
  }

  useEffect(() => {
    const subscription = supabase.auth.onAuthStateChange(async (event, session) => {
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
      try {
        // @ts-ignore
        if (subscription?.data?.subscription?.unsubscribe) {
          subscription.data.subscription.unsubscribe();
        // @ts-ignore
        } else if (subscription?.unsubscribe) {
          subscription.unsubscribe();
        }
      } catch {
        // ignore
      }
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
        setError(signError.message);
      } else if ((data as { user?: unknown } | null)?.user) {
        await routeAfterAuth();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const oauthLogin = async (provider: "google") => {
    setError(null);
    try {
      if (redirectWwwToCanonicalForOAuth()) return;

      const redirectTo = getOAuthCallbackUrl(getSafeNextPath(router.query.next, "/try"));
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (oauthError) {
        setError(oauthError.message);
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
      secondary={
        <div className="auth-helpers">
          <Link href="/auth/forgot-password" className="quiet">
            Forgot password?
          </Link>
        </div>
      }
    >
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
          Password
        </label>
        <input
          id="password"
          className="auth-input"
          type={showPw ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
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
