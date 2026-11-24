'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import { AGENT } from '@/content/home';
import { LINKS } from '@/content/site';
import { CTAButton } from '../kit/CTAButton';
import { Section, SectionHeading } from '../kit/Section';

/** The agent's mark: a soft colour orb (same idea as the in-app Marketing Agent). */
function Orb({ size = 28, busy = false }: { size?: number; busy?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ${busy ? 'animate-pulse' : ''}`}
      style={{
        width: size,
        height: size,
        background: 'conic-gradient(from 200deg, #ffd8a8, #f7a6c8 70deg, #c4a6f2 140deg, #7f9ff5 200deg, #8fd0f6 250deg, #e6f1fb 300deg, #ffd8a8)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25), 0 4px 14px rgba(127,159,245,0.35)',
      }}
    />
  );
}

/**
 * The chat plays like the real thing: the owner types, the agent thinks and writes its
 * reply, the planned posts slide in, then the posters are designed and appear. It loops
 * while visible. Every element keeps its place from the start (only opacity changes), so
 * the page never jumps. With "reduce motion" it shows the finished chat.
 */
const STEPS = {
  typing: 1, // owner typing in the box
  sent: 2, // owner bubble shown
  thinking: 3, // agent thinking dots
  replying: 4, // reply text types out
  post1: 5,
  post2: 6,
  note: 7,
  designing: 8, // poster tiles shimmer
  done: 9, // posters shown
} as const;

function useChatPlayback(askLen: number, replyLen: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [askChars, setAskChars] = useState(0);
  const [replyChars, setReplyChars] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep(STEPS.done);
      setAskChars(askLen);
      setReplyChars(replyLen);
      return;
    }
    let timers: ReturnType<typeof setTimeout>[] = [];
    let running = false;
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const clear = () => { timers.forEach(clearTimeout); timers = []; };

    const play = () => {
      clear();
      setStep(0); setAskChars(0); setReplyChars(0);
      let t = 500;
      at(t, () => setStep(STEPS.typing));
      for (let i = 1; i <= askLen; i++) at(t + i * 45, () => setAskChars(i));
      t += askLen * 45 + 400;
      at(t, () => setStep(STEPS.sent));
      t += 500;
      at(t, () => setStep(STEPS.thinking));
      t += 1300;
      at(t, () => setStep(STEPS.replying));
      for (let i = 1; i <= replyLen; i += 2) at(t + (i / 2) * 22, () => setReplyChars(Math.min(replyLen, i + 1)));
      t += (replyLen / 2) * 22 + 400;
      at(t, () => setStep(STEPS.post1));
      t += 650;
      at(t, () => setStep(STEPS.post2));
      t += 650;
      at(t, () => setStep(STEPS.note));
      t += 700;
      at(t, () => setStep(STEPS.designing));
      t += 2200;
      at(t, () => setStep(STEPS.done));
      t += 5500;
      at(t, () => { if (running) play(); });
    };

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !running) { running = true; play(); }
      else if (!entry.isIntersecting && running) { running = false; clear(); setStep(STEPS.done); setAskChars(askLen); setReplyChars(replyLen); }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => { io.disconnect(); clear(); };
  }, [askLen, replyLen]);

  return { ref, step, askChars, replyChars };
}

/** Typed text that keeps the full text's size, so nothing moves while it types. */
function Typed({ text, chars, caret }: { text: string; chars: number; caret?: boolean }) {
  return (
    <span className="grid">
      <span aria-hidden className="invisible col-start-1 row-start-1">{text}</span>
      <span className="col-start-1 row-start-1">
        {text.slice(0, chars)}
        {caret && <span aria-hidden className="ml-px inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-current" />}
      </span>
    </span>
  );
}

const show = (on: boolean) => `transition-all duration-500 ease-out ${on ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`;

/** Section 2: the Marketing Agent. Points on the left, an animated example chat (fictional brand) on the right. */
export default function AgentSection() {
  const c = AGENT.chat;
  const { ref, step, askChars, replyChars } = useChatPlayback(c.ask.length, c.reply.length);

  return (
    <Section id="marketing-agent" labelledBy="agent-title" tone="paper" innerClassName="grid gap-12 lg:grid-cols-12 lg:items-center">
      <div className="lg:col-span-5">
        <SectionHeading id="agent-title" eyebrow={AGENT.eyebrow} title={AGENT.title} sub={AGENT.sub} />
        <ul className="mt-8 space-y-4">
          {AGENT.points.map((p) => (
            <li key={p.title} className="border-l-2 border-accent/40 pl-4">
              <h3 className="font-display text-[17px] font-semibold">{p.title}</h3>
              <p className="mt-1 text-[15px] text-ink-soft">{p.body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <CTAButton href={LINKS.startFree} arrow>
            {AGENT.cta}
          </CTAButton>
        </div>
      </div>

      <figure className="m-0 lg:col-span-7">
        <div ref={ref} className="overflow-hidden rounded-card border border-line bg-surface shadow-lift">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-[13px] text-ink-mute">
            <Orb size={18} busy={step >= STEPS.thinking && step < STEPS.done} />
            <span className="font-medium text-ink">Marketing Agent</span>
            <span aria-hidden>·</span>
            <span>
              {c.brand} · {c.label}
            </span>
          </div>

          {/* Screen readers get the whole conversation at once. */}
          <p className="sr-only">
            Owner: {c.ask} SkalX Agent: {c.reply} {c.posts.map((p) => `${p.day}: ${p.headline}, ${p.time}.`).join(' ')} {c.note}
          </p>

          <div aria-hidden className="space-y-5 p-4 sm:p-6">
            {/* Owner: types in the box, then the message becomes a bubble. */}
            <div className="relative flex min-h-[44px] justify-end">
              <p className={`max-w-[80%] rounded-[18px] rounded-br-md bg-ink px-4 py-2.5 text-[15px] text-paper ${show(step >= STEPS.sent)}`}>{c.ask}</p>
              {step === STEPS.typing && (
                <div className="absolute inset-x-0 top-0 flex items-center rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[15px] text-ink">
                  <Typed text={c.ask} chars={askChars} caret />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Orb busy={step === STEPS.thinking || step === STEPS.replying || step === STEPS.designing} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  SkalX Agent
                  {step === STEPS.thinking && <span className="animate-pulse text-[12px] font-normal text-accent">thinking…</span>}
                  {step === STEPS.designing && <span className="animate-pulse text-[12px] font-normal text-accent">designing posters…</span>}
                </p>
                <p className={`mt-1 text-[15px] leading-relaxed text-ink-soft ${step >= STEPS.replying ? 'opacity-100' : 'opacity-0'}`}>
                  <Typed text={c.reply} chars={step >= STEPS.replying ? replyChars : 0} caret={step === STEPS.replying} />
                </p>
                <ul className="mt-3 space-y-2">
                  {c.posts.map((p, n) => (
                    <li key={p.headline} className={`rounded-xl border border-line bg-paper px-3.5 py-2.5 ${show(step >= STEPS.post1 + n)}`}>
                      <span className="block text-[11.5px] font-medium uppercase tracking-[0.08em] text-ink-mute">{p.day}</span>
                      <span className="mt-0.5 block font-display text-[15.5px] font-semibold text-ink">{p.headline}</span>
                      <span className="mt-0.5 block text-[12.5px] text-ink-mute">{p.time}</span>
                    </li>
                  ))}
                </ul>
                <p className={`mt-3 inline-flex items-center gap-1.5 text-[14px] text-ink-soft ${show(step >= STEPS.note)}`}>
                  <Sparkles aria-hidden className="h-4 w-4 text-accent" /> {c.note}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {c.images.map((src, n) => (
                    <div key={src} className={`relative aspect-[4/5] overflow-hidden rounded-xl border border-line bg-paper-deep ${show(step >= STEPS.designing)}`}>
                      <Image
                        src={src}
                        alt=""
                        fill
                        sizes="(max-width: 1024px) 42vw, 300px"
                        className={`object-cover transition-all duration-700 ${step >= STEPS.done ? 'scale-100 opacity-100 blur-0' : 'scale-105 opacity-0 blur-md'}`}
                        style={{ transitionDelay: step >= STEPS.done ? `${n * 250}ms` : '0ms' }}
                      />
                      {step === STEPS.designing && (
                        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                          <Orb size={30} busy />
                          <span className="text-[12px] text-ink-mute">Designing…</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <figcaption className="mt-3 text-[13px] text-ink-mute">{c.footnote}</figcaption>
      </figure>
    </Section>
  );
}
