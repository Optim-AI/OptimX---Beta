// pages/welcome.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from '@/auth/supabase/client';
import { fetchPostAuthDestination } from '@/lib/auth/client-post-auth';
import colors from '@/lib/ui/colors';
import { PulseSpinner } from '@/app/web/src/components/ui/skeletons';

/**
 * Thin post-auth entry. Uses the same canonical resolver as Google OAuth
 * and /try — no independent business_name check.
 */
export default function Welcome(): React.ReactElement {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;

    let mounted = true;
    (async () => {
      try {
        setError(null);
        const { data } = await supabase.auth.getUser();
        const user = data?.user ?? null;

        if (!mounted) return;

        if (!user) {
          router.replace('/auth/signin');
          return;
        }

        const decision = await fetchPostAuthDestination();
        if (!mounted) return;

        if (!decision.ok) {
          setError(decision.error);
          return;
        }

        if (decision.destination === 'workspace') {
          router.replace(decision.path);
          return;
        }

        router.replace('/try');
      } catch (e: unknown) {
        if (!mounted) return;
        setError(
          e instanceof Error
            ? e.message
            : 'Could not determine where to send you. Please try again.'
        );
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router.isReady, router]);

  if (error) {
    return (
      <div
        className="app-page"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#121212",
          color: colors.foreground,
          padding: 24,
          textAlign: "center",
        }}
      >
        <div>
          <p style={{ color: colors.destructive ?? "#ef4444", marginBottom: 16 }}>{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: colors.primary,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "10px 18px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="app-page"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#121212",
        fontFamily: "Poppins, Inter",
        color: colors.foreground,
      }}
    >
      <PulseSpinner />
    </div>
  );
}
