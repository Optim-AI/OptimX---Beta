import React from 'react';
import { Plus } from 'lucide-react';
import { FAQS } from '@/lib/marketing/content';
import { SectionHeading } from './ui';

/** FAQPage structured data for the same questions (homepage). */
export const faqJsonLd = {
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-12 md:py-28">
        <div className="md:col-span-4">
          <SectionHeading id="faq-title" eyebrow="FAQ" title="Questions founders ask." />
        </div>
        <div className="divide-y divide-line border-y border-line md:col-span-8">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-1">
              <summary className="flex cursor-pointer items-center justify-between gap-6 rounded-md py-5 text-lg font-medium">
                {f.q}
                <Plus aria-hidden className="h-5 w-5 shrink-0 text-ink-mute transition-transform group-open:rotate-45" />
              </summary>
              <p className="max-w-2xl pb-6 text-ink-soft">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
