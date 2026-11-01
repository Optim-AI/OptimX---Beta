'use client';

import React from 'react';
import { Check } from 'lucide-react';

export const TRY_STEPS = ['Your brand', 'Brand profile', 'Free demo', 'Choose a plan'] as const;

type Props = {
  /** 0-based index into TRY_STEPS. */
  current: number;
};

/**
 * Compact progress for the /try flow: a glowing track that slides between labelled steps on
 * desktop, "Step n of 4" + bar on mobile.
 */
export default function TryStepper({ current }: Props) {
  const total = TRY_STEPS.length;
  const index = Math.max(0, Math.min(current, total - 1));
  const pct = ((index + 1) / total) * 100;

  return (
    <nav aria-label="Onboarding progress" className="min-w-0">
      {/* Mobile */}
      <div className="text-center sm:hidden">
        <p className="text-xs text-paper/60">
          Step {index + 1} of {total} · <span className="text-paper">{TRY_STEPS[index]}</span>
        </p>
        <div className="mx-auto mt-2 h-1 w-36 overflow-hidden rounded-full bg-paper/[0.08]" aria-hidden>
          <div
            className="ob-track-fill h-full rounded-full bg-accent-on-ink"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Desktop */}
      <div className="ob-glass relative hidden rounded-full px-2 py-1.5 sm:block">
        <div aria-hidden className="absolute inset-x-5 bottom-0 h-px overflow-hidden rounded-full">
          <div
            className="ob-track-fill h-full bg-accent-on-ink"
            style={{ width: `${pct}%` }}
          />
        </div>
        <ol className="flex items-center gap-1">
          {TRY_STEPS.map((label, i) => {
            const done = i < index;
            const active = i === index;
            return (
              <li key={label} className="flex items-center gap-1">
                <span
                  className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-all duration-500 ${
                    active ? 'bg-paper/[0.08] text-paper' : done ? 'text-paper/75' : 'text-paper/55'
                  }`}
                  aria-current={active ? 'step' : undefined}
                >
                  <span
                    className={`relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-all duration-500 ${
                      done
                        ? 'bg-accent-on-ink/15 text-accent-on-ink'
                        : active
                          ? 'bg-paper text-ink'
                          : 'bg-paper/[0.06] text-paper/55 ring-1 ring-paper/10'
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
                  </span>
                  {label}
                  {done && <span className="sr-only">(done)</span>}
                </span>
                {i < total - 1 && (
                  <span
                    aria-hidden
                    className={`h-px w-4 transition-colors duration-700 ${done ? 'bg-accent-on-ink/50' : 'bg-paper/10'}`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
