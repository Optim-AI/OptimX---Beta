import React from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { PhoneFrame, SectionHeading } from './ui';
import LoopingVideo from './LoopingVideo';

/**
 * Sample ads made with SkalX. Files live in /public/images/samples and
 * /public/videos/samples (see README there for sizes).
 */
const SAMPLES: ReadonlyArray<{
  src: string;
  format: 'feed' | 'story' | 'video';
  label: string;
  alt: string;
  /** Feed cards: the image's own width/height ratio (default 4/5), so nothing is cropped. */
  ratio?: string;
  /** Video slots: the clip that loops inside the phone frame (src is its poster). */
  video?: string;
}> = [
  // Alternates video, poster, video … so every poster sits between two clips.
  { src: '/videos/samples/sample-video-01.jpg', video: '/videos/samples/sample-video-01.mp4', format: 'video', label: 'Video 9:16', alt: 'Video ad: wireless earbuds in quick TV-ad cuts' },
  { src: '/images/samples/sample-feed-01.jpg', format: 'feed', label: 'Feed 4:5', alt: 'Feed ad for Crunchwell masala makhana' },
  { src: '/videos/samples/sample-video-02.jpg', video: '/videos/samples/sample-video-02.mp4', format: 'video', label: 'Video 9:16', alt: 'Video ad: a woman’s morning skincare routine with a matching product range' },
  { src: '/images/samples/sample-story-03.jpg', format: 'story', label: 'Story 9:16', alt: 'Story ad for Plum Body Lovin vanilla caramello body lotion' },
  { src: '/videos/samples/sample-video-03.jpg', video: '/videos/samples/sample-video-03.mp4', format: 'video', label: 'Video 9:16', alt: 'Video ad: a woman shows a skincare product to her phone camera' },
  { src: '/images/samples/sample-square-01.jpg', format: 'feed', ratio: '1/1', label: 'Square 1:1', alt: 'Comic-style sale ad for the boAt Stone 350 speaker' },
  { src: '/videos/samples/sample-video-04.jpg', video: '/videos/samples/sample-video-04.mp4', format: 'video', label: 'Video 9:16', alt: 'Video ad: a tea tin, cookies and honey packed into one gift box' },
  { src: '/images/samples/sample-feed-05.jpg', format: 'feed', ratio: '7/9', label: 'Feed', alt: 'Feed ad for Yoga Bar high protein dark chocolate oats' },
  { src: '/videos/samples/sample-video-05.jpg', video: '/videos/samples/sample-video-05.mp4', format: 'video', label: 'Video 9:16', alt: 'Video ad: a family runs their small food business together' },
  { src: '/images/samples/sample-story-01.jpg', format: 'story', label: 'Story 9:16', alt: 'Story ad for Tidal Lime sparkling soda' },
  { src: '/videos/samples/sample-video-06.jpg', video: '/videos/samples/sample-video-06.mp4', format: 'video', label: 'Video 9:16', alt: 'Video ad: a spice-business founder shows his workshop to the camera' },
  { src: '/images/samples/sample-feed-06.jpg', format: 'feed', ratio: '7/9', label: 'Feed', alt: 'Feed ad for The Whole Truth plant protein' },
  { src: '/videos/samples/sample-video-07.jpg', video: '/videos/samples/sample-video-07.mp4', format: 'video', label: 'Video 9:16', alt: 'Video ad: an old family photograph in a spice workshop at dawn' },
];

const TILTS = ['-2.2deg', '1.6deg', '-1deg', '2.4deg', '-1.8deg', '1.2deg', '-2deg', '1.4deg'];

/** Ink "gallery wall": creatives pinned at slight angles that straighten on hover/focus. */
export default function SampleWorkSection() {
  return (
    <section id="samples" aria-labelledby="samples-title" className="sx-sheet relative isolate overflow-hidden bg-ink text-paper">
      <div aria-hidden className="sx-glow pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden className="sx-grid-bg-ink pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-20 sm:px-6 md:flex-row md:items-end md:justify-between md:pt-32">
        <SectionHeading
          id="samples-title"
          index="01"
          tone="ink"
          eyebrow="Sample work"
          title="Made with SkalX."
          intro="Feed ads, story ads and short videos, built from product photos."
        />
      </div>
      {/* Horizontal strip: scrolls inside itself, never the page. Focusable so keyboards can scroll it. */}
      <ul
        aria-label="Sample ads made with SkalX"
        tabIndex={0}
        className="sx-fade-x mx-auto mt-8 flex max-w-6xl snap-x snap-mandatory scroll-px-4 items-end gap-6 overflow-x-auto px-4 pb-8 pt-10 [scrollbar-color:rgba(246,241,232,0.25)_transparent] sm:scroll-px-6 sm:px-6"
      >
        {SAMPLES.map((s, i) => (
          <li key={s.src} className="shrink-0 snap-start">
            <figure className="sx-tilt-card m-0" style={{ '--r': TILTS[i % TILTS.length] } as React.CSSProperties}>
              {s.format === 'feed' ? (
                <div
                  className="relative w-[230px] overflow-hidden rounded-xl shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)] ring-1 ring-paper/10 sm:w-[260px]"
                  style={{ aspectRatio: s.ratio ?? '4/5' }}
                >
                  <Image src={s.src} alt={s.alt} fill loading="lazy" sizes="260px" className="object-cover" />
                </div>
              ) : (
                <PhoneFrame className="w-[150px] ring-1 ring-paper/20 sm:w-[165px]">
                  {s.video ? (
                    <>
                      <LoopingVideo src={s.video} poster={s.src} label={s.alt} />
                      <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-ink/80 px-1.5 py-0.5 text-[10px] font-medium text-paper">
                        <Play aria-hidden className="h-2.5 w-2.5 fill-current" /> Video
                      </span>
                    </>
                  ) : (
                    <Image src={s.src} alt={s.alt} fill loading="lazy" sizes="165px" className="object-cover" />
                  )}
                </PhoneFrame>
              )}
              <figcaption className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-paper/70">{s.label}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
      <p className="mx-auto max-w-6xl px-4 pb-20 text-sm text-paper/70 sm:px-6 md:pb-32">
        Sample &amp; fictional brand ads made with SkalX.
      </p>
    </section>
  );
}
