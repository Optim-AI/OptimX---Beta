'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { X, Check, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface StackedCardProblem {
  icon: LucideIcon;
  title: string;
  text: string;
}

export interface StackedCardSolution {
  icon: LucideIcon;
  title: string;
  text: string;
}

export interface StackedCard {
  problem: StackedCardProblem;
  solution: StackedCardSolution;
}

interface StackedScrollSectionProps {
  cards: StackedCard[];
  className?: string;
}

const INACTIVE_OPACITY = 0.05;
const INACTIVE_SCALE = 1;
const INACTIVE_Y_OFFSET = 30;
const INACTIVE_BLUR = 35;
const DEPTH_OFFSET = 50;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

const StackedScrollSection: React.FC<StackedScrollSectionProps> = ({ cards, className = '' }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const n = cards.length;

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 600,
    damping: 40,
    restDelta: 0.0001,
  });

  return (
    <section
      ref={sectionRef}
      className={`relative ${className}`}
      style={{
        height: `${n * 100}vh`,
        background: '#121212',
      }}
    >
      <div
        className="sticky top-0 left-0 w-full h-screen flex items-center justify-center overflow-hidden"
        style={{ perspective: 1000 }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(79,140,255,0.12) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
          />
        </div>

        <div className="relative w-full max-w-5xl mx-auto px-6">
          {cards.map((card, i) => (
            <StackedCardLayer
              key={i}
              card={card}
              index={i}
              total={n}
              progress={smoothProgress}
            />
          ))}
        </div>

        <ProgressIndicator cards={cards} progress={smoothProgress} />
      </div>
    </section>
  );
};

interface StackedCardLayerProps {
  card: StackedCard;
  index: number;
  total: number;
  progress: ReturnType<typeof useSpring>;
}

const StackedCardLayer: React.FC<StackedCardLayerProps> = ({ card, index, total, progress }) => {
  const ProblemIcon = card.problem.icon;
  const SolutionIcon = card.solution.icon;

  const activation = useTransform(progress, (v) => {
    const rawIndex = v * (total - 1);
    const dist = Math.abs(rawIndex - index);
    return Math.max(0, easeOutCubic(1 - dist * 1.2));
  });

  const opacity = useTransform(activation, (a) => INACTIVE_OPACITY + a * (1 - INACTIVE_OPACITY));
  const scale = useTransform(activation, (a) => INACTIVE_SCALE + a * (1 - INACTIVE_SCALE));
  const y = useTransform(progress, (v) => {
    const rawIndex = v * (total - 1);
    const act = Math.max(0, easeOutCubic(1 - Math.abs(rawIndex - index) * 1.2));
    return (index - rawIndex) * INACTIVE_Y_OFFSET * (1 - act);
  });
  const blur = useTransform(activation, (a) => (1 - a) * INACTIVE_BLUR);
  const filter = useTransform(blur, (b) => `blur(${b}px)`);
  const zIndex = useTransform(activation, (a) => Math.round(10 + index + a * 1000));
  const z = useTransform(activation, (a) => a * DEPTH_OFFSET);
  const borderOpacity = useTransform(activation, (a) => 0.04 + a * 0.4);
  const boxShadow = useTransform(
    borderOpacity,
    (bo) => `0 0 60px rgba(79,140,255,${bo * 0.15}), 0 25px 50px -12px rgba(0,0,0,0.5)`
  );
  const borderColor = useTransform(borderOpacity, (bo) => `rgba(79,140,255,${bo})`);

  return (
    <motion.div
      className="absolute left-0 right-0 top-1/2 -translate-y-1/2 origin-center"
      style={{
        opacity,
        scale,
        y,
        z,
        zIndex,
        filter,
        willChange: 'transform, opacity',
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-8 items-center">
        <div
          className="rounded-2xl p-6 md:p-8 backdrop-blur-xl relative"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.2)' }}>
            <X className="w-4 h-4" style={{ color: '#ef4444' }} strokeWidth={2.5} />
          </div>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <ProblemIcon className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.4)' }} />
          </div>
          <h3 className="font-semibold text-xl mb-2" style={{ color: 'rgba(255,255,255,0.75)' }}>{card.problem.title}</h3>
          <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{card.problem.text}</p>
        </div>

        <div className="flex items-center justify-center flex-shrink-0 rotate-90 md:rotate-0" style={{ color: 'rgba(255,255,255,0.25)' }}>
          <ArrowRight className="w-6 h-6 md:w-8 md:h-8" strokeWidth={2} />
        </div>

        <motion.div
          className="rounded-2xl p-6 md:p-8 backdrop-blur-xl relative"
          style={{
            background: 'rgba(79,140,255,0.08)',
            border: '1px solid transparent',
            boxShadow,
            borderColor,
          }}
        >
          <div className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.2)' }}>
            <Check className="w-4 h-4" style={{ color: '#22c55e' }} strokeWidth={2.5} />
          </div>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(79,140,255,0.2)' }}>
            <SolutionIcon className="w-6 h-6" style={{ color: '#4F8CFF' }} />
          </div>
          <h3 className="font-semibold text-xl mb-2" style={{ color: 'rgba(255,255,255,0.95)' }}>{card.solution.title}</h3>
          <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{card.solution.text}</p>
        </motion.div>
      </div>
    </motion.div>
  );
};

interface ProgressIndicatorProps {
  cards: StackedCard[];
  progress: ReturnType<typeof useSpring>;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ cards, progress }) => {
  return (
    <div
      className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 md:gap-3 pointer-events-none hidden sm:flex"
      aria-hidden
    >
      {cards.map((_, i) => (
        <ProgressDot key={i} index={i} total={cards.length} progress={progress} />
      ))}
    </div>
  );
};

interface ProgressDotProps {
  index: number;
  total: number;
  progress: ReturnType<typeof useSpring>;
}

const ProgressDot: React.FC<ProgressDotProps> = ({ index, total, progress }) => {
  const activation = useTransform(progress, (v) => {
    const rawIndex = v * (total - 1);
    const dist = Math.abs(rawIndex - index);
    return Math.max(0, 1 - dist * 1.5);
  });

  const opacity = useTransform(activation, (a) => 0.25 + a * 0.75);
  const scale = useTransform(activation, (a) => 0.7 + a * 0.5);
  const bg = useTransform(activation, (a) =>
    a > 0.5 ? 'rgba(79,140,255,0.9)' : 'rgba(255,255,255,0.2)'
  );

  return (
    <motion.div
      className="w-2 h-2 rounded-full"
      style={{
        opacity,
        scale,
        backgroundColor: bg,
        willChange: 'transform, opacity',
      }}
    />
  );
};

export default StackedScrollSection;
