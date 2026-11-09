'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ArrowRight, Camera, Sparkles } from 'lucide-react';
import { PHOTOSHOOT } from '@/content/home';
import { LINKS } from '@/content/site';
import { CTAButton } from '../kit/CTAButton';
import { Section, SectionHeading } from '../kit/Section';

/** Fictional showcase brands (content/showcase-inputs.ts). Every shot was made from the one "before" photo. */
const BRANDS = [
  { slug: 'saffra-skin', brand: 'Saffra Skin', product: 'Gel moisturiser', angles: ['Studio', 'Flat lay', 'In hand'] },
  { slug: 'kolam-kitchen', brand: 'Kolam Kitchen', product: 'Chettinad masala', angles: ['Studio', 'Flat lay', 'In the kitchen'] },
  { slug: 'crunchwell', brand: 'Crunchwell', product: 'Peri peri makhana', angles: ['Studio', 'Flat lay', 'On the go'] },
  { slug: 'monsoon-thread', brand: 'Monsoon Thread', product: 'Block-print kurta', angles: ['Studio', 'Print detail', 'Worn'] },
];

/** Product photoshoot: one plain product photo in, a styled shot out. Brand tabs switch the example. */
export default function PhotoshootSection() {
  const [i, setI] = useState(0);
  const b = BRANDS[i];
  return (
    <Section id="photoshoot" labelledBy="photoshoot-title" tone="paper" innerClassName="grid gap-12 lg:grid-cols-12 lg:items-center">
      <div className="lg:col-span-5">
        <SectionHeading id="photoshoot-title" eyebrow={PHOTOSHOOT.eyebrow} title={PHOTOSHOOT.title} sub={PHOTOSHOOT.sub} />
        <ul className="mt-8 space-y-4">
          {PHOTOSHOOT.points.map((p) => (
            <li key={p.title} className="border-l-2 border-accent/40 pl-4">
              <h3 className="font-display text-[17px] font-semibold">{p.title}</h3>
              <p className="mt-1 text-[15px] text-ink-soft">{p.body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <CTAButton href={LINKS.startFree} arrow>
            {PHOTOSHOOT.cta}
          </CTAButton>
        </div>
      </div>

      <div className="lg:col-span-7">
        <div role="tablist" aria-label="Example brands" className="flex flex-wrap gap-2">
          {BRANDS.map((x, n) => (
            <button
              key={x.slug}
              type="button"
              role="tab"
              aria-selected={n === i}
              onClick={() => setI(n)}
              className={`min-h-10 rounded-full border px-4 text-[14px] font-medium transition-colors ${
                n === i ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-ink-soft hover:border-ink/40 hover:text-ink'
              }`}
            >
              {x.brand}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="mt-5 grid grid-cols-[1fr_auto_1.35fr] items-center gap-2 sm:gap-4">
          <figure className="m-0">
            <div className="relative aspect-[4/5] overflow-hidden rounded-card border border-line bg-surface shadow-card">
              <Image key={`b-${b.slug}`} src={`/showcase/${b.slug}/packshot.webp`} alt={`Plain photo of the ${b.brand} ${b.product.toLowerCase()}`} fill sizes="(max-width: 1024px) 38vw, 280px" className="sx-fade-in object-cover" />
            </div>
            <figcaption className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-ink-mute">
              <Camera aria-hidden className="h-3.5 w-3.5" /> {PHOTOSHOOT.beforeLabel}
            </figcaption>
          </figure>
          <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white shadow-card sm:h-11 sm:w-11">
            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <figure className="m-0">
            <div className="relative aspect-[4/5] overflow-hidden rounded-card shadow-lift">
              <Image key={`a-${b.slug}`} src={`/showcase/${b.slug}/photoshoot.webp`} alt={`SkalX product photoshoot of the ${b.brand} ${b.product.toLowerCase()}`} fill sizes="(max-width: 1024px) 50vw, 380px" className="sx-fade-in object-cover" />
            </div>
            <figcaption className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
              <Sparkles aria-hidden className="h-3.5 w-3.5 text-accent" /> {PHOTOSHOOT.afterLabel} · {b.product}
            </figcaption>
          </figure>
        </div>
        <p className="mt-7 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-ink-mute">{PHOTOSHOOT.anglesLabel}</p>
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:gap-4">
          {b.angles.map((label, n) => (
            <li key={`${b.slug}-${n}`}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-card shadow-card">
                <Image src={`/showcase/${b.slug}/angle-${n + 1}.webp`} alt={`${b.brand} ${b.product.toLowerCase()}, ${label.toLowerCase()}`} fill sizes="(max-width: 1024px) 30vw, 230px" className="sx-fade-in object-cover" />
              </div>
              <p className="mt-1.5 text-[12.5px] text-ink-mute">{label}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-ink-mute">{PHOTOSHOOT.note}</p>
      </div>
    </Section>
  );
}
