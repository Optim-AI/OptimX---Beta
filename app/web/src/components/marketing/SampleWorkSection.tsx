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

export default function SampleWorkSection() {
  return (
    <section id="samples" aria-labelledby="samples-title" className="bg-paper-deep">
      <div className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 md:pt-28">
        <SectionHeading
          id="samples-title"
          eyebrow="Sample work"
          title="What a sprint looks like."
          intro="Feed ads, story ads and short videos, built from product photos."
        />
      </div>
      {/* Horizontal strip: scrolls inside itself, never the page. */}
      <ul
        aria-label="Sample creatives for fictional brands"
        className="mx-auto mt-10 flex max-w-6xl snap-x snap-mandatory scroll-px-4 items-end gap-4 overflow-x-auto px-4 pb-6 sm:scroll-px-6 sm:px-6"
      >
        {SAMPLES.map((s) => (
          <li key={s.src} className="shrink-0 snap-start">
            <figure className="m-0">
              {s.format === 'feed' ? (
                <div className="relative aspect-[4/5] w-[230px] overflow-hidden rounded-xl shadow-[0_18px_40px_-22px_rgba(23,20,15,0.5)] sm:w-[260px]">
                  <Image src={s.src} alt={s.alt} fill loading="lazy" sizes="260px" className="object-cover" />
                </div>
              ) : (
                <PhoneFrame className="w-[150px] sm:w-[165px]">
                  <Image src={s.src} alt={s.alt} fill loading="lazy" sizes="165px" className="object-cover" />
                  {s.format === 'video' ? (
                    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-ink/80 px-1.5 py-0.5 text-[10px] font-medium text-paper">
                      <Play aria-hidden className="h-2.5 w-2.5 fill-current" /> 0:15
                    </span>
                  ) : null}
                </PhoneFrame>
              )}
              <figcaption className="mt-2 text-[13px] text-ink-mute">{s.label}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
      <p className="mx-auto max-w-6xl px-4 pb-20 text-sm text-ink-soft sm:px-6 md:pb-28">
        Sample work for fictional brands. Not client campaigns.
      </p>
    </section>
  );
}
