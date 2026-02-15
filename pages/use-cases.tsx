'use client';

import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '../app/web/src/components/ui/button';
import { User, Store, Users } from 'lucide-react';
import colors from '@/lib/ui/colors';

const Header = dynamic(() => import('../app/web/src/components/Header'), { ssr: false });
const Footer = dynamic(() => import('../app/web/src/components/Footer'), { ssr: false });

const USE_CASES = [
  {
    icon: User,
    title: 'Solo Founders',
    pain: 'No time or budget for a full marketing team.',
    solution: 'SkalX AI acts as your marketing department.',
    benefits: ['Run ads without hiring', 'Generate creatives on demand', 'Optimize spend automatically'],
  },
  {
    icon: Store,
    title: 'D2C Brands',
    pain: 'Scaling creatives and campaigns across channels is slow and costly.',
    solution: 'SkalX AI unifies creative production and campaign execution.',
    benefits: ['Multi-channel campaigns in minutes', 'Consistent brand voice', 'Real-time performance insights'],
  },
  {
    icon: Users,
    title: 'In-House Marketing Teams',
    pain: 'Manual workflows and fragmented tools slow down experimentation.',
    solution: 'SkalX AI automates execution so you focus on strategy.',
    benefits: ['Faster campaign launches', 'AI-driven optimization', 'Reduced dashboard overload'],
  },
];

export default function UseCasesPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.background }}>
      <Header />
      <main className="pt-28 pb-20">
        <section className="py-20 text-center">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl md:text-6xl font-bold mb-6" style={{ color: colors.foreground }}>
              Use Cases
            </h1>
            <p className="text-xl max-w-2xl mx-auto" style={{ color: colors.mutedForeground }}>
              See how SkalX AI helps different teams scale marketing smarter.
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4 max-w-4xl space-y-16">
            {USE_CASES.map((uc, i) => {
              const Icon = uc.icon;
              return (
                <div
                  key={i}
                  className="p-10 rounded-[20px]"
                  style={{
                    background: 'hsl(0 0% 15% / 0.5)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="flex items-start gap-6 mb-8">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'hsl(213 100% 55% / 0.12)' }}>
                      <Icon className="h-7 w-7" style={{ color: colors.primary }} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold mb-2" style={{ color: colors.foreground }}>{uc.title}</h2>
                      <p className="mb-2" style={{ color: colors.mutedForeground }}><strong>Pain:</strong> {uc.pain}</p>
                      <p className="mb-4" style={{ color: colors.foreground }}><strong>Solution:</strong> {uc.solution}</p>
                      <ul className="space-y-1">
                        {uc.benefits.map((b, j) => (
                          <li key={j} className="flex items-center gap-2" style={{ color: colors.mutedForeground }}>
                            <span style={{ color: 'hsl(142 76% 36%)' }}>✓</span> {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <Button variant="hero" size="lg" asChild style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                    <Link href="/auth/signup">Start Free</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
