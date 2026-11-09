'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Pause, Play, Search, Sparkles, Target } from 'lucide-react';
import { HERO_FLOW } from '@/content/home';
import { HERO_DEMO_VIDEO } from '@/lib/marketing/content';

/**
 * Hero visual: Research → Angle → Ads for a fictional brand, looping like a short video.
 * Each stage is a small card; the ads at the end carry the angle they came from.
 * Pauses off-screen; with prefers-reduced-motion it starts paused on the last stage.
 * Set HERO_DEMO_VIDEO (lib/marketing/content.ts) to play a real recording instead.
 */

const STAGE_MS = 4200;
const ICONS = [Search, Target, Sparkles];

function ResearchCard() {
  const r = HERO_FLOW.research;
  return (
    <div className="flex h-full flex-col justify-center gap-3 px-5 sm:px-7">
      <p className="hx-in text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-on-ink">Brand audit · {HERO_FLOW.site}</p>
      <div className="hx-in rounded-2xl border border-white/10 bg-white/[0.04] p-4" style={{ '--d': '120ms' } as React.CSSProperties}>
        <p className="text-[11.5px] font-medium text-white/55">Positioning</p>
        <p className="mt-1 text-[14px] text-white/90">{r.positioning}</p>
      </div>
      <div className="hx-in rounded-2xl border border-white/10 bg-white/[0.04] p-4" style={{ '--d': '320ms' } as React.CSSProperties}>
        <p className="text-[11.5px] font-medium text-white/55">3 competitors</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {r.competitors.map((c) => (
            <li key={c} className="rounded-full border border-white/15 px-2.5 py-0.5 text-[12.5px] text-white/85">
              {c}
            </li>
          ))}
        </ul>
      </div>
      <div className="hx-in rounded-2xl border border-[#ffb08a]/30 bg-[#ffb08a]/[0.06] p-4" style={{ '--d': '520ms' } as React.CSSProperties}>
        <p className="text-[11.5px] font-medium text-[#ffcab0]">Top customer complaint</p>
        <p className="mt-1 text-[14px] text-white/90">{r.complaint}</p>
      </div>
    </div>
  );
}

function AngleCard() {
  const a = HERO_FLOW.angle;
  return (
    <div className="flex h-full flex-col justify-center gap-3 px-5 sm:px-7">
      <p className="hx-in text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-on-ink">The angle to test</p>
      <div className="hx-in rounded-2xl border border-white/10 bg-white/[0.04] p-4" style={{ '--d': '120ms' } as React.CSSProperties}>
        <p className="text-[11.5px] font-medium text-white/55">Finding</p>
        <p className="mt-1 text-[15px] text-white/90">{a.finding}</p>
      </div>
      <div aria-hidden className="hx-in flex justify-center text-white/40" style={{ '--d': '300ms' } as React.CSSProperties}>
        <ArrowRight className="h-5 w-5 rotate-90" />
      </div>
      <div className="hx-in hx-pick rounded-2xl border border-accent-on-ink bg-accent-on-ink/10 p-4" style={{ '--d': '450ms' } as React.CSSProperties}>
        <p className="text-[11.5px] font-medium text-accent-on-ink">Angle</p>
        <p className="mt-1 font-display text-[17px] font-semibold leading-snug text-white">{a.angle}</p>
      </div>
    </div>
  );
}

function AdsCard() {
  const tones = ['bg-[#f2ece3] text-[#1f2b24]', 'bg-[#1f4d3a] text-[#eaf5ee]', 'bg-[#1d4ed8] text-white'];
  return (
    <div className="flex h-full flex-col justify-center gap-3 px-5 sm:px-7">
      <p className="hx-in text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-on-ink">Ads from that angle</p>
      <ul className="grid grid-cols-3 items-end gap-2.5">
        {HERO_FLOW.ads.map((ad, i) => (
          <li key={ad.format} className="hx-in" style={{ '--d': `${120 + i * 200}ms` } as React.CSSProperties}>
            <div className={`relative flex flex-col justify-between overflow-hidden rounded-xl p-2.5 ${tones[i]} ${i === 0 ? 'aspect-[4/5]' : 'aspect-[9/16]'}`}>
              <p className="font-display text-[11px] font-bold leading-tight sm:text-[12.5px]">{ad.headline}</p>
              <span aria-hidden className="mx-auto mb-1 h-[38%] w-[34%] rounded-[30%_30%_14px_14px] bg-current opacity-25" />
            </div>
            <p className="mt-1.5 text-center text-[10px] uppercase tracking-[0.12em] text-white/50">{ad.format}</p>
          </li>
        ))}
      </ul>
      <p className="hx-in rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/70" style={{ '--d': '760ms' } as React.CSSProperties}>
        <span className="font-semibold text-accent-on-ink">Why these ads: </span>
        {HERO_FLOW.angle.finding}
      </p>
    </div>
  );
}

export default function HeroFlow() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPaused(true);
      setStage(2);
    }
  }, []);

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
    const t = window.setTimeout(() => setStage((s) => (s + 1) % 3), STAGE_MS);
    return () => window.clearTimeout(t);
  }, [playing, stage]);

  if (HERO_DEMO_VIDEO) {
    return (
      <div className="overflow-hidden rounded-[22px] border border-ink/10 bg-[#111] shadow-frame">
        <video src={HERO_DEMO_VIDEO} className="block aspect-[4/5] w-full object-cover sm:aspect-[16/12]" autoPlay muted loop playsInline controls aria-label="SkalX product walkthrough" />
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <section
        aria-roledescription="carousel"
        aria-label={`How SkalX works: research, angle, ads. An example for a fictional brand (${HERO_FLOW.brand}).`}
        className="overflow-hidden rounded-[22px] border border-ink/10 bg-[#111] text-white shadow-frame"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
          <span className="truncate text-[11.5px] text-white/55">
            {HERO_FLOW.brand} · <span className="text-white/40">{HERO_FLOW.label}</span>
          </span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Play demo' : 'Pause demo'}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            {paused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5 fill-current" />}
          </button>
        </div>

        {/* Phones and tablets: one step at a time. */}
        <div className="relative h-[360px] lg:hidden">
          <div key={stage} className="absolute inset-0" role="group" aria-roledescription="slide" aria-label={HERO_FLOW.steps[stage]}>
            {stage === 0 ? <ResearchCard /> : stage === 1 ? <AngleCard /> : <AdsCard />}
          </div>
        </div>

        {/* Desktop: the whole flow side by side; the active step is lit and replays its entrance. */}
        <div className="hidden items-stretch gap-3 px-5 py-6 lg:grid lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {[ResearchCard, AngleCard, AdsCard].map((Card, i) => (
            <React.Fragment key={HERO_FLOW.steps[i]}>
              <button
                type="button"
                onClick={() => setStage(i)}
                aria-current={i === stage ? 'step' : undefined}
                aria-label={`Step ${i + 1}: ${HERO_FLOW.steps[i]}`}
                className={`rounded-2xl text-left transition-[opacity,background-color,box-shadow] duration-500 ${
                  i === stage ? 'bg-white/[0.03] opacity-100 shadow-[0_0_0_1px_rgba(157,184,255,0.45)]' : 'opacity-45 hover:opacity-70'
                }`}
              >
                <div key={i === stage ? `on-${stage}` : `off-${i}`} className="h-[400px]">
                  <Card />
                </div>
              </button>
              {i < 2 ? (
                <span aria-hidden className={`flex items-center transition-colors duration-500 ${i < stage ? 'text-accent-on-ink' : 'text-white/25'}`}>
                  <ArrowRight className="h-5 w-5" />
                </span>
              ) : null}
            </React.Fragment>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1.5 border-t border-white/[0.07] px-4 pb-3 pt-2.5">
          {HERO_FLOW.steps.map((label, i) => {
            const Icon = ICONS[i];
            return (
              <button key={label} type="button" onClick={() => setStage(i)} aria-current={i === stage ? 'step' : undefined} className="group text-left">
                <span className="block h-[3px] overflow-hidden rounded-full bg-white/10">
                  <span
                    key={i === stage ? `on-${stage}` : 'off'}
                    className={`block h-full rounded-full bg-accent-on-ink ${i < stage ? 'w-full' : i === stage ? (playing ? 'hx-fill' : 'w-full opacity-60') : 'w-0'}`}
                    style={{ '--dur': `${STAGE_MS}ms` } as React.CSSProperties}
                  />
                </span>
                <span className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] ${i === stage ? 'text-white' : 'text-white/45 group-hover:text-white/75'}`}>
                  <Icon aria-hidden className="h-3.5 w-3.5" />
                  {i + 1}. {label}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
