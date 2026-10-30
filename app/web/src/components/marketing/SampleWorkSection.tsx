import React from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { PhoneFrame, SectionHeading } from './ui';

/**
 * Sample work — fictional brands only. Never real client or third-party brand work.
 * Files live in /public/images/samples (see README there for sizes).
 */
const SAMPLES = [
  { src: '/images/samples/sample-feed-01.png', format: 'feed', label: 'Feed 4:5', alt: 'Sample feed ad for a fictional snack brand' },
  { src: '/images/samples/sample-story-01.png', format: 'story', label: 'Story 9:16', alt: 'Sample story ad for a fictional beverage brand' },
  { src: '/images/samples/sample-feed-02.png', format: 'feed', label: 'Feed 4:5', alt: 'Sample feed ad for a fictional beverage brand' },
  { src: '/images/samples/sample-video-01.png', format: 'video', label: 'Video 15s', alt: 'Frame from a sample video ad for a fictional brand' },
  { src: '/images/samples/sample-feed-03.png', format: 'feed', label: 'Feed 4:5', alt: 'Sample feed ad for a fictional skincare brand' },
  { src: '/images/samples/sample-story-02.png', format: 'story', label: 'Story 9:16', alt: 'Sample story ad for a fictional personal-care brand' },
  { src: '/images/samples/sample-feed-04.png', format: 'feed', label: 'Feed 4:5', alt: 'Sample feed ad for a fictional personal-care brand' },
] as const;

const TILTS = ['-2.2deg', '1.6deg', '-1deg', '2.4deg', '-1.8deg', '1.2deg', '-2deg'];

/** Ink "gallery wall": creatives pinned at slight angles that straighten on hover/focus. */
export default function SampleWorkSection() {
  return (
    <section id="samples" aria-labelledby="samples-title" className="sx-sheet relative isolate overflow-hidden bg-ink text-paper">
      <div aria-hidden className="sx-glow pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden className="sx-grid-bg-ink pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-20 sm:px-6 md:flex-row md:items-end md:justify-between md:pt-32">
        <SectionHeading
          id="samples-title"
          index="04"
          tone="ink"
          eyebrow="Sample work"
          title="Made with SkalX."
          intro="Feed ads, story ads and short videos, built from product photos."
        />
      </div>
      {/* Horizontal strip: scrolls inside itself, never the page. Focusable so keyboards can scroll it. */}
      <ul
        aria-label="Sample creatives for fictional brands"
        tabIndex={0}
        className="sx-fade-x mx-auto mt-8 flex max-w-6xl snap-x snap-mandatory scroll-px-4 items-end gap-6 overflow-x-auto px-4 pb-8 pt-10 [scrollbar-color:rgba(246,241,232,0.25)_transparent] sm:scroll-px-6 sm:px-6"
      >
        {SAMPLES.map((s, i) => (
          <li key={s.src} className="shrink-0 snap-start">
            <figure className="sx-tilt-card m-0" style={{ '--r': TILTS[i % TILTS.length] } as React.CSSProperties}>
              {s.format === 'feed' ? (
                <div className="relative aspect-[4/5] w-[230px] overflow-hidden rounded-xl shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)] ring-1 ring-paper/10 sm:w-[260px]">
                  <Image src={s.src} alt={s.alt} fill loading="lazy" sizes="260px" className="object-cover" />
                </div>
              ) : (
                <PhoneFrame className="w-[150px] ring-1 ring-paper/20 sm:w-[165px]">
                  <Image src={s.src} alt={s.alt} fill loading="lazy" sizes="165px" className="object-cover" />
                  {s.format === 'video' ? (
                    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-ink/80 px-1.5 py-0.5 text-[10px] font-medium text-paper">
                      <Play aria-hidden className="h-2.5 w-2.5 fill-current" /> 0:15
                    </span>
                  ) : null}
                </PhoneFrame>
              )}
              <figcaption className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-paper/70">{s.label}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
      <p className="mx-auto max-w-6xl px-4 pb-20 text-sm text-paper/70 sm:px-6 md:pb-32">
        Sample work for fictional brands. Not client campaigns.
      </p>
    </section>
  );
}
