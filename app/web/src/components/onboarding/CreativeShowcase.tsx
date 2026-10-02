'use client';

import React, { useState } from 'react';
import colors from '@/lib/ui/colors';
import type { OnboardingDemoCreative } from '@/lib/onboarding/try-onboarding';

const glass = {
  background: 'hsl(0 0% 12% / 0.75)',
  border: '1px solid rgba(255,255,255,0.08)',
} as const;

type Props = {
  brandName: string;
  creatives: OnboardingDemoCreative[];
  onContinue: () => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
};

export default function CreativeShowcase({
  brandName,
  creatives,
  onContinue,
  onRegenerate,
  regenerating,
}: Props) {
  const [open, setOpen] = useState<OnboardingDemoCreative | null>(null);

  return (
    <div className="max-w-5xl mx-auto mt-6 sm:mt-10">
      <h1 className="text-3xl sm:text-5xl font-normal mb-3 text-center">Your first creations</h1>
      <p className="text-center mb-10 max-w-xl mx-auto font-light" style={{ color: colors.mutedForeground }}>
        Generated from {brandName}&apos;s Brand DNA. These are the actual files from this session.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {creatives.map((creative, index) => (
          <article key={`${creative.direction}-${creative.generationId || index}`} className="rounded-[28px] p-3" style={glass}>
            <button
              type="button"
              className="block w-full text-left"
              onClick={() => setOpen(creative)}
            >
              <div className="relative w-full overflow-hidden rounded-[22px] bg-black" style={{ aspectRatio: '4 / 5' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={creative.imageUrl}
                  alt={`${creative.directionLabel} for ${brandName}`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
            </button>
            <div className="px-2 pt-3 pb-2">
              <div className="text-xs uppercase tracking-[0.14em]" style={{ color: colors.primary }}>
                Social post · 4:5
              </div>
              <div className="text-base mt-1">{creative.directionLabel}</div>
              {creative.shortDescription && (
                <p className="text-sm mt-1" style={{ color: colors.mutedForeground }}>{creative.shortDescription}</p>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={onContinue}
          className="h-12 px-8 rounded-xl font-medium w-full sm:w-auto"
          style={{ background: colors.gradientPrimary, color: colors.primaryForeground, border: 'none' }}
        >
          Continue with SkalX →
        </button>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className="h-12 px-6 rounded-xl text-sm w-full sm:w-auto disabled:opacity-60"
            style={{ background: 'transparent', color: colors.foreground, border: `1px solid ${colors.border}` }}
          >
            Generate again
          </button>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)' }}
          onClick={() => setOpen(null)}
        >
          <div className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.imageUrl} alt={open.directionLabel} className="w-full rounded-2xl" />
            <button
              type="button"
              className="mt-4 text-sm"
              style={{ color: colors.foreground, background: 'transparent', border: 'none' }}
              onClick={() => setOpen(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
