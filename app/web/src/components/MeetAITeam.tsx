'use client';

import React from 'react';
import Link from 'next/link';
import { Palette, Zap, BarChart3, LineChart } from 'lucide-react';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '@/lib/ui/colors';

const TEAM_BLOCKS = [
  { icon: Palette, title: 'Creative Engine', desc: 'Generate high-converting posters and video ads directly from your product or website.' },
  { icon: Zap, title: 'Campaign Automation', desc: 'Launch across Meta, Google, and LinkedIn in minutes.' },
  { icon: BarChart3, title: 'Performance Optimization', desc: 'AI analyzes campaign performance and identifies what\'s working — and what isn\'t.' },
  { icon: LineChart, title: 'Analytics & Insights', desc: 'Clear, actionable reporting without dashboard overload.' },
];

const MeetAITeam: React.FC = () => {
  const { elementRef: titleRef, isVisible: titleVisible } = useScrollAnimation();
  const { elementRef: blocksRef, isVisible: blocksVisible } = useScrollAnimation({ threshold: 0.1 });

  return (
    <section id="system" className="py-24 relative overflow-hidden section-solid">
      <div className="grain-overlay" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          ref={titleRef}
          className="text-center max-w-3xl mx-auto mb-6 transition-all duration-700"
          style={{ opacity: titleVisible ? 1 : 0, transform: titleVisible ? 'translateY(0)' : 'translateY(20px)', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-tight" style={{ color: colors.foreground }}>
            Meet Your AI Marketing Team
          </h2>
          <p className="text-lg md:text-xl" style={{ color: colors.mutedForeground }}>
            Oli AI combines creative, execution, and analytics into one unified system.
          </p>
        </div>

        <div ref={blocksRef} className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {TEAM_BLOCKS.map((block, index) => {
            const Icon = block.icon;
            return (
              <div
                key={index}
                className="group p-8 rounded-[20px] transition-all duration-500"
                style={{
                  opacity: blocksVisible ? 1 : 0,
                  transform: blocksVisible ? 'translateY(0)' : 'translateY(20px)',
                  transitionDelay: blocksVisible ? `${index * 100}ms` : '0ms',
                  transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                  background: 'hsl(0 0% 15% / 0.5)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.25), 0 0 0 1px hsl(213 100% 55% / 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = blocksVisible ? 'translateY(0)' : 'translateY(20px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ backgroundColor: 'hsl(213 100% 55% / 0.12)' }}>
                  <Icon className="h-6 w-6" style={{ color: colors.primary }} />
                </div>
                <h3 className="text-xl font-semibold mb-3" style={{ color: colors.foreground }}>{block.title}</h3>
                <p className="leading-relaxed mb-4" style={{ color: colors.mutedForeground }}>{block.desc}</p>
                <Link href="/product" className="text-sm font-medium" style={{ color: colors.primary }}>Learn More →</Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default MeetAITeam;
