'use client';

import React from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import colors from '@/lib/ui/colors';
import { useScrollAnimation } from '../hooks/use-scroll-animation';

const EASE = [0.16, 1, 0.3, 1] as const;

const STAGES = [
  {
    label: 'Brand identity',
    title: 'Brand DNA',
    copy: 'Colours, voice, and product context from your site.',
    visual: 'dna' as const,
  },
  {
    label: 'Creative Intelligence',
    title: 'Direction',
    copy: 'Audience, angle, and campaign-ready messaging.',
    visual: 'intel' as const,
  },
  {
    label: 'Finished assets',
    title: 'Creatives',
    copy: 'Posters, social ads, and AI video campaigns.',
    visual: 'assets' as const,
  },
];

function DnaVisual() {
  return (
    <div className="flex flex-col gap-3 p-4 h-full justify-center">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-semibold"
          style={{ background: colors.primary, color: colors.primaryForeground }}
        >
          SX
        </div>
        <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
      </div>
      <div className="flex gap-2">
        {['#1A8CFF', '#E8EEF5', '#2A2A2A', '#7EB6FF'].map((hex) => (
          <span
            key={hex}
            className="w-8 h-8 rounded-lg border border-white/10"
            style={{ background: hex }}
          />
        ))}
      </div>
      <div className="space-y-1.5">
        <div className="h-1.5 rounded-full w-[80%]" style={{ background: 'rgba(255,255,255,0.14)' }} />
        <div className="h-1.5 rounded-full w-[60%]" style={{ background: 'rgba(255,255,255,0.08)' }} />
      </div>
    </div>
  );
}

function IntelVisual() {
  return (
    <div className="flex flex-col gap-2 p-4 h-full justify-center">
      {['Audience', 'Value prop', 'Campaign angle'].map((row, i) => (
        <div
          key={row}
          className="rounded-xl px-3 py-2 text-xs flex items-center justify-between"
          style={{
            background: i === 1 ? 'hsl(213 100% 55% / 0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${i === 1 ? 'hsl(213 100% 55% / 0.35)' : 'rgba(255,255,255,0.06)'}`,
            color: colors.foreground,
          }}
        >
          <span>{row}</span>
          <span style={{ color: colors.primary }}>●</span>
        </div>
      ))}
    </div>
  );
}

function AssetsVisual() {
  return (
    <div className="relative h-full min-h-[140px] p-3">
      <div
        className="absolute left-3 top-4 w-[42%] aspect-[4/5] rounded-lg overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.1)', transform: 'rotate(-6deg)' }}
      >
        <Image
          src="/images/partners/boat-stone-350-deadpool.png"
          alt=""
          fill
          className="object-cover"
          sizes="120px"
        />
      </div>
      <div
        className="absolute right-3 bottom-3 w-[48%] aspect-[4/5] rounded-lg overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.1)', transform: 'rotate(5deg)' }}
      >
        <Image
          src="/images/partners/jimmys-cocktails-green-apple-martini.png"
          alt=""
          fill
          className="object-cover"
          sizes="140px"
        />
      </div>
    </div>
  );
}

/**
 * Brand → Creative Intelligence → finished assets.
 * Visual storytelling only — no invented metrics.
 */
const BrandJourney: React.FC = () => {
  const { elementRef, isVisible } = useScrollAnimation({ threshold: 0.15 });
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="journey"
      className="py-16 md:py-20 relative overflow-hidden"
      style={{ backgroundColor: '#121212' }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{ background: colors.gradientMesh }}
        aria-hidden
      />
      <div
        ref={elementRef}
        className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 max-w-6xl"
      >
        <div className="text-center mb-10 md:mb-12 max-w-xl mx-auto">
          <p
            className="text-xs uppercase tracking-[0.2em] mb-3"
            style={{ color: colors.primary }}
          >
            How SkalX creates
          </p>
          <h2
            className="text-3xl md:text-4xl font-normal leading-tight"
            style={{ color: colors.foreground }}
          >
            Brand in. Creatives out.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {STAGES.map((stage, index) => (
            <motion.div
              key={stage.label}
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              animate={
                isVisible || reduceMotion
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 24 }
              }
              transition={{ duration: 0.55, delay: reduceMotion ? 0 : index * 0.12, ease: EASE }}
              className="rounded-2xl overflow-hidden flex flex-col"
              style={{
                background: colors.glassBg,
                border: `1px solid ${colors.glassBorder}`,
                boxShadow: colors.glassShadow,
              }}
            >
              <div
                className="relative h-[160px] sm:h-[180px]"
                style={{ background: 'hsl(0 0% 8%)', borderBottom: `1px solid ${colors.border}` }}
              >
                {stage.visual === 'dna' && <DnaVisual />}
                {stage.visual === 'intel' && <IntelVisual />}
                {stage.visual === 'assets' && <AssetsVisual />}
              </div>
              <div className="p-5">
                <div
                  className="text-[11px] uppercase tracking-[0.16em] mb-2"
                  style={{ color: colors.primary }}
                >
                  {String(index + 1).padStart(2, '0')} · {stage.label}
                </div>
                <h3 className="text-lg mb-1" style={{ color: colors.foreground }}>
                  {stage.title}
                </h3>
                <p className="text-sm font-light" style={{ color: colors.mutedForeground }}>
                  {stage.copy}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BrandJourney;
