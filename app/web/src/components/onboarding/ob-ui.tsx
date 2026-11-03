'use client';

import React from 'react';

/**
 * Shared visual pieces for the /try onboarding flow. Decorative parts are aria-hidden;
 * motion lives in the `.ob-*` rules in styles/globals.css (all off under reduced motion).
 */

/** Fixed ambient backdrop: aurora blobs that drift and move to a new spot per step. */
export function OnboardingStage({ step, busy = false }: { step: number; busy?: boolean }) {
  return (
    <div aria-hidden className="ob-stage" data-step={step} data-busy={busy ? 'true' : 'false'}>
      <div className="ob-blob ob-blob-a" />
      <div className="ob-blob ob-blob-b" />
      <div className="ob-blob ob-blob-c" />
      <div className="ob-dots" />
    </div>
  );
}

/** Staggered entrance wrapper. */
export function Enter({
  children,
  delay = 0,
  className = '',
  as = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'li' | 'section' | 'p' | 'h1';
}) {
  const Tag = as as React.ElementType;
  return (
    <Tag className={`ob-enter ${className}`} style={{ '--d': `${delay}ms` } as React.CSSProperties}>
      {children}
    </Tag>
  );
}

/** Small uppercase label above a screen heading. */
export function Kicker({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`mb-4 inline-flex items-center gap-3 text-[12.5px] font-semibold uppercase tracking-[0.18em] text-accent-on-ink ${className}`}>
      <span aria-hidden className="h-px w-6 bg-paper/30" />
      {children}
    </p>
  );
}

/** Drawn check inside a filled circle; pops in when it mounts. */
export function DrawnCheck({ className = '' }: { className?: string }) {
  return (
    <span className={`ob-check flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-on-ink ${className}`}>
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
        <path d="M3.5 8.5l3 3 6-7" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export type StatusItem = { key: string; label: string; done: boolean; active: boolean };

/**
 * Vertical step progress. Finished steps go quiet, the live step is the focus (pulsing node +
 * an indeterminate bar under its label), upcoming steps stay faint. A thin bar across the top
 * shows overall progress. Each row draws its own rail segment, so nodes and lines always line up.
 */
export function StatusList({ items }: { items: StatusItem[] }) {
  const doneCount = items.filter((i) => i.done).length;
  const activeCount = items.some((i) => i.active) ? 0.5 : 0;
  const overall = items.length ? Math.min(1, (doneCount + activeCount) / items.length) : 0;
  return (
    <div className="ob-glass relative overflow-hidden rounded-3xl text-left">
      <div aria-hidden className="h-[2px] bg-paper/[0.06]">
        <div
          className="ob-track-fill h-full bg-accent-on-ink"
          style={{ width: `${overall * 100}%` }}
        />
      </div>
      <ul className="px-5 py-6 sm:px-7">
        {items.map((step, i) => {
          const last = i === items.length - 1;
          return (
            <li key={step.key} className="grid grid-cols-[20px_1fr] gap-x-4">
              {/* Node + the rail segment down to the next node. */}
              <div aria-hidden className="flex flex-col items-center">
                <span className="flex h-6 items-center justify-center">
                  {step.done ? (
                    <span className="ob-check flex h-5 w-5 items-center justify-center rounded-full bg-accent-on-ink/15 ring-1 ring-accent-on-ink/40">
                      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
                        <path d="M3.5 8.5l3 3 6-7" stroke="var(--color-accent-on-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  ) : step.active ? (
                    <span className="relative flex h-5 w-5 items-center justify-center rounded-full ring-1 ring-accent-on-ink">
                      <span className="relative h-2 w-2 rounded-full bg-accent-on-ink">
                        <span className="ob-ping absolute inset-0" />
                      </span>
                    </span>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-paper/20" />
                  )}
                </span>
                {!last && (
                  <span
                    className={`my-1 w-px flex-1 transition-colors duration-700 ${
                      step.done ? 'bg-accent-on-ink/45' : 'bg-paper/10'
                    }`}
                  />
                )}
              </div>
              <div className={last ? '' : 'pb-6'}>
                <p
                  className={`flex min-h-6 items-center transition-all duration-500 ${
                    step.active
                      ? 'text-[16px] font-medium text-paper'
                      : step.done
                        ? 'text-[15px] text-paper/60'
                        : 'text-[15px] text-paper/40'
                  }`}
                >
                  {step.label}
                  {step.done && <span className="sr-only"> (done)</span>}
                  {step.active && <span className="sr-only"> (in progress)</span>}
                </p>
                {step.active && (
                  <div aria-hidden className="ob-indeterminate mt-2.5 h-[3px] w-full max-w-[220px] overflow-hidden rounded-full bg-paper/[0.07]" />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Orbit scan around a brand monogram. `lit` = number of nodes lit (0–3). */
export function OrbitVisual({ label, lit }: { label: string; lit: number }) {
  const initials =
    label
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || 'S';
  const nodes = [
    { top: '4%', left: '50%' },
    { top: '72%', left: '92%' },
    { top: '72%', left: '8%' },
  ];
  return (
    <div aria-hidden className="relative mx-auto h-48 w-48 sm:h-56 sm:w-56">
      <div className="absolute inset-0 rounded-full border border-paper/15" />
      <div className="ob-spin-slow absolute inset-0">
        {nodes.map((n, i) => (
          <span
            key={i}
            data-on={i < lit ? 'true' : 'false'}
            className="ob-orbit-node absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-paper/30 bg-ink"
            style={{ top: n.top, left: n.left }}
          />
        ))}
      </div>
      <div className="ob-spin-rev absolute inset-6 rounded-full border border-dashed border-paper/10" />
      <div className="ob-sweep absolute inset-3" />
      <div className="absolute inset-[30%] flex items-center justify-center rounded-[22%] bg-paper font-display text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
        {initials}
      </div>
    </div>
  );
}

/** Fanned stack of placeholder creatives "developing". `ready` cards look finished. */
export function DevelopingStack({ ready, total = 4 }: { ready: number; total?: number }) {
  const tilts = ['-9deg', '-3deg', '3deg', '9deg'];
  return (
    <div aria-hidden className="relative mx-auto flex h-44 items-end justify-center sm:h-52">
      {Array.from({ length: total }, (_, i) => {
        const done = i < ready;
        return (
          <div
            key={i}
            className="ob-float -mx-3 w-24 sm:w-28"
            style={{ '--r': tilts[i % tilts.length], '--d': `${i * 400}ms`, zIndex: i === 1 || i === 2 ? 2 : 1 } as React.CSSProperties}
          >
            <div
              className={`relative aspect-[4/5] overflow-hidden rounded-2xl border transition-all duration-700 ${
                done
                  ? 'border-transparent bg-paper-deep'
                  : 'ob-shimmer border-paper/10 bg-[#222222]'
              }`}
            >
              <div className="absolute inset-x-3 top-3 space-y-1.5">
                <div className={`h-1.5 w-2/3 rounded-full ${done ? 'bg-ink/70' : 'bg-paper/10'}`} />
                <div className={`h-1.5 w-1/2 rounded-full ${done ? 'bg-ink/30' : 'bg-paper/10'}`} />
              </div>
              <div className={`absolute bottom-3 left-1/2 h-10 w-8 -translate-x-1/2 rounded-md ${done ? 'bg-accent' : 'bg-paper/[0.06]'}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
