'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { User, Store, Users } from 'lucide-react';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '@/lib/ui/colors';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from './ui/carousel';

const BUILT_FOR_CARDS = [
  { icon: User, title: 'Solo Founders', desc: 'Run and optimize ads without hiring a full team.' },
  { icon: Store, title: 'D2C Brands', desc: 'Scale creatives and campaigns efficiently across channels.' },
  { icon: Users, title: 'In-House Marketing Teams', desc: 'Move faster with automation and AI-driven insights.' },
];

const AUTO_PLAY_INTERVAL = 5000;

const BuiltFor: React.FC = () => {
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const { elementRef: titleRef, isVisible: titleVisible } = useScrollAnimation();
  const { elementRef: cardsRef, isVisible: cardsVisible } = useScrollAnimation({ threshold: 0.1 });

  const scrollTo = useCallback((index: number) => {
    api?.scrollTo(index);
    setCurrent(index);
  }, [api]);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api]);

  useEffect(() => {
    if (!api || !cardsVisible || isPaused) return;
    const timer = setInterval(() => {
      const next = (api.selectedScrollSnap() + 1) % BUILT_FOR_CARDS.length;
      api.scrollTo(next);
    }, AUTO_PLAY_INTERVAL);
    return () => clearInterval(timer);
  }, [api, cardsVisible, isPaused]);

  return (
    <section className="py-24 relative overflow-hidden section-solid">
      <div className="grain-overlay" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          ref={titleRef}
          className="text-center mb-16 transition-all duration-700"
          style={{ opacity: titleVisible ? 1 : 0, transform: titleVisible ? 'translateY(0)' : 'translateY(20px)', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <h2 className="text-4xl md:text-5xl font-bold leading-tight" style={{ color: colors.foreground }}>
            Built for Growing Brands
          </h2>
        </div>

        <div ref={cardsRef} className="max-w-5xl mx-auto mb-12">
          <Carousel
            setApi={setApi}
            opts={{ loop: true, align: 'center' }}
            className="w-full"
          >
            <CarouselContent className="-ml-4 md:-ml-6">
              {BUILT_FOR_CARDS.map((card, index) => {
                const Icon = card.icon;
                return (
                  <CarouselItem key={index} className="pl-4 md:pl-6 basis-full">
                    <div
                      className="p-8 rounded-[20px] transition-all duration-500 h-full w-full max-w-md mx-auto"
                      onMouseEnter={() => setIsPaused(true)}
                      onMouseLeave={() => setIsPaused(false)}
                      style={{
                        opacity: cardsVisible ? 1 : 0,
                        transform: cardsVisible ? 'translateY(0)' : 'translateY(20px)',
                        transitionDelay: cardsVisible ? `${index * 100}ms` : '0ms',
                        background: 'hsl(0 0% 15% / 0.5)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = cardsVisible ? 'translateY(0)' : 'translateY(20px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                      }}
                    >
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ backgroundColor: 'hsl(213 100% 55% / 0.12)' }}>
                        <Icon className="h-6 w-6" style={{ color: colors.primary }} />
                      </div>
                      <h3 className="text-xl font-semibold mb-3" style={{ color: colors.foreground }}>{card.title}</h3>
                      <p className="leading-relaxed" style={{ color: colors.mutedForeground }}>{card.desc}</p>
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex -left-4 lg:-left-12" />
            <CarouselNext className="hidden md:flex -right-4 lg:-right-12" />
          </Carousel>

          {/* Dot indicators */}
          <div className="flex justify-center gap-2 mt-6">
            {BUILT_FOR_CARDS.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollTo(index)}
                className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                style={{
                  background: current === index ? colors.primary : 'rgba(255,255,255,0.2)',
                  transform: current === index ? 'scale(1.2)' : 'scale(1)',
                }}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="text-center">
          <Link href="/use-cases" className="text-lg font-medium" style={{ color: colors.primary }}>Explore Use Cases →</Link>
        </div>
      </div>
    </section>
  );
};

export default BuiltFor;
