'use client';

import React from 'react';
import { AlertTriangle, Clock, DollarSign, Users, BarChart3 } from 'lucide-react';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '../../../../lib/colors';

const Problem: React.FC = () => {
  const { elementRef: titleRef, isVisible: titleVisible } = useScrollAnimation();
  const { elementRef: cardsRef, isVisible: cardsVisible } = useScrollAnimation({ threshold: 0.1 });

  const painPoints = [
    {
      icon: BarChart3,
      text: 'Too many channels, too many dashboards'
    },
    {
      icon: DollarSign,
      text: 'High agency fees, unclear ROI'
    },
    {
      icon: Clock,
      text: 'No time to manage ads while running your business'
    },
    {
      icon: Users,
      text: 'Hard to rank on Google and reach customers organically'
    },
    {
      icon: AlertTriangle,
      text: 'No easy way to track reviews, mentions, and customer feedback'
    }
  ];

  return (
    <section
      className="py-24 relative overflow-hidden"
      // color-only changes: replace bg-gradient-to-b from/background via-muted/20 to/background
      style={{
        background: `linear-gradient(180deg, ${colors.background} 0%, "hsl(220 13% 95% / 0.2)" 50%, ${colors.background} 100%)`,
      }}
    >
      {/* Decorative background orbs */}
      <div
        className="absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl animate-float"
        style={{ backgroundColor: "hsl(213 100% 50% / 0.1)" }}
      />
      <div
        className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl animation-delay-2000 animation-float"
        style={{ backgroundColor: "hsl(213 100% 62% / 0.05)" }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          ref={titleRef}
          className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-1000 ${
            titleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <h2
            className="text-4xl md:text-5xl font-bold mb-6 leading-tight"
            style={{ color: colors.foreground }}
          >
            Marketing shouldn't be{' '}
            <span
              className="gradient-text"
              style={{
                backgroundImage: colors.gradientHero,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              this complicated.
            </span>
          </h2>
        </div>

        <div
          ref={cardsRef}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto"
        >
          {painPoints.map((point, index) => {
            const Icon = point.icon;

            return (
              <div
                key={index}
                className={`p-8 rounded-2xl transition-all duration-700 group ${cardsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                style={{
                  transitionDelay: cardsVisible ? `${index * 100}ms` : '0ms',
                  background: colors.glassBg, // glass-card look using token
                  border: `1px solid "hsl(213 100% 50% / 0.1)"`,
                  boxShadow: colors.shadowSoft,
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = colors.primary;
                  el.style.boxShadow = colors.shadowGlow;
                  const iconWrap = el.querySelector('.icon-bg') as HTMLElement | null;
                  if (iconWrap) iconWrap.style.backgroundColor = "hsl(213 100% 50% / 0.2)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "hsl(213 100% 50% / 0.1)";
                  el.style.boxShadow = colors.shadowSoft;
                  const iconWrap = el.querySelector('.icon-bg') as HTMLElement | null;
                  if (iconWrap) iconWrap.style.backgroundColor = "hsl(213 100% 50% / 0.1)";
                }}
              >
                <div className="flex items-start gap-5">
                  <div className="flex-shrink-0">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300 icon-bg"
                      style={{
                        backgroundColor: "hsl(213 100% 50% / 0.1)",
                        borderRadius: 12,
                      }}
                    >
                      <Icon className="h-6 w-6" style={{ color: colors.primary }} />
                    </div>
                  </div>
                  <p className="text-left font-medium leading-relaxed text-lg" style={{ color: colors.foreground }}>
                    {point.text}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Empty placeholder to maintain symmetry */}
          <div className="hidden md:block" />
        </div>
      </div>
    </section>
  );
};

export default Problem;
