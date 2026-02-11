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
    {
      number: '1',
      icon: LinkIcon,
      title: 'Connect your channels',
      description:
        'Link your Google, Meta, Instagram, WhatsApp, and website once. Oli AI securely pulls in your data and keeps everything in sync.'
    },
    {
      number: '2',
      icon: MessageSquare,
      title: 'Tell Oli AI your goal',
      description:
        "Describe what you want in simple words — like 'get more walk-ins' or 'sell 50 more products'. Oli AI turns it into a clear campaign plan."
    },
    {
      number: '3',
      icon: Rocket,
      title: 'We launch, learn, and optimise',
      description:
        'Oli AI creates, launches, and tracks your ads and content across channels, then doubles down on what works so you get better results over time.'
    }
  ];

  return (
    <section
      id="how-it-works"
      className="py-24 overflow-hidden"
      style={{
        backgroundColor: 'hsl(220 13% 95% / 0.3)',
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
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
            Connect your channels, set a goal, and let Oli AI handle the rest.
          </p>
        </div>

        {/* Step Cards */}
        <div ref={stepsRef} className="grid lg:grid-cols-3 gap-8 lg:gap-12 max-w-6xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={index}
                className={`relative transition-all duration-700 h-full ${
                  stepsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{
                  transitionDelay: stepsVisible ? `${index * 200}ms` : '0ms'
                }}
              >
                <div
                  className="rounded-2xl p-8 flex flex-col h-full"
                  style={{
                    background: colors.gradientCard,
                    color: colors.cardForeground,
                    boxShadow: colors.shadowSoft,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <div className="relative mb-8">
                    <div
                      className="relative flex items-center justify-center w-20 h-20 rounded-2xl shadow-glow mx-auto"
                      style={{
                        background: `linear-gradient(135deg, ${colors.primary} 0%, ${
                          colors.primaryHover ?? colors.primary
                        } 100%)`,
                      }}
                    >
                      <Icon style={{ color: colors.primaryForeground, width: 38, height: 38 }} />
                    </div>

                    <div
                      className="absolute -top-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-glow"
                      style={{
                        backgroundColor: colors.primaryGlow,
                        color: colors.primaryForeground,
                      }}
                    >
                      {step.number}
                    </div>
                  </div>

                  <h3
                    className="text-xl font-semibold mb-4 text-center"
                    style={{ color: colors.foreground }}
                  >
                    {step.title}
                  </h3>

                  <p
                    className="text-base leading-relaxed text-center flex-grow"
                    style={{ color: colors.mutedForeground }}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
