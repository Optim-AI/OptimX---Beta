'use client';

import React from 'react';
import colors from '../../../../lib/colors';
import { 
  Wand2, 
  Target, 
  Zap, 
  BarChart3, 
  Search, 
  Palette, 
  Star, 
  Users, 
  Calendar,
  TrendingUp
} from 'lucide-react';
import { useScrollAnimation } from '../hooks/use-scroll-animation';

type Feature = {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
};

const Features: React.FC = () => {
  const { elementRef: titleRef, isVisible: titleVisible } = useScrollAnimation();
  const { elementRef: cardsRef, isVisible: cardsVisible } = useScrollAnimation({ threshold: 0.05 });

  const features: Feature[] = [
    { icon: Wand2, title: 'AI Ad Studio', description: 'Create scroll-stopping ads with instant copy and designs — no agency needed.' },
    { icon: Target, title: 'Laser-Targeted Campaigns', description: 'Reach the right customers across Meta(Facebook), Google, Instagram & WhatsApp with precision.' },
    { icon: Zap, title: 'One-Click Campaign Launch', description: 'Publish everywhere in one click from a single dashboard. No hopping tabs.' },
    { icon: BarChart3, title: 'Analytics & Insights', description: 'Track results, optimize spend, and grow smarter.' },
    { icon: Search, title: 'SEO & Content Engine', description: 'Optimize your website, blog, and landing pages for Google without a content team.' },
    { icon: Palette, title: 'AI Brand Voice & Messaging', description: 'Lock in your brand tone, slogans, and messaging in minutes — keep everything consistent everywhere.' },
    { icon: Star, title: 'Reputation & Review Intelligence', description: 'Monitor reviews and mentions online with AI-guided replies and escalation alerts.' },
    { icon: Users, title: 'Influencer & Freelancer Marketplace', description: 'Hire designers, writers, or local influencers directly from OptimX.' },
    { icon: Calendar, title: 'Multi-Channel Posting', description: 'Schedule and auto-publish posts on Meta(Facebook), Instagram, LinkedIn, WhatsApp and more.' },
    { icon: TrendingUp, title: 'Insights & Growth Analytics', description: 'View real-time ROI, performance breakdowns, and AI recommendations on what to improve next.' }
  ];

  return (
    <section id="features" className="py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div 
          ref={titleRef}
          className={`text-center max-w-4xl mx-auto mb-16 transition-all duration-1000 ${
            titleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
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
            Stop juggling multiple tools. OptimX brings together everything you need to grow your business online.
          </p>
        </div>

        <div ref={cardsRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;

            const baseCardStyle: React.CSSProperties = {
              background: colors.gradientCard,
              boxShadow: colors.shadowSoft,
              color: colors.foreground,
            };

            const hoverCardStyle: React.CSSProperties = {
              background: `linear-gradient(180deg, ${colors.primary}10, ${colors.primary}05)`,
              boxShadow: colors.shadowGlow,
            };

            const baseIconBg = "hsl(213 100% 50% / 0.1)";
            const hoverIconBg = "hsl(213 100% 50% / 0.2)";

            return (
              <div
                key={index}
                className={`group p-8 rounded-xl hover-lift hover-glow transition-all duration-700 ${
                  cardsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{
                  ...baseCardStyle,
                  transitionDelay: cardsVisible ? `${index * 80}ms` : '0ms',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = hoverCardStyle.background as string;
                  (e.currentTarget as HTMLElement).style.boxShadow = hoverCardStyle.boxShadow as string;
                  const iconWrap = e.currentTarget.querySelector('[data-icon-wrap]') as HTMLElement | null;
                  if (iconWrap) iconWrap.style.backgroundColor = hoverIconBg;
                  const svg = e.currentTarget.querySelector('svg') as SVGElement | null;
                  if (svg) (svg.style as any).color = colors.primary;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = baseCardStyle.background as string;
                  (e.currentTarget as HTMLElement).style.boxShadow = baseCardStyle.boxShadow as string;
                  const iconWrap = e.currentTarget.querySelector('[data-icon-wrap]') as HTMLElement | null;
                  if (iconWrap) iconWrap.style.backgroundColor = baseIconBg;
                  const svg = e.currentTarget.querySelector('svg') as SVGElement | null;
                  if (svg) (svg.style as any).color = colors.primary;
                }}
              >
                <div
                  data-icon-wrap
                  className="flex items-center justify-center w-12 h-12 rounded-lg mb-6 transition-all duration-300"
                  style={{
                    backgroundColor: baseIconBg,
                    borderRadius: '0.5rem',
                  }}
                >
                  <Icon className="h-6 w-6" style={{ color: colors.primary }} />
                </div>

                <h3 className="text-xl font-semibold mb-3" style={{ color: colors.foreground }}>
                  {feature.title}
                </h3>
                <p className="leading-relaxed" style={{ color: colors.mutedForeground }}>
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
