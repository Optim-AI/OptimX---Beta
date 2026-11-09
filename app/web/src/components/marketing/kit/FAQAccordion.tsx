import React from 'react';
import { Plus } from 'lucide-react';

export type FAQItem = { q: string; a: string };

/** FAQPage structured data for a list of questions (add to the page's JSON-LD). */
export function faqJsonLd(items: FAQItem[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/**
 * Accordion built on <details>/<summary>: keyboard and screen-reader friendly by default,
 * works without JS, and opens smoothly where the browser supports it.
 */
export function FAQAccordion({ items, className = '' }: { items: FAQItem[]; className?: string }) {
  return (
    <div className={`border-t border-ink/15 ${className}`}>
      {items.map((f) => (
        <details key={f.q} className="sx-faq group border-b border-ink/15">
          <summary className="flex cursor-pointer items-center gap-5 rounded-md py-5 text-[17px] font-medium transition-colors hover:text-accent-deep">
            <span className="flex-1">{f.q}</span>
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/20 transition-[transform,background-color,color] duration-300 group-open:rotate-45 group-open:bg-ink group-open:text-paper"
            >
              <Plus className="h-4 w-4" />
            </span>
          </summary>
          <p className="max-w-2xl pb-6 text-ink-soft">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
