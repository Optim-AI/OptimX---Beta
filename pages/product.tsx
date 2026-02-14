'use client';

import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '../app/web/src/components/ui/button';
import { Palette, Zap, BarChart3, Brain } from 'lucide-react';
import colors from '@/lib/ui/colors';

const Header = dynamic(() => import('../app/web/src/components/Header'), { ssr: false });
const Footer = dynamic(() => import('../app/web/src/components/Footer'), { ssr: false });

const SECTIONS = [
  { icon: Palette, title: 'Creative Generation', desc: 'Generate high-converting posters and video ads from your product or website. AI-powered design that scales.' },
  { icon: Zap, title: 'Campaign Automation', desc: 'Launch across Meta, Google, and LinkedIn in minutes. One dashboard. Multiple channels.' },
  { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Clear, actionable reporting. See what\'s working and optimize in real time.' },
  { icon: Brain, title: 'Brand Intelligence', desc: 'Lock in your brand voice. AI keeps messaging consistent across all touchpoints.' },
];

export default function ProductPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.background }}>
      <Header />
      <main className="pt-28 pb-20">
        <section className="py-20 text-center">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl md:text-6xl font-bold mb-6" style={{ color: colors.foreground }}>
              All-in-One AI Marketing Platform
            </h1>
            <p className="text-xl max-w-2xl mx-auto mb-10" style={{ color: colors.mutedForeground }}>
              Creative generation, campaign automation, analytics, and brand intelligence — unified.
            </p>
            <Button variant="hero" size="lg" asChild style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
              <Link href="/auth/signup">Start Free</Link>
            </Button>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid md:grid-cols-2 gap-12">
              {SECTIONS.map((sec, i) => {
                const Icon = sec.icon;
                return (
                  <div
                    key={i}
                    className="p-8 rounded-[20px]"
                    style={{
                      background: 'hsl(0 0% 15% / 0.5)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ backgroundColor: 'hsl(213 100% 55% / 0.12)' }}>
                      <Icon className="h-6 w-6" style={{ color: colors.primary }} />
                    </div>
                    <h2 className="text-2xl font-semibold mb-3" style={{ color: colors.foreground }}>{sec.title}</h2>
                    <p className="leading-relaxed" style={{ color: colors.mutedForeground }}>{sec.desc}</p>
                    <div className="mt-4 h-48 rounded-xl flex items-center justify-center" style={{ background: 'hsl(0 0% 20% / 0.5)' }}>
                      <span className="text-sm" style={{ color: colors.mutedForeground }}>Screenshot placeholder</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
