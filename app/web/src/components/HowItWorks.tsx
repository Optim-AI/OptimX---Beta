'use client';

import React from 'react';
import { Globe2, Clapperboard, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '@/lib/ui/colors';

const STEPS = [
  {
    number: '01',
    icon: Globe2,
    title: 'Add your brand',
    description: 'Drop a website or brand name. SkalX reads your identity.',
  },
  {
    number: '02',
    icon: Clapperboard,
    title: 'Create your campaign',
    description: 'Pick a product and direction from your Brand DNA.',
  },
  {
    number: '03',
    icon: Sparkles,
    title: 'Generate your creatives',
    description: 'Get posters, social ads, and video ready to use.',
  },
];

const EASE = [0.16, 1, 0.3, 1] as const;

const HowItWorks: React.FC = () => {
  const { elementRef, isVisible } = useScrollAnimation({ threshold: 0.12 });
  const reduceMotion = useReducedMotion();

  return (
    <section id="how-it-works" className="py-14 md:py-20 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 max-w-5xl">
        <motion.div
          className="text-center max-w-lg mx-auto mb-10"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={isVisible || reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <p
            className="text-xs uppercase tracking-[0.2em] mb-3"
            style={{ color: colors.primary }}
          >
            How it works
          </p>
          <h2
            className="text-3xl md:text-4xl font-normal leading-tight"
            style={{ color: colors.foreground }}
          >
            Three steps to first creatives
          </h2>
        </motion.div>

        <div ref={elementRef} className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                animate={
                  isVisible || reduceMotion
                    ? { opacity: 1, y: 0 }
                    : { opacity: 0, y: 20 }
                }
                transition={{
                  duration: 0.55,
                  delay: reduceMotion ? 0 : index * 0.1,
                  ease: EASE,
                }}
                className="rounded-2xl p-6 text-center transition-transform duration-300 hover:-translate-y-0.5"
                style={{
                  background: colors.glassBg,
                  border: `1px solid ${colors.glassBorder}`,
                }}
              >
                <div
                  className="mx-auto mb-4 w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{
                    background: colors.gradientPrimary,
                    boxShadow: colors.shadowGlow,
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: colors.primaryForeground }} />
                </div>
                <div
                  className="text-[11px] uppercase tracking-[0.16em] mb-2"
                  style={{ color: colors.primary }}
                >
                  {step.number}
                </div>
                <h3 className="text-lg mb-2" style={{ color: colors.foreground }}>
                  {step.title}
                </h3>
                <p className="text-sm font-light leading-relaxed" style={{ color: colors.mutedForeground }}>
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
