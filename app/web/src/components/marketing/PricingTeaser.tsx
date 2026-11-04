'use client';

import React from 'react';
import Link from 'next/link';
import PlanCards from './PlanCards';
import Reveal from './Reveal';
import { SectionHeading } from './ui';
import { DFY_COPY, DoneForYouView, PricingModeToggle, tabIdFor, usePricingMode } from './PricingModeToggle';

export default function PricingTeaser() {
  const { mode, setMode, panelId } = usePricingMode();
  const dfy = mode === 'dfy';

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="sx-sheet bg-paper-deep">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-32">
        <SectionHeading
          id="pricing-title"
          index="06"
          eyebrow="Pricing"
          title={dfy ? DFY_COPY.title : 'Simple monthly plans.'}
          intro={dfy ? DFY_COPY.intro : 'Pick the credits you need. Top up or cancel anytime.'}
        />

        <PricingModeToggle mode={mode} onChange={setMode} panelId={panelId} className="mt-10" />

        <div id={panelId} role="tabpanel" aria-labelledby={tabIdFor(panelId, mode)} className="mt-10 sm:mt-12">
          {dfy ? (
            <div key="dfy" className="sx-swap-in">
              <DoneForYouView />
            </div>
          ) : (
            <div key="diy" className="sx-swap-in">
              <Reveal variant="scale">
                <PlanCards headingLevel="h3" />
              </Reveal>
              <p className="mt-8 text-ink-soft">
                Prices are + 18% GST.{' '}
                <Link href="/pricing" className="sx-link font-medium text-ink">
                  Compare plans in detail
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
