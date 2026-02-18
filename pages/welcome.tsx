// pages/welcome.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from '@/auth/supabase/client';
import { authFetch } from '@/lib/utils';
import colors from '@/lib/ui/colors';

/** Capitalize first letter */
function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** withAlpha helper same as signin */
function withAlpha(tokenInput: string | undefined | null, alpha: number) {
  const token = String(tokenInput ?? "").trim();
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

export default function Welcome(): React.ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function extractName(user: any) {
    if (!user) return null;
    const meta = user.user_metadata ?? {};
    const candidates = [
      meta.full_name ?? meta.name ?? meta.fullName ?? meta.first_name ?? meta.given_name,
      user.email ? user.email.split("@")[0] : undefined,
    ];
    for (const c of candidates) {
      if (c && c.trim().length > 0) return c.trim();
    }
    return null;
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const { data } = await supabase.auth.getUser();
        const user = data?.user ?? null;

        if (!mounted) return;

        if (!user) {
          // Not logged in, redirect to signin
          router.replace('/auth/signin');
          return;
        }

        // Check if plan system is enabled
        const plansCheckResponse = await authFetch('/api/billing/plans/status');
        const plansStatus = await plansCheckResponse.json();

        // If plans are enabled, check if user has selected a plan
        if (plansStatus.plansEnabled) {
          const subResponse = await authFetch('/api/billing/subscriptions/current');
          const subData = await subResponse.json();

          if (!subData.hasSubscription) {
            // Plans are enabled but user hasn't selected one
            router.replace('/#pricing');
            return;
          }
        }
        // If plans are disabled, user can proceed with pay-as-you-go

        // Extract and set user name
        const name = extractName(user);
        if (name) setUserName(capitalize(name.split(" ")[0]));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
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
        Loading…
      </div>
    );
  }

  const firstName = userName ?? "";

  return (
    <>
      <style jsx>{`
        /* layout */
        .page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          padding: 40px 20px;
          font-family: Poppins, Inter, system-ui;
          text-align: center;
          background-color: #121212;
          color: hsl(0 0% 95%);
        }

        /* floating + subtle rotation for depth */
        @keyframes float {
          0% { transform: translateY(0) translateX(0) rotate(0deg) scale(1); opacity: 0.95; }
          25% { transform: translateY(-8px) translateX(4px) rotate(.25deg) scale(1.01); opacity: 0.98; }
          50% { transform: translateY(0) translateX(0) rotate(0deg) scale(1); opacity: 0.95; }
          75% { transform: translateY(6px) translateX(-3px) rotate(-.3deg) scale(0.995); opacity: 0.94; }
          100% { transform: translateY(0) translateX(0) rotate(0deg) scale(1); opacity: 0.95; }
        }

        /* entrance animations */
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pop {
          0% { transform: scale(0.94); opacity: 0; }
          60% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        /* shimmer on name */
        @keyframes nameShine {
          0% { background-position: -120% 0; }
          100% { background-position: 220% 0; }
        }

        .center-fade {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          background: linear-gradient(
            90deg,
            transparent 0%,
            transparent 20%,
            rgba(18,18,18,0.5) 45%,
            rgba(18,18,18,0.5) 55%,
            transparent 80%,
            transparent 100%
          );
        }

        .title {
          font-size: 40px;
          font-weight: 800;
          margin-bottom: 14px;
          position: relative;
          z-index: 2;
          color: hsl(0 0% 95%);
          animation: fadeSlideUp 620ms cubic-bezier(.2,.9,.2,1) both;
          animation-delay: 80ms;
        }

        .name {
          color: ${colors?.primary ?? "#0088FF"};
          font-weight: 900;
          display: inline-block;
          transform-origin: center;
          animation: pop 850ms cubic-bezier(.2,.9,.2,1) both;
          animation-delay: 160ms;
          position: relative;
          /* subtle shine */
          background: linear-gradient(90deg, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 70%, rgba(255,255,255,0.0) 100%);
          background-size: 240% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
        }
        /* overlay a pseudo-element for the actual colored text so we can animate shine separately */
        .name::after {
          content: attr(data-text);
          position: absolute;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          color: ${colors?.primary ?? "#0088FF"};
          -webkit-text-fill-color: ${colors?.primary ?? "#0088FF"};
          background: linear-gradient(90deg, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.0) 55%, rgba(255,255,255,0.0) 100%);
          background-size: 240% 100%;
          animation: nameShine 2.8s linear infinite;
          animation-delay: 500ms;
          pointer-events: none;
        }

        .subtitle {
          margin-top: 12px;
          color: hsl(0 0% 75%);
          font-size: 18px;
          max-width: 640px;
          margin-left: auto;
          margin-right: auto;
          position: relative;
          z-index: 2;
          opacity: 0;
          animation: fadeSlideUp 720ms cubic-bezier(.2,.9,.2,1) both;
          animation-delay: 240ms;
        }

        /* CTA */
        .cta {
          margin-top: 40px;
          width: 240px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(180deg, #0088ff, #0073e6);
          color: white;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          border: none;
          box-shadow: 0 10px 30px rgba(0, 136, 255, 0.3);
          position: relative;
          z-index: 2;
          transform: translateY(6px);
          opacity: 0;
          animation: fadeSlideUp 760ms cubic-bezier(.2,.9,.2,1) both;
          animation-delay: 300ms;
          transition: transform 180ms ease, box-shadow 180ms ease;
        }

        .cta:hover {
          transform: translateY(0);
          box-shadow: 0 18px 40px rgba(0,136,255,0.4);
          background: linear-gradient(180deg, #1a94ff, #0080f0);
        }
        .cta:active { transform: translateY(1px) scale(0.998); }
        .cta:focus { outline: 3px solid rgba(0,136,255,0.3); outline-offset: 3px; }

        .do-later {
          margin-top: 18px;
          display: block;
          font-size: 14px;
          color: hsl(0 0% 65%);
          text-decoration: underline;
          cursor: pointer;
          position: relative;
          z-index: 2;
          opacity: 0;
          animation: fadeSlideUp 680ms cubic-bezier(.2,.9,.2,1) both;
          animation-delay: 360ms;
          transition: color 0.2s ease;
        }

        .do-later:hover {
          color: hsl(0 0% 85%);
        }

        /* orb specific */
        .orb {
          filter: blur(84px);
          border-radius: 9999px;
          position: absolute;
          transform-origin: center;
          animation: float 8000ms ease-in-out infinite;
        }
        .orb.small { width: 220px; height: 220px; top: 12px; left: 12px; animation-duration: 8200ms; }
        .orb.medium { width: 300px; height: 300px; bottom: 10px; right: 20px; animation-duration: 9000ms; animation-delay: 2000ms; }
        .orb.big { width: 420px; height: 420px; top: 50%; left: 50%; transform: translate(-50%,-50%); animation-duration: 10000ms; animation-delay: 4000ms; }

        /* media */
        @media (max-width: 860px) {
          .title { font-size: 28px; }
          .subtitle { font-size: 15px; }
          .cta { width: 200px; }
          .orb.small { display: none; } /* optional: reduce clutter on small screens */
          .orb.big { width: 300px; height: 300px; }
        }
      `}</style>

      <div className="page" role="main" aria-label="Welcome page" style={{ backgroundColor: colors.background }}>

        {/* Content - animated in */}
        <h1 className="title" aria-live="polite">
          Welcome,{" "}
          <span className="name" data-text={firstName || "there"}>
            {firstName || "there"}
          </span>
          {" "}👋
        </h1>

        <p className="subtitle">
          Let&apos;s set up your workspace in under a minute.
        </p>

        {error && (
          <p style={{ color: colors.destructive ?? "#ef4444", marginTop: 14, position: "relative", zIndex: 2 }}>
            {error}
          </p>
        )}

        <button
          className="cta"
          onClick={() => router.push("/onboardingInfo")}
          type="button"
          aria-label="Get started"
        >
          Get Started
        </button>

        <a
          className="do-later"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            router.push("/creative-studio?guided=1");
          }}
        >
          Skip for now
        </a>
      </div>
    </>
  );
}
