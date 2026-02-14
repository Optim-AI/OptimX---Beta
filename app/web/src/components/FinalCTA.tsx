'use client';

import React from 'react';
import { Button } from './ui/button';
import Link from 'next/link';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '@/lib/ui/colors';

const FinalCTA: React.FC = () => {
  const { elementRef: ctaRef, isVisible: ctaVisible } = useScrollAnimation({ threshold: 0.2 });

  return (
    <section className="py-24 relative overflow-hidden section-solid">
      <div className="grain-overlay" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          ref={ctaRef}
          className="text-center max-w-4xl mx-auto transition-all duration-700"
          style={{ opacity: ctaVisible ? 1 : 0, transform: ctaVisible ? 'translateY(0)' : 'translateY(20px)', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight" style={{ color: colors.foreground }}>
            Ready to Scale Marketing Smarter?
          </h2>
          <p className="text-xl mb-10 max-w-2xl mx-auto" style={{ color: colors.mutedForeground }}>
            Launch, automate, and optimize campaigns — without expanding your team.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <Button variant="hero" size="lg" className="px-10 py-6 text-lg btn-premium" asChild style={{ background: colors.gradientPrimary, color: colors.primaryForeground, boxShadow: '0 0 32px hsl(213 100% 55% / 0.35)' }}>
              <Link href="/auth/signup">Start Free</Link>
            </Button>
          </div>
          <Link href="/Contact" className="text-sm" style={{ color: colors.mutedForeground }}>Talk to Sales</Link>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
