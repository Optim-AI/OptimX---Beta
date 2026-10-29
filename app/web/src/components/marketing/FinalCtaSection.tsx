import React from 'react';
import StartForm from './StartForm';

export default function FinalCtaSection() {
  return (
    <section id="get-started" aria-labelledby="final-cta-title" className="bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 md:grid-cols-12 md:py-28">
        <div className="md:col-span-6">
          <h2 id="final-cta-title" className="font-display text-[clamp(2.25rem,4.6vw,3.5rem)] font-medium leading-[1.05]">
            See it before you pay.
          </h2>
          <p className="mt-4 text-xl text-paper/80">
            Paste your website. SkalX researches your market and competitors and gives you 3 ad ideas — free.
          </p>
        </div>
        <div className="md:col-span-6">
          <StartForm inputId="final-brand-input" onInk />
        </div>
      </div>
    </section>
  );
}
