import React from 'react';
import Link from 'next/link';
import { MARKETING_SUBSCRIPTION_PLANS, formatPricePlusGst } from '@/lib/billing/marketing-plans';
import Reveal from './Reveal';
import SprintCard from './SprintCard';
import { SectionHeading } from './ui';

export default function PricingTeaser() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="bg-paper-deep">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <SectionHeading id="pricing-title" eyebrow="Pricing" title="One fixed price. No retainer." />
        <Reveal className="mt-10">
          <SprintCard variant="compact" headingLevel="h3" />
        </Reveal>
        <p className="mt-8 text-ink-soft">
          Prefer to make creatives yourself?{' '}
          <Link href="/pricing#self-serve" className="font-medium text-ink underline underline-offset-4">
            See the self-serve plans
          </Link>{' '}
          from {formatPricePlusGst(Math.min(...MARKETING_SUBSCRIPTION_PLANS.map((p) => p.priceInr)))} a month.
        </p>
      </div>
    </section>
  );
}
