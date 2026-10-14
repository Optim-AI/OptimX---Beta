"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import {
  Sparkles,
  Lightbulb,
  TrendingUp,
  Target,
  Megaphone,
  PenTool,
  BarChart3,
} from "lucide-react";
import { useRouter } from "next/router";
import Link from "next/link";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { trackAuditEvent } from "@/lib/audit/analytics";
import { useIsMobile } from "../hooks/use-mobile";
import { ParallaxLayer } from "./ParallaxLayer";

function withAlpha(token: string, alpha: number) {
  const hslMatch = token.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i);
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  }
  return token;
}

/**
 * Public hero — marketing CTA surface.
 * Website URL starts the free marketing audit (/audit/:id); no signup required.
 * Creative carousel lives in CreativeShowcase on the homepage.
 */
const Hero: React.FC = () => {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [url, setUrl] = useState("");
  const sectionRef = useRef<HTMLElement>(null);
  const floatContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredOrbs, setHoveredOrbs] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isMobile) return;
    const container = floatContainerRef.current;
    if (!container) return;
    const orbs = container.querySelectorAll(".hero-float-orb");
    const onMove = (e: MouseEvent) => {
      const next = new Set<number>();
      orbs.forEach((orb, i) => {
        const r = (orb as HTMLElement).getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
        if (dist < 56) next.add(i);
      });
      setHoveredOrbs(next);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [isMobile]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasteHint, setShowPasteHint] = useState(false);
  const hintTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearHintTimer = () => {
      if (hintTimerRef.current != null) {
        window.clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
      }
    };

    const showHint = () => {
      clearHintTimer();
      setShowPasteHint(true);
      hintTimerRef.current = window.setTimeout(() => {
        setShowPasteHint(false);
        hintTimerRef.current = null;
      }, 5000);
    };

    const onFocusAudit = () => showHint();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowPasteHint(false);
    };

    try {
      if (sessionStorage.getItem("skalx:focus-audit") === "1") {
        sessionStorage.removeItem("skalx:focus-audit");
        const input = document.getElementById("hero-brand-input") as HTMLInputElement | null;
        if (input) {
          input.scrollIntoView({ behavior: "smooth", block: "center" });
          window.setTimeout(() => input.focus({ preventScroll: true }), 450);
        }
        showHint();
      }
    } catch {
      /* ignore */
    }

    window.addEventListener("skalx:focus-audit", onFocusAudit);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("skalx:focus-audit", onFocusAudit);
      window.removeEventListener("keydown", onKeyDown);
      clearHintTimer();
    };
  }, []);

  const startAudit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Enter your website address to get your audit.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch("/api/audit", {
        method: "POST",
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data.audit?.id) {
        setError(data?.error || "We couldn't start your audit. Please try again.");
        setSubmitting(false);
        return;
      }
      if (!data.reused) trackAuditEvent("audit_started", { host: data.audit.host });
      router.push(`/audit/${data.audit.id}`);
    } catch {
      setError("Network error. Check your connection and try again.");
      setSubmitting(false);
    }
  };

  return (
    <section
      ref={sectionRef}
      id="hero-liquid-trigger"
      className="pt-28 pb-16 min-h-[85vh] flex flex-col items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "#121212", color: colors.foreground, isolation: "isolate" }}
    >
      <a id="home" className="absolute top-0 left-0 block w-px h-px invisible" aria-hidden />
      <style jsx>{`
        .hero-card {
          border-radius: 20px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 1px 2px hsl(0 0% 0% / 0.04), 0 4px 12px hsl(0 0% 0% / 0.04),
            0 12px 40px hsl(0 0% 0% / 0.06);
        }
        .hero-input-wrap {
          transition: transform 0.3s, box-shadow 0.3s;
        }
        .hero-input-wrap:focus-within {
          transform: scale(1.01);
          box-shadow: 0 0 0 1px hsl(213 100% 62% / 0.2), 0 0 24px hsl(213 100% 62% / 0.12);
        }
        @keyframes heroHintPulse {
          0%,
          100% {
            box-shadow: 0 0 0 1px hsl(213 100% 62% / 0.35), 0 0 20px hsl(213 100% 62% / 0.15);
          }
          50% {
            box-shadow: 0 0 0 2px hsl(213 100% 62% / 0.55), 0 0 28px hsl(213 100% 62% / 0.28);
          }
        }
        .hero-input-hint-pulse {
          animation: heroHintPulse 1.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-input-hint-pulse {
            animation: none;
            box-shadow: 0 0 0 1px hsl(213 100% 62% / 0.4), 0 0 20px hsl(213 100% 62% / 0.18);
          }
        }
        @keyframes floatOrbit {
          0%,
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(4px, -6px) rotate(2deg);
          }
          50% {
            transform: translate(-3px, -4px) rotate(-1deg);
          }
          75% {
            transform: translate(5px, 2px) rotate(1deg);
          }
        }
        .hero-float-orb {
          animation: floatOrbit 6s ease-in-out infinite;
        }
        .hero-float-orb.delay-1 {
          animation-delay: -1.2s;
        }
        .hero-float-orb.delay-2 {
          animation-delay: -2.5s;
        }
        .hero-float-orb.delay-3 {
          animation-delay: -4s;
        }
        .hero-float-orb.delay-4 {
          animation-delay: -0.5s;
        }
        .hero-float-orb.delay-5 {
          animation-delay: -3.2s;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-float-orb {
            animation: none;
          }
        }
        .hero-float-orb-inner {
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s,
            filter 0.2s;
        }
        .hero-float-orb-hover .hero-float-orb-inner {
          transform: scale(1.45);
          opacity: 0.6;
          filter: drop-shadow(0 0 10px currentColor);
        }
      `}</style>

      <div className="absolute inset-0 z-0" style={{ backgroundColor: "#121212" }} />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.012] z-[1]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {!isMobile && (
        <div
          ref={floatContainerRef}
          className="absolute inset-0 pointer-events-none z-[2] overflow-hidden"
          aria-hidden
        >
          <div
            className={`hero-float-orb absolute left-[5%] top-[12%] opacity-[0.32] ${hoveredOrbs.has(0) ? "hero-float-orb-hover" : ""}`}
            style={{ color: colors.primary }}
          >
            <span className="hero-float-orb-inner inline-block origin-center">
              <Lightbulb className="h-7 w-7" strokeWidth={1.5} />
            </span>
          </div>
          <div
            className={`hero-float-orb delay-1 absolute left-[22%] top-[8%] opacity-[0.22] ${hoveredOrbs.has(1) ? "hero-float-orb-hover" : ""}`}
            style={{ color: colors.mutedForeground }}
          >
            <span className="hero-float-orb-inner inline-block origin-center">
              <PenTool className="h-5 w-5" strokeWidth={1.5} />
            </span>
          </div>
          <div
            className={`hero-float-orb delay-3 absolute left-[8%] top-[58%] opacity-[0.28] ${hoveredOrbs.has(2) ? "hero-float-orb-hover" : ""}`}
            style={{ color: colors.primary }}
          >
            <span className="hero-float-orb-inner inline-block origin-center">
              <TrendingUp className="h-6 w-6" strokeWidth={1.5} />
            </span>
          </div>
          <div
            className={`hero-float-orb delay-4 absolute left-[18%] top-[88%] opacity-[0.24] ${hoveredOrbs.has(3) ? "hero-float-orb-hover" : ""}`}
            style={{ color: colors.primary }}
          >
            <span className="hero-float-orb-inner inline-block origin-center">
              <Megaphone className="h-6 w-6" strokeWidth={1.5} />
            </span>
          </div>
          <div
            className={`hero-float-orb delay-5 absolute left-[35%] top-[25%] opacity-[0.2] ${hoveredOrbs.has(4) ? "hero-float-orb-hover" : ""}`}
            style={{ color: colors.mutedForeground }}
          >
            <span className="hero-float-orb-inner inline-block origin-center">
              <Sparkles className="h-5 w-5" strokeWidth={1.5} />
            </span>
          </div>
          <div
            className={`hero-float-orb delay-2 absolute left-[28%] top-[72%] opacity-[0.26] ${hoveredOrbs.has(5) ? "hero-float-orb-hover" : ""}`}
            style={{ color: colors.primary }}
          >
            <span className="hero-float-orb-inner inline-block origin-center">
              <Target className="h-6 w-6" strokeWidth={1.5} />
            </span>
          </div>
          <div
            className={`hero-float-orb absolute right-[6%] top-[18%] opacity-[0.3] ${hoveredOrbs.has(6) ? "hero-float-orb-hover" : ""}`}
            style={{ color: colors.primary }}
          >
            <span className="hero-float-orb-inner inline-block origin-center">
              <Target className="h-7 w-7" strokeWidth={1.5} />
            </span>
          </div>
          <div
            className={`hero-float-orb delay-1 absolute right-[20%] top-[6%] opacity-[0.22] ${hoveredOrbs.has(7) ? "hero-float-orb-hover" : ""}`}
            style={{ color: colors.mutedForeground }}
          >
            <span className="hero-float-orb-inner inline-block origin-center">
              <BarChart3 className="h-5 w-5" strokeWidth={1.5} />
            </span>
          </div>
        </div>
      )}

      <ParallaxLayer speed={0.08} className="relative" style={{ zIndex: 10 }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full max-w-6xl">
          <div
            className="text-center mb-4 mx-auto max-w-6xl animate-[fadeUp_0.7s_cubic-bezier(0.16,1,0.3,1)_both"
            style={{ animationDelay: "0.1s" }}
          >
            <h1
              className="text-4xl sm:text-[46px] font-normal leading-tight tracking-tight max-w-4xl mx-auto"
              style={{ color: colors.foreground }}
            >
              Your competitors are marketing. Are you learning from them?
            </h1>
          </div>
          <p
            className="text-center text-xl mb-8 max-w-3xl mx-auto font-extralight animate-[fadeUp_0.7s_cubic-bezier(0.16,1,0.3,1)_both"
            style={{ color: colors.mutedForeground, animationDelay: "0.25s" }}
          >
            Get a free AI-powered marketing audit for your brand. Discover what competitors are
            posting, what&apos;s working in your niche, and what you should create next.
          </p>

          <form
            onSubmit={startAudit}
            noValidate
            className="hero-card p-6 sm:p-8 mb-4 mx-auto w-full max-w-2xl animate-float-subtle"
            style={{
              background: `linear-gradient(135deg, ${withAlpha(colors.card, 0.85)} 0%, ${withAlpha(colors.card, 0.92)} 100%)`,
              border: "1px solid rgba(97, 97, 97, 1)",
            }}
          >
            <div className="space-y-5">
              <div className="relative">
                {showPasteHint && (
                  <div
                    role="status"
                    className="absolute left-1/2 bottom-full z-20 mb-3 w-max max-w-[min(90vw,280px)] -translate-x-1/2 animate-[fadeUp_0.35s_cubic-bezier(0.16,1,0.3,1)_both]"
                  >
                    <div
                      className="relative rounded-xl px-4 py-2.5 text-sm font-medium text-center shadow-lg"
                      style={{
                        background: "hsl(0 0% 12%)",
                        color: colors.foreground,
                        border: "1px solid rgba(255,255,255,0.12)",
                        boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
                      }}
                    >
                      Paste your website here
                      <span
                        aria-hidden
                        className="absolute left-1/2 top-full -translate-x-1/2"
                        style={{
                          width: 0,
                          height: 0,
                          borderLeft: "8px solid transparent",
                          borderRight: "8px solid transparent",
                          borderTop: "8px solid hsl(0 0% 12%)",
                          filter: "drop-shadow(0 1px 0 rgba(255,255,255,0.12))",
                        }}
                      />
                    </div>
                  </div>
                )}
                <div
                  className={`hero-input-wrap rounded-[18px] ${showPasteHint ? "hero-input-hint-pulse" : ""}`}
                >
                  <label htmlFor="hero-brand-input" className="sr-only">
                    Your website URL
                  </label>
                  <input
                    id="hero-brand-input"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="yourbrand.com"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (error) setError(null);
                      if (showPasteHint) setShowPasteHint(false);
                    }}
                    aria-invalid={Boolean(error)}
                    aria-describedby={
                      error
                        ? "hero-audit-error"
                        : showPasteHint
                          ? "hero-paste-hint"
                          : undefined
                    }
                    disabled={submitting}
                    className="w-full h-12 rounded-[18px] px-4 text-base outline-none"
                    style={{
                      backgroundColor: colors.card,
                      border: `1px solid ${
                        error
                          ? colors.destructive
                          : showPasteHint
                            ? "hsl(213 100% 62% / 0.7)"
                            : colors.input
                      }`,
                      color: colors.foreground,
                    }}
                  />
                </div>
                {showPasteHint && (
                  <span id="hero-paste-hint" className="sr-only">
                    Paste your website here to start the free audit
                  </span>
                )}
              </div>
              {error && (
                <p id="hero-audit-error" role="alert" className="text-sm text-center" style={{ color: colors.destructive }}>
                  {error}
                </p>
              )}
              <div className="flex flex-col items-center justify-center gap-4">
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  disabled={submitting}
                  className="px-8 py-4 text-base rounded-xl w-full sm:w-auto min-w-[220px]"
                  style={{
                    background: colors.gradientPrimary,
                    color: colors.primaryForeground,
                    boxShadow: colors.shadowGlow,
                  }}
                >
                  {submitting ? "Starting your audit…" : "Get my free audit"}
                </Button>
              </div>
              <p className="text-center text-sm" style={{ color: colors.mutedForeground }}>
                No signup or card needed to see your results.
              </p>
            </div>
          </form>

          <div className="text-center">
            <Link href="/pricing" className="text-sm font-medium" style={{ color: colors.primary }}>
              Don&apos;t have a website? Explore plans
            </Link>
          </div>
        </div>
      </ParallaxLayer>
    </section>
  );
};

export default Hero;
