'use client';

import React from 'react';
import Link from 'next/link';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '@/lib/ui/colors';
import { X, Check } from 'lucide-react';

const LEFT_ITEMS = ['High retainers', 'Slow onboarding', 'Manual workflows', 'Limited experimentation'];
const RIGHT_ITEMS = ['Predictable pricing', 'Instant setup', 'Automated execution', 'Continuous optimization'];

const ScaleWithoutHiring: React.FC = () => {
  const { elementRef, isVisible } = useScrollAnimation({ threshold: 0.1 });

  return (
    <section className="py-24 relative overflow-hidden section-solid">
      <div className="grain-overlay" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          ref={elementRef}
          className="text-center mb-16 transition-all duration-700"
          style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'translateY(0)' : 'translateY(20px)', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-tight" style={{ color: colors.foreground }}>
            Scale Marketing — Not Headcount.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
          <div
            className="p-8 rounded-[20px] transition-all duration-500"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
              transitionDelay: '0.15s',
              background: 'hsl(0 0% 15% / 0.4)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <h3 className="text-xl font-semibold mb-6" style={{ color: colors.mutedForeground }}>Hiring / Agencies</h3>
            <ul className="space-y-3">
              {LEFT_ITEMS.map((item, i) => (
                <li key={i} className="flex items-center gap-3" style={{ color: colors.mutedForeground }}>
                  <X className="h-5 w-5 flex-shrink-0" style={{ color: colors.destructive }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div
            className="p-8 rounded-[20px] transition-all duration-500"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
              transitionDelay: '0.25s',
              background: 'hsl(0 0% 18% / 0.6)',
              border: '1px solid hsl(213 100% 55% / 0.2)',
              boxShadow: '0 0 40px hsl(213 100% 55% / 0.08)',
            }}
          >
            <h3 className="text-xl font-semibold mb-6" style={{ color: colors.foreground }}>SkalX AI</h3>
            <ul className="space-y-3">
              {RIGHT_ITEMS.map((item, i) => (
                <li key={i} className="flex items-center gap-3" style={{ color: colors.foreground }}>
                  <Check className="h-5 w-5 flex-shrink-0" style={{ color: 'hsl(142 76% 36%)' }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="text-center">
          <Link href="/#pricing" className="text-lg font-medium" style={{ color: colors.primary }}>See Plans →</Link>
        </div>
      </div>
    </section>
  );
};

export default ScaleWithoutHiring;
