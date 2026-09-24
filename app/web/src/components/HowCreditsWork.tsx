'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useScrollAnimation } from '../hooks/use-scroll-animation';

const STEPS = [
  {
    id: '01',
    title: 'Tell us about your brand',
    desc: 'Share your website or a product image. SkalX starts from your real brand — not a blank template.',
  },
  {
    id: '02',
    title: 'SkalX understands your brand',
    desc: 'We map your offering, visual style, colors, and tone so every creative stays on-brand.',
  },
  {
    id: '03',
    title: 'Create personalized creatives',
    desc: 'Generate posters, ad creatives, and videos tailored to your product and brand language.',
  },
  {
    id: '04',
    title: 'Launch your campaigns',
    desc: 'Turn concepts into campaign-ready assets and move from brief to launch inside SkalX.',
  },
  {
    id: '05',
    title: 'Learn and optimize',
    desc: 'Use insights and recommendations to refine what you create next.',
  },
];

const HowCreditsWork: React.FC = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLElement | null>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { elementRef, isVisible } = useScrollAnimation({ threshold: 0.1 });

  useEffect(() => {
    const handleScroll = () => {
      const el = sectionRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const winH = window.innerHeight;
      const vp60 = winH * 0.6;

      if (rect.top > winH) {
        setScrollProgress(0);
        setActiveStep(0);
        return;
      }
      if (rect.bottom < 0) {
        setScrollProgress(1);
        setActiveStep(STEPS.length - 1);
        return;
      }

      const sectionH = rect.height;
      const scrollable = Math.max(0, -rect.top);
      const progress = Math.min(1, scrollable / (sectionH * 0.85));
      setScrollProgress(progress);

      let active = 0;
      for (let i = 0; i < stepRefs.current.length; i++) {
        const stepEl = stepRefs.current[i];
        if (stepEl) {
          const stepRect = stepEl.getBoundingClientRect();
          if (stepRect.top <= vp60) active = i;
        }
      }
      setActiveStep(active);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section
      id="how-it-works"
      ref={(n) => { (sectionRef as React.MutableRefObject<HTMLElement | null>).current = n; }}
      className="relative overflow-hidden section-solid"
      style={{ background: '#121212' }}
    >
      <style jsx>{`
        .flow-grain::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          z-index: 0;
        }
        .step-block {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 100px;
          align-items: center;
          min-height: 420px;
          padding: 100px 0;
        }
        @media (max-width: 1023px) {
          .step-block {
            grid-template-columns: 1fr;
            gap: 48px;
            min-height: auto;
            padding: 60px 0;
          }
        }
        .step-content { display: flex; flex-direction: column; gap: 16px; }
        .step-block:hover .step-visual {
          opacity: 0.85 !important;
          transform: scale(1.02) translateY(-6px);
        }
      `}</style>

      <div
        className="absolute pointer-events-none"
        style={{
          inset: 0,
          background: 'radial-gradient(ellipse 70% 80% at 50% 50%, hsl(213 100% 50% / 0.08) 0%, transparent 70%)',
          filter: 'blur(80px)',
          zIndex: 0,
        }}
      />
      <div className="flow-grain absolute inset-0 z-[1]" />

      <div
        ref={elementRef}
        className="relative z-10"
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '0 1.5rem',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div className="text-center" style={{ paddingTop: 140, paddingBottom: 80 }}>
          <h2 className="text-4xl md:text-[46px] font-normal leading-tight mb-4" style={{ color: 'rgba(255,255,255,0.95)' }}>
            How It Works
          </h2>
          <p className="text-xl max-w-xl mx-auto font-extralight" style={{ color: 'rgba(255,255,255,0.5)' }}>
            From brand understanding to campaign-ready creatives.
          </p>
        </div>

        {/* Timeline wrapper with vertical line */}
        <div className="relative">
          {/* Base line */}
          <div
            className="hidden lg:block absolute left-[48px] top-0 bottom-0 w-[2px] rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          />
          {/* Progress line (scroll gradient) */}
          <div
            className="hidden lg:block absolute left-[48px] top-0 w-[2px] rounded-full transition-[height] duration-50 ease-out"
            style={{
              height: `${scrollProgress * 100}%`,
              background: 'linear-gradient(to bottom, #4F8CFF, #7B5CFF, #FF4FD8)',
            }}
          />

          {STEPS.map((step, i) => (
            <div
              key={step.id}
              ref={(n) => { stepRefs.current[i] = n; }}
              className="step-block"
            >
              {/* LEFT: Text content */}
              <div className="relative">
                <div
                  className="step-content lg:pl-16"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateY(0)' : 'translateY(16px)',
                    transition: 'opacity 0.5s ease, transform 0.5s ease',
                    transitionDelay: isVisible ? `${i * 100}ms` : '0ms',
                  }}
                >
                  <div
                    className="text-4xl font-bold transition-colors duration-300"
                    style={{
                      color: activeStep === i ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.28)',
                      lineHeight: 1.1,
                    }}
                  >
                    {step.id}
                  </div>
                  <div
                    className="step-title text-xl font-semibold transition-all duration-300"
                    style={{ color: activeStep === i ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.85)' }}
                  >
                    {step.title}
                  </div>
                  <p
                    className="text-base leading-relaxed transition-opacity duration-300"
                    style={{ color: 'rgba(255,255,255,0.65)', opacity: activeStep === i ? 1 : 0.85 }}
                  >
                    {step.desc}
                  </p>
                </div>
              </div>

              {/* RIGHT: Visual card */}
              <div
                className="step-visual rounded-2xl p-6 lg:ml-auto transition-all duration-300"
                style={{
                  maxWidth: 420,
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 16,
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.05) inset, 0 30px 80px rgba(0,0,0,0.6)',
                  opacity: activeStep === i ? 0.85 : 0.6,
                  transform: activeStep === i ? 'scale(1.02) translateY(-6px)' : 'scale(1) translateY(0)',
                }}
              >
                {i === 0 && (
                  <>
                    <div className="flex gap-1.5 mb-4">
                      <div className="w-3 h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
                      <div className="w-3 h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
                      <div className="w-3 h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
                    </div>
                    <div
                      className="h-10 rounded-lg flex items-center px-3 gap-2"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>https://</span>
                      <span className="inline-block w-2 h-4 animate-pulse" style={{ background: 'rgba(255,255,255,0.7)' }} />
                    </div>
                    <div className="mt-4 flex gap-2">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="h-16 flex-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }} />
                      ))}
                    </div>
                  </>
                )}
                {i === 1 && (
                  <>
                    <div className="text-xs mb-3 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      Brand profile
                    </div>
                    <div className="flex gap-2 mb-4">
                      {['#4F8CFF', '#E8E8E8', '#1A1A1A', '#F5C542'].map((c) => (
                        <div
                          key={c}
                          className="h-8 w-8 rounded-full"
                          style={{ background: c, border: '1px solid rgba(255,255,255,0.12)' }}
                        />
                      ))}
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 rounded w-2/3" style={{ background: 'rgba(255,255,255,0.12)' }} />
                      <div className="h-3 rounded w-1/2" style={{ background: 'rgba(255,255,255,0.08)' }} />
                      <div className="h-3 rounded w-3/4" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    </div>
                  </>
                )}
                {i === 2 && (
                  <div className="relative aspect-[3/4] max-w-[200px] mx-auto rounded-xl overflow-hidden"
                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/partners/plum-cc332b6e-16f6-42a6-937c-cca1d9a11816.png"
                      alt="Sample personalized creative"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                )}
                {i === 3 && (
                  <>
                    <div
                      className="h-12 rounded-lg mb-4 flex items-center justify-center gap-2"
                      style={{ background: 'rgba(79,140,255,0.15)', border: '1px solid rgba(79,140,255,0.25)' }}
                    >
                      <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                        Campaign ready
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-8 rounded flex items-center px-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>Poster set</span>
                      </div>
                      <div className="h-8 rounded flex items-center px-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>Ad creative</span>
                      </div>
                      <div className="h-8 rounded flex items-center px-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>Video concept</span>
                      </div>
                    </div>
                  </>
                )}
                {i === 4 && (
                  <>
                    <div className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Insights
                    </div>
                    <div className="space-y-2 mb-3">
                      <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>
                          Strongest visual direction for this brand
                        </div>
                      </div>
                      <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>
                          Next creative angle to test
                        </div>
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-2 rounded-lg p-2"
                      style={{ background: 'rgba(79,140,255,0.12)', border: '1px solid rgba(79,140,255,0.2)' }}
                    >
                      <span className="text-xs" style={{ color: '#4F8CFF' }}>◆</span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        Refine and generate the next set
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ height: 140 }} />
      </div>
    </section>
  );
};

export default HowCreditsWork;
