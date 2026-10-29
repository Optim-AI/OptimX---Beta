import React from 'react';
import Link from 'next/link';
import { Play, RotateCcw } from 'lucide-react';
import { DELIVERABLES, SPRINT, type Deliverable } from '@/lib/marketing/content';
import Reveal from './Reveal';
import { ButtonLink, SectionHeading } from './ui';

/** Tiny CSS mockups — decorative, so hidden from assistive tech. */
function Mockup({ id }: { id: Deliverable['id'] }) {
  const tile = 'rounded-[4px] bg-ink/10';
  switch (id) {
    case 'snapshot':
      return (
        <div className="flex h-full gap-3">
          <div className="flex-1 space-y-1.5 rounded-md bg-surface p-2.5">
            <div className="h-2 w-2/3 rounded bg-ink/70" />
            <div className="h-1.5 w-full rounded bg-ink/15" />
            <div className="h-1.5 w-5/6 rounded bg-ink/15" />
            <div className="h-1.5 w-3/4 rounded bg-ink/15" />
          </div>
          <div className="flex flex-col justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-5 w-5 rounded-full border border-ink/25 bg-surface" />
            ))}
          </div>
        </div>
      );
    case 'concept':
      return (
        <div className="flex h-full flex-col justify-center gap-2">
          <div className="h-2.5 w-1/2 rounded bg-ink/70" />
          <div className="flex gap-1.5">
            {['A', 'B', 'C'].map((a) => (
              <span key={a} className="whitespace-nowrap rounded-full border border-ink/25 bg-surface px-2 py-0.5 text-[10px] font-medium">
                Angle {a}
              </span>
            ))}
          </div>
        </div>
      );
    case 'statics':
      return (
        <div className="grid h-full grid-cols-6 items-end gap-1">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className={`${tile} ${i % 2 ? 'aspect-[9/16]' : 'aspect-[4/5]'} ${i === 4 ? 'bg-accent/70' : ''}`} />
          ))}
        </div>
      );
    case 'videos':
      return (
        <div className="flex h-full items-center justify-center gap-3">
          {[0, 1].map((i) => (
            <span key={i} className="relative flex aspect-[9/16] h-full items-center justify-center rounded-md bg-ink">
              <Play className="h-3.5 w-3.5 fill-paper text-paper" />
              <span className="absolute bottom-1 text-[9px] text-paper/80">0:15</span>
            </span>
          ))}
        </div>
      );
    case 'calendar':
      return (
        <div className="grid h-full grid-cols-7 content-center gap-1">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="flex aspect-square items-center justify-center rounded-[3px] bg-surface">
              {[0, 2, 4, 7, 9, 11].includes(i) ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
            </span>
          ))}
        </div>
      );
    case 'revision':
      return (
        <div className="flex h-full items-center gap-3">
          <RotateCcw className="h-7 w-7 text-accent" />
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`${tile} aspect-[4/5] w-7`} />
            ))}
          </div>
        </div>
      );
  }
}

export default function WhatYouGetSection() {
  return (
    <section id="what-you-get" aria-labelledby="wyg-title" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <SectionHeading
              id="wyg-title"
              eyebrow={`The ${SPRINT.name}`}
              title="Everything you need for a launch."
              intro="One sprint, one fixed price. Delivered as ready-to-use files."
            />
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {DELIVERABLES.map((d, i) => (
                <Reveal as="li" key={d.id} delay={(i % 3) * 80} className="flex flex-col rounded-2xl border border-line bg-paper-deep/60 p-5">
                  <div aria-hidden className="h-20">
                    <Mockup id={d.id} />
                  </div>
                  <h3 className="mt-5 text-[17px] font-semibold leading-snug">{d.title}</h3>
                  <p className="mt-1.5 text-[15px] text-ink-soft">{d.desc}</p>
                </Reveal>
              ))}
            </ul>
          </div>

          <aside aria-label="Sprint price" className="lg:col-span-4 lg:pt-28">
            <div className="rounded-2xl bg-ink p-7 text-paper lg:sticky lg:top-24">
              <p className="text-sm uppercase tracking-[0.14em] text-paper/70">Founding price</p>
              <p className="mt-2 font-display text-5xl font-medium">
                {SPRINT.foundingPrice}
                <span className="ml-2 align-middle text-base font-normal text-paper/70">{SPRINT.gstNote}</span>
              </p>
              <p className="mt-1 text-paper/70">
                <s>{SPRINT.price}</s> · first 3 brands only
              </p>
              <dl className="mt-6 space-y-3 border-t border-paper/15 pt-6 text-[15px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-paper/70">Turnaround</dt>
                  <dd>{SPRINT.turnaround}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-paper/70">Payment</dt>
                  <dd className="text-right">{SPRINT.paymentTerms}</dd>
                </div>
              </dl>
              <ButtonLink href="/free-ad" variant="onInk" className="mt-7 w-full">
                Get one free ad first
              </ButtonLink>
              <Link href="/pricing" className="mt-4 block text-center text-sm text-accent-on-ink underline underline-offset-4">
                Full pricing
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
