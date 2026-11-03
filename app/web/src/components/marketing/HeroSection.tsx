'use client';

import React from 'react';
import { STARTING_PRICE } from '@/lib/marketing/content';
import HeroDemo from './HeroDemo';
import StartForm from './StartForm';
import { Eyebrow } from './ui';

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
          <HeroDemo />
          <p className="mt-5 text-center text-xs text-ink-mute md:text-left">Illustration for a fictional brand.</p>
        </div>
      </div>
    </section>
  );
}
