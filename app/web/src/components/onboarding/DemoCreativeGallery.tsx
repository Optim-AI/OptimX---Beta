'use client';

import React, { useRef } from 'react';
import type { OnboardingDemoCreative } from '@/lib/onboarding/try-onboarding';
import { Enter } from './ob-ui';

type Props = {
  brandName: string;
  creatives: OnboardingDemoCreative[];
  onContinue: () => void;
};

/** Creative card that tilts toward the pointer (mouse only). */
function TiltCard({ children, delay }: { children: React.ReactNode; delay: number }) {
  const ref = useRef<HTMLElement>(null);
  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-4px)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = '';
  };
  return (
    <article
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="ob-glass ob-develop overflow-hidden rounded-3xl transition-transform duration-300 ease-out"
      style={{ '--d': `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </article>
  );
}

export default function DemoCreativeGallery({
  brandName,
  creatives,
  onContinue,
}: Props) {
  const countLabel =
    creatives.length === 1
      ? 'One creative direction'
      : `${creatives.length} creative directions`;

  return (
    <div className="mx-auto mt-8 max-w-4xl sm:mt-12">
      <div className="relative">
        <Enter>
          <h1 className="mb-2 text-center font-display text-3xl font-semibold tracking-[-0.025em] sm:text-[2.6rem]">
            Made for <span className="ob-gradient-text">{brandName}.</span>
          </h1>
        </Enter>
        <Enter delay={100}>
          <p className="mb-8 text-center text-paper/65 sm:mb-10">{countLabel}, built from your brand.</p>
        </Enter>
      </div>

      <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        {creatives.map((c, index) => (
          <TiltCard key={`${c.direction}-${c.generationId || index}`} delay={250 + index * 220}>
            <div className="relative w-full" style={{ aspectRatio: '4 / 5' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.imageUrl}
                alt={`${c.directionLabel} creative for ${brandName}`}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span aria-hidden className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium tabular-nums text-paper/85 backdrop-blur">
                {String(index + 1).padStart(2, '0')}
              </span>
            </div>
            <div className="p-5">
              <div className="mb-1 text-xs uppercase tracking-[0.14em] text-accent-on-ink">{c.directionLabel}</div>
              {c.shortDescription && <p className="text-sm text-paper/65">{c.shortDescription}</p>}
            </div>
          </TiltCard>
        ))}
      </div>

      <Enter delay={300 + creatives.length * 220} className="flex justify-center">
        <button type="button" onClick={onContinue} className="ob-btn h-12 rounded-full px-8 font-medium">
          See what else SkalX can do →
        </button>
      </Enter>
    </div>
  );
}
