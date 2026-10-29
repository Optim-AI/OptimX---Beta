import React from 'react';
import Link from 'next/link';
import PlanCards from './PlanCards';
import Reveal from './Reveal';
import { SectionHeading } from './ui';

export default function PricingTeaser() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="bg-paper-deep">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <SectionHeading
          id="pricing-title"
          eyebrow="Pricing"
          title="Simple monthly plans."
          intro="Pick the credits you need. Top up or cancel anytime."
        />
        <Reveal className="mt-10">
          <PlanCards headingLevel="h3" />
        </Reveal>
        <p className="mt-8 text-ink-soft">
          Prices are + 18% GST.{' '}
          <Link href="/pricing" className="font-medium text-ink underline underline-offset-4">
            Compare plans in detail
          </Link>
        </p>
      </div>
    </section>
  );
}
