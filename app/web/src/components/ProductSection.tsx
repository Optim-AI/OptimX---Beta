'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Palette, Clapperboard, LayoutTemplate, Compass, LineChart } from 'lucide-react';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '@/lib/ui/colors';

/**
 * Truthful Product section based on current SkalX capabilities in the repo:
 * Brand Studio (posters), Ad Studio, commercial video, Creative Intelligence,
 * campaign flows, analytics (coming soon / gated).
 */
const GROUPS = [
  {
    label: 'Create',
    items: [
      {
        icon: Palette,
        title: 'AI posters',
        desc: 'Generate on-brand poster creatives from your brand kit and product imagery.',
      },
      {
        icon: LayoutTemplate,
        title: 'AI ad creatives',
        desc: 'Build scroll-stopping ad visuals and copy for campaign-ready assets.',
      },
      {
        icon: Clapperboard,
        title: 'AI videos',
        desc: 'Produce short-form marketing videos from your product and brand context.',
      },
    ],
  },
  {
    label: 'Plan',
    items: [
      {
        icon: Compass,
        title: 'Campaign concepts',
        desc: 'Shape campaign angles and creative direction before you generate.',
      },
      {
        icon: LayoutTemplate,
        title: 'Creative direction',
        desc: 'Brand Studio and Creative Intelligence help align tone, audience, and visuals.',
      },
      {
        icon: Compass,
        title: 'Campaign planning',
        desc: 'Move from brief to structured campaign flow inside Ad Studio.',
      },
    ],
  },
  {
    label: 'Optimize',
    items: [
      {
        icon: LineChart,
        title: 'Analytics',
        desc: 'Performance views and workspace analytics as they roll out in-product.',
      },
      {
        icon: LineChart,
        title: 'Insights',
        desc: 'Creative Intelligence surfaces brand and market context for better decisions.',
      },
      {
        icon: LineChart,
        title: 'Recommendations',
        desc: 'Use AI-assisted guidance to refine creatives and campaign direction.',
      },
    ],
  },
] as const;

const ProductSection: React.FC = () => {
  const { elementRef: titleRef, isVisible: titleVisible } = useScrollAnimation();
  const { elementRef: bodyRef, isVisible: bodyVisible } = useScrollAnimation({ threshold: 0.08 });

  return (
    <section id="product" className="py-24 relative overflow-hidden section-solid">
      <div className="grain-overlay" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          ref={titleRef}
          className="text-center max-w-3xl mx-auto mb-16 transition-all duration-700"
          style={{
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? 'translateY(0)' : 'translateY(20px)',
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <h2
            className="text-4xl md:text-[46px] font-normal leading-tight mb-4"
            style={{ color: colors.foreground }}
          >
            The SkalX product
          </h2>
          <p className="text-xl font-extralight" style={{ color: colors.mutedForeground }}>
            Create, plan, and improve marketing creatives from one AI marketing platform.
          </p>
        </div>

        <div
          ref={bodyRef}
          className="max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-14 items-center"
          style={{
            opacity: bodyVisible ? 1 : 0,
            transform: bodyVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <div className="space-y-10">
            {GROUPS.map((group) => (
              <div key={group.label}>
                <p
                  className="text-xs uppercase tracking-[0.2em] mb-4 font-medium"
                  style={{ color: colors.primary }}
                >
                  {group.label}
                </p>
                <div className="space-y-4">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="flex gap-4">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: 'hsl(213 100% 55% / 0.12)' }}
                        >
                          <Icon className="h-5 w-5" style={{ color: colors.primary }} />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium mb-1" style={{ color: colors.foreground }}>
                            {item.title}
                          </h3>
                          <p className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div
            className="relative rounded-2xl overflow-hidden aspect-[3/4] max-w-md mx-auto w-full"
            style={{
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
            }}
          >
            <Image
              src="/images/partners/boat-stone-350-deadpool.png"
              alt="Example SkalX poster creative"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 90vw, 400px"
            />
            <div
              className="absolute inset-x-0 bottom-0 p-5"
              style={{
                background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
              }}
            >
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
                Real creatives generated with SkalX Brand Studio.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center mt-14">
          <Link href="/try" className="text-lg font-medium" style={{ color: colors.primary }}>
            Try SkalX →
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ProductSection;
