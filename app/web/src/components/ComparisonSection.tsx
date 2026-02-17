'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Layers, Clock, TrendingDown, LayoutGrid, Sparkles, Zap, BarChart3, Boxes, X, Check, ArrowRight } from 'lucide-react';

const COMPARISON_ROWS = [
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
      title: 'Manual optimization & guesswork',
      text: 'Guesswork leads to wasted budget and missed opportunities.',
    },
    solution: {
      icon: BarChart3,
      title: 'Real-time AI insights with budget recommendations',
      text: 'Know what\'s working. Optimize with confidence.',
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
      text: 'Creative, execution, and optimization in one place.',
    },
  },
];

const ComparisonSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-play functionality for desktop
  useEffect(() => {
    if (isMobile || !isAutoPlaying) return;

    autoPlayRef.current = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % COMPARISON_ROWS.length);
    }, 4000);

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [isMobile, isAutoPlaying]);

  const handleSlideClick = (index: number) => {
    setActiveSlide(index);
    setIsAutoPlaying(false);
    // Resume auto-play after 10 seconds of inactivity
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
    }
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  if (isMobile) {
    return (
      <section
        id="system"
        ref={sectionRef}
        className="relative overflow-hidden section-solid comparison-section"
        style={{ background: '#121212', paddingTop: 80, paddingBottom: 80 }}
      >
        <div className="grain-overlay" />
        <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4" style={{ color: 'rgba(255,255,255,0.95)' }}>
              Modern Marketing Is Broken. SkalX Fixes It.
            </h2>
            <p className="text-base md:text-lg max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Creative, execution, and optimization — unified into one intelligent system.
            </p>
          </div>
          <div className="flex flex-col gap-8">
            {COMPARISON_ROWS.map((row, index) => {
              const ProblemIcon = row.problem.icon;
              const SolutionIcon = row.solution.icon;
              return (
                <div key={index} className="flex flex-col gap-4">
                  <div
                    className="p-6 rounded-2xl flex gap-4 relative"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.2)' }}>
                      <X className="w-3 h-3" style={{ color: '#ef4444' }} strokeWidth={2.5} />
                    </div>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <ProblemIcon className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.4)' }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base mb-1" style={{ color: 'rgba(255,255,255,0.75)' }}>{row.problem.title}</h3>
                      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{row.problem.text}</p>
                    </div>
                  </div>
                  <div className="flex justify-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    <ArrowRight className="w-6 h-6 rotate-90" strokeWidth={2} />
                  </div>
                  <div
                    className="p-6 rounded-2xl flex gap-4 relative"
                    style={{
                      background: 'rgba(79,140,255,0.08)',
                      border: '1px solid rgba(79,140,255,0.25)',
                    }}
                  >
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.2)' }}>
                      <Check className="w-3 h-3" style={{ color: '#22c55e' }} strokeWidth={2.5} />
                    </div>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(79,140,255,0.2)' }}>
                      <SolutionIcon className="w-5 h-5" style={{ color: '#4F8CFF' }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base mb-1" style={{ color: 'rgba(255,255,255,0.95)' }}>{row.solution.title}</h3>
                      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{row.solution.text}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  const currentRow = COMPARISON_ROWS[activeSlide];
  const ProblemIcon = currentRow.problem.icon;
  const SolutionIcon = currentRow.solution.icon;

  return (
    <section
      id="system"
      ref={sectionRef}
      className="relative section-solid comparison-section"
      style={{ background: '#121212', paddingTop: 100, paddingBottom: 100, overflow: 'hidden' }}
    >
      <style jsx>{`
        .comparison-container {
          position: relative;
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 1.5rem;
        }
        .comparison-slide-grid {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 40px;
          align-items: center;
          min-height: 280px;
        }
        .comparison-card {
          padding: 28px;
          border-radius: 16px;
        }
        .comparison-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(ellipse 60% 40% at 50% 50%, rgba(79,140,255,0.08) 0%, transparent 70%);
          filter: blur(100px);
        }
        .nav-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: rgba(255,255,255,0.15);
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        }
        .nav-dot:hover {
          background: rgba(255,255,255,0.3);
        }
        .nav-dot.active {
          background: #4F8CFF;
        }
        .nav-dot.active::after {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid rgba(79,140,255,0.4);
        }
        .nav-label {
          position: absolute;
          top: 24px;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          opacity: 0;
          transition: opacity 0.2s ease;
          pointer-events: none;
        }
        .nav-dot:hover .nav-label,
        .nav-dot.active .nav-label {
          opacity: 1;
        }
        .nav-dot.active .nav-label {
          color: rgba(79,140,255,0.9);
        }
        .progress-bar {
          position: absolute;
          bottom: -2px;
          left: 0;
          height: 2px;
          background: rgba(79,140,255,0.6);
          border-radius: 2px;
          transition: width 0.1s linear;
        }
        @keyframes progressFill {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
      <div className="grain-overlay" />
      <div className="comparison-glow" />

      <div className="comparison-container">
        {/* Header */}
        <div className="text-center mb-16">
          <h2
            className="text-3xl md:text-4xl leading-tight mb-3"
            style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 200 }}
          >
            Modern Marketing Is Broken. SkalX Fixes It.
          </h2>
          <p
            className="text-base md:text-lg max-w-2xl mx-auto"
            style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 300 }}
          >
            Creative, execution, and optimization — unified into one intelligent system.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center gap-8 mb-12">
          {COMPARISON_ROWS.map((row, index) => (
            <button
              key={index}
              onClick={() => handleSlideClick(index)}
              className={`nav-dot ${activeSlide === index ? 'active' : ''}`}
              aria-label={`View ${row.problem.title}`}
            >
              <span className="nav-label">{row.problem.title}</span>
            </button>
          ))}
        </div>

        {/* Comparison Cards */}
        <div className="comparison-slide-grid">
          <div
            className="comparison-card relative"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              transform: 'translateX(0)',
              opacity: 1,
              transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            key={`problem-${activeSlide}`}
          >
            <div className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.2)' }}>
              <X className="w-4 h-4" style={{ color: '#ef4444' }} strokeWidth={2.5} />
            </div>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 mb-4"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <ProblemIcon className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.4)' }} />
            </div>
            <h3 className="font-semibold text-xl mb-2" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {currentRow.problem.title}
            </h3>
            <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {currentRow.problem.text}
            </p>
          </div>

          <div className="flex items-center justify-center flex-shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>
            <ArrowRight className="w-8 h-8" strokeWidth={2} />
          </div>

          <div
            className="comparison-card relative"
            style={{
              background: 'rgba(79,140,255,0.08)',
              border: '1px solid rgba(79,140,255,0.25)',
              boxShadow: '0 0 40px rgba(79,140,255,0.15)',
              transform: 'translateX(0)',
              opacity: 1,
              transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            key={`solution-${activeSlide}`}
          >
            <div className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,197,94,0.2)' }}>
              <Check className="w-4 h-4" style={{ color: '#22c55e' }} strokeWidth={2.5} />
            </div>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 mb-4"
              style={{ background: 'rgba(79,140,255,0.2)' }}
            >
              <SolutionIcon className="w-6 h-6" style={{ color: '#4F8CFF' }} />
            </div>
            <h3 className="font-semibold text-xl mb-2" style={{ color: 'rgba(255,255,255,0.95)' }}>
              {currentRow.solution.title}
            </h3>
            <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {currentRow.solution.text}
            </p>
          </div>
        </div>

        {/* Auto-play indicator */}
        <div className="flex justify-center mt-8">
          <div className="relative" style={{ width: 120, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
            {isAutoPlaying && (
              <div
                className="progress-bar"
                style={{
                  width: '100%',
                  animation: 'progressFill 4s linear infinite',
                }}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ComparisonSection;
