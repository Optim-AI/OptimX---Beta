import React from 'react';
import Image from 'next/image';
import { ArrowRight, Play } from 'lucide-react';
import { STARTING_PRICE } from '@/lib/marketing/content';
import StartForm from './StartForm';
import { Eyebrow, PhoneFrame } from './ui';

function Caption({ children }: { children: React.ReactNode }) {
  return <figcaption className="mt-2 text-center text-xs text-ink-mute sm:text-[13px]">{children}</figcaption>;
}

/** One product photo → feed ad, story ad and a video frame. Placeholder assets until supplied. */
function HeroVisual() {
  return (
    <div className="relative">
      <div className="flex items-end gap-2 sm:gap-3">
        <figure className="m-0 w-[29%]">
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-line bg-surface">
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

        <ArrowRight aria-hidden className="mb-10 h-5 w-5 shrink-0 text-ink-mute sm:mb-12" />

        <figure className="sx-hero-out m-0 w-[27%]" style={{ animationDelay: '0.9s' }}>
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

        <figure className="sx-hero-out m-0 w-[19%]" style={{ animationDelay: '1.05s' }}>
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

        <figure className="sx-hero-out m-0 w-[19%]" style={{ animationDelay: '1.2s' }}>
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
      <p className="mt-5 text-center text-xs text-ink-mute md:text-left">Illustration for a fictional brand.</p>
    </div>
  );
}

export default function HeroSection() {
  return (
    <section aria-labelledby="hero-title" className="overflow-hidden">
      <div className="mx-auto grid max-w-6xl gap-x-12 gap-y-10 px-4 pb-16 pt-10 sm:px-6 md:grid-cols-12 md:pb-24 md:pt-16">
        <div className="md:col-span-11 lg:col-span-10">
          <Eyebrow>For D2C, marketing teams, solo founders</Eyebrow>
          <h1
            id="hero-title"
            className="font-display text-[clamp(2.5rem,6vw,4.5rem)] font-medium leading-[1.02] tracking-[-0.02em]"
          >
            Your Marketing. All Figured Out.
          </h1>
        </div>
        <div className="md:col-span-5">
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
        <div className="md:col-span-7 md:pt-2">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}
