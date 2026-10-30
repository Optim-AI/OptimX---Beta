import React from 'react';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
import { FOUNDER } from '@/lib/marketing/content';
import Reveal from './Reveal';

export function FounderPhoto({ className = '' }: { className?: string }) {
  if (FOUNDER.photo) {
    return (
      <div className={`relative aspect-[4/5] overflow-hidden rounded-2xl shadow-[0_18px_40px_-24px_rgba(20,16,10,0.55)] ${className}`}>
        <Image src={FOUNDER.photo} alt={`${FOUNDER.name}, founder of SkalX`} fill sizes="(min-width: 768px) 260px, 224px" className="object-cover object-[50%_30%]" />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={`Photo of ${FOUNDER.name} (placeholder)`}
      className={`flex aspect-[4/5] items-center justify-center rounded-2xl border border-dashed border-ink/30 bg-paper-deep font-display text-4xl text-ink-mute ${className}`}
    >
      {FOUNDER.shortName}
    </div>
  );
}

/** "— Sudharsan AJ, Founder" with the location under it. */
export function FounderSignature({ className = 'mt-5' }: { className?: string }) {
  return (
    <div className={className}>
      <p className="font-medium">— {FOUNDER.name}, Founder</p>
      <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-soft">
        <MapPin className="h-4 w-4" aria-hidden /> Chennai, India
      </p>
    </div>
  );
}

export function FounderContacts() {
  return (
    <p className="flex flex-wrap items-center gap-x-1 text-ink-soft">
      <a href={`mailto:${FOUNDER.email}`} className="sx-link font-medium text-ink">
        {FOUNDER.email}
      </a>
      {FOUNDER.linkedinUrl ? (
        <>
          {' · '}
          <a href={FOUNDER.linkedinUrl} target="_blank" rel="noopener noreferrer" className="sx-link font-medium text-ink">
            LinkedIn
          </a>
        </>
      ) : null}
    </p>
  );
}

export default function FounderNote() {
  return (
    <section id="founder" aria-labelledby="founder-title" className="sx-sheet relative overflow-hidden bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-32">
        {/* Photo column is fixed-width and stretches to the text: its top lines up with the
            label and its bottom with the email. */}
        <Reveal className="grid items-start gap-8 md:grid-cols-[clamp(200px,20vw,260px)_minmax(0,1fr)] md:items-stretch md:gap-12">
          <div className="sx-crop w-48 sm:w-56 md:h-full md:w-full">
            <FounderPhoto className="md:aspect-auto md:h-full md:w-full" />
          </div>
          <div className="relative min-w-0">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-2 -top-10 select-none font-display text-[12rem] font-bold leading-none text-accent/10 md:-top-16 md:text-[16rem]"
            >
              &rdquo;
            </span>
            <h2 id="founder-title" className="flex items-center gap-3 text-[12.5px] font-semibold uppercase tracking-[0.18em] text-accent">
              <span aria-hidden className="font-display tabular-nums text-ink-mute">07</span>
              <span aria-hidden className="h-px w-6 bg-ink/25" />
              A note from the founder
            </h2>
            <blockquote className="relative mt-5 text-balance font-display text-[clamp(1.45rem,2.6vw,2.05rem)] font-medium leading-[1.3] tracking-[-0.015em]">
              <p>{FOUNDER.note}</p>
            </blockquote>
            <FounderSignature />
            <div className="mt-2">
              <FounderContacts />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
