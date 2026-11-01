'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Pause, Play } from 'lucide-react';
import { HERO_DEMO_VIDEO } from '@/lib/marketing/content';

/**
 * Hero demo: a short looping "video" of SkalX working for a fictional D2C brand —
 * website → research → strategy → finished ads. Built in code (no video file) so it stays
 * sharp and light. Set HERO_DEMO_VIDEO in lib/marketing/content.ts to play a real screen
 * recording here instead.
 *
 * Fictional brand only (site rule: no real client or third-party brand work).
 * Autoplay pauses off-screen; with prefers-reduced-motion it starts paused on the last scene.
 */

const BRAND = 'Kaapi & Co.';
const SITE = 'kaapiandco.in';
const SCENE_MS = 3600;

const SCENES = [
  { id: 'website', label: 'Website' },
  { id: 'research', label: 'Research' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'create', label: 'Create' },
] as const;

/** Cold-brew bottle used in the example ads. */
function Bottle({ className = '', tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  return (
    <svg viewBox="0 0 60 120" className={className} aria-hidden>
      <rect x="22" y="2" width="16" height="12" rx="3" fill={tone === 'light' ? '#2b1d14' : '#f3e7d3'} />
      <path d="M20 14h20v10c8 4 12 10 12 18v66a10 10 0 0 1-10 10H18A10 10 0 0 1 8 108V42c0-8 4-14 12-18z" fill="#4a2c1a" />
      <rect x="12" y="52" width="36" height="38" rx="4" fill="#f3e7d3" />
      <text x="30" y="68" textAnchor="middle" fontSize="7" fontWeight="700" fill="#4a2c1a" fontFamily="Montserrat, sans-serif">
        KAAPI
      </text>
      <text x="30" y="78" textAnchor="middle" fontSize="5" fill="#8a5a3b" fontFamily="Poppins, sans-serif">
        cold brew
      </text>
    </svg>
  );
}

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
      <p className="hx-in font-display text-[clamp(1.1rem,2.2vw,1.45rem)] font-semibold tracking-[-0.02em]">
        Paste your website.
      </p>
      <p className="hx-in mt-1 text-[13px] text-white/55" style={{ '--d': '120ms' } as React.CSSProperties}>
        SkalX does the rest.
      </p>
      <div
        className="hx-in mt-6 flex w-full max-w-sm items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] p-1.5 pl-4"
        style={{ '--d': '220ms' } as React.CSSProperties}
      >
        <span className="flex-1 truncate text-left font-mono text-[13px] text-white/90">
          {SITE.slice(0, typed)}
          <span className="hx-caret ml-px inline-block h-4 w-px translate-y-[3px] bg-white/80" />
        </span>
        <span
          className={`rounded-full px-4 py-2 text-[12px] font-semibold transition-all duration-300 ${
            done ? 'scale-95 bg-white text-[#111]' : 'bg-white/90 text-[#111]'
          }`}
        >
          Get a free ad
        </span>
      </div>
    </div>
  );
}

function SceneResearch() {
  const cards = [
    {
      title: 'Customers love',
      lines: ['“Smooth, never bitter”', '“Keeps me going till lunch”'],
      dot: 'bg-[#7ee2a8]',
    },
    {
      title: 'Customers complain',
      lines: ['“Most cold brews are too sweet”', '“Bottle leaks in my bag”'],
      dot: 'bg-[#ffb08a]',
    },
    {
      title: 'Competitors running now',
      lines: ['4 discount ads', '1 founder-story video'],
      dot: 'bg-[#9db8ff]',
    },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 px-5 sm:px-7">
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
          <p className="mt-1 text-[13px] leading-snug text-white/90">{c.lines.join('  ·  ')}</p>
        </div>
      ))}
    </div>
  );
}

function SceneStrategy() {
  const angles = [
    { name: 'Smooth, not sweet', why: 'Answers the #1 complaint', pick: true },
    { name: 'Leak-proof, bag-ready', why: 'Fixes a real annoyance', pick: false },
    { name: 'Your 9 a.m. ritual', why: 'Competitors only push discounts', pick: false },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 px-5 sm:px-7">
      <p className="hx-in text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9db8ff]">Strategy · 3 ad angles</p>
      {angles.map((a, i) => (
        <div
          key={a.name}
          className={`hx-in flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
            a.pick ? 'hx-pick border-[#9db8ff] bg-[#9db8ff]/10' : 'border-white/10 bg-white/[0.03]'
          }`}
          style={{ '--d': `${150 + i * 220}ms` } as React.CSSProperties}
        >
          <div>
            <p className="text-[14px] font-medium text-white">{a.name}</p>
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

function SceneCreate() {
  return (
    <div className="flex h-full items-end justify-center gap-2.5 px-4 pb-5 sm:gap-3.5">
      {/* Feed 4:5 */}
      <figure className="hx-in m-0 w-[40%] max-w-[190px]" style={{ '--d': '100ms' } as React.CSSProperties}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#f3e7d3] p-3 text-[#2b1d14]">
          <p className="font-display text-[clamp(0.85rem,1.6vw,1.05rem)] font-bold leading-[1.05] tracking-[-0.02em]">
            Smooth,
            <br />
            not sweet.
          </p>
          <p className="mt-1 text-[9px] text-[#6b4a35]">Zero added sugar cold brew</p>
          <Bottle className="absolute bottom-2 right-3 h-[58%] w-auto" />
          <span className="absolute bottom-3 left-3 rounded-full bg-[#2b1d14] px-2.5 py-1 text-[9px] font-semibold text-[#f3e7d3]">
            Shop now
          </span>
        </div>
        <figcaption className="mt-1.5 text-center text-[10px] uppercase tracking-[0.12em] text-white/50">Feed 4:5</figcaption>
      </figure>
      {/* Story 9:16 */}
      <figure className="hx-in m-0 w-[24%] max-w-[118px]" style={{ '--d': '350ms' } as React.CSSProperties}>
        <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-[#a8623a] p-2.5 text-[#fff7ec]">
          <p className="font-display text-[11px] font-bold leading-tight">Leaks? Not this bottle.</p>
          <Bottle className="absolute bottom-7 left-1/2 h-[46%] w-auto -translate-x-1/2" tone="dark" />
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#f3e7d3] px-2 py-0.5 text-[8px] font-semibold text-[#2b1d14]">
            Swipe up
          </span>
        </div>
        <figcaption className="mt-1.5 text-center text-[10px] uppercase tracking-[0.12em] text-white/50">Story</figcaption>
      </figure>
      {/* Video 9:16 */}
      <figure className="hx-in m-0 w-[24%] max-w-[118px]" style={{ '--d': '600ms' } as React.CSSProperties}>
        <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-[#1d4ed8] text-white">
          <div className="hx-zoom absolute inset-0 flex items-center justify-center">
            <Bottle className="h-[52%] w-auto" />
          </div>
          <p className="absolute inset-x-2.5 top-2.5 font-display text-[11px] font-bold leading-tight">Your 9 a.m. ritual.</p>
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-medium">
            <Play className="h-2.5 w-2.5 fill-current" /> 0:15
          </span>
        </div>
        <figcaption className="mt-1.5 text-center text-[10px] uppercase tracking-[0.12em] text-white/50">Video</figcaption>
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
    const t = window.setTimeout(() => setScene((s) => (s + 1) % SCENES.length), SCENE_MS);
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
        <div className="relative h-[300px] sm:h-[340px]" aria-live="off">
          <div key={scene} className="absolute inset-0" role="group" aria-roledescription="slide" aria-label={SCENES[scene].label}>
            {scene === 0 ? (
              <SceneWebsite active={playing} />
            ) : scene === 1 ? (
              <SceneResearch />
            ) : scene === 2 ? (
              <SceneStrategy />
            ) : (
              <SceneCreate />
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
                  style={{ '--dur': `${SCENE_MS}ms` } as React.CSSProperties}
                />
              </span>
              <span
                className={`mt-1.5 block text-[10.5px] font-medium uppercase tracking-[0.12em] transition-colors ${
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
