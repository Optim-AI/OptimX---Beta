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
    <section id="faq" aria-labelledby="faq-title" className="sx-sheet scroll-mt-20 bg-paper-deep">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-12 md:py-32">
        <div className="md:col-span-4">
          <div className="md:sticky md:top-32">
            <SectionHeading id="faq-title" index="08" eyebrow="FAQ" title="Questions founders ask." />
          </div>
        </div>
        <div className="border-t border-ink/15 md:col-span-8">
          {FAQS.map((f, i) => (
            <details key={f.q} className="sx-faq group border-b border-ink/15">
              <summary className="flex cursor-pointer items-center gap-5 rounded-md py-6 text-lg font-medium transition-colors hover:text-accent-deep">
                <span aria-hidden className="w-6 shrink-0 font-display text-sm tabular-nums text-ink-mute">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="flex-1">{f.q}</span>
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/20 transition-[transform,background-color,border-color,color] duration-300 group-open:rotate-45 group-open:border-ink group-open:bg-ink group-open:text-paper"
                >
                  <Plus className="h-4 w-4" />
                </span>
              </summary>
              <p className="max-w-2xl pb-7 pl-11 text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
