import React from 'react';
import { Check } from 'lucide-react';
import { HERO } from '@/content/home';
import { LINKS } from '@/content/site';
import { Eyebrow } from '../ui';
import { CTAButton } from '../kit/CTAButton';
import HeroDemo from '../HeroDemo';

/**
 * Section 1: centered hero. Promise first (one wide headline, one wide sub-line), two clear
 * actions, then the Website → Research → Angle → Ads demo at full width underneath.
 * The free audit form itself lives in the final CTA band (#get-started).
 */
export default function HomeHero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div aria-hidden className="sx-grid-bg pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-12 text-center sm:px-6 md:pb-24 md:pt-20">
        <Eyebrow className="sx-fade-in justify-center">{HERO.eyebrow}</Eyebrow>
        <h1 id="hero-title" className="font-display font-semibold">
          <span className="sx-line block text-[clamp(1.15rem,2.2vw,1.6rem)] font-medium tracking-[-0.01em] text-ink-soft">
            <span>{HERO.kicker}</span>
          </span>
          {/* One line on desktop: the headline is ~15.4× its font size wide, so size it to the container. */}
          <span className="sx-line mt-3 block text-balance text-[clamp(2.6rem,7vw,4.5rem)] leading-[1] tracking-[-0.045em] lg:whitespace-nowrap lg:text-[min(5.25rem,calc((min(100vw,80rem)-4rem)/15.6))]">
            <span>{HERO.title}</span>
          </span>
        </h1>
        <p className="sx-fade-in mx-auto mt-6 max-w-4xl text-balance text-[clamp(1.0625rem,1.8vw,1.375rem)] lg:max-w-6xl lg:text-wrap leading-relaxed text-ink-soft">
          {HERO.sub}
        </p>

        <div className="sx-fade-in mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <CTAButton href={LINKS.freeAudit} arrow className="w-full sm:w-auto">
            {HERO.primaryCta}
          </CTAButton>
          <CTAButton href={LINKS.startFree} variant="secondary" className="w-full sm:w-auto">
            {HERO.secondaryCta}
          </CTAButton>
        </div>
        <ul className="sx-fade-in mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-ink-soft">
          {HERO.trust.map((t) => (
            <li key={t} className="inline-flex items-center gap-1.5">
              <Check aria-hidden className="h-4 w-4 text-accent" />
              {t}
            </li>
          ))}
        </ul>

        <div className="mx-auto mt-14 max-w-6xl text-left md:mt-16">
          <HeroDemo />
        </div>
      </div>
    </section>
  );
}
