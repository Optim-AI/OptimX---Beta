'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { ArrowRight, Play } from 'lucide-react';
import { STARTING_PRICE } from '@/lib/marketing/content';
import StartForm from './StartForm';
import { Eyebrow, PhoneFrame } from './ui';

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <figcaption className="mt-2.5 whitespace-nowrap text-center text-[9.5px] font-medium uppercase tracking-[0.06em] text-ink-mute sm:text-xs sm:tracking-[0.12em]">
      {children}
    </figcaption>
  );
}

/**
 * One product photo → feed ad, story ad and a video frame, laid out on a framed "proof board".
 * The board tilts slightly toward the pointer (fine pointers only, off under reduced motion).
 */
function HeroVisual() {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--ry', `${(x * 6).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
  };
  const onLeave = () => {
    ref.current?.style.setProperty('--ry', '0deg');
    ref.current?.style.setProperty('--rx', '0deg');
  };

  return (
    <div className="relative" onPointerMove={onMove} onPointerLeave={onLeave}>
      {/* Soft accent glow behind the board. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -inset-y-8 -z-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_60%_50%,rgba(29,78,216,0.16),transparent_70%)]"
      />
      <div ref={ref} className="sx-tilt sx-crop rounded-[26px] border border-line bg-surface/90 p-3 shadow-[0_40px_80px_-48px_rgba(23,20,15,0.55)] sm:p-5">
        <div aria-hidden className="mb-4 flex items-center justify-between px-1">
          <span className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ink/15" />
            <span className="h-2 w-2 rounded-full bg-ink/15" />
            <span className="sx-pulse h-2 w-2 rounded-full bg-accent" />
          </span>
          <span className="h-1.5 w-20 rounded-full bg-ink/10" />
        </div>
        <div className="flex items-end gap-2 sm:gap-3">
          <figure className="sx-depth m-0 w-[29%]" style={{ '--z': '10px' } as React.CSSProperties}>
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-line bg-paper">
              <Image
                src="/images/samples/hero-before.png"
                alt="Plain product photo of a fictional snack pouch"
                fill
                priority
                sizes="(max-width: 768px) 30vw, 220px"
                className="object-cover"
              />
              <span
                aria-hidden
                className="sx-hero-scan pointer-events-none absolute inset-x-0 top-0 h-full bg-gradient-to-b from-transparent via-accent/25 to-transparent"
              />
            </div>
            <Caption>Your photo</Caption>
          </figure>

          <span aria-hidden className="mb-12 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-paper sm:mb-14">
            <ArrowRight className="h-3.5 w-3.5" />
          </span>

          <figure className="sx-hero-out sx-depth m-0 w-[27%]" style={{ animationDelay: '0.9s', '--z': '40px' } as React.CSSProperties}>
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl shadow-[0_18px_40px_-20px_rgba(23,20,15,0.5)]">
              <Image
                src="/images/samples/hero-feed.png"
                alt="Feed ad (4:5) made from the product photo"
                fill
                priority
                sizes="(max-width: 768px) 27vw, 200px"
                className="object-cover"
              />
            </div>
            <Caption>Feed 4:5</Caption>
          </figure>

          <figure className="sx-hero-out sx-depth m-0 w-[19%]" style={{ animationDelay: '1.05s', '--z': '60px' } as React.CSSProperties}>
            <PhoneFrame>
              <Image
                src="/images/samples/hero-story.png"
                alt="Story ad (9:16) made from the product photo"
                fill
                priority
                sizes="(max-width: 768px) 19vw, 140px"
                className="object-cover"
              />
            </PhoneFrame>
            <Caption>Story 9:16</Caption>
          </figure>

          <figure className="sx-hero-out sx-depth m-0 w-[19%]" style={{ animationDelay: '1.2s', '--z': '80px' } as React.CSSProperties}>
            <PhoneFrame>
              <Image
                src="/images/samples/hero-video-frame.png"
                alt="Frame from a 15-second video ad made from the product photo"
                fill
                priority
                sizes="(max-width: 768px) 19vw, 140px"
                className="object-cover"
              />
              <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-ink/80 px-1.5 py-0.5 text-[10px] font-medium text-paper">
                <Play aria-hidden className="h-2.5 w-2.5 fill-current" /> 0:15
              </span>
            </PhoneFrame>
            <Caption>Video 15s</Caption>
          </figure>
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-ink-mute md:text-left">Illustration for a fictional brand.</p>
    </div>
  );
}

export default function HeroSection() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div aria-hidden className="sx-grid-bg pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto grid max-w-6xl gap-x-12 gap-y-10 px-4 pb-20 pt-12 sm:px-6 md:grid-cols-12 md:pb-28 md:pt-20">
        <div className="md:col-span-12">
          <Eyebrow className="sx-fade-in">
            <span className="mr-2 inline-block h-1.5 w-1.5 translate-y-[-2px] rounded-full bg-accent" aria-hidden />
            For D2C, marketing teams, solo founders
          </Eyebrow>
          <h1
            id="hero-title"
            className="font-display text-[clamp(2.75rem,8.4vw,7rem)] font-semibold leading-[0.95] tracking-[-0.045em]"
          >
            <span className="sx-line">
              <span>Your Marketing.</span>
            </span>{' '}
            <span className="sx-line">
              <span className="relative">
                All Figured Out.
                {/* Hand-drawn accent stroke under the second line. */}
                <svg
                  aria-hidden
                  viewBox="0 0 600 24"
                  preserveAspectRatio="none"
                  className="sx-stroke pointer-events-none absolute -bottom-[0.06em] left-[0.02em] h-[0.16em] w-[98%] text-accent"
                >
                  <path
                    d="M3 15 C 120 6, 260 4, 380 9 S 540 18, 597 8"
                    pathLength={1}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </span>
          </h1>
        </div>
        <div className="sx-fade-in md:col-span-5">
          <p className="max-w-xl text-lg text-ink-soft sm:text-xl">
            SkalX handles it all, from research and strategy to ready-to-use content, so you can focus on growing
            your business.
          </p>
          <div id="start" className="mt-8 max-w-xl scroll-mt-24">
            <StartForm inputId="hero-brand-input" focusOnHash="start" />
          </div>
          <p className="mt-5 text-sm text-ink-mute">
            Plans from {STARTING_PRICE}/month <span aria-hidden>·</span> Cancel anytime
          </p>
        </div>
        <div className="md:col-span-7 md:pl-4 md:pt-2">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}
