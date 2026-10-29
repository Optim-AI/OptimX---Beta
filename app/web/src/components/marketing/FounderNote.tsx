import React from 'react';
import Image from 'next/image';
import { FOUNDER } from '@/lib/marketing/content';
import Reveal from './Reveal';

export function FounderPhoto({ className = '' }: { className?: string }) {
  if (FOUNDER.photo) {
    return (
      <div className={`relative aspect-square overflow-hidden rounded-2xl ${className}`}>
        <Image src={FOUNDER.photo} alt={`${FOUNDER.name}, founder of SkalX`} fill sizes="240px" className="object-cover" />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={`Photo of ${FOUNDER.name} (placeholder)`}
      className={`flex aspect-square items-center justify-center rounded-2xl border border-dashed border-ink/30 bg-paper-deep font-display text-4xl text-ink-mute ${className}`}
    >
      {FOUNDER.shortName}
    </div>
  );
}

export function FounderContacts() {
  return (
    <p className="text-ink-soft">
      <a href={`mailto:${FOUNDER.email}`} className="font-medium text-ink underline underline-offset-4">
        {FOUNDER.email}
      </a>
      {FOUNDER.linkedinUrl ? (
        <>
          {' · '}
          <a href={FOUNDER.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline underline-offset-4">
            LinkedIn
          </a>
        </>
      ) : null}
    </p>
  );
}

export default function FounderNote() {
  return (
    <section id="founder" aria-labelledby="founder-title">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <Reveal className="grid items-center gap-8 md:grid-cols-12">
          <FounderPhoto className="w-40 sm:w-52 md:col-span-3 md:w-full" />
          <div className="md:col-span-8 md:col-start-5">
            <h2 id="founder-title" className="text-[13px] font-semibold uppercase tracking-[0.16em] text-accent">
              A note from the founder
            </h2>
            <blockquote className="mt-4 font-display text-[clamp(1.5rem,2.8vw,2.1rem)] leading-snug">
              <p>{FOUNDER.note}</p>
            </blockquote>
            <p className="mt-5 font-medium">— {FOUNDER.name}, Chennai</p>
            <div className="mt-2">
              <FounderContacts />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
