'use client';

import React, { useState, useRef, useEffect, memo } from 'react';
import Image from 'next/image';
import colors from '@/lib/ui/colors';
import { useScrollAnimation } from '../hooks/use-scroll-animation';

type CarouselMediaItem = { type: 'image'; src: string } | { type: 'video'; src: string };

const AD_CREATIVE_IMAGES = [
  '/images/partners/download__5_-2d306f55-d9c8-4c5b-acbd-5b6812d25c56.png',
  '/images/partners/jimmys-cocktails-green-apple-martini.png',
  '/images/partners/download__2_-df378dbd-3706-431d-bbfd-8f2286e45de1.png',
  '/images/partners/plum-cc332b6e-16f6-42a6-937c-cca1d9a11816.png',
  '/images/partners/eaa4a0c4-064b-487b-8d58-a28b77d2a015_1763752969200_gen-b7af8568-d936-4c20-a335-9a90a4f28709.png',
  '/images/partners/download_dark_choco-b1dee636-d24e-4528-840a-9cee4a332923.png',
  '/images/partners/download__23_-5bb7c097-7ed8-4e26-9f09-b2c3c0dab73f.png',
  '/images/partners/download__24_-f934ff9b-83a1-48c1-a07b-1bdd9ceb13a9.png',
  '/images/partners/download__8_-acc0be34-f324-4ae1-a42b-803835bca987.png',
  '/images/partners/wild_date-a0935436-0c67-4d06-a04a-92172fdb7fd9.png',
  '/images/partners/download__10_-0c8442ce-4905-42ec-a447-17f470161620.png',
  '/images/partners/bombay-shaving-legend-365.png',
  '/images/partners/boat-stone-350-deadpool.png',
];

const AD_CREATIVE_VIDEOS: string[] = [
  '/videos/1772472492670_video.mp4',
  '/videos/1772472655830_video.mp4',
  '/videos/1772472814538_video.mp4',
  '/videos/1772472925195_video.mp4',
  '/videos/Bike%20ad%20test.mp4',
  '/videos/download%20(4).mp4',
  '/videos/video-video_1770977065725_f0zb0n7nw.mp4',
  '/videos/video-video_1771484100449_crs2lp30d.mp4',
  '/videos/1772519732573_video%20(1).mp4',
];

function interleaveMedia(images: string[], videos: string[]): CarouselMediaItem[] {
  const result: CarouselMediaItem[] = [];
  const maxLen = Math.max(images.length, videos.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < images.length) result.push({ type: 'image', src: images[i] });
    if (i < videos.length) result.push({ type: 'video', src: videos[i] });
  }
  return result;
}

const AD_CREATIVE_MEDIA: CarouselMediaItem[] = interleaveMedia(
  AD_CREATIVE_IMAGES,
  AD_CREATIVE_VIDEOS
);

const LazyVideo = memo(function LazyVideo({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(false);

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
      autoPlay={isVisible}
      preload="none"
      className="absolute inset-0 w-full h-full object-cover"
      aria-label={label}
    />
  );
});

/**
 * Extracted from Hero — same assets, lazy video, and CSS scroll animation.
 * Mounted once on the homepage as the creative proof section.
 */
const CreativeShowcase: React.FC = () => {
  const { elementRef, isVisible } = useScrollAnimation({ threshold: 0.1 });

  return (
    <section
      id="showcase"
      className="py-16 md:py-24 relative overflow-hidden section-solid"
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
          animation: adCarouselScroll 45s linear infinite;
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
            From product to campaign-ready creative.
          </h2>
          <p className="text-lg font-extralight" style={{ color: colors.mutedForeground }}>
            Create personalized marketing content across products, formats, and campaigns.
          </p>
        </div>

        <div className="relative overflow-hidden -mx-4 sm:mx-0">
          <div className="showcase-ad-carousel-track flex gap-4 w-max" style={{ width: 'max-content' }}>
            {[...AD_CREATIVE_MEDIA, ...AD_CREATIVE_MEDIA].map((item, index) => (
              <div
                key={index}
                className="flex-shrink-0 w-[220px] sm:w-[260px] md:w-[280px] rounded-[16px] overflow-hidden"
                style={{
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 4px 12px hsl(0 0% 0% / 0.3)',
                }}
              >
                <div className="relative aspect-[3/4] w-full">
                  {item.type === 'image' ? (
                    <Image
                      src={item.src}
                      alt={`SkalX creative ${(index % AD_CREATIVE_MEDIA.length) + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 220px, (max-width: 768px) 260px, 280px"
                    />
                  ) : (
                    <LazyVideo
                      src={item.src}
                      label={`SkalX creative video ${(index % AD_CREATIVE_MEDIA.length) + 1}`}
                    />
                  )}
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
