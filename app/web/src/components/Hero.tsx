"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "./ui/drawer";
import { Sparkles, Loader2, Check, Lightbulb, TrendingUp, Target, Megaphone, PenTool, BarChart3 } from "lucide-react";
import { useRouter } from "next/router";
import Link from "next/link";
import colors from "@/lib/ui/colors";
import { useIsMobile } from "../hooks/use-mobile";
import { ParallaxLayer } from "./ParallaxLayer";

function withAlpha(token: string, alpha: number) {
  const hslMatch = token.match(
    /hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i
  );
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  }
  return token;
}

const AD_CREATIVE_IMAGES = [
  "/images/partners/download__5_-2d306f55-d9c8-4c5b-acbd-5b6812d25c56.png",
  "/images/partners/jimmys-cocktails-green-apple-martini.png",
  "/images/partners/download__2_-df378dbd-3706-431d-bbfd-8f2286e45de1.png",
  "/images/partners/plum-cc332b6e-16f6-42a6-937c-cca1d9a11816.png",
  "/images/partners/eaa4a0c4-064b-487b-8d58-a28b77d2a015_1763752969200_gen-b7af8568-d936-4c20-a335-9a90a4f28709.png",
  "/images/partners/download_dark_choco-b1dee636-d24e-4528-840a-9cee4a332923.png",
  "/images/partners/download__23_-5bb7c097-7ed8-4e26-9f09-b2c3c0dab73f.png",
  "/images/partners/download__24_-f934ff9b-83a1-48c1-a07b-1bdd9ceb13a9.png",
  "/images/partners/download__8_-acc0be34-f324-4ae1-a42b-803835bca987.png",
  "/images/partners/wild_date-a0935436-0c67-4d06-a04a-92172fdb7fd9.png",
  "/images/partners/download__10_-0c8442ce-4905-42ec-a447-17f470161620.png",
  "/images/partners/bombay-shaving-legend-365.png",
  "/images/partners/boat-stone-350-deadpool.png",
];

const PROGRESS_STEPS = [
  "Analyzing website...",
  "Identifying target audience...",
  "Creating campaign angles...",
  "Generating creatives...",
];

function AuthModalButtons({
  onGoogle,
  onEmail,
}: {
  onGoogle: () => void;
  onEmail: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 pt-4">
      <Button
        variant="outline"
        className="h-12 rounded-xl w-full font-medium flex items-center justify-center gap-2"
        onClick={onGoogle}
        style={{ borderColor: colors.border, color: colors.foreground }}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </Button>
      <Button
        variant="outline"
        className="h-12 rounded-xl w-full font-medium"
        onClick={onEmail}
        style={{ borderColor: colors.border, color: colors.foreground }}
      >
        Continue with Email
      </Button>
    </div>
  );
}

const MOCK_CAMPAIGN_ANGLES = [
  { title: "Problem-Solution Angle", desc: "Lead with the pain point your product solves. Create urgency with limited-time framing." },
  { title: "Social Proof Angle", desc: "Feature testimonials, case studies, or user metrics. Trust signals drive conversions." },
  { title: "Aspirational Angle", desc: "Paint the outcome—how life improves after using your product. Emotion-first hook." },
];

const Hero: React.FC = () => {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"idle" | "generating" | "results">("idle");
  const [progressStep, setProgressStep] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [smoothPos, setSmoothPos] = useState({ x: 0, y: 0 });
  const [fadingOut, setFadingOut] = useState(false);
  const [hoveredOrbs, setHoveredOrbs] = useState<Set<number>>(new Set());
  const sectionRef = useRef<HTMLElement | null>(null);
  const floatContainerRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, clientX: 0, clientY: 0, inSection: false });
  const rafRef = useRef<number | null>(null);
  const smoothRef = useRef({ x: 0, y: 0 });
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const LERP = 0.2;
    const HOVER_RADIUS = 90;

    const updateHoveredOrbs = (clientX: number, clientY: number) => {
      const container = floatContainerRef.current;
      if (!container) return;
      const hovered = new Set<number>();
      const children = container.children;
      for (let i = 0; i < children.length; i++) {
        const r = (children[i] as HTMLElement).getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = clientX - cx;
        const dy = clientY - cy;
        if (dx * dx + dy * dy < HOVER_RADIUS * HOVER_RADIUS) hovered.add(i);
      }
      setHoveredOrbs((prev) => {
        if (prev.size !== hovered.size) return hovered;
        for (const i of hovered) if (!prev.has(i)) return hovered;
        return prev;
      });
    };

    const handleMove = (e: MouseEvent) => {
      // Use clientX/clientY only — viewport coords. Never pageX/pageY or +scrollY.
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const dy = (e.clientY - rect.top - rect.height / 2) / rect.height;
      setParallax({
        x: Math.max(-1, Math.min(1, (e.clientX - cx) / rect.width)) * 8,
        y: Math.max(-1, Math.min(1, dy)) * 8,
      });
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      mouseRef.current = { x: mx, y: my, clientX: e.clientX, clientY: e.clientY, inSection: true };
      smoothRef.current = { x: e.clientX, y: e.clientY };
      setCursorPos({ x: mx, y: my });
      setSmoothPos({ x: e.clientX, y: e.clientY });
      setFadingOut(false);
      updateHoveredOrbs(e.clientX, e.clientY);
    };
    const handleLeave = () => {
      setParallax({ x: 0, y: 0 });
      mouseRef.current = { x: 0, y: 0, clientX: 0, clientY: 0, inSection: false };
      setCursorPos(null);
      setHoveredOrbs(new Set());
      setFadingOut(true);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = setTimeout(() => setFadingOut(false), 500);
    };
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const { clientX, clientY, inSection } = mouseRef.current;
      if (!inSection) return;
      const s = smoothRef.current;
      smoothRef.current = {
        x: s.x + (clientX - s.x) * LERP,
        y: s.y + (clientY - s.y) * LERP,
      };
      setSmoothPos(smoothRef.current);
    };
    rafRef.current = requestAnimationFrame(loop);
    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
    else router.push(`/#${id}`);
  };

  const runGenerate = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setInputError("Enter a valid input to generate");
      return;
    }
    setInputError(null);
    setPhase("generating");
    setProgressStep(0);
    for (let i = 0; i < PROGRESS_STEPS.length; i++) {
      setProgressStep(i);
      await new Promise((r) => setTimeout(r, 500));
    }
    setProgressStep(PROGRESS_STEPS.length);
    await new Promise((r) => setTimeout(r, 300));
    setPhase("results");
    await new Promise((r) => setTimeout(r, 2200));
    setAuthModalOpen(true);
  }, [url]);

  const handleContinueWithGoogle = async () => {
    try {
      const { supabase } = await import("@/auth/supabase/client");
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/welcome` : `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/welcome`;
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
      if (error) throw error;
    } catch (e) {
      router.push("/auth/signin");
    }
  };

  const handleContinueWithEmail = () => {
    setAuthModalOpen(false);
    router.push("/auth/signin");
  };

  return (
    <section
      ref={sectionRef}
      id="hero-liquid-trigger"
      className="pt-28 pb-20 min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: '#121212', color: colors.foreground, isolation: 'isolate' }}
    >
      <a id="home" className="absolute top-0 left-0 block w-px h-px invisible" aria-hidden />
      <style jsx>{`
        .hero-card { border-radius: 20px; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 1px 2px hsl(0 0% 0% / 0.04), 0 4px 12px hsl(0 0% 0% / 0.04), 0 12px 40px hsl(0 0% 0% / 0.06);
          transition: transform 0.5s cubic-bezier(0.4,0,0.2,1), box-shadow 0.5s cubic-bezier(0.4,0,0.2,1); }
        .hero-card-expanded { transform: scale(1.01); box-shadow: 0 1px 2px hsl(0 0% 0% / 0.04), 0 8px 24px hsl(0 0% 0% / 0.05), 0 24px 64px hsl(0 0% 0% / 0.08); }
        .hero-input-wrap { transition: transform 0.3s, box-shadow 0.3s; }
        .hero-input-wrap:focus-within { transform: scale(1.01); box-shadow: 0 0 0 1px hsl(213 100% 62% / 0.2), 0 0 24px hsl(213 100% 62% / 0.12); }
        .hero-pill { transition: transform 0.25s, box-shadow 0.25s; }
        .hero-pill:hover { transform: translateY(-2px); box-shadow: 0 4px 12px hsl(0 0% 0% / 0.08); }
        .hero-pill-bounce { animation: pillBounce 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        @keyframes pillBounce { 0%{transform:scale(1)} 40%{transform:scale(1.08)} 100%{transform:scale(1)} }
        .hero-btn-generate { position: relative; overflow: hidden; transition: all 0.3s; }
        .hero-btn-generate::before { content: ""; position: absolute; inset: 0;
          background: linear-gradient(110deg, transparent 0%, hsl(0 0% 100% / 0.2) 25%, transparent 50%, hsl(0 0% 100% / 0.15) 75%, transparent 100%);
          background-size: 200% 100%; animation: btnSweep 3s ease-in-out infinite; }
        .hero-btn-generate:hover { transform: translateY(-1px); box-shadow: 0 4px 20px hsl(213 100% 62% / 0.35); }
        @keyframes btnSweep { 0%,100%{background-position:200% 0} 50%{background-position:-200% 0} }
        @keyframes checkPop { 0%{transform:scale(0);opacity:0} 60%{transform:scale(1.15);opacity:1} 100%{transform:scale(1);opacity:1} }
        .liquid-glass-blob {
          position: relative;
          pointer-events: none;
          will-change: transform, opacity;
          transform-origin: center;
          animation: liquidBlobMorph 7s ease-in-out infinite;
          transition: opacity 0.4s ease, transform 0.4s ease;
        }
        .liquid-glass-blob.scale-up { transform: scale(1.1); }
        .liquid-glass-blob::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: inherit;
          background: radial-gradient(ellipse 70% 70% at 15% 15%, rgba(255,255,255,0.35) 0%, transparent 60%);
          opacity: 0.08;
          pointer-events: none;
        }
        @keyframes liquidBlobMorph {
          0%, 100% { border-radius: 60% 40% 55% 45% / 50% 60% 40% 50%; }
          25% { border-radius: 45% 55% 50% 50% / 55% 45% 55% 45%; }
          50% { border-radius: 50% 50% 40% 60% / 45% 55% 45% 55%; }
          75% { border-radius: 55% 45% 60% 40% / 50% 50% 55% 45%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .liquid-glass-blob { animation: none; }
        }
        @keyframes floatOrbit {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(4px, -6px) rotate(2deg); }
          50% { transform: translate(-3px, -4px) rotate(-1deg); }
          75% { transform: translate(5px, 2px) rotate(1deg); }
        }
        .hero-float-orb { animation: floatOrbit 6s ease-in-out infinite; }
        .hero-float-orb.delay-1 { animation-delay: -1.2s; }
        .hero-float-orb.delay-2 { animation-delay: -2.5s; }
        .hero-float-orb.delay-3 { animation-delay: -4s; }
        .hero-float-orb.delay-4 { animation-delay: -0.5s; }
        .hero-float-orb.delay-5 { animation-delay: -3.2s; }
        @media (prefers-reduced-motion: reduce) {
          .hero-float-orb { animation: none; }
        }
        @media (max-width: 768px) {
          .hero-float-orb { opacity: 0.5; }
        }
        @keyframes adCarouselScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .hero-ad-carousel-track {
          animation: adCarouselScroll 45s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-ad-carousel-track { animation: none; }
        }
        .hero-float-orb-inner {
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s, filter 0.2s;
        }
        .hero-float-orb-hover .hero-float-orb-inner {
          transform: scale(1.45);
          opacity: 0.6;
          filter: drop-shadow(0 0 10px currentColor);
        }
      `}</style>

      <div className="absolute inset-0 z-0" style={{ backgroundColor: '#121212' }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.012] z-[1]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />

      {/* Floating design elements - marketing, growth, creativity - spread across whole hero */}
      {!isMobile && (
        <div ref={floatContainerRef} className="absolute inset-0 pointer-events-none z-[2] overflow-hidden" aria-hidden>
          <div className={`hero-float-orb absolute left-[5%] top-[12%] opacity-[0.32] ${hoveredOrbs.has(0) ? "hero-float-orb-hover" : ""}`} style={{ color: colors.primary }}>
            <span className="hero-float-orb-inner inline-block origin-center"><Lightbulb className="h-7 w-7" strokeWidth={1.5} /></span>
          </div>
          <div className={`hero-float-orb delay-1 absolute left-[22%] top-[8%] opacity-[0.22] ${hoveredOrbs.has(1) ? "hero-float-orb-hover" : ""}`} style={{ color: colors.mutedForeground }}>
            <span className="hero-float-orb-inner inline-block origin-center"><PenTool className="h-5 w-5" strokeWidth={1.5} /></span>
          </div>
          <div className={`hero-float-orb delay-3 absolute left-[8%] top-[58%] opacity-[0.28] ${hoveredOrbs.has(2) ? "hero-float-orb-hover" : ""}`} style={{ color: colors.primary }}>
            <span className="hero-float-orb-inner inline-block origin-center"><TrendingUp className="h-6 w-6" strokeWidth={1.5} /></span>
          </div>
          <div className={`hero-float-orb delay-4 absolute left-[18%] top-[88%] opacity-[0.24] ${hoveredOrbs.has(3) ? "hero-float-orb-hover" : ""}`} style={{ color: colors.primary }}>
            <span className="hero-float-orb-inner inline-block origin-center"><Megaphone className="h-6 w-6" strokeWidth={1.5} /></span>
          </div>
          <div className={`hero-float-orb delay-5 absolute left-[35%] top-[25%] opacity-[0.2] ${hoveredOrbs.has(4) ? "hero-float-orb-hover" : ""}`} style={{ color: colors.mutedForeground }}>
            <span className="hero-float-orb-inner inline-block origin-center"><Sparkles className="h-5 w-5" strokeWidth={1.5} /></span>
          </div>
          <div className={`hero-float-orb delay-2 absolute left-[28%] top-[72%] opacity-[0.26] ${hoveredOrbs.has(5) ? "hero-float-orb-hover" : ""}`} style={{ color: colors.primary }}>
            <span className="hero-float-orb-inner inline-block origin-center"><Target className="h-6 w-6" strokeWidth={1.5} /></span>
          </div>
          <div className={`hero-float-orb absolute right-[6%] top-[18%] opacity-[0.3] ${hoveredOrbs.has(6) ? "hero-float-orb-hover" : ""}`} style={{ color: colors.primary }}>
            <span className="hero-float-orb-inner inline-block origin-center"><Target className="h-7 w-7" strokeWidth={1.5} /></span>
          </div>
          <div className={`hero-float-orb delay-1 absolute right-[20%] top-[6%] opacity-[0.22] ${hoveredOrbs.has(7) ? "hero-float-orb-hover" : ""}`} style={{ color: colors.mutedForeground }}>
            <span className="hero-float-orb-inner inline-block origin-center"><BarChart3 className="h-5 w-5" strokeWidth={1.5} /></span>
          </div>
          <div className={`hero-float-orb absolute right-[8%] top-[52%] opacity-[0.28] ${hoveredOrbs.has(8) ? "hero-float-orb-hover" : ""}`} style={{ color: colors.primary }}>
            <span className="hero-float-orb-inner inline-block origin-center"><Lightbulb className="h-6 w-6" strokeWidth={1.5} /></span>
          </div>
          <div className={`hero-float-orb delay-4 absolute right-[25%] top-[85%] opacity-[0.24] ${hoveredOrbs.has(9) ? "hero-float-orb-hover" : ""}`} style={{ color: colors.primary }}>
            <span className="hero-float-orb-inner inline-block origin-center"><TrendingUp className="h-6 w-6 rotate-180" strokeWidth={1.5} /></span>
          </div>
          <div className={`hero-float-orb delay-3 absolute right-[32%] top-[38%] opacity-[0.2] ${hoveredOrbs.has(10) ? "hero-float-orb-hover" : ""}`} style={{ color: colors.mutedForeground }}>
            <span className="hero-float-orb-inner inline-block origin-center"><Megaphone className="h-5 w-5" strokeWidth={1.5} /></span>
          </div>
          <div className={`hero-float-orb delay-5 absolute left-[42%] top-[92%] opacity-[0.22] ${hoveredOrbs.has(11) ? "hero-float-orb-hover" : ""}`} style={{ color: colors.mutedForeground }}>
            <span className="hero-float-orb-inner inline-block origin-center"><BarChart3 className="h-5 w-5" strokeWidth={1.5} /></span>
          </div>
          <div className={`hero-float-orb delay-2 absolute right-[38%] top-[78%] opacity-[0.24] ${hoveredOrbs.has(12) ? "hero-float-orb-hover" : ""}`} style={{ color: colors.primary }}>
            <span className="hero-float-orb-inner inline-block origin-center"><Sparkles className="h-5 w-5" strokeWidth={1.5} /></span>
          </div>
        </div>
      )}

      {/* Glass lens: disabled — uncomment condition below to re-enable */}
      {false && !isMobile && (cursorPos !== null || fadingOut) && (
        <div
          className="liquid-glass-blob fixed pointer-events-none z-[40]"
          style={{
            left: smoothPos.x,
            top: smoothPos.y,
            width: 140,
            height: 140,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            animation: "none",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 0 60px rgba(255,255,255,0.05)",
            opacity: cursorPos !== null ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
          aria-hidden
        />
      )}

      <ParallaxLayer speed={0.08} className="relative" style={{ zIndex: 10 }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full max-w-6xl">
        {/* Headline - PRD */}
        <div className="text-center mb-4 mx-auto max-w-6xl animate-[fadeUp_0.7s_cubic-bezier(0.16,1,0.3,1)_both" style={{ animationDelay: "0.1s" }}>
          <h1 className="text-4xl sm:text-[46px] font-normal leading-tight tracking-tight md:whitespace-nowrap" style={{ color: colors.foreground }}>
          Create High Converting ads From a Single Prompt..
          </h1>
        </div>
        <p className="text-center text-xl mb-8 max-w-3xl mx-auto font-extralight animate-[fadeUp_0.7s_cubic-bezier(0.16,1,0.3,1)_both" style={{ color: colors.mutedForeground, animationDelay: "0.25s" }}>
        Generate strategy, creatives, and platform ready ads in minutes.
        </p>

        {/* Product Preview UI - interactive mock */}
        <div className={`hero-card p-6 sm:p-8 mb-8 mx-auto w-full max-w-2xl transition-transform duration-800 ${phase === "idle" ? "animate-float-subtle" : ""} ${phase !== "idle" ? "hero-card-expanded" : ""}`} style={{ background: `linear-gradient(135deg, ${withAlpha(colors.card, 0.85)} 0%, ${withAlpha(colors.card, 0.92)} 100%)`, border: '1px solid rgba(97, 97, 97, 1)' }}>
          {phase === "idle" && (
            <div className="space-y-5 animate-[fadeUp_0.5s_cubic-bezier(0.4,0,0.2,1)_forwards]">
              <div className="hero-input-wrap rounded-[18px]">
                <input
                  type="text"
                  placeholder="Paste your website URL or describe your product..."
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setInputError(null);
                  }}
                  className="w-full h-12 rounded-[18px] px-4 text-base outline-none"
                  style={{
                    backgroundColor: colors.card,
                    border: `1px solid ${inputError ? "hsl(0 84% 60%)" : colors.input}`,
                    color: colors.foreground,
                  }}
                />
                {inputError && (
                  <p className="mt-1.5 text-sm" style={{ color: "hsl(0 84% 60%)" }}>
                    {inputError}
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  variant="hero"
                  size="lg"
                  className="px-8 py-4 text-base rounded-xl w-full sm:w-auto min-w-[160px]"
                  asChild
                  style={{ background: colors.gradientPrimary, color: colors.primaryForeground, boxShadow: colors.shadowGlow }}
                >
                  <Link href="/auth/signup" className="flex items-center justify-center w-full">Start Free</Link>
                </Button>
                <Button
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
              2 min launch, no agency, no design skills.
              </p>
            </div>
          )}
          {phase === "generating" && (
            <div className="space-y-6 animate-[fadeUp_0.4s_cubic-bezier(0.4,0,0.2,1)_forwards]">
              {PROGRESS_STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-4" style={{ opacity: i <= progressStep ? 1 : 0.4 }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: i < progressStep ? "hsl(142 76% 36%)" : "hsl(213 100% 55% / 0.2)" }}>
                    {i < progressStep ? <Check className="h-3.5 w-3.5" style={{ color: "white" }} /> : i === progressStep ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: colors.primary }} /> : null}
                  </div>
                  <span className="text-sm font-medium" style={{ color: colors.foreground }}>{step}</span>
                </div>
              ))}
            </div>
          )}
          {phase === "results" && (
            <div className="space-y-4 animate-[fadeUp_0.5s_cubic-bezier(0.4,0,0.2,1)_forwards]">
              <div className="flex items-center gap-2 mb-4">
                <Check className="h-5 w-5" style={{ color: "hsl(142 76% 36%)" }} />
                <span className="text-sm font-semibold" style={{ color: colors.foreground }}>Campaign angles ready</span>
              </div>
              {MOCK_CAMPAIGN_ANGLES.map((a, i) => (
                <div key={i} className="p-4 rounded-[16px]" style={{ background: withAlpha(colors.primary, 0.05), border: `1px solid ${withAlpha(colors.primary, 0.12)}` }}>
                  <div className="font-semibold text-sm mb-1" style={{ color: colors.foreground }}>{a.title}</div>
                  <div className="text-xs" style={{ color: colors.mutedForeground }}>{a.desc}</div>
                </div>
              ))}
              <div className="mt-4 p-4 rounded-[16px] blur-sm select-none pointer-events-none" style={{ background: colors.muted, opacity: 0.65 }} />
              <button type="button" onClick={() => setPhase("idle")} className="text-sm font-medium" style={{ color: colors.primary }}>Generate again</button>
            </div>
          )}
        </div>
        </div>

        {/* Sample AD CREATIVES carousel - full width, breaks out of max-w-4xl */}
        <div className="w-full max-w-7xl mx-auto mb-12 overflow-hidden px-4 sm:px-6 lg:px-8">
        <p className="text-center text-medium mb-9" style={{ color: colors.mutedForeground }}>
            Sample ad creatives made with SkalX
          </p>
          <div className="relative overflow-hidden -mx-4 sm:mx-0">
            <div className="hero-ad-carousel-track flex gap-4 w-max" style={{ width: "max-content" }}>
              {[...AD_CREATIVE_IMAGES, ...AD_CREATIVE_IMAGES].map((src, index) => (
                <div
                  key={index}
                  className="flex-shrink-0 w-[220px] sm:w-[260px] md:w-[280px] rounded-[16px] overflow-hidden"
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 4px 12px hsl(0 0% 0% / 0.3)",
                  }}
                >
                  <div className="relative aspect-[3/4] w-full">
                    <Image
                      src={src}
                      alt={`Ad creative ${(index % AD_CREATIVE_IMAGES.length) + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 200px, (max-width: 768px) 240px, 260px"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ParallaxLayer>

      {isMobile ? (
        <Drawer open={authModalOpen} onOpenChange={setAuthModalOpen}>
          <DrawerContent className="max-h-[85vh] rounded-t-2xl">
            <div className="p-6 pb-8">
              <DrawerHeader>
                <DrawerTitle className="text-xl font-bold text-center">Unlock Your Full Campaign</DrawerTitle>
                <DrawerDescription className="text-center pt-1">Sign up to generate and launch instantly.</DrawerDescription>
              </DrawerHeader>
              <AuthModalButtons onGoogle={handleContinueWithGoogle} onEmail={handleContinueWithEmail} />
              <p className="text-center text-xs pt-2" style={{ color: colors.mutedForeground }}>Takes 10 seconds.</p>
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={authModalOpen} onOpenChange={setAuthModalOpen}>
          <DialogContent className="w-[95vw] max-w-[420px] rounded-2xl p-6 sm:p-8">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-center">Unlock Your Full Campaign</DialogTitle>
              <DialogDescription className="text-center pt-1">Sign up to generate and launch instantly.</DialogDescription>
            </DialogHeader>
            <AuthModalButtons onGoogle={handleContinueWithGoogle} onEmail={handleContinueWithEmail} />
            <p className="text-center text-xs pt-2" style={{ color: colors.mutedForeground }}>Takes 10 seconds.</p>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
};

export default Hero;
