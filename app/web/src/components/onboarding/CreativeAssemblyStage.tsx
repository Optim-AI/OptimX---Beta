'use client';

import React from 'react';
import colors from '@/lib/ui/colors';
import type { OnboardingDemoProgressStage } from '@/lib/onboarding/try-onboarding';

const STEPS: { key: OnboardingDemoProgressStage; label: string }[] = [
  { key: 'planning', label: 'Understanding your campaign...' },
  { key: 'direction_ready', label: 'Developing the creative direction...' },
  { key: 'building', label: 'Applying your Brand DNA...' },
  { key: 'exploring', label: 'Generating your creative...' },
  { key: 'preparing', label: 'Preparing your preview...' },
];

const ORDER: OnboardingDemoProgressStage[] = [
  'planning',
  'direction_ready',
  'building',
  'exploring',
  'preparing',
  'complete',
];

type Props = {
  progressStage?: OnboardingDemoProgressStage | null;
  creativeCount?: number;
  error?: string | null;
  onRetry?: () => void;
};

/** Creative assembly screen. Steps advance only when the demo job writes them. */
export default function CreativeAssemblyStage({
  progressStage,
  creativeCount = 0,
  error,
  onRetry,
}: Props) {
  const stage = progressStage || 'planning';
  const index = Math.max(0, ORDER.indexOf(stage));
  const label =
    stage === 'complete'
      ? 'Preparing your preview...'
      : STEPS.find((s) => s.key === stage)?.label || STEPS[0].label;

  return (
    <div className="fixed inset-0 z-30 overflow-hidden" style={{ background: '#07080a', color: colors.foreground }}>
      <style jsx>{`
        .grid {
          background-image:
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .frame {
          animation: pulse 2.8s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .frame { animation: none; }
        }
      `}</style>
      <div className="grid absolute inset-0 opacity-40" aria-hidden />
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div
          className="frame mb-10 w-[220px] sm:w-[280px] rounded-2xl"
          style={{
            aspectRatio: '4 / 5',
            border: `1px solid ${colors.primary}`,
            boxShadow: `0 0 40px ${colors.primary}33`,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.04), transparent 40%, rgba(255,255,255,0.03))',
          }}
          aria-hidden
        />
        <p className="text-xs uppercase tracking-[0.22em] mb-3" style={{ color: colors.primary }}>
          Creative generation
        </p>
        <h1 className="text-3xl sm:text-5xl font-normal mb-3">Making your first creatives</h1>
        <p className="text-lg font-light" style={{ color: colors.mutedForeground }} aria-live="polite">
          {error || label}
        </p>
        {!error && creativeCount > 0 && (
          <p className="mt-3 text-sm" style={{ color: colors.mutedForeground }}>
            {creativeCount} creative{creativeCount === 1 ? '' : 's'} ready so far
          </p>
        )}
        {!error && (
          <div className="mt-8 h-1 w-40 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full"
              style={{
                width: `${Math.min(100, ((index + 1) / ORDER.length) * 100)}%`,
                background: colors.primary,
                transition: 'width 0.6s ease',
              }}
            />
          </div>
        )}
        {error && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-8 h-11 px-6 rounded-xl text-sm font-medium"
            style={{ background: colors.gradientPrimary, color: colors.primaryForeground, border: 'none' }}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
