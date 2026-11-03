'use client';

import React from 'react';
import ElapsedHint from './ElapsedHint';
import { Enter, OrbitVisual, StatusList } from './ob-ui';

export type AnalysisPhase = 'idle' | 'started' | 'processing' | 'complete' | 'error';

type Props = {
  brandName: string;
  analysisPhase: AnalysisPhase;
};

/**
 * Brand analysis progress — an orbit scan around the brand monogram whose nodes light up
 * per phase, above the step list.
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
    <div className="mx-auto mt-8 max-w-md text-center sm:mt-14">
      <Enter>
        <OrbitVisual label={displayName === 'your brand' ? 'S' : displayName} lit={current} />
      </Enter>
      <Enter delay={120}>
        <h1 className="mb-3 mt-8 font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          Getting to know <span className="ob-gradient-text">{displayName}</span>
        </h1>
      </Enter>
      <Enter delay={200}>
        <p className="mb-8 text-sm text-paper/65 sm:text-base">
          We&apos;re studying your brand so the first creative feels like yours.
        </p>
      </Enter>
      <Enter delay={280}>
        <StatusList
          items={steps.map((step) => ({
            key: step.key,
            label: step.label,
            done: current > order[step.key] || analysisPhase === 'complete',
            active: analysisPhase === step.key,
          }))}
        />
        <ElapsedHint typical="under a minute" />
      </Enter>
    </div>
  );
}
