'use client';

import React from 'react';
import { Image, Video, RefreshCw, Calendar, Layers } from 'lucide-react';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '@/lib/ui/colors';

const CREDIT_ITEMS = [
  { icon: Image, text: 'Image credits → Used per poster generation' },
  { icon: Video, text: 'Video credits → Used per second generated' },
  { icon: RefreshCw, text: 'Subscription credits reset monthly' },
  { icon: Calendar, text: 'Purchased credits never expire' },
  { icon: Layers, text: 'Subscription credits are used first' },
];

const HowCreditsWork: React.FC = () => {
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
          <h2 className="text-4xl md:text-5xl font-bold leading-tight" style={{ color: colors.foreground }}>
            How Credits Work
          </h2>
        </div>

        <div className="max-w-2xl mx-auto space-y-4">
          {CREDIT_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="flex items-center gap-4 p-6 rounded-[18px] transition-all duration-500"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                  transitionDelay: isVisible ? `${index * 80}ms` : '0ms',
                  background: 'hsl(0 0% 15% / 0.5)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'hsl(213 100% 55% / 0.12)' }}>
                  <Icon className="h-5 w-5" style={{ color: colors.primary }} />
                </div>
                <span className="text-base md:text-lg" style={{ color: colors.foreground }}>{item.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowCreditsWork;
