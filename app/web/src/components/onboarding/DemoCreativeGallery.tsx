'use client';

import React, { useEffect, useState } from 'react';
import colors from '@/lib/ui/colors';
import type { OnboardingDemoCreative } from '@/lib/onboarding/try-onboarding';

const glass = {
  background: 'hsl(0 0% 12% / 0.75)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
} as const;

type Props = {
  brandName: string;
  creatives: OnboardingDemoCreative[];
  onContinue: () => void;
};

export default function DemoCreativeGallery({
  brandName,
  creatives,
  onContinue,
}: Props) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    if (creatives.length === 0) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setVisibleCount(i);
      if (i >= creatives.length) window.clearInterval(id);
    }, 220);
    return () => window.clearInterval(id);
  }, [creatives]);

  const countLabel =
    creatives.length === 1
      ? 'One creative direction'
      : `${creatives.length} creative directions`;

  return (
    <div className="max-w-4xl mx-auto mt-8 sm:mt-12">
      <h1 className="text-3xl sm:text-4xl font-normal mb-2 text-center">
        Made for {brandName}.
      </h1>
      <p
        className="text-center mb-8 sm:mb-10 font-light"
        style={{ color: colors.mutedForeground }}
      >
        {countLabel}, built from your brand.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mb-10">
        {creatives.map((c, index) => (
          <article
            key={`${c.direction}-${c.generationId || index}`}
            className="rounded-2xl overflow-hidden transition-all duration-500"
            style={{
              ...glass,
              opacity: index < visibleCount ? 1 : 0,
              transform: index < visibleCount ? 'translateY(0)' : 'translateY(16px)',
            }}
          >
            <div className="relative w-full" style={{ aspectRatio: '4 / 5' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.imageUrl}
                alt={`${c.directionLabel} creative for ${brandName}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <div className="p-4">
              <div
                className="text-xs uppercase tracking-[0.14em] mb-1"
                style={{ color: colors.primary }}
              >
                {c.directionLabel}
              </div>
              {c.shortDescription && (
                <p className="text-sm" style={{ color: colors.mutedForeground }}>
                  {c.shortDescription}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onContinue}
          className="h-12 px-8 rounded-xl font-medium"
          style={{
            background: colors.gradientPrimary,
            color: colors.primaryForeground,
            border: 'none',
          }}
        >
          See what else SkalX can do →
        </button>
      </div>
    </div>
  );
}
