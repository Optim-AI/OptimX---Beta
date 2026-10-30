import React from 'react';
import { PROBLEMS } from '@/lib/marketing/content';
import Reveal from './Reveal';
import { SectionHeading } from './ui';

/** Editorial ledger: oversized outlined numerals that fill with the accent as each row arrives. */
export default function ProblemSection() {
  return (
    <section id="problem" aria-labelledby="problem-title" className="relative">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-32">
        <SectionHeading id="problem-title" index="01" eyebrow="The problem" title="Good ads wear out. Fast." />
        <ol className="mt-14 border-b border-line">
          {PROBLEMS.map((p, i) => (
            <Reveal
              as="li"
              key={p.title}
              delay={i * 110}
              className="group grid gap-x-8 gap-y-3 border-t border-line py-8 transition-colors hover:bg-surface/60 md:grid-cols-12 md:items-baseline md:py-10"
            >
              <span
                aria-hidden
                className="sx-outline-num font-display text-[clamp(3rem,7vw,5.5rem)] font-bold leading-none tracking-[-0.04em] md:col-span-2"
                style={{ transitionDelay: `${i * 110 + 250}ms` }}
              >
                0{i + 1}
              </span>
              <h3 className="font-display text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-[1.1] tracking-[-0.02em] md:col-span-5">
                {p.title}
              </h3>
              <p className="max-w-md text-ink-soft md:col-span-5 md:text-lg">{p.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
