'use client';

import React from 'react';
import { Play } from 'lucide-react';
import { Enter } from './ob-ui';

type Props = {
  error?: string | null;
  failedMessage?: string | null;
  onCreate: () => void;
  disabled?: boolean;
};

/** Decorative fan of three ad cards that spreads on hover. */
function CreativeFan() {
  const cards = [
    { r: '-12deg', x: '-26px', bg: 'bg-paper-deep' },
    { r: '0deg', x: '0px', bg: 'bg-paper' },
    { r: '12deg', x: '26px', bg: 'bg-accent' },
  ];
  return (
    <div aria-hidden className="relative hidden h-28 w-32 shrink-0 sm:block">
      {cards.map((c, i) => (
        <div
          key={i}
          className={`ob-fan-card absolute bottom-0 left-1/2 h-24 w-[4.5rem] origin-bottom rounded-xl ${c.bg} shadow-[0_14px_30px_-14px_rgba(0,0,0,0.8)]`}
          style={{ '--r': c.r, '--x': c.x, zIndex: i === 1 ? 2 : 1 } as React.CSSProperties}
        >
          <div className="absolute inset-x-2 top-2 space-y-1">
            <div className={`h-1 w-3/4 rounded-full ${i === 2 ? 'bg-paper/80' : 'bg-ink/70'}`} />
            <div className={`h-1 w-1/2 rounded-full ${i === 2 ? 'bg-paper/50' : 'bg-ink/30'}`} />
          </div>
          <div className={`absolute bottom-2 left-1/2 h-7 w-5 -translate-x-1/2 rounded ${i === 2 ? 'bg-paper/80' : 'bg-accent/80'}`} />
        </div>
      ))}
    </div>
  );
}

export default function DemoChoicePanel({
  error,
  failedMessage,
  onCreate,
  disabled,
}: Props) {
  return (
    <div className="mx-auto mt-10 max-w-xl sm:mt-16">
      <Enter>
        <h1 className="mb-3 font-display text-3xl font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[2.6rem]">
          Let&apos;s make something for <span className="ob-gradient-text">your brand.</span>
        </h1>
      </Enter>
      <Enter delay={90}>
        <p className="mb-10 text-paper/65">
          Before you choose a plan, see what SkalX can create from your brand.
        </p>
      </Enter>
      {error && (
        <p className="mb-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-[hsl(0_84%_72%)]" role="alert">
          {error}
        </p>
      )}
      {failedMessage && !error && (
        <p className="mb-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-[hsl(0_84%_72%)]" role="alert">
          {failedMessage}
        </p>
      )}
      <div className="space-y-4">
        <Enter delay={170}>
          <button
            type="button"
            onClick={onCreate}
            disabled={disabled}
            className="ob-glass ob-card ob-ring-border group flex w-full items-center gap-5 rounded-3xl p-6 text-left disabled:opacity-60 sm:p-7"
          >
            <div className="min-w-0 flex-1">
              <div className="mb-1 text-lg font-medium">
                Create your first creatives{' '}
                <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </div>
              <div className="mb-3 text-sm text-paper/65">
                We&apos;ll generate a small set of personalized ad concepts using your brand,
                product and visual direction.
              </div>
              <div className="inline-flex rounded-full bg-paper/[0.06] px-2.5 py-1 text-xs text-paper/60">
                Demo creatives don&apos;t use your SkalX credits.
              </div>
            </div>
            <CreativeFan />
          </button>
        </Enter>
        <Enter delay={250}>
          <div className="ob-glass w-full rounded-3xl p-6 opacity-90">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
              <div className="flex gap-4">
                <span aria-hidden className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper/[0.06] ring-1 ring-paper/10">
                  <Play className="h-4 w-4 fill-paper/70 text-paper/70" />
                </span>
                <div>
                  <div className="mb-1 text-lg font-medium">Video creatives</div>
                  <div className="text-sm text-paper/65">
                    Turn the same brand direction into short-form video ads inside SkalX.
                  </div>
                </div>
              </div>
              <span className="shrink-0 rounded-full border border-paper/10 bg-paper/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-wider text-paper/60">
                Available after you continue
              </span>
            </div>
          </div>
        </Enter>
      </div>
    </div>
  );
}
