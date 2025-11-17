'use client';

import React from 'react';
import { Button } from './ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '../../../../lib/colors';

const FinalCTA: React.FC = () => {
  const { elementRef: ctaRef, isVisible: ctaVisible } = useScrollAnimation({ threshold: 0.2 });

  return (
    <section className="py-20 relative overflow-hidden">
      {/* Modern mesh background effects (color tokens only; animations untouched) */}
      <div
        className="absolute inset-0 mesh-gradient opacity-50"
        style={{
          background: colors.gradientMesh,
          opacity: 0.5,
        }}
      ></div>

      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl animation-float"
        style={{
          backgroundColor: `${colors.primary} / 0.2`,
        }}
      ></div>

      <div
        className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl animation-float"
        style={{
          backgroundColor: "hsl(213 100% 62% / 0.2)",
          animationDelay: '2s',
        }}
      ></div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          ref={ctaRef}
          className={`text-center max-w-4xl mx-auto transition-all duration-1000 ${
            ctaVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <div
            className={`inline-flex items-center space-x-2 mb-6 px-4 py-2 backdrop-blur-sm rounded-full border transition-all duration-700 ${
              ctaVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
            }`}
            style={{
              // token-based accent background & subtle border (keeps animation classes intact)
              backgroundColor: "hsl(213 90% 96% / 0.5)",
              borderColor: "hsl(213 100% 50% / 0.2)",
              transitionDelay: ctaVisible ? '200ms' : '0ms',
            }}
          >
            <Sparkles className="h-5 w-5" style={{ color: colors.primary }} />
            <span style={{ color: colors.primary, fontWeight: 600 }}>
              Ready to transform your marketing?
            </span>
          </div>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight" style={{ color: colors.foreground }}>
            Run campaigns like the{' '}
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
              big brands
            </span>{' '}
            — <br className="hidden md:block" />
            without the big budget or team.
          </h2>

          <p className="text-xl mb-10 max-w-3xl mx-auto leading-relaxed" style={{ color: colors.mutedForeground }}>
            Join thousands of businesses already using OptimX to grow faster, spend smarter,
            and achieve better results than ever before.
          </p>

          <div
            className={`flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 transition-all duration-700 ${
              ctaVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
            style={{ transitionDelay: ctaVisible ? '400ms' : '0ms' }}
          >
            <Button
              variant="hero"
              size="lg"
              className="px-10 py-4 text-lg hover-lift hover-glow group"
              style={{
                background: colors.gradientPrimary,
                color: colors.primaryForeground,
                boxShadow: colors.shadowGlow,
              }}
            >
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="px-8 py-4 text-lg hover-lift"
              asChild
              >
                <a href="/#features">Schedule a demo</a>
            </Button>
          </div>

          <div
            className={`mt-8 text-sm transition-all duration-700 ${
              ctaVisible ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ color: colors.mutedForeground, transitionDelay: ctaVisible ? '600ms' : '0ms' }}
          >
            <p>✨ Many businesses growing • 7-day free trial • Cancel anytime</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
