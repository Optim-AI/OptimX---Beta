'use client';

import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import colors from '@/lib/ui/colors';

export type AnalysisPhase = 'idle' | 'started' | 'processing' | 'complete' | 'error';

const glass = {
  background: 'hsl(0 0% 12% / 0.75)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
} as const;

type Props = {
  brandName: string;
  analysisPhase: AnalysisPhase;
};

/**
 * Brand analysis progress — single progress card, no duplicate top spinner.
 */
export default function BrandAnalysisProgress({ brandName, analysisPhase }: Props) {
  const displayName = brandName.trim() || 'your brand';
  const steps = [
    { key: 'started' as const, label: 'Brand information received' },
    { key: 'processing' as const, label: 'Understanding your brand' },
    { key: 'complete' as const, label: 'Building your creative direction' },
  ];
  const order = { idle: 0, started: 1, processing: 2, complete: 3, error: 0 };
  const current = order[analysisPhase];

  return (
    <div className="max-w-md mx-auto mt-16 sm:mt-24 text-center">
      <img
        src="/images/SkalX_Logo.png"
        alt=""
        className="h-4 w-auto mx-auto mb-8 opacity-70"
        aria-hidden
      />
      <h1 className="text-2xl sm:text-3xl font-normal mb-3">
        Getting to know {displayName}
      </h1>
      <p className="mb-8 text-sm sm:text-base font-light" style={{ color: colors.mutedForeground }}>
        We&apos;re studying your brand so the first creative feels like yours.
      </p>
      <ul className="space-y-4 text-left rounded-2xl p-6" style={glass}>
        {steps.map((step) => {
          const stepOrder = order[step.key];
          const done = current > stepOrder || analysisPhase === 'complete';
          const active = analysisPhase === step.key;
          return (
            <li key={step.key} className="flex items-center gap-3">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: done
                    ? 'hsl(142 76% 36%)'
                    : active
                      ? 'hsl(213 100% 55% / 0.25)'
                      : 'rgba(255,255,255,0.08)',
                }}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5 text-white" />
                ) : active ? (
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin"
                    style={{ color: colors.primary }}
                  />
                ) : (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.25)' }}
                  />
                )}
              </span>
              <span
                style={{
                  color: done || active ? colors.foreground : colors.mutedForeground,
                }}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-sm" style={{ color: colors.mutedForeground }} aria-live="polite">
        This usually takes a moment. We&apos;ll only move forward when your brand profile is ready.
      </p>
    </div>
  );
}
