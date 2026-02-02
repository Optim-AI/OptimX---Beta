"use client";

import React, { useRef, useEffect, useState } from "react";
import { Play, Search, BookOpen, Tag, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "../app/web/src/components/ui/button";
import colors from "../lib/colors";
import Link from 'next/link';
function withAlpha(token: string, alpha: number) {
  const hslMatch = token.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i);
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  }
  if (/rgba?\(|hsla?\(/i.test(token)) return token;
  return token;
}

const tutorialsData = [
  {
    id: "intro-1",
    title: "Getting Started: Create Your First Campaign",
    length: "6:34",
    excerpt: "Learn how to create a campaign from scratch — connect accounts, set objectives, and generate creatives.",
    tags: ["beginner", "campaigns"],
    href: "/docs/tutorials/getting-started",
  },
  {
    id: "ai-1",
    title: "AI Creative Best Practices",
    length: "8:12",
    excerpt: "Tips to get the best results from our AI image and caption generators — prompts, reference images, and styles.",
    tags: ["ai", "creative"],
    href: "/docs/tutorials/ai-best-practices",
  },
  {
    id: "ads-1",
    title: "Running Ads on Meta & Google",
    length: "10:05",
    excerpt: "End-to-end flow: budgets, targeting, creatives, and how to handle ad rejections.",
    tags: ["ads", "advanced"],
    href: "/docs/tutorials/running-ads",
  },
  {
    id: "analytics-1",
    title: "Reading Campaign Insights",
    length: "5:22",
    excerpt: "Understand metrics, attribution windows, and how to optimize based on performance signals.",
    tags: ["analytics", "optimization"],
    href: "/docs/tutorials/analytics",
  },
];

const Tutorials: React.FC = () => {
  const topRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    topRef.current?.scrollTo({ top: 0 });
  }, []);

  const tags = Array.from(new Set(tutorialsData.flatMap((t) => t.tags)));

  const filtered = tutorialsData.filter((t) => {
    const matchesQuery =
      query === "" ||
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.excerpt.toLowerCase().includes(query.toLowerCase());
    const matchesTag = !activeTag || t.tags.includes(activeTag);
    return matchesQuery && matchesTag;
  });

  return (
    <main
      ref={topRef}
      className="min-h-screen pb-24 pt-20 relative overflow-hidden"
      style={{ backgroundColor: colors.background, color: colors.foreground }}
    >
      <style jsx>{`
        .animation-float {
          animation: floatY 6s ease-in-out infinite alternate;
        }
        @keyframes floatY {
          from {
            transform: translateY(-8px);
          }
          to {
            transform: translateY(8px);
          }
        }
        .glass-card {
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
      `}</style>

      {/* background layers */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(135deg, ${colors.background} 0%, ${withAlpha(
            "hsl(213 90% 96%)",
            0.28
          )} 40%, ${colors.background} 100%)`,
        }}
      />
      <div className="absolute inset-0" style={{ background: colors.gradientMesh, opacity: 0.35 }} />
      <div className="absolute -left-10 top-16 w-72 h-72 rounded-full blur-3xl animation-float" style={{ backgroundColor: withAlpha(colors.primary, 0.28) }} />
      <div
        className="absolute right-10 bottom-20 w-96 h-96 rounded-full blur-3xl animation-float"
        style={{ backgroundColor: withAlpha(colors.primary, 0.18), animationDelay: "2s" }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <header className="flex items-center gap-3 py-6">
          {/* <div className="w-12 h-12 rounded-md flex items-center justify-center glass-card" style={{ background: colors.card, border: `1px solid ${colors.border}`, boxShadow: colors.shadowStrong }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <rect x="2" y="2" width="20" height="20" rx="6" fill={colors.primary} />
              <path d="M7 12h10" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 8h10" stroke={withAlpha("white", 0.85)} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div>
            <div className="text-2xl font-bold leading-tight flex items-baseline gap-1">
              <span style={{ color: colors.foreground }}>Optim</span>
              <span style={{ color: colors.primary, fontFamily: "inherit" }}>X</span>
            </div>
            <div className="text-sm text-[14px]" style={{ color: colors.mutedForeground }}>
              Tutorials
            </div>
          </div> */}

          <Link href="/" className="flex items-center space-x-1" style={{ color: colors.foreground }}>
                      <img src="/images/OptimX_Logo.svg" alt="OptimX Logo" className="h-10 w-auto" />
                      <span className="text-xl font-bold" style={{ lineHeight: 1 }}>
                        <span style={{ color: colors.foreground }}>Optim</span>
                        <span style={{ color: colors.primary }}>X</span>
                      </span>
                    </Link>
        </header>

        <section className="max-w-6xl mx-auto mt-6">
          <div className="p-8 rounded-2xl glass-card border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
            <div className="mb-6">
              <h1 className="text-4xl font-extrabold mb-2" style={{ color: colors.foreground }}>
                Tutorials & Guides
              </h1>
              <p className="text-lg" style={{ color: colors.mutedForeground }}>
                Step-by-step videos and written guides to help you get the most from OptimX.
              </p>
            </div>

            <div className="mb-6 flex flex-col md:flex-row gap-4 items-start">
              <div className="flex items-center gap-3 flex-1 p-3 rounded-lg border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                <Search className="h-5 w-5" style={{ color: colors.mutedForeground }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tutorials, e.g. 'ads' or 'AI'" className="w-full bg-transparent outline-none text-sm" style={{ color: colors.foreground }} />
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                <div className="text-sm text-[13px]" style={{ color: colors.mutedForeground }}>
                  Filter by tag:
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setActiveTag(null)}
                    className={`px-3 py-1 rounded-md text-sm ${activeTag ? "" : "font-semibold"}`}
                    style={{
                      background: activeTag ? "transparent" : colors.primary,
                      color: activeTag ? colors.foreground : colors.primaryForeground,
                      border: `1px solid ${withAlpha(colors.border, 0.6)}`,
                    }}
                  >
                    All
                  </button>

                  {tags.map((t) => (
                    <button
                      key={t}
                      onClick={() => setActiveTag(t)}
                      className={`px-3 py-1 rounded-md text-sm ${activeTag === t ? "font-semibold" : ""}`}
                      style={{
                        background: activeTag === t ? colors.primary : "transparent",
                        color: activeTag === t ? colors.primaryForeground : colors.mutedForeground,
                        border: `1px solid ${withAlpha(colors.border, 0.6)}`,
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((t) => (
                <article key={t.id} className="p-4 rounded-lg border flex flex-col justify-between" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 style={{ color: colors.foreground, fontWeight: 700 }}>{t.title}</h3>
                      <div className="text-sm" style={{ color: colors.mutedForeground }}>
                        {t.length}
                      </div>
                    </div>
                    <p style={{ color: colors.mutedForeground }}>{t.excerpt}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4" style={{ color: colors.primary }} />
                      <div className="text-sm" style={{ color: colors.mutedForeground }}>
                        {t.tags.join(" • ")}
                      </div>
                    </div>

                    <Button size="sm" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                      <a href={t.href} className="flex items-center gap-2">
                        Watch Guide <Play className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </article>
              ))}

              {filtered.length === 0 && (
                <div className="p-6 col-span-full text-center" style={{ color: colors.mutedForeground }}>
                  No tutorials found. Try clearing filters or search different keywords.
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-between items-center">
              <div className="flex items-center gap-3 text-sm" style={{ color: colors.mutedForeground }}>
                <Sparkles className="h-4 w-4" style={{ color: colors.primary }} />
                <span>OptimX — Learn &amp; Grow</span>
              </div>

              <div className="flex items-center gap-3">
                {/* <Button
                  size="sm"
                  variant="outline"
                  asChild
                >
                  <a
                    href="#top"
                    onClick={(e) => {
                      e.preventDefault();
                      topRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Back to top
                  </a>
                </Button> */}
                <Button size="sm" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                  <a href="/auth/signin" className="flex items-center gap-2">
                    Get Started <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Tutorials;
