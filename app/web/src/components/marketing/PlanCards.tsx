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

/** Custom plan: no price, credits or checkout — just a route to the existing contact page. */
const CUSTOM_CARD = {
  name: 'Custom',
  subtext: 'Need more videos or images?',
  priceLabel: "Let's talk",
  body: "Tell us how many videos and posters you need each month, and we'll build a plan for you.",
  cta: 'Contact us',
  href: '/Contact',
} as const;

const CARD = 'flex flex-col rounded-2xl border p-6 xl:p-5';
const PRICE = 'font-display text-4xl font-medium xl:text-[2rem]';

const BUTTON = 'mt-auto inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 text-[15px] xl:px-3 font-medium transition-colors disabled:opacity-60';

function Features({ items }: { items: readonly string[] }) {
  return (
    <ul className="mb-6 mt-5 space-y-2 text-[15px] text-ink-soft">
      {items.map((cap) => (
        <li key={cap} className="flex gap-2">
          <Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-accent" />
          {cap}
        </li>
      ))}
    </ul>
  );
}

/** Minimal light plan cards: Free Trial, the three monthly plans from the live catalog, and Custom. */
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <article className={`${CARD} border-line bg-surface`}>
        <Heading className="font-display text-2xl font-medium">{FREE_TRIAL_CARD.name}</Heading>
        <p className="mt-1 text-sm text-ink-mute">{FREE_TRIAL_CARD.description}</p>
        <p className={`mt-4 ${PRICE}`}>{FREE_TRIAL_CARD.priceLabel}</p>
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
            className={`relative ${CARD} ${
              featured ? 'border-ink bg-surface shadow-[0_24px_50px_-34px_rgba(23,20,15,0.6)]' : 'border-line bg-surface'
            } ${selected ? 'ring-2 ring-accent' : ''}`}
          >
            {featured ? (
              <span className="absolute -top-3 left-6 rounded-full bg-ink px-3 py-1 text-xs font-medium text-paper">
                Recommended
              </span>
            ) : null}
            <Heading className="font-display text-2xl font-medium">{plan.name}</Heading>
            <span className="mt-1.5 w-fit rounded-full bg-accent-wash px-2.5 py-0.5 text-xs font-semibold text-accent-deep">
              {plan.offerLabel}
            </span>
            <p className="mt-4">
              <span className={PRICE}>{formatInr(plan.priceInr)}</span>
              <span className="block text-sm text-ink-mute">+ GST / month</span>
            </p>
            <p className="mt-1 text-sm text-ink-mute">{formatInr(totals.totalInr)} incl. 18% GST</p>
            <p className="mt-4 text-[15px]">
              <strong>{plan.imageCredits.toLocaleString('en-IN')}</strong> Image Credits
              <br />
              <strong>{plan.videoCredits.toLocaleString('en-IN')}</strong> Video Credits
            </p>
            <Features items={features} />
            {interactive && onChoosePlan ? (
              <button
                type="button"
                disabled={continuing}
                aria-label={`Select ${plan.name} plan`}
                onClick={() => onChoosePlan(plan.id)}
                className={`${BUTTON} ${featured ? 'bg-accent text-white hover:bg-accent-deep' : 'bg-ink text-paper hover:bg-accent-deep'}`}
              >
                {continuing && selected ? 'Continuing…' : `Choose ${plan.name}`}
              </button>
            ) : (
              <Link
                href="/pricing"
                className={`${BUTTON} ${featured ? 'bg-accent text-white hover:bg-accent-deep' : 'bg-ink text-paper hover:bg-accent-deep'}`}
              >
                Choose {plan.name}
              </Link>
            )}
          </article>
        );
      })}

      <article className={`${CARD} border-line bg-surface sm:col-span-2 lg:col-span-2 xl:col-span-1`}>
        <Heading className="font-display text-2xl font-medium">{CUSTOM_CARD.name}</Heading>
        <p className="mt-1 text-sm text-ink-mute">{CUSTOM_CARD.subtext}</p>
        <p className={`mt-4 ${PRICE}`}>{CUSTOM_CARD.priceLabel}</p>
        <p className="mb-6 mt-5 max-w-md text-[15px] text-ink-soft">{CUSTOM_CARD.body}</p>
        <Link
          href={CUSTOM_CARD.href}
          className={`${BUTTON} border border-ink/25 text-ink hover:border-ink hover:bg-paper sm:max-w-xs xl:max-w-none`}
        >
          {CUSTOM_CARD.cta}
        </Link>
      </article>
    </div>
  );
}
