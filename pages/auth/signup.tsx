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

export default function SignUpPage(): React.ReactElement {
  const router = useRouter();

  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const nextSuffix =
    typeof router.query.next === "string"
      ? `?next=${encodeURIComponent(getSafeNextPath(router.query.next, "/try"))}`
      : "";

  function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  async function routeAfterAuth() {
    const decision = await fetchPostAuthDestination();
    if (!decision.ok) {
      setError(decision.error);
      return;
    }
    router.replace(decision.path);
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
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            business_name: businessName.trim(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message || "Failed to create account.");
        setLoading(false);
        return;
      }

      const user = (data as { user?: { id?: string } } | null)?.user ?? null;
      if (user?.id) {
        await routeAfterAuth();
        return;
      }

      setInfo("Account created. Please check your email to confirm and then sign in.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
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
