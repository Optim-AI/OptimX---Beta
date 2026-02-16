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

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) return;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const section = sectionRef.current;
        if (!section) return;

        const rect = section.getBoundingClientRect();
        const scrollHeight = section.offsetHeight;
        const viewportHeight = window.innerHeight;

        if (rect.top > viewportHeight || rect.bottom < 0) return;

        const scrollableDistance = scrollHeight - viewportHeight;
        if (scrollableDistance <= 0) {
          setActiveSlide(0);
          return;
        }

        const scrolled = -rect.top;
        const progress = Math.max(0, Math.min(1, scrolled / scrollableDistance));
        const segment = Math.floor(progress * 4);
        const slideIndex = Math.min(segment, 3);
        setActiveSlide((prev) => (prev !== slideIndex ? slideIndex : prev));
      });
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isMobile]);

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

  return (
    <section
      id="system"
      ref={sectionRef}
      className="relative section-solid comparison-section"
      style={{ height: '400vh', background: '#121212', overflow: 'visible' }}
    >
      <style jsx>{`
        .comparison-sticky {
          position: sticky;
          top: 0;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 1.5rem;
          overflow: hidden;
        }
        .comparison-slide {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 1.5rem;
          pointer-events: none;
        }
        .comparison-slide.active {
          pointer-events: auto;
        }
        .comparison-slide-grid {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 40px;
          align-items: center;
          max-width: 1100px;
          width: 100%;
        }
        .comparison-card {
          padding: 28px;
          border-radius: 16px;
          will-change: transform, opacity;
        }
        .comparison-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.5s ease-out;
        }
        .comparison-slide.active .comparison-glow {
          opacity: 1;
        }
        .progress-track {
          position: absolute;
          left: 24px;
          top: 50%;
          transform: translateY(-50%);
          width: 2px;
          height: 80px;
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
          overflow: hidden;
        }
        .progress-fill {
          width: 100%;
          height: 0%;
          background: rgba(79,140,255,0.6);
          border-radius: 2px;
          transition: height 0.2s ease-out;
        }
        @media (max-width: 767px) {
          .progress-track { display: none; }
        }
      `}</style>
      <div className="grain-overlay" />

      <div className="comparison-sticky">
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ height: `${((activeSlide + 0.25) / 4) * 100}%` }}
          />
        </div>
        {COMPARISON_ROWS.map((row, index) => {
          const ProblemIcon = row.problem.icon;
          const SolutionIcon = row.solution.icon;
          const isActive = activeSlide === index;

          return (
            <div
              key={index}
              className={`comparison-slide ${isActive ? 'active' : ''}`}
              style={{
                opacity: isActive ? 1 : 0,
                transition: 'opacity 0.4s ease-out',
              }}
            >
              <div
                className="comparison-glow"
                style={{
                  background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(79,140,255,0.08) 0%, transparent 70%)',
                  filter: 'blur(100px)',
                }}
              />
              <div className="comparison-slide-grid">
                <div
                  className="comparison-card relative"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    transform: isActive ? 'translateX(0)' : 'translateX(-30px)',
                    opacity: isActive ? 1 : 0,
                    transition: 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.7s ease-out',
                  }}
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
                    {row.problem.title}
                  </h3>
                  <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {row.problem.text}
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
                    transform: isActive ? 'translateX(0)' : 'translateX(30px)',
                    opacity: isActive ? 1 : 0,
                    transition: 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.7s ease-out',
                  }}
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
                    {row.solution.title}
                  </h3>
                  <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {row.solution.text}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div
          className="absolute left-0 right-0 text-center px-4"
          style={{
            top: '12vh',
            pointerEvents: 'none',
          }}
        >
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
      </div>
    </section>
  );
};

export default ComparisonSection;
