"use client";

import React, { useRef, useEffect } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "./web/src/components/ui/button"; // adjust import if your Button path differs
import colors from '@/lib/ui/colors'; // adjust path if your colors file is elsewhere

function withAlpha(token: string, alpha: number) {
  const hslMatch = token.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i);
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  }
  if (/rgba?\(|hsla?\(/i.test(token)) return token;
  return token;
}

export default function NotFound() {
  const topRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    topRef.current?.scrollTo?.({ top: 0 });
  }, []);

  return (
    <main
      ref={topRef}
      className="min-h-screen flex items-center justify-center relative overflow-hidden px-4"
      style={{ backgroundColor: colors.background, color: colors.foreground }}
    >
      <style jsx>{`
        .animation-float { animation: floatY 6s ease-in-out infinite alternate; }
        @keyframes floatY { from { transform: translateY(-8px);} to { transform: translateY(8px);} }
        .glass-card { backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
      `}</style>

      {/* Background layers + orbs */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(135deg, ${colors.background} 0%, ${withAlpha(
            "hsl(213 90% 96%)",
            0.28
          )} 40%, ${colors.background} 100%)`,
        }}
      />
      <div className="absolute inset-0" style={{ background: colors.gradientMesh, opacity: 0.32 }} />

      <div
        className="absolute -left-20 top-12 w-72 h-72 rounded-full blur-3xl animation-float"
        style={{ backgroundColor: withAlpha(colors.primary, 0.22) }}
      />
      <div
        className="absolute right-10 bottom-12 w-96 h-96 rounded-full blur-3xl animation-float"
        style={{ backgroundColor: withAlpha(colors.primaryGlow ?? colors.primary, 0.12), animationDelay: "2s" }}
      />

      <div className="relative z-10 max-w-4xl w-full">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-12 h-12 rounded-md flex items-center justify-center glass-card"
            style={{ background: colors.card, border: `1px solid ${colors.border}`, boxShadow: colors.shadowStrong }}
          >
            {/* Simple logo square */}
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <rect x="2" y="2" width="20" height="20" rx="6" fill={colors.primary} />
              <path d="M7 12h10" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 8h10" stroke={withAlpha("white", 0.85)} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div>
            <div className="text-2xl font-bold leading-tight flex items-baseline gap-1">
              <span style={{ color: colors.foreground }}>Oli AI</span>
            </div>
            <div className="text-sm" style={{ color: colors.mutedForeground }}>Page not found</div>
          </div>
        </div>

        <div className="p-10 rounded-3xl glass-card border text-center" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
          <div className="mb-4">
            <h1 className="text-6xl sm:text-7xl font-extrabold" style={{ color: colors.foreground, lineHeight: 1 }}>
              404
            </h1>
            <div className="mt-3 text-lg" style={{ color: colors.mutedForeground }}>
              Sorry — we couldn't find that page.
            </div>
          </div>

          <p className="max-w-2xl mx-auto mt-4 mb-6" style={{ color: colors.mutedForeground }}>
            The page you’re looking for may have been moved, renamed, or does not exist. Try returning home or reach out to support if you think this is an error.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
              <a href="/" className="flex items-center gap-2">Go to Homepage <ArrowRight className="h-4 w-4" /></a>
            </Button>

            <Button size="lg" variant="outline" asChild>
              <a href="/help-center">Visit Help Center</a>
            </Button>
          </div>

          <div className="mt-6 text-sm" style={{ color: colors.mutedForeground }}>
            <Sparkles className="inline-block mr-2" style={{ color: colors.primary }} />
            <span>If you need immediate assistance, email <strong>info@optimx.app</strong> or check <a href="/status">system status</a>.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
