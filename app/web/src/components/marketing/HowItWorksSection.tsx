'use client';

import React, { useEffect, useRef, useState } from 'react';
import { STEPS } from '@/lib/marketing/content';
import { SectionHeading } from './ui';

/**
 * Scroll story: a rail fills as the steps pass the middle of the viewport and the current
 * step lights up. Without JS or with reduced motion every step is shown at full strength.
 */
export default function HowItWorksSection() {
  const listRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      list.style.setProperty('--p', '1');
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = list.getBoundingClientRect();
      const mid = window.innerHeight * 0.55;
      const p = Math.min(1, Math.max(0, (mid - r.top) / r.height));
      list.style.setProperty('--p', p.toFixed(3));
      const items = Array.from(list.children) as HTMLElement[];
      let idx = -1;
      items.forEach((el, i) => {
        if (el.getBoundingClientRect().top < mid) idx = i;
      });
      setActive(idx);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="how-it-works" aria-labelledby="how-title" className="sx-sheet scroll-mt-20 bg-paper-deep">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:grid-cols-12 md:py-32">
        <div className="md:col-span-5">
          <div className="md:sticky md:top-32">
            <SectionHeading id="how-title" index="02" eyebrow="How it works" title="Three simple steps." />
            <p aria-hidden className="mt-8 hidden font-display text-[7rem] font-bold leading-none tracking-[-0.06em] text-ink/[0.07] md:block">
              {active < 0 ? 1 : active + 1}/{STEPS.length}
            </p>
          </div>
        </div>
        <ol ref={listRef} className="relative md:col-span-7">
          {/* Rail + fill */}
          <span aria-hidden className="absolute bottom-6 left-[15px] top-2 w-px bg-ink/15" />
          <span aria-hidden className="sx-rail-fill absolute bottom-6 left-[15px] top-2 w-px bg-accent" />
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              data-active={active === -1 ? 'true' : i <= active ? 'true' : 'false'}
              className="sx-step relative grid grid-cols-[2rem_1fr] gap-6 pb-14 last:pb-0 md:pb-24"
            >
              <span
                aria-hidden
                className="sx-step-dot relative z-10 mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-ink font-display text-sm font-semibold text-paper"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-[1.08] tracking-[-0.025em]">
                  {s.title}
                </h3>
                <p className="mt-3 max-w-md text-lg text-ink-soft">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
