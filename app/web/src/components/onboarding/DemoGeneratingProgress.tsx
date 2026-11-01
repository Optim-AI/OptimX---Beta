'use client';

import React from 'react';
import ElapsedHint from './ElapsedHint';
import { DevelopingStack, Enter, StatusList } from './ob-ui';
import type { OnboardingDemoProgressStage } from '@/lib/onboarding/try-onboarding';

const STEPS: {
  key: OnboardingDemoProgressStage;
  label: string;
}[] = [
  { key: 'planning', label: 'Brand context understood' },
  { key: 'direction_ready', label: 'Creative direction planned' },
  { key: 'building', label: 'Building your first concept' },
  { key: 'exploring', label: 'Exploring alternate directions' },
  { key: 'preparing', label: 'Preparing your creative set' },
];

const STAGE_ORDER: Record<OnboardingDemoProgressStage, number> = {
  planning: 1,
  direction_ready: 2,
  building: 3,
  exploring: 4,
  preparing: 5,
  complete: 6,
};

type Props = {
  progressStage?: OnboardingDemoProgressStage | null;
  creativeCount?: number;
};

/** "Darkroom": a fan of creatives that develop as the set comes together, above the step list. */
export default function DemoGeneratingProgress({
  progressStage,
  creativeCount = 0,
}: Props) {
  const stage = progressStage || 'planning';
  const current = STAGE_ORDER[stage] || 1;
  // Cards look finished as real creatives arrive; otherwise one per completed late stage.
  const ready = Math.min(4, Math.max(creativeCount, current - 2));

  return (
    <div className="mx-auto mt-8 max-w-md text-center sm:mt-14">
      <Enter>
        <DevelopingStack ready={ready} />
      </Enter>
      <Enter delay={120}>
        <h1 className="mb-3 mt-8 font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          Creating your creative direction
        </h1>
      </Enter>
      <Enter delay={200}>
        <p className="mb-8 text-sm text-paper/65" aria-live="polite">
          {creativeCount > 0
            ? `${creativeCount} creative${creativeCount === 1 ? '' : 's'} ready so far…`
            : 'Building a small set of personalized concepts from your brand.'}
        </p>
      </Enter>
      <Enter delay={280}>
        <StatusList
          items={STEPS.map((step) => ({
            key: step.key,
            label: step.label,
            done: current > STAGE_ORDER[step.key] || stage === 'complete',
            active: stage === step.key,
          }))}
        />
        <ElapsedHint typical="1–2 minutes" slowAfterSec={120} />
      </Enter>
    </div>
  );
}
