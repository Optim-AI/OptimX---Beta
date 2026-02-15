"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
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
import { Sparkles, Loader2, Check } from "lucide-react";
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

type TabType = "Campaign Strategy" | "Ad Creatives" | "Social Posts";
const TABS: TabType[] = ["Campaign Strategy", "Ad Creatives", "Social Posts"];
const PLATFORMS = [
  { id: "meta", label: "Meta" },
  { id: "google", label: "Google" },
  { id: "linkedin", label: "LinkedIn" },
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
  const [activeTab, setActiveTab] = useState<TabType>("Campaign Strategy");
  const [platforms, setPlatforms] = useState<Set<string>>(new Set(["meta"]));
  const [phase, setPhase] = useState<"idle" | "generating" | "results">("idle");
  const [progressStep, setProgressStep] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [pillBounce, setPillBounce] = useState<string | null>(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const sectionRef = useRef<HTMLElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, inSection: false });
  const rafRef = useRef<number | null>(null);
  const sparkleIdRef = useRef(0);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const dy = (e.clientY - rect.top - rect.height / 2) / rect.height;
      setParallax({
        x: Math.max(-1, Math.min(1, (e.clientX - cx) / rect.width)) * 8,
        y: Math.max(-1, Math.min(1, dy)) * 8,
      });
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        inSection: true,
      };
    };
    const handleLeave = () => {
      setParallax({ x: 0, y: 0 });
      mouseRef.current = { x: 0, y: 0, inSection: false };
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    let lastX = 0;
    let lastY = 0;
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const { x, y, inSection } = mouseRef.current;
      if (inSection && (x !== lastX || y !== lastY)) {
        lastX = x;
        lastY = y;
        sparkleIdRef.current += 1;
        setSparkles((prev) => {
          const next = [...prev, { id: sparkleIdRef.current, x, y }];
          return next.slice(-38);
        });
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const togglePlatform = useCallback((id: string) => {
    setPillBounce(id);
    setTimeout(() => setPillBounce(null), 400);
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleTabClick = useCallback((tab: TabType) => {
    setPillBounce(tab);
    setTimeout(() => setPillBounce(null), 400);
    setActiveTab(tab);
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
      id="home"
      className="pt-28 pb-20 min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: '#121212', color: colors.foreground, isolation: 'isolate' }}
    >
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
        @keyframes heroSparkle { from{opacity:0.7} to{opacity:0} }
        .hero-sparkle { animation: heroSparkle 2s cubic-bezier(0.4,0,0.2,1) forwards; pointer-events: none; }
      `}</style>

      <div className="absolute inset-0 z-0" style={{ backgroundColor: '#121212' }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.012] z-[1]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />

      {/* Warm light yellow sparkles on hover - Hero only */}
      {!isMobile && sparkles.map((s) => (
        <div
          key={s.id}
          className="hero-sparkle absolute z-[5]"
          style={{
            left: s.x - 14,
            top: s.y - 14,
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'radial-gradient(circle at center, hsl(210 100% 85% / 0.55) 0%, hsl(210 95% 75% / 0.3) 45%, hsl(213 90% 70% / 0.08) 75%, transparent 100%)',
            boxShadow: '0 0 12px hsl(210 100% 80% / 0.35)',
            filter: 'blur(1px)',
            WebkitFilter: 'blur(1px)',
          }}
          aria-hidden
        />
      ))}

      <ParallaxLayer speed={0.08} className="relative" style={{ zIndex: 10 }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full max-w-4xl">
        {/* Headline - PRD */}
        <div className="text-center mb-4 mx-auto max-w-2xl animate-[fadeUp_0.7s_cubic-bezier(0.16,1,0.3,1)_both" style={{ animationDelay: "0.1s" }}>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight" style={{ color: colors.foreground, marginLeft: '-223px', marginRight: '-223px' }}>
            An AI Marketing Team, Without Expanding Headcount.
          </h1>
        </div>
        <p className="text-center text-lg md:text-xl mb-8 max-w-2xl mx-auto animate-[fadeUp_0.7s_cubic-bezier(0.16,1,0.3,1)_both" style={{ color: colors.mutedForeground, animationDelay: "0.25s" }}>
        Create, launch, and optimise campaigns, all from one dashboard.
        </p>

        {/* CTAs - PRD */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4 animate-[fadeUp_0.7s_cubic-bezier(0.16,1,0.3,1)_both" style={{ animationDelay: "0.35s" }}>
          <Button
            variant="hero"
            size="lg"
            className="px-8 py-6 text-lg w-full sm:w-auto"
            asChild
            style={{ background: colors.gradientPrimary, color: colors.primaryForeground, boxShadow: colors.shadowGlow }}
          >
            <Link href="/auth/signup">Start Free</Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="px-8 py-6 text-lg w-full sm:w-auto"
            onClick={() => scrollToSection("system")}
            style={{ borderColor: colors.border, color: colors.foreground }}
          >
            See How It Works
          </Button>
        </div>
        <p className="text-center text-sm mb-12" style={{ color: colors.mutedForeground }}>
          Agency-level output. Software-level speed.
        </p>

        {/* Product Preview UI - interactive mock */}
        <div className={`hero-card p-6 sm:p-8 mb-8 transition-transform duration-800 ${phase === "idle" ? "animate-float-subtle" : ""} ${phase !== "idle" ? "hero-card-expanded" : ""}`} style={{ background: `linear-gradient(135deg, ${withAlpha(colors.card, 0.85)} 0%, ${withAlpha(colors.card, 0.92)} 100%)`, border: '1px solid rgba(97, 97, 97, 1)' }}>
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
              <div>
                <div className="text-xs font-medium mb-2.5 uppercase tracking-wider" style={{ color: colors.mutedForeground }}>Output type</div>
                <div className="flex flex-wrap gap-2">
                  {TABS.map((tab) => (
                    <button key={tab} type="button" onClick={() => handleTabClick(tab)} className={`hero-pill px-4 py-2.5 rounded-full text-sm font-medium ${pillBounce === tab ? "hero-pill-bounce" : ""}`} style={activeTab === tab ? { background: colors.primary, color: colors.primaryForeground, boxShadow: colors.shadowSoft } : { background: colors.muted, color: colors.mutedForeground }}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium mb-2.5 uppercase tracking-wider" style={{ color: colors.mutedForeground }}>Platforms</div>
                <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                  {PLATFORMS.map((p) => (
                    <button key={p.id} type="button" onClick={() => togglePlatform(p.id)} className={`hero-pill px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 flex items-center gap-2 ${pillBounce === p.id ? "hero-pill-bounce" : ""}`} style={platforms.has(p.id) ? { background: withAlpha(colors.primary, 0.12), color: colors.primary, border: `1.5px solid ${withAlpha(colors.primary, 0.4)}` } : { background: colors.muted, color: colors.mutedForeground, border: "1.5px solid transparent" }}>
                      {platforms.has(p.id) && <Check className="h-4 w-4" />}{p.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button variant="hero" size="lg" className="hero-btn-generate w-full h-12 rounded-[18px] text-base font-semibold" onClick={runGenerate} style={{ background: colors.gradientPrimary, color: colors.primaryForeground, boxShadow: colors.shadowGlow }}>
                <Sparkles className="h-5 w-5" /> Generate
              </Button>
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
