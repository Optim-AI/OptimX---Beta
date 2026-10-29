import React from 'react';
import { Check } from 'lucide-react';
import { DELIVERABLES, SPRINT, bookingHref } from '@/lib/marketing/content';
import { ButtonLink } from './ui';

type Props = {
  /** Full card for /pricing (payment terms + risk reversal); compact for the homepage teaser. */
  variant?: 'full' | 'compact';
  headingLevel?: 'h2' | 'h3';
};

export default function SprintCard({ variant = 'full', headingLevel = 'h2' }: Props) {
  const Heading = headingLevel;
  const full = variant === 'full';
  return (
    <article className="overflow-hidden rounded-3xl border border-ink/15 bg-surface shadow-[0_30px_60px_-40px_rgba(23,20,15,0.45)]">
      <div className="grid md:grid-cols-12">
        <div className="p-7 sm:p-10 md:col-span-7">
          <p className="inline-flex rounded-full bg-accent-wash px-3 py-1 text-[13px] font-semibold text-accent-deep">
            Done for you · {SPRINT.turnaround}
          </p>
          <Heading className="mt-4 font-display text-3xl font-medium leading-tight sm:text-4xl">{SPRINT.name}</Heading>
          <ul className="mt-6 space-y-3">
            {DELIVERABLES.map((d) => (
              <li key={d.id} className="flex gap-3">
                <Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-accent" />
                <span>
                  <span className="font-medium">{d.title}</span>
                  {full ? <span className="text-ink-soft"> — {d.desc}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col border-t border-line bg-paper-deep/70 p-7 sm:p-10 md:col-span-5 md:border-l md:border-t-0">
          <p className="text-sm font-medium text-ink-soft">{SPRINT.foundingNote}</p>
          <p className="mt-2 font-display text-5xl font-medium sm:text-6xl">
            {SPRINT.foundingPrice}
            <span className="ml-2 align-middle font-body text-base font-normal text-ink-soft">{SPRINT.gstNote}</span>
          </p>
          <p className="mt-1 text-ink-soft">
            Regular price <s>{SPRINT.price}</s> {SPRINT.gstNote}
          </p>

          <dl className="mt-6 space-y-2 border-t border-line pt-5 text-[15px]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Delivery</dt>
              <dd className="font-medium">{SPRINT.turnaround}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Payment</dt>
              <dd className="text-right font-medium">{SPRINT.paymentTerms}</dd>
            </div>
          </dl>

          {full ? <p className="mt-5 rounded-xl bg-accent-wash p-4 text-[15px] font-medium">{SPRINT.riskReversal}</p> : null}

          <div className="mt-7 flex flex-col gap-3">
            <ButtonLink href={bookingHref}>Book a 15-min call</ButtonLink>
            <ButtonLink href="/free-ad" variant="secondary">
              Get a free ad first
            </ButtonLink>
          </div>
        </div>
      </div>
    </article>
  );
}
