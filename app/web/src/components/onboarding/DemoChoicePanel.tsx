'use client';

import React from 'react';
import colors from '@/lib/ui/colors';

const glass = {
  background: 'hsl(0 0% 12% / 0.75)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
} as const;

type Props = {
  error?: string | null;
  failedMessage?: string | null;
  onCreate: () => void;
  disabled?: boolean;
};

export default function DemoChoicePanel({
  error,
  failedMessage,
  onCreate,
  disabled,
}: Props) {
  return (
    <div className="max-w-xl mx-auto mt-10 sm:mt-16">
      <h1 className="text-3xl sm:text-4xl font-normal mb-3">
        Let&apos;s make something for your brand.
      </h1>
      <p className="mb-10 font-light" style={{ color: colors.mutedForeground }}>
        Before you choose a plan, see what SkalX can create from your brand.
      </p>
      {error && (
        <p className="mb-4 text-sm" role="alert" style={{ color: 'hsl(0 84% 60%)' }}>
          {error}
        </p>
      )}
      {failedMessage && !error && (
        <p className="mb-4 text-sm" role="alert" style={{ color: 'hsl(0 84% 60%)' }}>
          {failedMessage}
        </p>
      )}
      <div className="space-y-4">
        <button
          type="button"
          onClick={onCreate}
          disabled={disabled}
          className="w-full text-left rounded-2xl p-6 transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          style={glass}
        >
          <div className="text-lg font-medium mb-1">Create your first creatives →</div>
          <div className="text-sm mb-3" style={{ color: colors.mutedForeground }}>
            We&apos;ll generate a small set of personalized ad concepts using your brand,
            product and visual direction.
          </div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Demo creatives don&apos;t use your SkalX credits.
          </div>
        </button>
        <div className="w-full rounded-2xl p-6" style={glass}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-medium mb-1">Video creatives</div>
              <div className="text-sm" style={{ color: colors.mutedForeground }}>
                Turn the same brand direction into short-form video ads inside SkalX.
              </div>
            </div>
            <span
              className="text-[10px] uppercase tracking-wider shrink-0 px-2 py-1 rounded-md"
              style={{
                color: colors.mutedForeground,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              Available after you continue
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
