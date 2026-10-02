'use client';

import React, { useState, useRef, useEffect, memo } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import colors from '@/lib/ui/colors';
import { useScrollAnimation } from '../hooks/use-scroll-animation';

type CarouselMediaItem =
  | { type: 'image'; src: string; label: string }
  | { type: 'video'; src: string; label: string };

const GALLERY: CarouselMediaItem[] = [
  {
    type: 'image',
    src: '/images/partners/boat-stone-350-deadpool.png',
    label: 'Poster',
  },
  {
    type: 'video',
    src: '/videos/1772472492670_video.mp4',
    label: 'AI video',
  },
  {
    type: 'image',
    src: '/images/partners/jimmys-cocktails-green-apple-martini.png',
    label: 'Social creative',
  },
  {
    type: 'video',
    src: '/videos/1772472655830_video.mp4',
    label: 'AI video',
  },
  {
    type: 'image',
    src: '/images/partners/plum-cc332b6e-16f6-42a6-937c-cca1d9a11816.png',
    label: 'Product ad',
  },
  {
    type: 'image',
    src: '/images/partners/bombay-shaving-legend-365.png',
    label: 'Poster',
  },
  {
    type: 'video',
    src: '/videos/1772472814538_video.mp4',
    label: 'AI video',
  },
  {
    type: 'image',
    src: '/images/partners/wild_date-a0935436-0c67-4d06-a04a-92172fdb7fd9.png',
    label: 'Social creative',
  },
  {
    type: 'image',
    src: '/images/partners/download_dark_choco-b1dee636-d24e-4528-840a-9cee4a332923.png',
    label: 'Product ad',
  },
];

const LazyVideo = memo(function LazyVideo({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={isVisible ? src : undefined}
      muted
      loop
      playsInline
      autoPlay={isVisible && !reduceMotion}
      preload="none"
      className="absolute inset-0 w-full h-full object-cover"
      aria-label={label}
    />
  );
});

/**
 * Compact gallery of real SkalX-supported outputs.
 */
const CreativeShowcase: React.FC = () => {
  const { elementRef, isVisible } = useScrollAnimation({ threshold: 0.1 });
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="showcase"
      className="py-14 md:py-20 relative overflow-hidden"
      style={{ backgroundColor: '#121212' }}
    >
      <style jsx>{`
        @keyframes adCarouselScroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .showcase-ad-carousel-track {
          animation: adCarouselScroll 42s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .showcase-ad-carousel-track {
            animation: none;
          }
        }
      `}</style>

      <div
        ref={elementRef}
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10"
      >
        <motion.div
          className="text-center mb-8 max-w-lg mx-auto"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={isVisible || reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <p
            className="text-xs uppercase tracking-[0.2em] mb-3"
            style={{ color: colors.primary }}
          >
            What you can create
          </p>
          <h2
            className="text-3xl md:text-4xl font-normal leading-tight"
            style={{ color: colors.foreground }}
          >
            Posters. Social. Video.
          </h2>
        </motion.div>

        <div className="relative overflow-hidden -mx-4 sm:mx-0">
          <div className="showcase-ad-carousel-track flex gap-3 sm:gap-4 w-max">
            {[...GALLERY, ...GALLERY].map((item, index) => (
              <div
                key={`${item.src}-${index}`}
                className="group flex-shrink-0 w-[160px] sm:w-[200px] md:w-[220px] rounded-2xl overflow-hidden transition-transform duration-300 hover:-translate-y-1"
                style={{
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 8px 24px hsl(0 0% 0% / 0.35)',
                }}
              >
                <div className="relative aspect-[3/4] w-full">
                  {item.type === 'image' ? (
                    <Image
                      src={item.src}
                      alt={`SkalX ${item.label}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 160px, 220px"
                    />
                  ) : (
                    <LazyVideo src={item.src} label={`SkalX ${item.label}`} />
                  )}
                  <span
                    className="absolute left-2 bottom-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md"
                    style={{
                      background: 'rgba(0,0,0,0.6)',
                      color: colors.foreground,
                      backdropFilter: 'blur(6px)',
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CreativeShowcase;
