'use client';

import React from 'react';
import Image from 'next/image';
import colors from '@/lib/ui/colors';
import { useScrollAnimation } from '../hooks/use-scroll-animation';

/**
 * Sample work — fictional brands only. Never real client or third-party brand work.
 * Files live in /public/images/samples (see README there for required sizes).
 */
type Sample = {
  src: string;
  format: 'Feed 4:5' | 'Story 9:16' | 'Video 9:16';
  alt: string;
};

const SAMPLES: Sample[] = [
  { src: '/images/samples/sample-feed-01.png', format: 'Feed 4:5', alt: 'Sample feed ad for a fictional snack brand' },
  { src: '/images/samples/sample-story-01.png', format: 'Story 9:16', alt: 'Sample story ad for a fictional brand' },
  { src: '/images/samples/sample-feed-02.png', format: 'Feed 4:5', alt: 'Sample feed ad for a fictional beverage brand' },
  { src: '/images/samples/sample-video-01.png', format: 'Video 9:16', alt: 'Frame from a sample video ad for a fictional brand' },
  { src: '/images/samples/sample-feed-03.png', format: 'Feed 4:5', alt: 'Sample feed ad for a fictional skincare brand' },
  { src: '/images/samples/sample-story-02.png', format: 'Story 9:16', alt: 'Sample story ad for a fictional brand' },
  { src: '/images/samples/sample-feed-04.png', format: 'Feed 4:5', alt: 'Sample feed ad for a fictional personal-care brand' },
];

const CreativeShowcase: React.FC = () => {
  const { elementRef, isVisible } = useScrollAnimation({ threshold: 0.1 });

  return (
    <section
      id="showcase"
      className="py-16 md:py-24 relative overflow-hidden section-solid"
      style={{ backgroundColor: '#121212' }}
    >
      {/* Hero "See what you get" target until the Phase 2 deliverables section lands. */}
      <span id="what-you-get" className="absolute top-0 left-0" aria-hidden />
      <div
        ref={elementRef}
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div className="text-center mb-10 max-w-2xl mx-auto">
          <h2
            className="text-3xl md:text-[40px] font-normal leading-tight mb-4"
            style={{ color: colors.foreground }}
          >
            Sample work
          </h2>
          <p className="text-lg font-extralight" style={{ color: colors.mutedForeground }}>
            Feed ads, story ads and short video ads, made from product photos.
          </p>
        </div>

        <ul
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 items-end"
          aria-label="Sample creatives for fictional brands"
        >
          {SAMPLES.map((item) => {
            const tall = item.format !== 'Feed 4:5';
            return (
              <li key={item.src} className="flex-shrink-0 snap-start">
                <figure className="m-0">
                  <div
                    className={`relative rounded-[16px] overflow-hidden ${
                      tall ? 'w-[180px] sm:w-[200px] aspect-[9/16]' : 'w-[220px] sm:w-[260px] aspect-[4/5]'
                    }`}
                    style={{
                      border: '1px solid rgba(255,255,255,0.08)',
                      boxShadow: '0 4px 12px hsl(0 0% 0% / 0.3)',
                    }}
                  >
                    <Image
                      src={item.src}
                      alt={item.alt}
                      fill
                      loading="lazy"
                      className="object-cover"
                      sizes={tall ? '200px' : '(max-width: 640px) 220px, 260px'}
                    />
                  </div>
                  <figcaption className="mt-2 text-xs" style={{ color: colors.mutedForeground }}>
                    {item.format}
                  </figcaption>
                </figure>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-sm text-center" style={{ color: colors.mutedForeground }}>
          Sample work for fictional brands. Not client campaigns.
        </p>
      </div>
    </section>
  );
};

export default CreativeShowcase;
