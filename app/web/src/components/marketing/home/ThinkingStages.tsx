import React from 'react';
import { THINKING } from '@/content/home';
import Reveal from '../Reveal';
import { MockupFrame } from '../kit/MockupFrame';
import { Section, SectionHeading } from '../kit/Section';

/** Small example outputs for each stage (fictional brand, labelled "Example"). */
function StageOutput({ index }: { index: number }) {
  if (index === 0) {
    return (
      <dl className="space-y-2 text-[13px]">
        {[
          ['Sells', 'Gel moisturiser, ₹449'],
          ['Buyer', 'Women 22–35, oily skin, metro cities'],
          ['Voice', 'Friendly, clinical, no hype'],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-14 shrink-0 text-ink-mute">{k}</dt>
            <dd className="text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    );
  }
  if (index === 1) {
    return (
      <ul className="space-y-2 text-[13px]">
        {[
          ['Mistleaf', 'Discount-led', '9 days'],
          ['Aqua Bloom', 'Ingredient story', '47 days'],
          ['Kesar & Co.', 'Festive offer', '12 days'],
        ].map(([n, a, d]) => (
          <li
            key={n}
            className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ${n === 'Aqua Bloom' ? 'bg-accent-wash text-accent-deep' : 'bg-paper'}`}
          >
            <span className="font-medium">{n}</span>
            <span className="truncate text-ink-soft">{a}</span>
            <span className="shrink-0 tabular-nums">{d}</span>
          </li>
        ))}
        <li className="pt-1 text-[12px] text-ink-mute">Longest-running ad highlighted</li>
      </ul>
    );
  }
  if (index === 2) {
    return (
      <ol className="space-y-2 text-[13px]">
        {['Will it feel sticky in humidity?', 'Does it work on oily skin?', 'Is ₹449 worth it vs. a drugstore gel?'].map((d, i) => (
          <li key={d} className="flex gap-2">
            <span className="font-display font-semibold text-accent">{i + 1}</span>
            <span>{d}</span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="flex aspect-[4/5] w-20 shrink-0 flex-col justify-between rounded-lg bg-[#1f4d3a] p-2 text-[#eaf5ee]">
        <p className="font-display text-[9px] font-bold leading-tight">Oily skin? Never greasy.</p>
        <span aria-hidden className="mx-auto h-6 w-5 rounded-md bg-current opacity-30" />
      </div>
      <div className="text-[12.5px]">
        <p className="font-semibold text-accent-deep">Why this ad</p>
        <p className="mt-1 text-ink-soft">Answers doubt #2: “Does it work on oily skin?”</p>
      </div>
    </div>
  );
}

/** Section 2b: the four thinking stages. Vertical timeline on mobile, horizontal stepper on desktop. */
export default function ThinkingStages() {
  return (
    <Section id="how-skalx-thinks" labelledBy="thinking-title" tone="deep" className="sx-sheet">
      <SectionHeading id="thinking-title" eyebrow={THINKING.eyebrow} title={THINKING.title} />
      <ol className="relative mt-12 grid gap-8 lg:grid-cols-4 lg:gap-5">
        {/* Connector: vertical on mobile, horizontal on desktop */}
        <span aria-hidden className="absolute bottom-6 left-[15px] top-2 w-px bg-ink/15 lg:hidden" />
        <span aria-hidden className="absolute left-4 right-4 top-[15px] hidden h-px bg-ink/15 lg:block" />
        {THINKING.stages.map((s, i) => (
          <Reveal as="li" key={s.title} delay={i * 110} className="relative grid grid-cols-[32px_1fr] gap-4 lg:grid-cols-1 lg:gap-0">
            <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ink font-display text-sm font-semibold text-paper">
              {i + 1}
            </span>
            <div className="lg:mt-5">
              <h3 className="font-display text-h3 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-[15px] text-ink-soft">{s.body}</p>
              <MockupFrame title={s.output} label="Example" variant="app" className="mt-4">
                <StageOutput index={i} />
              </MockupFrame>
            </div>
          </Reveal>
        ))}
      </ol>
      <p className="mt-12 font-display text-[clamp(1.25rem,2.4vw,1.75rem)] font-semibold tracking-[-0.02em]">{THINKING.closing}</p>
    </Section>
  );
}
