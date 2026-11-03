import React from 'react';
import StartForm from './StartForm';

export default function FinalCtaSection() {
  return (
    <section id="get-started" aria-labelledby="final-cta-title" className="sx-sheet relative isolate overflow-hidden bg-ink text-paper">
      <div aria-hidden className="sx-glow pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden className="sx-grid-bg-ink pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto grid max-w-6xl items-end gap-12 px-4 py-24 sm:px-6 md:grid-cols-12 md:py-36">
        <div className="md:col-span-7">
          <h2
            id="final-cta-title"
            className="text-balance font-display text-[clamp(2.75rem,7vw,5.75rem)] font-semibold leading-[0.95] tracking-[-0.045em]"
          >
            See it before you pay.
          </h2>
          <p className="mt-6 max-w-lg text-xl text-paper/80">
            Paste your website. SkalX researches your market and competitors and gives you 3 ad ideas — free.
          </p>
        </div>
        <div className="md:col-span-5">
          <div className="sx-crop sx-crop-ink rounded-[24px] border border-paper/15 bg-paper/[0.04] p-5 backdrop-blur-sm sm:p-7">
            <StartForm inputId="final-brand-input" onInk />
          </div>
        </div>
      </div>
    </section>
  );
}
