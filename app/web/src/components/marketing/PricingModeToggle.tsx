'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Check } from 'lucide-react';
import DoneForYouForm from './DoneForYouForm';

/**
 * Shared "Do it yourself / Done for you" switch for the website pricing sections
 * (homepage #pricing and /pricing). Marketing only — no billing, plans or checkout.
 */

export type PricingMode = 'diy' | 'dfy';

const MODES: { id: PricingMode; label: string }[] = [
  { id: 'diy', label: 'Self-serve' },
  { id: 'dfy', label: 'Done-for-you' },
];

export const DFY_COPY = {
  title: 'We make it for you.',
  intro: "Tell us about your brand. We'll plan, create and deliver your marketing content every month.",
} as const;

const STEPS = [
  { title: 'Share your brand', body: 'Tell us about your products, customers and offers.' },
  { title: 'Approve the plan', body: 'We research your market and send a content plan.' },
  { title: 'We create it', body: 'Our team makes your posters and video ads using SkalX.' },
  { title: 'Review and receive', body: 'Get ready-to-post files after up to 2 rounds of changes.' },
] as const;

const DELIVERABLES = [
  'Brand research & competitive research',
  'Marketing and content plan',
  'Product photoshoots, posters and videos',
  'Ready-to-post files every month',
] as const;

/** Shareable link value: `?plan=done-for-you` opens the "Done for you" view. */
const DFY_QUERY_VALUE = 'done-for-you';

function writeModeToUrl(mode: PricingMode) {
  try {
    const url = new URL(window.location.href);
    if (mode === 'dfy') url.searchParams.set('plan', DFY_QUERY_VALUE);
    else url.searchParams.delete('plan');
    window.history.replaceState(window.history.state, '', url.toString());
  } catch {
    /* ignore */
  }
}

/** Current mode ("Do it yourself" by default), synced with `?plan=done-for-you`. */
export function usePricingMode() {
  const router = useRouter();
  const panelId = `${useId()}-pricing-panel`;
  const [mode, setModeState] = useState<PricingMode>('diy');
  const planParam = router.isReady && typeof router.query.plan === 'string' ? router.query.plan : null;

  // Read the shareable link once the router has the real query (not during prerender).
  useEffect(() => {
    if (!router.isReady) return;
    setModeState(planParam === DFY_QUERY_VALUE ? 'dfy' : 'diy');
  }, [router.isReady, planParam]);

  const setMode = (next: PricingMode) => {
    setModeState(next);
    writeModeToUrl(next);
  };

  return { mode, setMode, panelId };
}

export function tabIdFor(panelId: string, mode: PricingMode) {
  return `${panelId}-tab-${mode}`;
}

export function PricingModeToggle({
  mode,
  onChange,
  panelId,
  className = '',
}: {
  mode: PricingMode;
  onChange: (mode: PricingMode) => void;
  panelId: string;
  className?: string;
}) {
  const tabRefs = useRef<Record<PricingMode, HTMLButtonElement | null>>({ diy: null, dfy: null });

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const i = MODES.findIndex((m) => m.id === mode);
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % MODES.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + MODES.length) % MODES.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = MODES.length - 1;
    if (next == null) return;
    e.preventDefault();
    onChange(MODES[next].id);
    tabRefs.current[MODES[next].id]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="How you want to work with SkalX"
      className={`relative inline-grid grid-cols-2 rounded-full border border-line bg-surface p-1 ${className}`}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-ink transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ transform: mode === 'dfy' ? 'translateX(100%)' : 'none' }}
      />
      {MODES.map((m) => {
        const selected = m.id === mode;
        return (
          <button
            key={m.id}
            ref={(el) => {
              tabRefs.current[m.id] = el;
            }}
            id={tabIdFor(panelId, m.id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(m.id)}
            onKeyDown={onKeyDown}
            className={`relative z-10 min-h-11 whitespace-nowrap rounded-full px-5 text-[15px] font-medium transition-colors duration-300 sm:px-7 ${
              selected ? 'text-paper' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

/** "Done for you" view: How it works + What you get beside the enquiry form (stacked on mobile). */
export function DoneForYouView({ headingLevel = 'h3' }: { headingLevel?: 'h2' | 'h3' }) {
  const Heading = headingLevel;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="rounded-[20px] border border-line bg-surface p-6 sm:p-8 lg:col-span-5">
        <Heading className="font-display text-2xl font-semibold tracking-[-0.02em]">How it works</Heading>
        <ol className="mt-6 space-y-5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-wash font-display text-sm font-semibold text-accent"
              >
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="mt-0.5 text-[15px] text-ink-soft">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <Heading className="mt-10 font-display text-2xl font-semibold tracking-[-0.02em]">What you get</Heading>
        <ul className="mt-5 space-y-2 text-[15px] text-ink-soft">
          {DELIVERABLES.map((item) => (
            <li key={item} className="flex gap-2">
              <Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-accent" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-6 border-t border-line pt-5 text-[15px] text-ink-soft">
          Pricing depends on how much content you need.
        </p>
      </div>

      <div className="rounded-[20px] border border-line bg-surface p-6 sm:p-8 lg:col-span-7">
        <Heading className="mb-6 font-display text-2xl font-semibold tracking-[-0.02em]">Tell us what you need</Heading>
        <DoneForYouForm />
      </div>
    </div>
  );
}
