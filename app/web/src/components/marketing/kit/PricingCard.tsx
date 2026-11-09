import React from 'react';
import { Check } from 'lucide-react';
import { PRICING_COPY, type PricingPlan } from '@/content/pricing';
import { Badge } from './Badge';
import { CTAButton } from './CTAButton';

/** One self-serve plan, with numbers from content/pricing.ts (the live catalog). */
export function PricingCard({
  plan,
  ctaHref,
  ctaLabel,
  features = [],
  headingLevel = 'h3',
}: {
  plan: PricingPlan;
  ctaHref: string;
  ctaLabel?: string;
  features?: readonly string[];
  headingLevel?: 'h2' | 'h3';
}) {
  const Heading = headingLevel;
  const featured = plan.mostPopular;
  return (
    <article
      className={`sx-lift relative flex h-full flex-col rounded-card border p-6 ${
        featured ? 'border-ink bg-ink text-paper shadow-lift' : 'border-line bg-surface text-ink'
      }`}
    >
      {featured ? (
        <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">
          {PRICING_COPY.mostPopularLabel}
        </span>
      ) : null}
      <Heading className="font-display text-2xl font-semibold tracking-[-0.02em]">{plan.name}</Heading>
      <p className="mt-4">
        <span className="font-display text-4xl font-semibold tracking-[-0.03em]">{plan.priceLabel}</span>
        <span className={`ml-1 text-sm ${featured ? 'text-paper/70' : 'text-ink-mute'}`}>+ GST / month</span>
      </p>
      <ul className={`mt-5 space-y-2 text-[15px] ${featured ? 'text-paper/85' : 'text-ink-soft'}`}>
        <li className="flex flex-wrap items-center gap-2">
          <strong className={featured ? 'text-paper' : 'text-ink'}>{plan.imageCredits.toLocaleString('en-IN')} image credits</strong>
          <Badge tone={featured ? 'ink' : 'paper'}>{PRICING_COPY.imageCreditsBadge}</Badge>
        </li>
        <li>
          <strong className={featured ? 'text-paper' : 'text-ink'}>{plan.videos15s}×15s</strong> or {plan.videos30s}×30s video ads
        </li>
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check aria-hidden className={`mt-1 h-4 w-4 shrink-0 ${featured ? 'text-accent-on-ink' : 'text-accent'}`} />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6">
        <CTAButton href={ctaHref} variant={featured ? 'onInk' : 'secondary'} size="md" className="w-full">
          {ctaLabel ?? `Choose ${plan.name}`}
        </CTAButton>
      </div>
    </article>
  );
}
