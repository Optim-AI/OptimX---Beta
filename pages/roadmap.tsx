"use client";

import React, { useRef, useEffect } from "react";
import { Calendar, Rocket, Zap, Clock, CheckCircle2, MessageSquare, ArrowRight, Sparkles } from "lucide-react";
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

const roadmapItems = [
  { id: "r1", title: "AI video generation", desc: "Generate short product videos from prompts and images.", eta: "Q4 2025", status: "Beta", icon: Rocket },
  { id: "r2", title: "Multi-account ad manager", desc: "Manage multiple Meta/Google accounts from a single UI.", eta: "Q4 2025", status: "In Progress", icon: Zap },
  { id: "r3", title: "Team seats & RBAC", desc: "Invite teammates, granular roles, and audit logs.", eta: "Q3 2026", status: "In progress", icon: CheckCircle2 },
  { id: "r4", title: "Advanced analytics & attribution", desc: "Attribution windows, cohort analysis, and A/B testing.", eta: "Q2 2026", status: "Planned", icon: Calendar },
  { id: "r5", title: "One-click ad rescue", desc: "Auto-suggest edits for rejected ads and resubmit.", eta: "Q1 2026", status: "In progress", icon: MessageSquare },
];

const Roadmap: React.FC = () => {
  const topRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    topRef.current?.scrollTo({ top: 0 });
  }, []);

  return (
    <main ref={topRef} className="min-h-screen pb-24 pt-20 relative overflow-hidden" style={{ backgroundColor: colors.background, color: colors.foreground }}>
      <style jsx>{`
        .animation-float { animation: floatY 6s ease-in-out infinite alternate; }
        @keyframes floatY { from { transform: translateY(-8px);} to { transform: translateY(8px);} }
        .glass-card { backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
      `}</style>

      {/* Background layers + orbs */}
      <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(135deg, ${colors.background} 0%, ${withAlpha("hsl(213 90% 96%)", 0.28)} 40%, ${colors.background} 100%)` }} />
      <div className="absolute inset-0" style={{ background: colors.gradientMesh, opacity: 0.35 }} />
      <div className="absolute -left-10 top-16 w-72 h-72 rounded-full blur-3xl animation-float" style={{ backgroundColor: withAlpha(colors.primary, 0.28) }} />
      <div className="absolute right-10 bottom-20 w-96 h-96 rounded-full blur-3xl animation-float" style={{ backgroundColor: withAlpha(colors.primary, 0.18), animationDelay: "2s" }} />

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
            <div className="text-sm text-[14px]" style={{ color: colors.mutedForeground }}>Roadmap</div>
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
              <h1 className="text-4xl font-extrabold mb-2" style={{ color: colors.foreground }}>Product Roadmap</h1>
              <p className="text-lg" style={{ color: colors.mutedForeground }}>What we're building next — timelines are estimates and subject to change. We appreciate feedback; submit ideas below.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {roadmapItems.map((r) => {
                  const Icon = r.icon as any;
                  return (
                    <div key={r.id} className="p-4 rounded-lg border flex items-start gap-4" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                      <div className="w-12 h-12 rounded-md flex items-center justify-center" style={{ background: withAlpha(colors.primary, 0.06) }}>
                        <Icon className="h-6 w-6" style={{ color: colors.primary }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-4">
                          <div style={{ color: colors.foreground, fontWeight: 700 }}>{r.title}</div>
                          <div className="text-sm" style={{ color: colors.mutedForeground }}>{r.eta}</div>
                        </div>
                        <div style={{ color: colors.mutedForeground, marginTop: 6 }}>{r.desc}</div>
                        <div className="mt-3">
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm`} style={{ background: r.status === 'In Progress' ? withAlpha(colors.primary, 0.12) : 'transparent', border: `1px solid ${withAlpha(colors.border, 0.06)}`, color: colors.mutedForeground }}>
                            <Clock className="h-4 w-4" /> {r.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <aside className="p-4 rounded-lg border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                <h3 style={{ color: colors.foreground, fontWeight: 700 }}>How we prioritize</h3>
                <p style={{ color: colors.mutedForeground, marginTop: 6 }}>We balance user impact, engineering effort, and compliance requirements. High-impact features with low effort get fast-tracked.</p>

                <div className="mt-6">
                  <h4 style={{ color: colors.foreground, fontWeight: 700 }}>Suggest a feature</h4>
                  <p style={{ color: colors.mutedForeground }}>Have an idea? Tell us — our product team reviews all submissions.</p>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href="/community">Discuss on community</a>
                    </Button>
                    <Button size="sm" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                      <a href="mailto:info@optimx.app" className="flex items-center gap-2">Email Product <ArrowRight className="h-4 w-4" /></a>
                    </Button>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 style={{ color: colors.foreground, fontWeight: 700 }}>Release cadence</h4>
                  <p style={{ color: colors.mutedForeground }}>We ship monthly improvements and quarterly major releases. Beta features may be limited to selected accounts.</p>
                </div>

                <div className="mt-6">
                  <h4 style={{ color: colors.foreground, fontWeight: 700 }}>Contact</h4>
                  <div style={{ color: colors.mutedForeground, marginTop: 6 }}>Email: <strong>info@optimx.app</strong></div>
                </div>
              </aside>

            </div>

            <div className="mt-8 flex justify-between items-center">
              <div className="flex items-center gap-3 text-sm" style={{ color: colors.mutedForeground }}>
                <Sparkles className="h-4 w-4" style={{ color: colors.primary }} />
                <span>OptimX — Roadmap</span>
              </div>

              <div className="flex items-center gap-3">
                {/* <Button size="sm" variant="outline" asChild>
                  <a href="#top" onClick={(e) => { e.preventDefault(); topRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}>Back to top</a>
                </Button> */}
                <Button size="sm" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                  <a href="/auth/signin" className="flex items-center gap-2">Try Features <Rocket className="h-4 w-4" /></a>
                </Button>
              </div>
            </div>

          </div>
        </section>
      </div>
    </main>
  );
};

export default Roadmap;
