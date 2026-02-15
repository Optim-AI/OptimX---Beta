'use client';

import React from 'react';
import colors from '@/lib/ui/colors';
import {
  Wand2, Target, Zap, BarChart3, Search, Palette,
  Star, Users, Calendar, TrendingUp,
} from 'lucide-react';
import { useScrollAnimation } from '../hooks/use-scroll-animation';

type Feature = {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  /** Slightly larger card for visual interest */
  highlight?: boolean;
};

const Features: React.FC = () => {
  const { elementRef: titleRef, isVisible: titleVisible } = useScrollAnimation();
  const { elementRef: cardsRef, isVisible: cardsVisible } = useScrollAnimation({ threshold: 0.05 });

  const features: Feature[] = [
    { icon: Wand2, title: 'AI Ad Studio', description: 'Create scroll-stopping ads with instant copy and designs — no agency needed.', highlight: true },
    { icon: Target, title: 'Laser-Targeted Campaigns', description: 'Reach the right customers across Meta(Facebook), Google, Instagram & WhatsApp with precision.' },
    { icon: Zap, title: 'One-Click Campaign Launch', description: 'Publish everywhere in one click from a single dashboard. No hopping tabs.', highlight: true },
    { icon: BarChart3, title: 'Analytics & Insights', description: 'Track results, optimize spend, and grow smarter.' },
    { icon: Search, title: 'SEO & Content Engine', description: 'Optimize your website, blog, and landing pages for Google without a content team.' },
    { icon: Palette, title: 'AI Brand Voice & Messaging', description: 'Lock in your brand tone, slogans, and messaging in minutes — keep everything consistent everywhere.', highlight: true },
    { icon: Star, title: 'Reputation & Review Intelligence', description: 'Monitor reviews and mentions online with AI-guided replies and escalation alerts.' },
    { icon: Users, title: 'Influencer & Freelancer Marketplace', description: 'Hire designers, writers, or local influencers directly from SkalX AI.' },
    { icon: Calendar, title: 'Multi-Channel Posting', description: 'Schedule and auto-publish posts on Meta(Facebook), Instagram, LinkedIn, WhatsApp and more.' },
    { icon: TrendingUp, title: 'Insights & Growth Analytics', description: 'View real-time ROI, performance breakdowns, and AI recommendations on what to improve next.' },
  ];

  return (
    <section id="features" className="py-24 relative overflow-hidden section-solid">
      <div className="grain-overlay" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          ref={titleRef}
          className={`text-center max-w-4xl mx-auto mb-16 transition-all duration-700`}
          style={{
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? 'translateY(0)' : 'translateY(20px)',
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-[1.08]" style={{ color: colors.foreground }}>
            All your{' '}
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
              marketing needs
            </span>{' '}
            — <br className="hidden md:block" />
            in one platform
          </h2>
          <p className="text-xl" style={{ color: colors.mutedForeground }}>
            Stop juggling multiple tools. SkalX AI brings together everything you need to grow your business online.
          </p>
        </div>

        <div ref={cardsRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isHighlight = feature.highlight ?? false;
            return (
              <div
                key={index}
                className="group relative p-6 lg:p-8 rounded-[20px] transition-all duration-500"
                style={{
                  opacity: cardsVisible ? 1 : 0,
                  transform: cardsVisible ? 'translateY(0)' : 'translateY(20px)',
                  transitionDelay: cardsVisible ? `${index * 80}ms` : '0ms',
                  transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                  gridRow: isHighlight ? 'span 1' : undefined,
                  padding: isHighlight ? '2rem 1.75rem' : undefined,
                  background: 'hsl(0 0% 15% / 0.5)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.transform = 'translateY(-4px) scale(1.01)';
                  el.style.boxShadow = '0 16px 48px rgba(0,0,0,0.25), 0 0 0 1px hsl(213 100% 55% / 0.12)';
                  el.style.borderColor = 'rgba(255,255,255,0.1)';
                  const iconWrap = el.querySelector('[data-icon-wrap]') as HTMLElement | null;
                  if (iconWrap) {
                    iconWrap.style.backgroundColor = 'hsl(213 100% 55% / 0.2)';
                    iconWrap.style.transform = 'scale(1.05)';
                  }
                  const svg = el.querySelector('svg');
                  if (svg) (svg as SVGElement).style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.transform = cardsVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(1)';
                  el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  el.style.borderColor = 'rgba(255,255,255,0.06)';
                  const iconWrap = el.querySelector('[data-icon-wrap]') as HTMLElement | null;
                  if (iconWrap) {
                    iconWrap.style.backgroundColor = 'hsl(213 100% 55% / 0.1)';
                    iconWrap.style.transform = 'scale(1)';
                  }
                  const svg = el.querySelector('svg');
                  if (svg) (svg as SVGElement).style.transform = 'scale(1)';
                }}
              >
                <div
                  data-icon-wrap
                  className="flex items-center justify-center w-12 h-12 rounded-xl mb-6 transition-all duration-300"
                  style={{ backgroundColor: 'hsl(213 100% 55% / 0.1)' }}
                >
                  <Icon className="h-6 w-6 transition-transform duration-300" style={{ color: colors.primary }} />
                </div>
                <h3 className="text-xl font-semibold mb-3" style={{ color: colors.foreground }}>
                  {feature.title}
                </h3>
                <p className="leading-relaxed text-[15px]" style={{ color: colors.mutedForeground }}>
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
