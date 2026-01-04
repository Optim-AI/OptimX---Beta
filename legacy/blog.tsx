"use client";

import React, { useRef, useEffect, useState } from "react";
import { Mail, Sparkles, ArrowRight } from "lucide-react";
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

const Blog: React.FC = () => {
  const topRef = useRef<HTMLElement | null>(null);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    topRef.current?.scrollTo({ top: 0 });
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    // placeholder: store to localStorage for now
    try {
      localStorage.setItem("optimx_blog_subscribed", email);
      setSubscribed(true);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <main ref={topRef} className="min-h-screen pb-24 pt-20 relative overflow-hidden" style={{ backgroundColor: colors.background, color: colors.foreground }}>
      <style jsx>{`
        .animation-float { animation: floatY 6s ease-in-out infinite alternate; }
        @keyframes floatY { from { transform: translateY(-8px);} to { transform: translateY(8px);} }
        .glass-card { backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
      `}</style>

      {/* Background layers + orbs (matching Hero) */}
      <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(135deg, ${colors.background} 0%, ${withAlpha("hsl(213 90% 96%)", 0.28)} 40%, ${colors.background} 100%)` }} />
      <div className="absolute inset-0" style={{ background: colors.gradientMesh, opacity: 0.35 }} />
      <div className="absolute -left-10 top-16 w-72 h-72 rounded-full blur-3xl animation-float" style={{ backgroundColor: withAlpha(colors.primary, 0.28) }} />
      <div className="absolute right-10 bottom-20 w-96 h-96 rounded-full blur-3xl animation-float" style={{ backgroundColor: withAlpha(colors.primary, 0.18), animationDelay: "2s" }} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <header className="flex items-center gap-3 py-6">
          <Link href="/" className="flex items-center space-x-1" style={{ color: colors.foreground }}>
            <img src="/images/OptimX_Logo.svg" alt="OptimX Logo" className="h-10 w-auto" />
            <span className="text-xl font-bold" style={{ lineHeight: 1 }}>
              <span style={{ color: colors.foreground }}>Optim</span>
              <span style={{ color: colors.primary }}>X</span>
            </span>
          </Link>
        </header>

        <section className="max-w-4xl mx-auto mt-6">
          <div className="p-10 rounded-2xl glass-card border text-center" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
            <h1 className="text-4xl font-extrabold mb-4" style={{ color: colors.foreground }}>Blog — coming soon</h1>
            <p className="mb-6" style={{ color: colors.mutedForeground }}>We’re preparing a collection of guides, case studies, and product updates. Sign up to be notified when new posts are published.</p>

            <form onSubmit={handleSubscribe} className="max-w-xl mx-auto flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 w-full p-3 rounded-lg border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.background }}>
                <label htmlFor="email" className="sr-only">Email</label>
                <input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent outline-none text-sm" style={{ color: colors.foreground }} />
              </div>

              <Button type="submit" size="lg" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                {subscribed ? 'Subscribed' : 'Notify me'}
              </Button>
            </form>

            <div className="mt-6 text-sm" style={{ color: colors.mutedForeground }}>
              <Sparkles className="inline-block mr-2" style={{ color: colors.primary }} />
              <span>OptimX — Insights, tutorials, and product news coming soon.</span>
            </div>

            <div className="mt-8">
              {/* <Button size="sm" variant="outline" asChild>
                <a href="#top" onClick={(e) => { e.preventDefault(); topRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}>Back to top</a>
              </Button> */}
              <Button size="sm" style={{ marginLeft: 8, background: colors.gradientPrimary, color: colors.primaryForeground }}>
                <a href="/auth/signin" className="flex items-center gap-2">Start Free Trial <ArrowRight className="h-4 w-4" /></a>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Blog;
