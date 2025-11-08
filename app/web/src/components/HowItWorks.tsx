'use client';

import React from 'react';
import { Link as LinkIcon, MessageSquare, Rocket } from 'lucide-react';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '../../../../lib/colors';

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
    {
      number: '1',
      icon: LinkIcon,
      title: 'Connect your business accounts and integrations',
      description:
        "Link your Google, Meta, Instagram, WhatsApp, and website accounts in minutes. Our secure setup ensures your data stays protected while giving OptimX the access it needs to work its magic."
    },
    {
      number: '2',
      icon: MessageSquare,
      title: 'Describe your campaign goal',
      description:
        "Simply tell OptimX what you want to achieve. Our AI helps craft compelling ads, eye-catching creatives, and comprehensive SEO strategy tailored to your business goals and target audience."
    },
    {
      number: '3',
      icon: Rocket,
      title: 'Let OptimX design, launch & track everything',
      description:
        "Sit back as OptimX handles the heavy lifting. From paid ads to organic growth, content creation to performance tracking, everything runs on autopilot while you focus on your business."
    }
  ];

  return (
    <section
      id="how-it-works"
      className="py-24 overflow-hidden"
      style={{
        // replace bg-muted/30
        backgroundColor: `${colors.muted} / 0.3`,
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={titleRef}
          className={`text-center max-w-3xl mx-auto mb-20 transition-all duration-1000 ${
            titleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <h2
            className="text-4xl md:text-5xl font-bold mb-6 leading-tight"
            style={{ color: colors.foreground }}
          >
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
            From setup to success, we've made it incredibly simple to start growing your business online.
          </p>
        </div>

        <div className="relative max-w-6xl mx-auto">
          {/* Animated flowing line (desktop) */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${colors.primary} / 0.2 0%, ${colors.primary} 50%, ${colors.primary} / 0.2 100%)`,
              }}
            />
            <div
              className="absolute inset-0 rounded-full animate-pulse"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${colors.primaryGlow} 50%, transparent 100%)`,
              }}
            />
          </div>

          <div ref={stepsRef} className="grid lg:grid-cols-3 gap-8 lg:gap-12 relative">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={index}
                  className={`relative transition-all duration-700 ${
                    stepsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                  }`}
                  style={{
                    transitionDelay: stepsVisible ? `${index * 200}ms` : '0ms'
                  }}
                >
                  <div className="relative z-10 h-full">
                    <div
                      className="rounded-2xl p-8 transition-all duration-300"
                      // replace card-gradient, shadow-elegant, hover-lift/hover-glow visuals with token-backed styles
                      style={{
                        background: colors.gradientCard,
                        color: colors.cardForeground,
                        boxShadow: colors.shadowSoft,
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      <div className="relative mb-8">
                        <div
                          className="absolute inset-0 rounded-2xl blur-xl animation-float"
                          style={{ backgroundColor: `${colors.primary} / 0.2` }}
                        />
                        <div
                          className="relative flex items-center justify-center w-20 h-20 rounded-2xl shadow-glow mx-auto"
                          style={{
                            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryHover ?? colors.primary} 100%)`,
                          }}
                        >
                          <Icon style={{ color: colors.primaryForeground, width: 40, height: 40 }} />
                        </div>

                        <div
                          className="absolute -top-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-glow animation-float"
                          style={{
                            backgroundColor: colors.primaryGlow,
                            color: colors.primaryForeground,
                            animationDelay: `${index * 0.3}s`,
                          }}
                        >
                          {step.number}
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col text-center">
                        <h3 className="text-xl font-semibold mb-4 leading-snug" style={{ color: colors.foreground }}>
                          {step.title}
                        </h3>
                        <p className="leading-relaxed text-base" style={{ color: colors.mutedForeground }}>
                          {step.description}
                        </p>
                      </div>

                      <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${colors.border}` }}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium" style={{ color: colors.mutedForeground }}>
                            Step {step.number}
                          </span>
                          <div className="flex gap-1">
                            {steps.map((_, i) => (
                              <div
                                key={i}
                                className={`h-1.5 rounded-full transition-all duration-300`}
                                style={{
                                  width: i <= index ? 32 : 16,
                                  backgroundColor: i <= index ? colors.primary : colors.muted,
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
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
