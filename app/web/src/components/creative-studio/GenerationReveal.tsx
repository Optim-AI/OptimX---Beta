import React, { useEffect, useState } from 'react';

/**
 * Loading screen for poster and video generation.
 *
 * The product photo starts heavily blurred and slowly comes into focus while the
 * work runs, with a plain message about how long it takes — so a long wait reads as
 * "it's being made", not "it's stuck". The finished creative replaces it.
 */

type Props = {
  /** Product photo (URL or data URL) to reveal; a soft gradient is used without one. */
  image?: string | null;
  /** CSS aspect ratio of the creative, e.g. "9 / 16". */
  aspect: string;
  title: string;
  steps: string[];
  activeStep: number;
  /** Typical time for this job, used for the progress and the "usually takes" line. */
  expectedSeconds: number;
  /** Optional live detail line (e.g. the latest progress message). */
  detail?: string;
  accent?: string;
  /** Seconds since the job started, when the page already tracks it (survives remounts). */
  elapsedSeconds?: number;
  /** "overlay": fills its container (video player); "panel": centred card (poster page). */
  variant?: 'overlay' | 'panel';
};

function minutesLabel(seconds: number): string {
  if (seconds < 90) return 'about a minute';
  const low = Math.max(1, Math.floor(seconds / 60));
  return `about ${low}–${low + 2} minutes`;
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function GenerationReveal({
  image,
  aspect,
  title,
  steps,
  activeStep,
  expectedSeconds,
  detail,
  accent = '#A855F7',
  elapsedSeconds,
  variant = 'panel',
}: Props) {
  const [ownElapsed, setElapsed] = useState(0);
  const elapsed = elapsedSeconds ?? ownElapsed;
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  // Eases toward 95% around the expected time and never claims to be finished.
  const byTime = 1 - Math.exp(-elapsed / (expectedSeconds * 0.45));
  const byStep = steps.length ? activeStep / steps.length : 0;
  const progress = Math.min(0.95, Math.max(byTime, byStep));
  const blur = Math.round(32 * (1 - progress));
  const overdue = elapsed > expectedSeconds * 1.2;

  const picture = (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: `blur(${blur}px) saturate(${0.4 + progress * 0.6}) brightness(${0.55 + progress * 0.25})`,
            transform: `scale(${1.15 - progress * 0.12})`,
            transition: 'filter 1s linear, transform 1s linear',
          }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 30% 30%, ${accent}55, transparent 60%), radial-gradient(ellipse at 70% 75%, #34D39933, transparent 55%), #0B0B10`,
            filter: `blur(${Math.max(8, blur)}px)`,
          }}
        />
      )}
      {/* A soft light sweeping down the picture, like it is being developed. */}
      <div
        className="absolute inset-x-0 h-1/3 motion-safe:animate-[reveal-sweep_3.2s_ease-in-out_infinite]"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.10), transparent)' }}
      />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,5,8,0.25), rgba(5,5,8,0.78))' }} />
      <style>{`@keyframes reveal-sweep { 0% { transform: translateY(-100%); } 100% { transform: translateY(300%); } }`}</style>
    </div>
  );

  const text = (
    <div className="relative w-full max-w-sm mx-auto text-center px-5" aria-live="polite">
      <p className="text-[18px] font-semibold text-white leading-snug">{title}</p>
      <p className="mt-1 text-[13px] tabular-nums text-white/60">
        {Math.round(progress * 100)}% · {clock(elapsed)} so far
      </p>
      <div className="mt-3 h-2 rounded-full bg-white/15 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${progress * 100}%`, background: accent, transition: 'width 1s linear' }}
        />
      </div>

      <ul className="mt-4 space-y-1.5 text-left inline-block">
        {steps.map((label, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <li
              key={label}
              className="text-[14px] flex items-center gap-2"
              style={{ color: done || active ? '#F4F4F7' : 'rgba(255,255,255,0.45)' }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] flex-shrink-0"
                style={
                  done
                    ? { background: accent, color: 'white' }
                    : active
                      ? { border: `2px solid ${accent}` }
                      : { border: '1px solid rgba(255,255,255,0.25)' }
                }
                aria-hidden
              >
                {done ? '✓' : ''}
              </span>
              {label}
            </li>
          );
        })}
      </ul>
      {detail && <p className="mt-2 text-[12px] text-white/55 line-clamp-2">{detail}</p>}

      <div className="mt-4 rounded-xl px-4 py-3 text-left" style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <p className="text-[14px] font-medium text-white">
          {overdue ? 'Taking a little longer than usual — still working.' : `This usually takes ${minutesLabel(expectedSeconds)}.`}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-white/70">
          Nothing is wrong. Please keep this screen open — your creative will appear here by itself.
        </p>
      </div>
    </div>
  );

  if (variant === 'overlay') {
    return (
      <div className="absolute inset-0 z-[3] flex items-center justify-center overflow-y-auto py-6">
        {picture}
        {text}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-3xl flex-col items-center gap-6 md:flex-row md:items-center">
        <div
          className="relative w-[220px] md:w-[280px] flex-shrink-0 rounded-2xl overflow-hidden border border-white/10"
          style={{ aspectRatio: aspect, maxHeight: '62vh' }}
        >
          {picture}
        </div>
        {text}
      </div>
    </div>
  );
}
