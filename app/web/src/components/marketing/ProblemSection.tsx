import React from 'react';
import { PROBLEMS } from '@/lib/marketing/content';
import Reveal from './Reveal';
import { SectionHeading } from './ui';

export default function ProblemSection() {
  return (
    <section id="problem" aria-labelledby="problem-title" className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <SectionHeading id="problem-title" eyebrow="The problem" title="Good ads wear out. Fast." />
        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {PROBLEMS.map((p, i) => (
            <Reveal as="li" key={p.title} delay={i * 90} className="rounded-2xl border border-line bg-surface p-7">
              <span aria-hidden className="font-display text-sm text-ink-mute">
                0{i + 1}
              </span>
              <h3 className="mt-3 font-display text-2xl font-medium leading-tight">{p.title}</h3>
              <p className="mt-3 text-ink-soft">{p.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
