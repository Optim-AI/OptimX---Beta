'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Pause, Play } from 'lucide-react';
import { HERO_DEMO_VIDEO } from '@/lib/marketing/content';

/**
 * Hero demo: a short looping walkthrough of SkalX working for a fictional D2C brand —
 * website → research → angle → finished ads. The ads in the last step are real SkalX output
 * (poster, product video, UGC video) for that brand. Set HERO_DEMO_VIDEO in lib/marketing/content.ts to play a real screen
 * recording here instead.
 *
 * Fictional brand only (site rule: no real client or third-party brand work).
 * Autoplay pauses off-screen; with prefers-reduced-motion it starts paused on the last scene.
 */

const BRAND = 'Saffra Skin';
const SITE = 'saffraskin.in';
/** Real SkalX output for this fictional brand (scripts/generate-showcase.ts). */
const ASSETS = '/showcase/saffra-skin';
const SCENE_MS = 3600;
/** The Ads step stays on screen long enough to watch the videos. */
const sceneMs = (i: number) => ('ms' in SCENES[i] ? (SCENES[i] as { ms: number }).ms : SCENE_MS);

const SCENES = [
  { id: 'website', label: 'Website' },
  { id: 'research', label: 'Research' },
  { id: 'angle', label: 'Angle' },
  { id: 'ads', label: 'Ads', ms: 8000 },
] as const;

function SceneWebsite({ active }: { active: boolean }) {
  const [typed, setTyped] = useState(active ? 0 : SITE.length);
  useEffect(() => {
    if (!active) return;
    setTyped(0);
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setTyped(i);
      if (i >= SITE.length) window.clearInterval(t);
    }, 90);
    return () => window.clearInterval(t);
  }, [active]);
  const done = typed >= SITE.length;
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="hx-in font-display text-[clamp(1.1rem,2.4vw,2rem)] font-semibold tracking-[-0.02em]">
        Paste your website.
      </p>
      <p className="hx-in mt-1 text-[13px] text-white/55 lg:text-[15px]" style={{ '--d': '120ms' } as React.CSSProperties}>
        SkalX does the rest.
      </p>
      <div
        className="hx-in mt-6 flex w-full max-w-sm items-center lg:mt-8 lg:max-w-xl lg:p-2 lg:pl-5 gap-2 rounded-full border border-white/15 bg-white/[0.04] p-1.5 pl-4"
        style={{ '--d': '220ms' } as React.CSSProperties}
      >
        <span className="flex-1 truncate text-left font-mono text-[13px] text-white/90 lg:text-[16px]">
          {SITE.slice(0, typed)}
          <span className="hx-caret ml-px inline-block h-4 w-px translate-y-[3px] bg-white/80" />
        </span>
        <span
          className={`rounded-full px-4 py-2 text-[12px] font-semibold transition-all lg:px-5 lg:py-2.5 lg:text-[14px] duration-300 ${
            done ? 'scale-95 bg-white text-[#111]' : 'bg-white/90 text-[#111]'
          }`}
        >
          Get my audit
        </span>
      </div>
    </div>
  );
}

function SceneResearch() {
  const cards = [
    {
      title: 'Customers love',
      lines: ['“Light, never sticky”', '“Survives Chennai heat”'],
      dot: 'bg-[#7ee2a8]',
    },
    {
      title: 'Customers ask',
      lines: ['“Will it feel greasy on oily skin?”'],
      dot: 'bg-[#ffb08a]',
    },
    {
      title: 'Competitors running now',
      lines: ['Ingredient lists, no proof', 'Flat white packshots'],
      dot: 'bg-[#9db8ff]',
    },
  ];
  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center gap-2.5 px-5 sm:px-7 lg:gap-3.5">
      <p className="hx-in text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9db8ff]">Research · {SITE}</p>
      {cards.map((c, i) => (
        <div
          key={c.title}
          className="hx-in rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
          style={{ '--d': `${150 + i * 260}ms` } as React.CSSProperties}
        >
          <p className="flex items-center gap-2 text-[11.5px] font-medium text-white/60">
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
            {c.title}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-white/90 lg:text-[15.5px]">{c.lines.join('  ·  ')}</p>
        </div>
      ))}
    </div>
  );
}

function SceneAngle() {
  const angles = [
    { name: 'Oily skin? Still never greasy.', why: 'Answers the #1 question', pick: true },
    { name: 'Weightless, even in May', why: 'What reviewers praise most', pick: false },
    { name: 'A real oily-skin review', why: 'Buyers trust peers over ads', pick: false },
  ];
  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center gap-2.5 px-5 sm:px-7 lg:gap-3.5">
      <p className="hx-in text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9db8ff]">Angle · 3 worth testing</p>
      {angles.map((a, i) => (
        <div
          key={a.name}
          className={`hx-in flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
            a.pick ? 'hx-pick border-[#9db8ff] bg-[#9db8ff]/10' : 'border-white/10 bg-white/[0.03]'
          }`}
          style={{ '--d': `${150 + i * 220}ms` } as React.CSSProperties}
        >
          <div>
            <p className="text-[14px] font-medium text-white lg:text-[16.5px]">{a.name}</p>
            <p className="text-[12px] text-white/55">{a.why}</p>
          </div>
          {a.pick ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#9db8ff] text-[#111]">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SceneAds({ active }: { active: boolean }) {
  const motion = active && typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const Clip = ({ name, label }: { name: string; label: string }) => (
    <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-[#1a1a1a]">
      {motion ? (
        <video autoPlay muted loop playsInline poster={`${ASSETS}/${name}-poster.webp`} aria-label={label} className="absolute inset-0 h-full w-full object-cover">
          <source src={`${ASSETS}/${name}.webm`} type="video/webm" />
          <source src={`${ASSETS}/${name}.mp4`} type="video/mp4" />
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${ASSETS}/${name}-poster.webp`} alt={label} className="absolute inset-0 h-full w-full object-cover" />
      )}
      <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-medium lg:text-[11px]">
        <Play className="h-2.5 w-2.5 fill-current" /> 0:08
      </span>
    </div>
  );
  return (
    <div className="flex h-full items-end justify-center gap-2.5 px-4 pb-5 sm:gap-3.5 lg:gap-6 lg:pb-7">
      <figure className="hx-in m-0 w-[38%] max-w-[190px] lg:max-w-[260px]" style={{ '--d': '100ms' } as React.CSSProperties}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#1a1a1a]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ASSETS}/poster-1.webp`} alt="Saffra Skin feed poster: Oily skin? Still never greasy." className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <figcaption className="mt-1.5 text-center text-[10px] uppercase tracking-[0.12em] text-white/50 lg:text-[11px]">Poster</figcaption>
      </figure>
      <figure className="hx-in m-0 w-[24%] max-w-[118px] lg:max-w-[160px]" style={{ '--d': '350ms' } as React.CSSProperties}>
        <Clip name="product-video" label="Saffra Skin product video: the gel melting into skin" />
        <figcaption className="mt-1.5 text-center text-[10px] uppercase tracking-[0.12em] text-white/50 lg:text-[11px]">Video</figcaption>
      </figure>
      <figure className="hx-in m-0 w-[24%] max-w-[118px] lg:max-w-[160px]" style={{ '--d': '600ms' } as React.CSSProperties}>
        <Clip name="ugc" label="Saffra Skin UGC video: a creator with oily skin reviews the gel" />
        <figcaption className="mt-1.5 text-center text-[10px] uppercase tracking-[0.12em] text-white/50 lg:text-[11px]">UGC</figcaption>
      </figure>
    </div>
  );
}

export default function HeroDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);

  // Reduced motion: no autoplay, show the finished ads.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPaused(true);
      setScene(SCENES.length - 1);
    }
  }, []);

  // Don't run while scrolled away.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const playing = !paused && visible;
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setScene((s) => (s + 1) % SCENES.length), sceneMs(scene));
    return () => window.clearTimeout(t);
  }, [playing, scene]);

  if (HERO_DEMO_VIDEO) {
    return (
      <div className="overflow-hidden rounded-[22px] border border-ink/10 bg-[#111] shadow-[0_40px_80px_-48px_rgba(23,20,15,0.6)]">
        <video
          src={HERO_DEMO_VIDEO}
          className="block aspect-[16/11] w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          controls
          aria-label="SkalX product walkthrough"
        />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative" data-paused={playing ? 'false' : 'true'}>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -inset-y-8 -z-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_60%_50%,rgba(29,78,216,0.12),transparent_70%)]"
      />
      <section
        aria-roledescription="carousel"
        aria-label={`How SkalX works, an example for a fictional brand (${BRAND})`}
        className="overflow-hidden rounded-[22px] border border-ink/10 bg-[#111] text-white shadow-[0_40px_80px_-48px_rgba(23,20,15,0.6)]"
      >
        {/* Window bar */}
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
          <span aria-hidden className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white/15" />
            <span className="h-2 w-2 rounded-full bg-white/15" />
            <span className="h-2 w-2 rounded-full bg-white/15" />
          </span>
          <span className="truncate text-[11px] text-white/50">
            {BRAND} · <span className="text-white/35">Example, fictional brand</span>
          </span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Play demo' : 'Pause demo'}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            {paused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5 fill-current" />}
          </button>
        </div>

        {/* Stage */}
        <div className="relative h-[300px] sm:h-[340px] lg:h-[440px]" aria-live="off">
          <div key={scene} className="absolute inset-0" role="group" aria-roledescription="slide" aria-label={SCENES[scene].label}>
            {scene === 0 ? (
              <SceneWebsite active={playing} />
            ) : scene === 1 ? (
              <SceneResearch />
            ) : scene === 2 ? (
              <SceneAngle />
            ) : (
              <SceneAds active={playing} />
            )}
          </div>
        </div>

        {/* Progress + chapter controls */}
        <div className="grid grid-cols-4 gap-1.5 border-t border-white/[0.07] px-4 pb-3 pt-2.5">
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScene(i)}
              aria-current={i === scene ? 'step' : undefined}
              className="group text-left"
            >
              <span className="block h-[3px] overflow-hidden rounded-full bg-white/10">
                <span
                  key={i === scene ? `on-${scene}` : 'off'}
                  className={`block h-full rounded-full bg-[#9db8ff] ${
                    i < scene ? 'w-full' : i === scene ? (playing ? 'hx-fill' : 'w-full opacity-60') : 'w-0'
                  }`}
                  style={{ '--dur': `${sceneMs(i)}ms` } as React.CSSProperties}
                />
              </span>
              <span
                className={`mt-1.5 block text-[10.5px] font-medium uppercase lg:text-[12px] tracking-[0.12em] transition-colors ${
                  i === scene ? 'text-white' : 'text-white/45 group-hover:text-white/75'
                }`}
              >
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
