'use client';

import React from 'react';
import Link from 'next/link';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '@/lib/ui/colors';

/**
 * Concise homepage About — adapted from pages/About.tsx story/mission, not a founder bio.
 */
const AboutPreview: React.FC = () => {
  const { elementRef, isVisible } = useScrollAnimation({ threshold: 0.15 });

  return (
    <section id="about" className="py-24 relative overflow-hidden section-solid">
      <div className="grain-overlay" />

      <div
        ref={elementRef}
        className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 max-w-4xl"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <p
          className="text-sm uppercase tracking-[0.25em] mb-4 font-light text-center"
          style={{ color: colors.mutedForeground }}
        >
          About SkalX
        </p>
        <h2
          className="text-4xl md:text-[46px] font-normal leading-tight mb-6 text-center"
          style={{ color: colors.foreground }}
        >
          Marketing should be simple, not overwhelming.
        </h2>
        <p
          className="text-lg font-extralight leading-relaxed text-center mb-8"
          style={{ color: colors.mutedForeground }}
        >
          SkalX AI is an AI marketing partner for growing brands. It understands your brand,
          creates campaign-ready creatives, and helps you move from idea to launch without
          assembling a full creative team.
        </p>
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <div
            className="p-6 rounded-2xl"
            style={{
              background: 'hsl(0 0% 15% / 0.45)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <h3 className="text-lg font-medium mb-2" style={{ color: colors.foreground }}>
              The problem
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>
              Running ads, producing creatives, and staying on-brand is expensive and fragmented —
              especially for small and growing businesses.
            </p>
          </div>
          <div
            className="p-6 rounded-2xl"
            style={{
              background: 'hsl(0 0% 15% / 0.45)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <h3 className="text-lg font-medium mb-2" style={{ color: colors.foreground }}>
              The vision
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>
              Make modern marketing effortless and accessible — one AI platform that understands
              your brand and helps you create and grow.
            </p>
          </div>
        </div>
        <div className="text-center">
          <Link href="/About" className="text-sm font-medium" style={{ color: colors.primary }}>
            Read our story →
          </Link>
        </div>
      </div>
    </section>
  );
};

export default AboutPreview;
