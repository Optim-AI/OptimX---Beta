'use client';

import React from 'react';
import { Layers, Clock, TrendingDown, LayoutGrid, Sparkles, Zap, BarChart3, Boxes } from 'lucide-react';
import StackedScrollSection, { type StackedCard } from './StackedScrollSection';

const CARDS: StackedCard[] = [
  {
    problem: {
      icon: Layers,
      title: 'Creative bottlenecks',
      text: 'Producing consistent, high-quality ads takes time and resources.',
    },
    solution: {
      icon: Sparkles,
      title: 'AI generates high-converting creatives instantly',
      text: 'From your brand and products — no design bottlenecks.',
    },
  },
  {
    problem: {
      icon: Clock,
      title: 'Slow campaign launches',
      text: 'Coordination delays prevent fast experimentation.',
    },
    solution: {
      icon: Zap,
      title: 'Launch across Meta, Google, LinkedIn in minutes',
      text: 'One workflow. Multiple platforms. No handoffs.',
    },
  },
  {
    problem: {
      icon: TrendingDown,
      title: 'Manual Optimisation & guesswork',
      text: 'Guesswork leads to wasted budget and missed opportunities.',
    },
    solution: {
      icon: BarChart3,
      title: 'Real-time AI insights with budget recommendations',
      text: 'Know what\'s working. Optimise with confidence.',
    },
  },
  {
    problem: {
      icon: LayoutGrid,
      title: 'Fragmented tools & platform switching',
      text: 'Switching between platforms creates inefficiency.',
    },
    solution: {
      icon: Boxes,
      title: 'One unified system for creative, execution, and analytics',
      text: 'Creative, execution, and Optimisation in one place.',
    },
  },
];

const ComparisonSection: React.FC = () => {
  return (
    <section id="system" className="relative section-solid" style={{ background: '#121212', overflow: 'visible' }}>
      <div className="grain-overlay" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(79,140,255,0.08) 0%, transparent 70%)',
          filter: 'blur(100px)',
        }}
      />
      <div className="relative pt-16 pb-8">
        <div className="text-center mb-12 px-6">
          <h2
            className="text-3xl md:text-4xl leading-tight mb-3"
            style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 200 }}
          >
            Modern Marketing Is Broken. SkalX Fixes It.
          </h2>
          <p
            className="text-base md:text-lg max-w-2xl mx-auto"
            style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 300, marginBottom: 0 }}
          >
            Creative, execution, and optimisation unified into one intelligent system.
          </p>
        </div>
        <StackedScrollSection cards={CARDS} />
      </div>
    </section>
  );
};

export default ComparisonSection;
