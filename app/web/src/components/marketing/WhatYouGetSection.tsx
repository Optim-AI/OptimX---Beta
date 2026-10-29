import React from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { PILLARS, STARTING_PRICE, type Pillar } from '@/lib/marketing/content';
import Reveal from './Reveal';
import { ButtonLink, SectionHeading } from './ui';

/** Tiny CSS mockups — decorative, so hidden from assistive tech. */
function Mockup({ id }: { id: Pillar['id'] }) {
  if (id === 'research') {
    return (
      <div className="flex h-full gap-3">
        <div className="flex-1 space-y-1.5 rounded-md bg-surface p-2.5">
          <div className="h-2 w-2/3 rounded bg-ink/70" />
          <div className="h-1.5 w-full rounded bg-ink/15" />
          <div className="h-1.5 w-5/6 rounded bg-ink/15" />
          <div className="flex gap-1 pt-1">
            <span className="rounded-full bg-accent/15 px-1.5 text-[9px] font-medium text-accent-deep">“love the taste”</span>
            <span className="rounded-full bg-ink/10 px-1.5 text-[9px] font-medium">“too sweet”</span>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-5 w-5 rounded-full border border-ink/25 bg-surface" />
          ))}
        </div>
      </div>
    );
  }
  if (id === 'strategy') {
    return (
      <div className="flex h-full flex-col justify-center gap-2">
        <div className="flex gap-1.5">
          {['A', 'B', 'C'].map((a) => (
            <span key={a} className="whitespace-nowrap rounded-full border border-ink/25 bg-surface px-2 py-0.5 text-[10px] font-medium">
              Angle {a}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="flex aspect-square items-center justify-center rounded-[3px] bg-surface">
              {[0, 2, 4, 6].includes(i) ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full items-end gap-1.5">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={`w-7 rounded-[4px] ${i % 2 ? 'aspect-[9/16]' : 'aspect-[4/5]'} ${i === 1 ? 'bg-accent/70' : 'bg-ink/10'}`} />
      ))}
      <span className="relative flex aspect-[9/16] w-7 items-center justify-center rounded-[4px] bg-ink">
        <Play className="h-3 w-3 fill-paper text-paper" />
      </span>
    </div>
  );
}

export default function WhatYouGetSection() {
  return (
    <section id="what-you-get" aria-labelledby="wyg-title" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <SectionHeading
              id="wyg-title"
              eyebrow="What SkalX does"
              title="Research, then strategy, then content."
              intro="Most tools jump straight to making ads. SkalX starts with what your market is telling you."
            />
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {PILLARS.map((p, i) => (
                <Reveal as="li" key={p.id} delay={i * 80} className="flex flex-col rounded-2xl border border-line bg-paper-deep/60 p-5">
                  <div aria-hidden className="h-20">
                    <Mockup id={p.id} />
                  </div>
                  <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.14em] text-accent">
                    <span aria-hidden>0{i + 1} · </span>
                    {p.title}
                  </p>
                  <h3 className="mt-1 font-display text-xl font-medium leading-snug">{p.lead}</h3>
                  <ul className="mt-3 space-y-1.5 text-[15px] text-ink-soft">
                    {p.points.map((pt) => (
                      <li key={pt} className="flex gap-2">
                        <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink/40" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              ))}
            </ol>
          </div>

          <aside aria-label="Plans" className="lg:col-span-4 lg:pt-28">
            <div className="rounded-2xl bg-ink p-7 text-paper lg:sticky lg:top-24">
              <p className="text-sm uppercase tracking-[0.14em] text-paper/70">Plans from</p>
              <p className="mt-2 font-display text-5xl font-medium">
                {STARTING_PRICE.replace(' + GST', '')}
                <span className="ml-2 align-middle font-body text-base font-normal text-paper/70">+ GST / month</span>
              </p>
              <p className="mt-3 text-paper/70">Research, strategy and creation in one place. Cancel anytime.</p>
              <ButtonLink href="/#start" variant="onInk" className="mt-7 w-full">
                Get a free ad first
              </ButtonLink>
              <Link href="/pricing" className="mt-4 block text-center text-sm text-accent-on-ink underline underline-offset-4">
                See all plans
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
