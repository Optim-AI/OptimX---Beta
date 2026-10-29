import React from 'react';
import { STEPS } from '@/lib/marketing/content';
import Reveal from './Reveal';
import { SectionHeading } from './ui';

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 bg-paper-deep">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:grid-cols-12 md:py-28">
        <div className="md:col-span-4">
          <SectionHeading id="how-title" eyebrow="How it works" title="Three steps. Seven days." />
        </div>
        <ol className="space-y-10 md:col-span-8 md:col-start-6">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 90} className="grid grid-cols-[3.25rem_1fr] gap-5 border-t border-ink/15 pt-6">
              <span aria-hidden className="font-display text-4xl leading-none text-accent">
                {i + 1}
              </span>
              <div>
                <h3 className="font-display text-2xl font-medium">{s.title}</h3>
                <p className="mt-2 max-w-lg text-ink-soft">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
