'use client';

import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import colors from '@/lib/ui/colors';
import type { OnboardingDemoProgressStage } from '@/lib/onboarding/try-onboarding';

const glass = {
  background: 'hsl(0 0% 12% / 0.75)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
} as const;

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

export default function DemoGeneratingProgress({
  progressStage,
  creativeCount = 0,
}: Props) {
  const stage = progressStage || 'planning';
  const current = STAGE_ORDER[stage] || 1;

  return (
    <div className="max-w-md mx-auto mt-16 sm:mt-24 text-center">
      <h1 className="text-2xl sm:text-3xl font-normal mb-3">
        Creating your creative direction
      </h1>
      <p className="mb-8 text-sm" style={{ color: colors.mutedForeground }} aria-live="polite">
        {creativeCount > 0
          ? `${creativeCount} creative${creativeCount === 1 ? '' : 's'} ready so far…`
          : 'Building a small set of personalized concepts from your brand.'}
      </p>
      <ul className="space-y-4 text-left rounded-2xl p-6" style={glass}>
        {STEPS.map((step) => {
          const stepOrder = STAGE_ORDER[step.key];
          const done = current > stepOrder || stage === 'complete';
          const active = stage === step.key;
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
    </div>
  );
}
