'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Button } from './ui/button';
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import colors from '../../../../lib/colors';

const Hero: React.FC = () => {
  const heroRef = useRef<HTMLElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Track mouse position relative to hero section
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    };

    const heroElement = heroRef.current;
    if (heroElement) {
      heroElement.addEventListener('mousemove', handleMouseMove);
      return () => heroElement.removeEventListener('mousemove', handleMouseMove);
    }
  }, []);

  // Magnetic movement effect
  const getMagneticStyle = (
    element: HTMLElement | null,
    strength: number = 0.15
  ) => {
    if (!element || !heroRef.current) return {};

    const rect = element.getBoundingClientRect();
    const heroRect = heroRef.current.getBoundingClientRect();
    const elementCenterX = rect.left + rect.width / 2 - heroRect.left;
    const elementCenterY = rect.top + rect.height / 2 - heroRect.top;

    const distanceX = mousePosition.x - elementCenterX;
    const distanceY = mousePosition.y - elementCenterY;
    const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);
    const maxDistance = 200;

    if (distance < maxDistance) {
      const factor = (1 - distance / maxDistance) * strength;
      return {
        transform: `translate(${distanceX * factor}px, ${distanceY * factor}px)`,
        transition:
          'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      };
    }

    return {
      transform: 'translate(0px, 0px)',
      transition:
        'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
    };
  };

  const badgeRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLAnchorElement>(null);
  const illustrationRef = useRef<HTMLDivElement>(null);

  return (
    <section
      ref={heroRef}
      id="home"
      className="pt-32 pb-24 min-h-screen flex items-center relative overflow-hidden"
      // top-level section text/background tokens
      style={{
        backgroundColor: colors.background,
        color: colors.foreground,
      }}
    >
      {/* Background Layers */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${colors.background}, ${colors.accent} / 0.3, ${colors.background})`,
        }}
      />
      <div
        className="absolute inset-0 mesh-gradient opacity-40"
        style={{
          background: colors.gradientMesh,
          opacity: 0.4,
        }}
      />

      {/* Animated Orbs */}
      <div
        className="absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl animation-float"
        style={{ backgroundColor: `${colors.primary} / 0.3` }}
      />
      <div
        className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl animation-float"
        style={{
          backgroundColor: `${colors.primaryGlow} / 0.2`,
          animationDelay: '2s',
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl animation-float"
        style={{
          background: `linear-gradient(90deg, ${colors.primary} / 0.1 0%, ${colors.primaryGlow} / 0.08 100%)`,
          animationDelay: '4s',
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
          {/* LEFT COLUMN */}
          <div className="text-center lg:text-left animation-fade-in">
            {/* Premium Badge */}
            <div
              ref={badgeRef}
              style={getMagneticStyle(badgeRef.current, 0.2)}
              className="inline-flex items-center space-x-2 mb-6 px-5 py-2.5 rounded-full shadow-glow"
              // color-only changes for badge
              style={{
                ...(getMagneticStyle(badgeRef.current, 0.2) as any),
                background: colors.glassBg,
                border: `1px solid ${colors.primary} / 0.3`,
                boxShadow: colors.shadowGlow,
                color: colors.primary,
              }}
            >
              <Sparkles
                className="h-4 w-4 animate-pulse"
                style={{ color: colors.primary }}
              />
              <span style={{ color: colors.primary, fontWeight: 600, fontSize: 14 }}>
                AI-Powered Marketing Platform
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1]">
              <span className="block mb-2" style={{ color: colors.foreground, fontSize: '1.75rem' }}>
                Marketing Made
              </span>
              <span
                className="gradient-text block"
                style={{
                  backgroundImage: colors.gradientHero,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                Simple & Powerful
              </span>
            </h1>

            {/* Subheadline */}
            <p
              className="text-lg md:text-xl mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed"
              style={{ color: colors.mutedForeground }}
            >
              Launch campaigns across Google, Meta, Instagram & WhatsApp in
              minutes.{' '}
              <span style={{ fontWeight: 600, color: colors.foreground }}>
                No agencies. No complexity.
              </span>{' '}
              Just results.
            </p>

            {/* Quick Benefits */}
            <div className="flex flex-wrap gap-4 mb-8 justify-center lg:justify-start">
              {[
                'Setup in 5 minutes',
                'No credit card needed',
                '14-day free trial',
              ].map((text, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm"
                  style={{ color: colors.foreground }}
                >
                  <CheckCircle2 className="h-5 w-5" style={{ color: colors.primary }} />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10">
              <Button
                variant="hero"
                size="lg"
                className="px-8 py-6 text-lg shadow-glow hover:shadow-strong group w-full sm:w-auto"
                asChild
                // ensure token-based button styling doesn't break internal behavior
                style={{
                  background: colors.gradientPrimary,
                  color: colors.primaryForeground,
                  boxShadow: colors.shadowGlow,
                }}
              >
                <a
                  ref={buttonRef}
                  style={getMagneticStyle(buttonRef.current, 0.25)}
                  href="/auth/signin"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </a>
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="px-8 py-6 text-lg"
                asChild
                style={{
                  backgroundColor: 'transparent',
                  border: `1px solid ${colors.primary} / 0.3`,
                  color: colors.foreground,
                }}
              >
                <a href="/#features">See How It Works</a>
              </Button>
            </div>

            {/* Social Proof */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {['A', 'B', 'C'].map((letter, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
                      style={{
                        backgroundColor: `${colors.primary} / 0.2`,
                        borderColor: colors.background,
                      }}
                    >
                      <span style={{ color: colors.primary, fontSize: 12, fontWeight: 700 }}>
                        {letter}
                      </span>
                    </div>
                  ))}
                </div>
                <span style={{ color: colors.foreground, fontWeight: 600 }}>
                  500+ businesses growing
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Sparkles
                      key={i}
                      className="h-4 w-4"
                      style={{ color: colors.primary }}
                    />
                  ))}
                </div>
                <span style={{ color: colors.foreground, fontWeight: 600 }}>
                  4.9/5 rating
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div
            ref={illustrationRef}
            style={getMagneticStyle(illustrationRef.current, 0.1)}
            className="hidden lg:block relative animation-fade-in"
          >
            <div className="relative h-[600px]">
              {/* Card 1 */}
              <div
                className="absolute top-0 right-0 w-80 p-6 rounded-2xl transform rotate-3 hover:rotate-0 transition-all duration-500"
                style={{
                  background: colors.gradientCard,
                  color: colors.cardForeground,
                  border: `1px solid ${colors.border}`,
                  boxShadow: colors.shadowStrong,
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${colors.primary} / 0.2` }}
                  >
                    <TrendingUp className="h-6 w-6" style={{ color: colors.primary }} />
                  </div>
                  <div>
                    <div style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      Campaign Performance
                    </div>
                    <div style={{ color: colors.foreground, fontSize: 20, fontWeight: 700 }}>
                      +245%
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${colors.primary} / 0.2` }}>
                    <div className="h-full rounded-full" style={{ backgroundColor: colors.primary, width: '80%' }} />
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${colors.primary} / 0.2` }}>
                    <div className="h-full rounded-full" style={{ backgroundColor: colors.primaryGlow, width: '60%' }} />
                  </div>
                </div>
              </div>

              {/* Card 2 */}
              <div
                className="absolute top-32 left-0 w-80 p-6 rounded-2xl transform -rotate-2 hover:rotate-0 transition-all duration-500"
                style={{
                  background: colors.card,
                  color: colors.cardForeground,
                  border: `1px solid ${colors.border}`,
                  boxShadow: colors.shadowStrong,
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${colors.primaryGlow} / 0.2` }}
                  >
                    <Zap className="h-6 w-6" style={{ color: colors.primary }} />
                  </div>
                  <div>
                    <div style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      Active Campaigns
                    </div>
                    <div style={{ color: colors.foreground, fontSize: 20, fontWeight: 700 }}>
                      12
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 h-20 rounded-lg p-3" style={{ backgroundColor: `${colors.primary} / 0.1` }}>
                    <div style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6 }}>
                      Google
                    </div>
                    <div style={{ color: colors.foreground, fontSize: 18, fontWeight: 700 }}>
                      3.2K
                    </div>
                  </div>
                  <div className="flex-1 h-20 rounded-lg p-3" style={{ backgroundColor: `${colors.primaryGlow} / 0.1` }}>
                    <div style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 6 }}>
                      Meta
                    </div>
                    <div style={{ color: colors.foreground, fontSize: 18, fontWeight: 700 }}>
                      5.8K
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3 */}
              <div
                className="absolute bottom-0 right-12 w-80 p-6 rounded-2xl transform rotate-1 hover:rotate-0 transition-all duration-500"
                style={{
                  background: colors.card,
                  color: colors.cardForeground,
                  border: `1px solid ${colors.border}`,
                  boxShadow: colors.shadowStrong,
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${colors.primary} / 0.2` }}>
                    <Sparkles className="h-6 w-6" style={{ color: colors.primary }} />
                  </div>
                  <div>
                    <div style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      AI Suggestions
                    </div>
                    <div style={{ color: colors.foreground, fontSize: 16, fontWeight: 700 }}>
                      New campaign ready
                    </div>
                  </div>
                </div>
                <div style={{ color: colors.mutedForeground, fontSize: 13 }}>
                  "Holiday sale campaign optimized for your audience"
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full"
                  style={{
                    border: `1px solid ${colors.primary} / 0.3`,
                    color: colors.foreground,
                    background: 'transparent',
                  }}
                >
                  Review Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
