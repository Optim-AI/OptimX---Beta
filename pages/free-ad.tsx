import React from 'react';
import PageSeo from '@/components/seo/PageSeo';
import FreeAdForm from '@/app/web/src/components/FreeAdForm';
import MarketingLayout from '@/app/web/src/components/marketing/MarketingLayout';
import { Eyebrow } from '@/app/web/src/components/marketing/ui';

const STEPS = [
  'Tell us about your brand.',
  'AJ makes one ad for it using SkalX.',
  'You get it by email within 2 working days. No strings.',
];

/** Door-opener: one free ad, made manually by the founder. */
export default function FreeAdPage() {
  return (
    <MarketingLayout>
      <PageSeo
        title="Get one free ad for your brand"
        description="See it before you pay. Tell us about your D2C brand and we'll make one ad for it, free, within 2 working days."
        path="/free-ad"
      />
      <section aria-labelledby="free-ad-title" className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 md:pb-28 md:pt-16">
        <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5 lg:pt-4">
            <Eyebrow>Free sample</Eyebrow>
            <h1
              id="free-ad-title"
              className="font-display text-[clamp(2.5rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.02em]"
            >
              See it before you pay.
            </h1>
            <p className="mt-5 text-xl text-ink-soft">We&apos;ll make one ad for your brand, free.</p>
            <ol className="mt-10 space-y-5">
              {STEPS.map((step, i) => (
                <li key={step} className="grid grid-cols-[2.5rem_1fr] items-start gap-3">
                  <span aria-hidden className="font-display text-2xl leading-none text-accent">
                    {i + 1}
                  </span>
                  <span className="text-ink-soft">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-[0_30px_60px_-40px_rgba(23,20,15,0.45)] sm:p-8 lg:col-span-7">
            <FreeAdForm />
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
