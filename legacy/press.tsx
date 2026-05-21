"use client";

import React, { useRef, useEffect } from "react";
import { FileText, Download, Image, Calendar, Globe, Mail, Sparkles } from "lucide-react";
import { Button } from "../app/web/src/components/ui/button";
import colors from '@/lib/ui/colors';
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

const pressReleases = [
  {
    id: "2025-11-14-launch",
    title: "SkalX AI launches AI-powered campaign automation (MVP)",
    date: "November 14, 2025",
    excerpt: "Public Beta with Google and Meta integrations, AI creative generation, and credit-based billing.",
    href: "/press/optimx-launch-2025",
  },
  {
    id: "2025-09-partnership",
    title: "SkalX AI announces partnership with Razorpay for payments",
    date: "September 3, 2025",
    excerpt: "Streamlined billing and credits via Razorpay — secure payments for Indian businesses.",
    href: "/press/razorpay-partnership",
  },
];

const Press: React.FC = () => {
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
              <span style={{ color: colors.foreground }}>SkalX AI</span>
            </div>
            <div className="text-sm text-[14px]" style={{ color: colors.mutedForeground }}>Press & Media</div>
          </div> */}

          <Link href="/" className="flex items-center space-x-1" style={{ color: colors.foreground }}>
                      <img src="/images/Oli_AI_Logo.svg" alt="SkalX AI Logo" className="h-10 w-auto" />
<span className="text-xl font-bold" style={{ lineHeight: 1 }}>
                      <span style={{ color: colors.foreground }}>SkalX AI</span>
                    </span>
                    </Link>
        </header>

        <section className="max-w-6xl mx-auto mt-6">
          <div className="p-8 rounded-2xl glass-card border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
            <div className="mb-6">
              <h1 className="text-4xl font-extrabold mb-2" style={{ color: colors.foreground }}>Press &amp; Media</h1>
              <p className="text-lg" style={{ color: colors.mutedForeground }}>Press releases, media kit, high-res logos, and press contact information.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="lg:col-span-2">
                <h3 style={{ color: colors.foreground, fontWeight: 700 }}>Latest Releases</h3>
                <div className="mt-4 space-y-4">
                  {pressReleases.map((r) => (
                    <article key={r.id} className="p-4 rounded-lg border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div style={{ color: colors.mutedForeground, fontSize: 13 }}>{r.date}</div>
                          <a href={r.href} style={{ color: colors.foreground, fontWeight: 700, fontSize: 18 }}>{r.title}</a>
                          <p style={{ color: colors.mutedForeground, marginTop: 6 }}>{r.excerpt}</p>
                        </div>

                        <div className="flex flex-col gap-2 items-end">
                          <Button size="sm" variant="outline" asChild>
                            <a href={r.href}>Read</a>
                          </Button>
                          <Button size="sm" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                            <a href={`${r.href}#download`} className="flex items-center gap-2"><Download className="h-4 w-4" /> Download</a>
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <aside className="p-4 rounded-lg border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                <div className="flex items-start gap-3">
                  <FileText className="h-6 w-6" style={{ color: colors.primary }} />
                  <div>
                    <div style={{ color: colors.foreground, fontWeight: 700 }}>Media Kit</div>
                    <div style={{ color: colors.mutedForeground, fontSize: 13 }}>High-resolution logos, brand guidelines, and product screenshots.</div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <a href="/downloads/optimx-press-kit.zip"><Download className="h-4 w-4" /> Press Kit</a>
                      </Button>
                      <Button size="sm" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                        <a href="/assets/logo-optimx.png" className="flex items-center gap-2"><Image className="h-4 w-4" /> Logo (PNG)</a>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <div style={{ color: colors.foreground, fontWeight: 700 }}>Press Contact</div>
                  <div style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 6 }}>
                    For press inquiries, interviews, or media assets, email: <strong>press@optimx.app</strong>
                    <br />Alternatively: info@skalxai.app
                  </div>
                </div>

                <div className="mt-6">
                  <div style={{ color: colors.foreground, fontWeight: 700 }}>Company</div>
                  <div style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 6 }}>
                    SkalX AI
                    <br />Thiruvanmiyur, Chennai, India
                  </div>
                </div>
              </aside>
            </div>

            <div className="mb-8">
              <h4 style={{ color: colors.foreground, fontWeight: 700 }}>Brand Assets</h4>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {["logo-optimx.png", "logo-optimx-white.png", "screenshot-1.png", "screenshot-2.png"].map((fn) => (
                  <div key={fn} className="p-3 rounded-lg border flex flex-col items-center" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                    <div className="w-28 h-28 rounded-md flex items-center justify-center" style={{ background: withAlpha(colors.primary, 0.06) }}>
                      <img src={`/assets/${fn}`} alt={fn} className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="mt-3 text-sm" style={{ color: colors.mutedForeground }}>{fn}</div>
                    <div className="mt-2 flex gap-2">
                      <Button size="lg" variant="outline" asChild>
                        <a href={`/assets/${fn}`}>View</a>
                      </Button>
                      <Button size="lg" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                        <a href={`/assets/${fn}`} className="flex items-center gap-1"><Download className="h-3 w-3" /> Download</a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-between items-center">
              <div className="flex items-center gap-3 text-sm" style={{ color: colors.mutedForeground }}>
                <Sparkles className="h-4 w-4" style={{ color: colors.primary }} />
                <span>SkalX AI — Press & Media</span>
              </div>

              <div className="flex items-center gap-3">
                {/* <Button size="sm" variant="outline" asChild>
                  <a href="#top" onClick={(e) => { e.preventDefault(); topRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}>Back to top</a>
                </Button> */}
                <Button size="sm" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                  <a href="/auth/signin" className="flex items-center gap-2">Login <Globe className="h-4 w-4" /></a>
                </Button>
              </div>
            </div>

          </div>
        </section>
      </div>
    </main>
  );
};

export default Press;
