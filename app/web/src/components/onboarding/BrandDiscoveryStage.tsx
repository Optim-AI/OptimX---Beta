'use client';

import React from 'react';
import colors from '@/lib/ui/colors';
import type { BrandAnalysisStage } from '@/lib/onboarding/try-onboarding';

const STAGES: { key: BrandAnalysisStage; label: string }[] = [
  { key: 'connecting', label: 'Connecting to your brand...' },
  { key: 'website', label: 'Analysing your website...' },
  { key: 'products', label: 'Discovering your products...' },
  { key: 'identity', label: 'Extracting your brand identity...' },
  { key: 'dna', label: 'Building your Brand DNA...' },
];

const ORDER: BrandAnalysisStage[] = [
  'connecting',
  'website',
  'identity',
  'products',
  'dna',
];

type Props = {
  brandName?: string;
  stage: BrandAnalysisStage | null;
  error?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
};

/**
 * Full-screen brand discovery. The active line is the latest milestone the
 * backend (or the following scan) has actually reached.
 */
export default function BrandDiscoveryStage({
  brandName,
  stage,
  error,
  onRetry,
  onCancel,
}: Props) {
  const active = stage || 'connecting';
  const activeIndex = Math.max(0, ORDER.indexOf(active));
  const label = STAGES.find((s) => s.key === active)?.label || STAGES[0].label;

  return (
    <div className="fixed inset-0 z-30 overflow-hidden" style={{ background: '#07080a', color: colors.foreground }}>
      <style jsx>{`
        .tunnel {
          background-image:
            linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px);
          background-size: 72px 72px;
          transform: perspective(520px) rotateX(58deg) scale(1.6);
          transform-origin: center top;
          animation: drift 14s linear infinite;
        }
        .sweep {
          background: linear-gradient(90deg, transparent, ${colors.primary}, transparent);
          animation: sweep 3.6s ease-in-out infinite;
        }
        @keyframes drift {
          from { background-position: 0 0; }
          to { background-position: 0 72px; }
        }
        @keyframes sweep {
          0% { transform: translateX(-40%); opacity: 0; }
          30% { opacity: 0.85; }
          100% { transform: translateX(40%); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tunnel, .sweep { animation: none; }
        }
      `}</style>
      <div className="absolute inset-x-0 bottom-0 h-[70%] overflow-hidden opacity-70" aria-hidden>
        <div className="tunnel absolute inset-0" />
      </div>
      <div className="sweep absolute left-[10%] right-[10%] top-[42%] h-px" aria-hidden />
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <img src="/images/SkalX_Logo.png" alt="SkalX" className="h-5 w-auto mb-10 opacity-90" />
        <p className="text-xs uppercase tracking-[0.22em] mb-4" style={{ color: colors.primary }}>
          Brand discovery
        </p>
        <h1 className="text-3xl sm:text-5xl font-normal max-w-3xl leading-tight mb-4">
          {brandName ? `Discovering ${brandName}` : 'Discovering your brand'}
        </h1>
        <p className="text-lg sm:text-xl font-light max-w-xl" style={{ color: colors.mutedForeground }} aria-live="polite">
          {error || label}
        </p>
        {!error && (
          <div className="mt-8 h-1 w-40 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }} aria-hidden>
            <div
              className="h-full rounded-full"
              style={{
                width: `${((activeIndex + 1) / ORDER.length) * 100}%`,
                background: colors.primary,
                transition: 'width 0.6s ease',
              }}
            />
          </div>
        )}
        <p className="mt-6 text-xs max-w-md" style={{ color: 'rgba(255,255,255,0.38)' }}>
          {error
            ? 'Nothing was saved as finished. You can try again.'
            : 'This stays on the current step until that part of the analysis finishes.'}
        </p>
        <div className="mt-8 flex gap-3">
          {error && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="h-11 px-6 rounded-xl text-sm font-medium"
              style={{ background: colors.gradientPrimary, color: colors.primaryForeground, border: 'none' }}
            >
              Try again
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="h-11 px-6 rounded-xl text-sm"
              style={{ background: 'transparent', color: colors.mutedForeground, border: `1px solid ${colors.border}` }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
