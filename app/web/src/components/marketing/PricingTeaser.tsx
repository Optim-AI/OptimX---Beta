import React from 'react';
import Link from 'next/link';
import PlanCards from './PlanCards';
import Reveal from './Reveal';
import { SectionHeading } from './ui';

export default function PricingTeaser() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="sx-sheet bg-paper-deep">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-32">
        <SectionHeading
          id="pricing-title"
          index="06"
          eyebrow="Pricing"
          title="Simple monthly plans."
          intro="Pick the credits you need. Top up or cancel anytime."
        />
        <Reveal variant="scale" className="mt-14">
          <PlanCards headingLevel="h3" />
        </Reveal>
        <p className="mt-8 text-ink-soft">
          Prices are + 18% GST.{' '}
          <Link href="/pricing" className="sx-link font-medium text-ink">
            Compare plans in detail
          </Link>
        </p>
      </div>
    </section>
  );
}
