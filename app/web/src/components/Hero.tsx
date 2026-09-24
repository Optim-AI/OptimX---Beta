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
 * Brand URL/product input routes into the canonical /try flow (no second onboarding).
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

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
    else router.push(`/#${id}`);
  };

  const goToTry = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = url.trim();
    if (trimmed) {
      const looksLikeUrl =
        /^https?:\/\//i.test(trimmed) ||
        /^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed);
      if (looksLikeUrl) {
        const withProtocol = /^https?:\/\//i.test(trimmed)
          ? trimmed
          : `https://${trimmed}`;
        router.push(`/try?website=${encodeURIComponent(withProtocol)}`);
        return;
      }
      router.push(`/try?brand=${encodeURIComponent(trimmed)}`);
      return;
    }
    router.push("/try");
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
              className="text-4xl sm:text-[46px] font-normal leading-tight tracking-tight md:whitespace-nowrap"
              style={{ color: colors.foreground }}
            >
              Your AI Marketing Partner.
            </h1>
          </div>
          <p
            className="text-center text-xl mb-8 max-w-3xl mx-auto font-extralight animate-[fadeUp_0.7s_cubic-bezier(0.16,1,0.3,1)_both"
            style={{ color: colors.mutedForeground, animationDelay: "0.25s" }}
          >
            SkalX understands your brand and creates marketing creatives so campaigns move
            faster.
          </p>

          <form
            onSubmit={goToTry}
            className="hero-card p-6 sm:p-8 mb-4 mx-auto w-full max-w-2xl animate-float-subtle"
            style={{
              background: `linear-gradient(135deg, ${withAlpha(colors.card, 0.85)} 0%, ${withAlpha(colors.card, 0.92)} 100%)`,
              border: "1px solid rgba(97, 97, 97, 1)",
            }}
          >
            <div className="space-y-5">
              <div className="hero-input-wrap rounded-[18px]">
                <label htmlFor="hero-brand-input" className="sr-only">
                  Website URL or brand name
                </label>
                <input
                  id="hero-brand-input"
                  type="text"
                  placeholder="Paste your website URL or brand name..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full h-12 rounded-[18px] px-4 text-base outline-none"
                  style={{
                    backgroundColor: colors.card,
                    border: `1px solid ${colors.input}`,
                    color: colors.foreground,
                  }}
                />
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="px-8 py-4 text-base rounded-xl w-full sm:w-auto min-w-[160px]"
                  style={{
                    background: colors.gradientPrimary,
                    color: colors.primaryForeground,
                    boxShadow: colors.shadowGlow,
                  }}
                >
                  Try Now →
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="px-8 py-4 text-base rounded-xl w-full sm:w-auto min-w-[160px]"
                  onClick={() => scrollToSection("how-it-works")}
                  style={{ borderColor: colors.border, color: colors.foreground }}
                >
                  See How It Works
                </Button>
              </div>
              <p className="text-center text-sm" style={{ color: colors.mutedForeground }}>
                Experience SkalX with your brand — no free trial required to explore.
              </p>
            </div>
          </form>

          <div className="text-center">
            <Link href="/try" className="text-sm font-medium" style={{ color: colors.primary }}>
              Or continue without entering a URL →
            </Link>
          </div>
        </div>
      </ParallaxLayer>
    </section>
  );
};

export default Hero;
