"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  Search,
  Sparkles,
  MessageCircle,
  BookOpen,
  HelpCircle,
  LifeBuoy,
  ArrowRight,
  Mail,
  Zap,
} from "lucide-react";
import Link from 'next/link';
import { Button } from "../app/web/src/components/ui/button";
import colors from '@/lib/ui/colors';
import PageSeo from "@/components/seo/PageSeo";

function withAlpha(token: string, alpha: number) {
  const hslMatch = token.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i);
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  }
  if (/rgba?\(|hsla?\(/i.test(token)) return token;
  return token;
}

const HelpCenter: React.FC = () => {
  const topRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    topRef.current?.scrollTo({ top: 0 });
  }, []);

  const faqs = [
    {
      q: "How do I connect my Meta or Google account?",
      a: "Go to Integrations → Connect and follow the OAuth flow. Make sure to grant publishing and insights permissions for ad management and analytics.",
    },
    {
      q: "How do credits work?",
      a: "Credits are consumed when you generate AI images/captions or run certain campaign actions. Check Billing → Credits for details and usage logs.",
    },
    {
      q: "Can I schedule posts?",
      a: "Yes — when you create a post, pick a scheduled time before publishing. Scheduling uses your connected Page/Account tokens.",
    },
    {
      q: "What if my ad is rejected by Meta/Google?",
      a: "Ad rejections are due to platform policies. We show the rejection reason in Ads → Diagnostics. You can edit and resubmit from the same panel.",
    },
    {
      q: "How do I request a refund?",
      a: "Email info@skalxai.app with your registered email, payment ID, and reason. Refunds for unused credits must be requested within 7 days of purchase.",
    },
  ];

  /** Point only at existing public pages — no invented /docs routes. */
  const guides = [
    { title: "Try SkalX with your brand", href: "/try", description: "Start the Try Now experience" },
    { title: "Product overview", href: "/#product", description: "AI ads, posters, and video creatives" },
    { title: "How SkalX works", href: "/#how-it-works", description: "From brand understanding to creatives" },
    { title: "Frequently asked questions", href: "/#faq", description: "Common product questions" },
    { title: "AI use disclosure", href: "/ai-disclosure", description: "How we use AI responsibly" },
    { title: "Data handling & security", href: "/data-handling-security", description: "Security practices overview" },
  ];

  const filteredFaqs = faqs.filter((f) => f.q.toLowerCase().includes(query.toLowerCase()) || f.a.toLowerCase().includes(query.toLowerCase()));

  return (
    <main
      ref={topRef}
      className="min-h-screen pb-24 pt-20 relative overflow-hidden"
      style={{ backgroundColor: colors.background, color: colors.foreground }}
    >
      <PageSeo
        title="Help Center"
        description="SkalX AI Help Center — answers about credits, integrations, campaigns, and getting support for the AI marketing platform."
        path="/help-center"
      />
      <style jsx>{`
        .animation-float { animation: floatY 6s ease-in-out infinite alternate; }
        @keyframes floatY { from { transform: translateY(-8px);} to { transform: translateY(8px);} }
        .glass-card { backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
      `}</style>

      {/* Background layers + orbs */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(135deg, ${colors.background} 0%, ${withAlpha("hsl(213 90% 96%)", 0.28)} 40%, ${colors.background} 100%)`,
        }}
      />
      <div className="absolute inset-0" style={{ background: colors.gradientMesh, opacity: 0.35 }} />

      <div
        className="absolute -left-10 top-16 w-72 h-72 rounded-full blur-3xl animation-float"
        style={{ backgroundColor: withAlpha(colors.primary, 0.28) }}
      />
      <div
        className="absolute right-10 bottom-20 w-96 h-96 rounded-full blur-3xl animation-float"
        style={{ backgroundColor: withAlpha(colors.primary, 0.18), animationDelay: "2s" }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <header className="flex items-center gap-3 py-6">
          {/* <div
            className="w-12 h-12 rounded-md flex items-center justify-center glass-card"
            style={{ background: colors.card, border: `1px solid ${colors.border}`, boxShadow: colors.shadowStrong }}
          >
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
            <div className="text-sm text-[14px]" style={{ color: colors.mutedForeground }}>Help Center</div>
          </div> */}

          <Link href="/" className="flex items-center space-x-1" style={{ color: colors.foreground }}>
                      <img src="/images/SkalX_Logo.png" alt="SkalX AI Logo" className="h-10 w-auto object-contain" />
                      <span className="text-xl font-bold" style={{ lineHeight: 1 }}>
<span style={{ color: colors.foreground }}>SkalX AI</span>
                      </span>
                    </Link>
        </header>

        <section className="max-w-6xl mx-auto mt-6">
          <div className="p-8 rounded-2xl glass-card border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
            <div className="mb-6">
              <h1 className="text-4xl font-extrabold mb-2" style={{ color: colors.foreground }}>Help Center</h1>
              <p className="text-lg" style={{ color: colors.mutedForeground }}>Find guides, FAQs, and support to get the most out of SkalX AI.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {/* Search */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center gap-3 flex-1 p-3 rounded-lg border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                    <Search className="h-5 w-5" style={{ color: colors.mutedForeground }} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search help articles, FAQs, guides..."
                      className="w-full bg-transparent outline-none text-sm"
                      style={{ color: colors.foreground }}
                    />
                    <Button size="sm" variant="outline" asChild>
                      <a href="#">Search</a>
                    </Button>
                  </div>
                </div>

                {/* FAQs */}
                <div className="mb-8">
                  <h3 style={{ color: colors.foreground }}>Frequently Asked Questions</h3>
                  <div className="mt-4 space-y-4">
                    {filteredFaqs.map((f, i) => (
                      <details key={i} className="p-4 rounded-lg border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                        <summary style={{ cursor: "pointer", color: colors.foreground, fontWeight: 700 }}>{f.q}</summary>
                        <div className="mt-2" style={{ color: colors.mutedForeground }}>{f.a}</div>
                      </details>
                    ))}

                    {filteredFaqs.length === 0 && <div style={{ color: colors.mutedForeground }}>No results — try different keywords or browse guides below.</div>}
                  </div>
                </div>

                {/* Guides — existing public destinations only */}
                <div className="mb-8">
                  <h3 style={{ color: colors.foreground }}>Guides &amp; resources</h3>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {guides.map((g, i) => (
                      <Link key={i} href={g.href} className="p-4 rounded-lg border flex items-start gap-3" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                        <BookOpen className="h-5 w-5" style={{ color: colors.primary }} />
                        <div>
                          <div style={{ color: colors.foreground, fontWeight: 700 }}>{g.title}</div>
                          <div style={{ color: colors.mutedForeground, fontSize: 13 }}>{g.description}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Support channels */}
                <div>
                  <h3 style={{ color: colors.foreground }}>Support Channels</h3>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <a href="mailto:info@skalxai.app" className="p-4 rounded-lg border flex items-center gap-3" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                      <Mail className="h-5 w-5" style={{ color: colors.primary }} />
                      <div>
                        <div style={{ color: colors.foreground, fontWeight: 700 }}>Email Support</div>
                        <div style={{ color: colors.mutedForeground, fontSize: 13 }}>info@skalxai.app</div>
                      </div>
                    </a>

                    <Link href="/community" className="p-4 rounded-lg border flex items-center gap-3" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                      <MessageCircle className="h-5 w-5" style={{ color: colors.primary }} />
                      <div>
                        <div style={{ color: colors.foreground, fontWeight: 700 }}>Community</div>
                        <div style={{ color: colors.mutedForeground, fontSize: 13 }}>Social channels & updates</div>
                      </div>
                    </Link>

                    <Link href="/Contact" className="p-4 rounded-lg border flex items-center gap-3" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                      <LifeBuoy className="h-5 w-5" style={{ color: colors.primary }} />
                      <div>
                        <div style={{ color: colors.foreground, fontWeight: 700 }}>Contact</div>
                        <div style={{ color: colors.mutedForeground, fontSize: 13 }}>Send a message to the team</div>
                      </div>
                    </Link>

                    <Link href="/#faq" className="p-4 rounded-lg border flex items-center gap-3" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                      <HelpCircle className="h-5 w-5" style={{ color: colors.primary }} />
                      <div>
                        <div style={{ color: colors.foreground, fontWeight: 700 }}>Product FAQ</div>
                        <div style={{ color: colors.mutedForeground, fontSize: 13 }}>Answers on the homepage</div>
                      </div>
                    </Link>

                  </div>
                </div>

              </div>

              <aside className="p-6 rounded-lg border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                <div className="mb-4">
                  <div className="flex items-center gap-3">
                    <Zap className="h-6 w-6" style={{ color: colors.primary }} />
                    <div>
                      <div style={{ color: colors.foreground, fontWeight: 700 }}>Need immediate help?</div>
                      <div style={{ color: colors.mutedForeground, fontSize: 13 }}>Email us or use the contact form</div>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <h4 style={{ color: colors.foreground, fontWeight: 700 }}>Quick links</h4>
                  <ul className="mt-3 space-y-2 text-sm" style={{ color: colors.mutedForeground }}>
                    <li><Link href="/Contact">Contact</Link></li>
                    <li><Link href="/#faq">Product FAQ</Link></li>
                    <li><Link href="/try">Try Now</Link></li>
                    <li><Link href="/community">Community</Link></li>
                    <li><Link href="/ai-disclosure">AI Disclosure</Link></li>
                  </ul>
                </div>

                <div className="mt-6">
                  <h4 style={{ color: colors.foreground, fontWeight: 700 }}>Contact</h4>
                  <div className="text-sm" style={{ color: colors.mutedForeground }}>
                    Email: <strong>info@skalxai.app</strong>
                  </div>
                </div>

                <div className="mt-6">
                  <Button size="sm" variant="outline" asChild>
                    <a href="#top" onClick={(e) => { e.preventDefault(); topRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}>Back to top</a>
                  </Button>
                </div>

              </aside>
            </div>

            <div className="mt-8 flex justify-between items-center">
              <div className="flex items-center gap-3 text-sm" style={{ color: colors.mutedForeground }}>
                <Sparkles className="h-4 w-4" style={{ color: colors.primary }} />
                <span>SkalX AI — Support &amp; Docs</span>
              </div>

              <div className="flex items-center gap-3">
                <Button size="sm" asChild style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                  <Link href="/auth/signin" className="flex items-center gap-2">Sign in <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>
            </div>

          </div>
        </section>
      </div>
    </main>
  );
};

export default HelpCenter;
