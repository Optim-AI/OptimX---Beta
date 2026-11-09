'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { Play, Sparkles, X } from 'lucide-react';
import { SHOWCASE } from '@/content/home';
import { LINKS } from '@/content/site';
import { SHOWCASE_ITEMS, type ShowcaseItem } from '@/content/showcase';
import { CTAButton } from '../kit/CTAButton';
import { Section, SectionHeading } from '../kit/Section';

/**
 * One ad with its "Why this ad". Desktop: hover or focus reveals the reason.
 * Touch: tap toggles it. The whole card is a button so keyboards get the same reveal.
 */
function WhyCard({ item }: { item: ShowcaseItem }) {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Video cards play only while hovered or focused (no autoplay), and never with reduced motion.
  const play = () => {
    const v = videoRef.current;
    if (!v || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    v.play().catch(() => undefined);
  };
  const pause = () => videoRef.current?.pause();
  const ratio = item.aspect === '4/5' ? 'aspect-[4/5]' : item.aspect === '1/1' ? 'aspect-square' : 'aspect-[9/16]';
  const panelId = `why-${item.id}`;
  return (
    <li className="break-inside-avoid">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        onPointerEnter={item.video ? play : undefined}
        onPointerLeave={item.video ? pause : undefined}
        onFocus={item.video ? play : undefined}
        onBlur={item.video ? pause : undefined}
        className={`group relative block w-full overflow-hidden rounded-card text-left shadow-card ${ratio}`}
      >
        <Image src={item.image} alt={item.alt} fill sizes="(max-width: 768px) 50vw, 280px" className="object-cover" loading="lazy" />
        {item.video ? (
          <video
            ref={videoRef}
            src={item.video}
            poster={item.image}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        {item.video ? (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-ink/75 px-2 py-0.5 text-[11px] font-medium text-paper">
            <Play aria-hidden className="h-3 w-3 fill-current" /> Video
          </span>
        ) : null}
        <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-paper/95 px-2.5 py-1 text-[11.5px] font-semibold text-ink shadow-card transition-opacity group-hover:opacity-0">
          <Sparkles aria-hidden className="h-3.5 w-3.5 text-accent" /> {SHOWCASE.whyLabel}
        </span>
        <span
          id={panelId}
          className={`absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-ink via-ink/90 to-ink/40 p-4 text-paper transition-opacity duration-300 ${
            open ? 'opacity-100' : 'opacity-0 [@media(hover:hover)]:group-hover:opacity-100 group-focus-visible:opacity-100'
          }`}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-on-ink">{SHOWCASE.whyLabel}</span>
            {open ? <X aria-hidden className="h-4 w-4 text-paper/70" /> : null}
          </span>
          <span className="mt-2 block text-[13px] leading-snug text-paper/80">
            <strong className="text-paper">Finding: </strong>
            {item.why.finding}
          </span>
          <span className="mt-1.5 block text-[13px] leading-snug text-paper/80">
            <strong className="text-paper">Angle: </strong>
            {item.why.angle}
          </span>
          <span className="mt-1.5 block text-[12px] text-paper/60">
            {item.format} · {item.brand}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Section 3: real ads, each with the research finding and angle behind it. */
export default function Showcase() {
  return (
    <Section id="showcase" labelledBy="showcase-title" tone="paper">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <SectionHeading id="showcase-title" eyebrow={SHOWCASE.eyebrow} title={SHOWCASE.title} sub={SHOWCASE.sub} />
        <p className="text-sm text-ink-mute">
          <span className="[@media(hover:hover)]:hidden">{SHOWCASE.hintTouch}</span>
          <span className="hidden [@media(hover:hover)]:inline">{SHOWCASE.hintPointer}</span>
        </p>
      </div>
      <ul className="mt-10 grid grid-cols-2 items-start gap-3 sm:gap-5 lg:grid-cols-4">
        {SHOWCASE_ITEMS.map((item) => (
          <WhyCard key={item.id} item={item} />
        ))}
      </ul>
      <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-mute">{SHOWCASE.note} Example findings shown.</p>
        <CTAButton href={LINKS.freeAudit} arrow>
          {SHOWCASE.cta}
        </CTAButton>
      </div>
    </Section>
  );
}
