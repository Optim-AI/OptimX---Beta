'use client';

import React from 'react';
import { Layers, Clock, TrendingDown, LayoutGrid } from 'lucide-react';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '@/lib/ui/colors';

const PROBLEM_CARDS = [
  { icon: Layers, title: 'Creative Bottlenecks', text: 'Producing consistent, high-quality ads takes time and resources.' },
  { icon: Clock, title: 'Slow Campaign Launches', text: 'Coordination delays prevent fast experimentation.' },
  { icon: TrendingDown, title: 'Manual Optimization', text: 'Guesswork leads to wasted budget.' },
  { icon: LayoutGrid, title: 'Fragmented Tools', text: 'Switching between platforms creates inefficiency.' },
];

const Problem: React.FC = () => {
  const { elementRef: titleRef, isVisible: titleVisible } = useScrollAnimation();
  const { elementRef: cardsRef, isVisible: cardsVisible } = useScrollAnimation({ threshold: 0.1 });

  return (
    <section className="py-24 relative overflow-hidden section-solid">
      <div className="grain-overlay" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          ref={titleRef}
          className="text-center max-w-3xl mx-auto mb-6 transition-all duration-700"
          style={{ opacity: titleVisible ? 1 : 0, transform: titleVisible ? 'translateY(0)' : 'translateY(20px)', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-tight" style={{ color: colors.foreground }}>
            Modern Marketing Demands More Than Most Teams Can Handle.
          </h2>
          <p className="text-lg md:text-xl" style={{ color: colors.mutedForeground }}>
            Creative production, campaign execution, and optimization shouldn&apos;t require a full department.
          </p>
        </div>

        <div
          ref={cardsRef}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-12"
        >
          {PROBLEM_CARDS.map((card, index) => {
            const Icon = card.icon;
            return (
              <div
                key={index}
                className="group p-8 rounded-[20px] transition-all duration-500"
                style={{
                  opacity: cardsVisible ? 1 : 0,
                  transform: cardsVisible ? 'translateY(0)' : 'translateY(20px)',
                  transitionDelay: cardsVisible ? `${index * 100}ms` : '0ms',
                  transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                  background: 'hsl(0 0% 15% / 0.6)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.3), 0 0 0 1px hsl(213 100% 55% / 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = cardsVisible ? 'translateY(0)' : 'translateY(20px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                }}
              >
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'hsl(213 100% 55% / 0.1)' }}>
                    <Icon className="h-6 w-6" style={{ color: colors.primary }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2" style={{ color: colors.foreground }}>{card.title}</h3>
                    <p className="leading-relaxed" style={{ color: colors.mutedForeground }}>{card.text}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xl font-medium" style={{ color: colors.foreground }}>
          SkalX AI brings everything together — intelligently.
        </p>
      </div>
    </section>
  );
};

export default Problem;
