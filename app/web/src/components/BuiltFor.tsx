'use client';

import React from 'react';
import Link from 'next/link';
import { User, Store, Users } from 'lucide-react';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '@/lib/ui/colors';

const BUILT_FOR_CARDS = [
  { icon: User, title: 'Solo Founders', desc: 'Run and Optimise ads without hiring a full team.' },
  { icon: Store, title: 'D2C Brands', desc: 'Scale creatives and campaigns efficiently across channels.' },
  { icon: Users, title: 'In-House Marketing Teams', desc: 'Move faster with automation and AI-driven insights.' },
];

const BuiltFor: React.FC = () => {
  const { elementRef: titleRef, isVisible: titleVisible } = useScrollAnimation();
  const { elementRef: cardsRef, isVisible: cardsVisible } = useScrollAnimation({ threshold: 0.1 });

  return (
    <section className="py-24 relative overflow-hidden section-solid">
      <div className="grain-overlay" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          ref={titleRef}
          className="text-center mb-16 transition-all duration-700"
          style={{ opacity: titleVisible ? 1 : 0, transform: titleVisible ? 'translateY(0)' : 'translateY(20px)', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <h2 className="text-4xl md:text-[46px] font-normal leading-tight" style={{ color: colors.foreground }}>
            Built for Growing Brands
          </h2>
        </div>

        <div ref={cardsRef} className="max-w-5xl mx-auto mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BUILT_FOR_CARDS.map((card, index) => {
              const Icon = card.icon;
              return (
                <div
                  key={index}
                  className="p-8 rounded-[20px] transition-all duration-500 h-full"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = cardsVisible ? 'translateY(0)' : 'translateY(20px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  }}
                  style={{
                    opacity: cardsVisible ? 1 : 0,
                    transform: cardsVisible ? 'translateY(0)' : 'translateY(20px)',
                    transitionDelay: cardsVisible ? `${index * 100}ms` : '0ms',
                    background: 'hsl(0 0% 15% / 0.5)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ backgroundColor: 'hsl(213 100% 55% / 0.12)' }}>
                    <Icon className="h-6 w-6" style={{ color: colors.primary }} />
                  </div>
                  <h3 className="text-xl font-semibold mb-3" style={{ color: colors.foreground }}>{card.title}</h3>
                  <p className="leading-relaxed" style={{ color: colors.mutedForeground }}>{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-center">
          <Link href="/auth/signup" className="text-lg font-medium" style={{ color: colors.primary }}>Explore Product →</Link>
        </div>
      </div>
    </section>
  );
};

export default BuiltFor;
