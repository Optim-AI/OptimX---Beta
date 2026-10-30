'use client';

import React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import {
  MARKETING_SUBSCRIPTION_PLANS,
  formatInr,
  subscriptionTotalsInr,
  type MarketingPlanId,
} from '@/lib/billing/marketing-plans';
import { PLAN_CARD_CAPABILITIES } from '@/lib/onboarding/plan-comparison';
import { FREE_TRIAL_CARD } from '@/lib/trial/validate';

type Props = {
  /** Plan names render as this heading level. */
  headingLevel?: 'h2' | 'h3';
  /**
   * With handlers (/pricing): buttons select a plan / open the trial request.
   * Without (homepage teaser): buttons link to /pricing.
   */
  onChoosePlan?: (planId: MarketingPlanId) => void;
  onRequestTrial?: () => void;
  selectedPlanId?: MarketingPlanId | null;
  continuing?: boolean;
};

const BUTTON = 'mt-auto inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 text-[15px] font-medium transition-colors disabled:opacity-60';

function Features({ items, onInk = false }: { items: readonly string[]; onInk?: boolean }) {
  return (
    <ul className={`mb-6 mt-5 space-y-2 text-[15px] ${onInk ? 'text-paper/80' : 'text-ink-soft'}`}>
      {items.map((cap) => (
        <li key={cap} className="flex gap-2">
          <Check aria-hidden className={`mt-1 h-4 w-4 shrink-0 ${onInk ? 'text-accent-on-ink' : 'text-accent'}`} />
          {cap}
        </li>
      ))}
    </ul>
  );
}

/** Minimal light plan cards: Free Trial + the three monthly plans from the live catalog. */
export default function PlanCards({
  headingLevel = 'h3',
  onChoosePlan,
  onRequestTrial,
  selectedPlanId = null,
  continuing = false,
}: Props) {
  const Heading = headingLevel;
  const interactive = Boolean(onChoosePlan);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article className="sx-lift flex flex-col rounded-[20px] border border-line bg-surface p-6 hover:border-ink/30">
        <Heading className="font-display text-2xl font-semibold tracking-[-0.02em]">{FREE_TRIAL_CARD.name}</Heading>
        <p className="mt-1 text-sm text-ink-mute">{FREE_TRIAL_CARD.description}</p>
        <p className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em]">{FREE_TRIAL_CARD.priceLabel}</p>
        <p className="mt-1 text-sm text-ink-mute">{FREE_TRIAL_CARD.supporting}</p>
        <Features items={FREE_TRIAL_CARD.features} />
        {interactive && onRequestTrial ? (
          <button
            type="button"
            disabled={continuing}
            onClick={onRequestTrial}
            className={`${BUTTON} border border-ink/25 text-ink hover:border-ink hover:bg-paper`}
          >
            {FREE_TRIAL_CARD.cta}
          </button>
        ) : (
          <Link href="/pricing" className={`${BUTTON} border border-ink/25 text-ink hover:border-ink hover:bg-paper`}>
            {FREE_TRIAL_CARD.cta}
          </Link>
        )}
        <p className="mt-3 text-center text-xs text-ink-mute">{FREE_TRIAL_CARD.note}</p>
      </article>

      {MARKETING_SUBSCRIPTION_PLANS.map((plan) => {
        const featured = plan.id === 'skalx_growth';
        const selected = selectedPlanId === plan.id;
        const totals = subscriptionTotalsInr(plan.priceInr);
        const features = plan.id === 'skalx_pro' ? [...PLAN_CARD_CAPABILITIES, 'Priority generation'] : PLAN_CARD_CAPABILITIES;
        return (
          <article
            key={plan.id}
            className={`sx-lift relative flex flex-col rounded-[20px] border p-6 ${
              featured
                ? 'bg-ink sx-glow border-ink text-paper shadow-[0_40px_70px_-40px_rgba(23,20,15,0.85)] xl:-my-3 xl:py-9'
                : 'border-line bg-surface hover:border-ink/30'
            } ${selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-paper' : ''}`}
          >
            {featured ? (
              <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-xs font-medium text-white shadow-[0_8px_18px_-8px_rgba(29,78,216,0.9)]">
                Recommended
              </span>
            ) : null}
            <Heading className="font-display text-2xl font-semibold tracking-[-0.02em]">{plan.name}</Heading>
            <p className="mt-4">
              <span className="font-display text-4xl font-semibold tracking-[-0.03em]">{formatInr(plan.priceInr)}</span>
              <span className={`block text-sm ${featured ? 'text-paper/70' : 'text-ink-mute'}`}>+ GST / month</span>
            </p>
            <p className={`mt-1 text-sm ${featured ? 'text-paper/70' : 'text-ink-mute'}`}>{formatInr(totals.totalInr)} incl. 18% GST</p>
            <p className="mt-4 text-[15px]">
              <strong>{plan.imageCredits.toLocaleString('en-IN')}</strong> Image Credits
              <br />
              <strong>{plan.videoCredits.toLocaleString('en-IN')}</strong> Video Credits
            </p>
            <Features items={features} onInk={featured} />
            {interactive && onChoosePlan ? (
              <button
                type="button"
                disabled={continuing}
                aria-label={`Select ${plan.name} plan`}
                onClick={() => onChoosePlan(plan.id)}
                className={`${BUTTON} ${featured ? 'bg-paper text-ink hover:bg-white' : 'bg-ink text-paper hover:bg-accent-deep'}`}
              >
                {continuing && selected ? 'Continuing…' : `Choose ${plan.name}`}
              </button>
            ) : (
              <Link
                href="/pricing"
                className={`${BUTTON} ${featured ? 'bg-paper text-ink hover:bg-white' : 'bg-ink text-paper hover:bg-accent-deep'}`}
              >
                Choose {plan.name}
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );
}
