import React from 'react';
import FreeAdForm from '../FreeAdForm';

export default function FinalCtaSection() {
  return (
    <section id="free-ad" aria-labelledby="final-cta-title" className="bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-12 md:py-28">
        <div className="md:col-span-5">
          <h2 id="final-cta-title" className="font-display text-[clamp(2.25rem,4.6vw,3.5rem)] font-medium leading-[1.05]">
            See it before you pay.
          </h2>
          <p className="mt-4 text-xl text-paper/80">We&apos;ll make one ad for your brand, free.</p>
          <p className="mt-6 text-paper/70">Made by the founder. In your inbox within 2 working days.</p>
        </div>
        <div className="rounded-2xl bg-surface p-5 text-ink sm:p-8 md:col-span-7">
          <FreeAdForm />
        </div>
      </div>
    </section>
  );
}
