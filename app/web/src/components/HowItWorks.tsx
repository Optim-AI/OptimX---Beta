'use client';

import React from 'react';
import { Link as LinkIcon, MessageSquare, Rocket } from 'lucide-react';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '@/lib/ui/colors';

type Step = {
  number: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
};

const HowItWorks: React.FC = () => {
  const { elementRef: titleRef, isVisible: titleVisible } = useScrollAnimation();
  const { elementRef: stepsRef, isVisible: stepsVisible } = useScrollAnimation({ threshold: 0.1 });

  const steps: Step[] = [
    { number: '1', icon: LinkIcon, title: 'Connect your channels', description: 'Link your Google, Meta, Instagram, WhatsApp, and website once. Oli AI securely pulls in your data and keeps everything in sync.' },
    { number: '2', icon: MessageSquare, title: 'Tell Oli AI your goal', description: "Describe what you want in simple words — like 'get more walk-ins' or 'sell 50 more products'. Oli AI turns it into a clear campaign plan." },
    { number: '3', icon: Rocket, title: 'We launch, learn, and optimise', description: 'Oli AI creates, launches, and tracks your ads and content across channels, then doubles down on what works so you get better results over time.' },
  ];

  return (
    <section id="how-it-works" className="py-24 overflow-hidden relative section-solid">
      <div className="grain-overlay" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          ref={titleRef}
          className={`text-center max-w-3xl mx-auto mb-20 transition-all duration-700`}
          style={{
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? 'translateY(0)' : 'translateY(20px)',
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight" style={{ color: colors.foreground }}>
            Launch a campaign in{' '}
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
              3 simple steps
            </span>
          </h2>
          <p className="text-lg md:text-xl leading-relaxed" style={{ color: colors.mutedForeground }}>
            Connect your channels, set a goal, and let Oli AI handle the rest.
          </p>
        </div>

        <div ref={stepsRef} className="relative max-w-6xl mx-auto">
          {/* Connector line - visible on lg screens */}
          <div
            className="hidden lg:block absolute top-[120px] left-0 right-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent 0%, hsl(213 100% 55% / 0.2) 20%, hsl(213 100% 55% / 0.3) 50%, hsl(213 100% 55% / 0.2) 80%, transparent 100%)`,
              opacity: stepsVisible ? 1 : 0,
              transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
              transitionDelay: '0.4s',
            }}
          />

          <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={index}
                  className="relative transition-all duration-700"
                  style={{
                    opacity: stepsVisible ? 1 : 0,
                    transform: stepsVisible ? 'translateY(0)' : 'translateY(20px)',
                    transitionDelay: stepsVisible ? `${index * 150}ms` : '0ms',
                    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <div
                    className="relative rounded-[20px] p-8 flex flex-col h-full transition-all duration-500 group hover:border-[rgba(255,255,255,0.12)]"
                    style={{
                      background: 'hsl(0 0% 15% / 0.5)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.style.transform = 'translateY(-4px)';
                      el.style.boxShadow = '0 16px 48px rgba(0,0,0,0.25), 0 0 0 1px hsl(213 100% 55% / 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.transform = 'translateY(0)';
                      el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    }}
                  >
                    <div className="relative mb-8">
                      <div
                        className="relative flex items-center justify-center w-20 h-20 rounded-2xl mx-auto transition-transform duration-500 group-hover:scale-105"
                        style={{
                          background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryHover ?? colors.primary} 100%)`,
                          boxShadow: `0 8px 24px hsl(213 100% 55% / 0.25)`,
                        }}
                      >
                        <Icon style={{ color: colors.primaryForeground, width: 38, height: 38 }} />
                      </div>
                      <div
                        className="absolute -top-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-transform duration-500"
                        style={{
                          backgroundColor: colors.primaryGlow,
                          color: colors.primaryForeground,
                          boxShadow: `0 4px 12px hsl(213 100% 55% / 0.3)`,
                          transform: stepsVisible ? 'scale(1)' : 'scale(0)',
                          transitionDelay: stepsVisible ? `${index * 150 + 300}ms` : '0ms',
                        }}
                      >
                        {step.number}
                      </div>
                    </div>

                    <h3 className="text-xl font-semibold mb-4 text-center" style={{ color: colors.foreground }}>
                      {step.title}
                    </h3>

                    <p className="text-base leading-relaxed text-center flex-grow" style={{ color: colors.mutedForeground }}>
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
