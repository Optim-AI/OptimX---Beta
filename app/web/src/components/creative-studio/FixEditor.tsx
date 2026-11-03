import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Play, Scissors, Sparkles } from 'lucide-react';
import type { FixPlanPreview, FixTimelineData } from './types';
import type { VoiceoverLanguage } from '@/lib/creative-studio/commercial-production/audio/voiceover-languages';
import { MAX_FIX_SECONDS, MIN_FIX_SECONDS } from '@/lib/creative-studio/commercial-production/fix/fix-pricing';
import { VoiceInputButton } from './GuidedAdSetup';

const PURPLE = '#A855F7';
const PURPLE_SOFT = 'rgba(168, 85, 247, 0.16)';
const PURPLE_BORDER = 'rgba(168, 85, 247, 0.42)';
const RAIL_BG = '#101014';
const SURFACE = '#16161C';
const SURFACE_2 = '#1A1A22';
const LINE = 'rgba(255,255,255,0.08)';
const MUTED = '#8B8B98';

type Selection = { start: number; end: number };

/** m:ss, rounded down like the video player's own clock. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds + 1e-6));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** The scene (between two cuts) containing t, capped to what one fix may cover. */
function sceneAt(t: number, cuts: number[], duration: number): Selection {
  const start = [0, ...cuts].filter((c) => c <= t).pop() ?? 0;
  const end = [...cuts, duration].find((c) => c > t) ?? duration;
  return { start, end: Math.min(end, start + MAX_FIX_SECONDS) };
}

/**
 * Edit screen: the video, a timeline of scenes underneath, and a short
 * "pick the part → say the change → see it → make it" panel.
 */
export default function FixEditor({
  player,
  currentTime,
  voiceLanguage,
  loadTimeline,
  onSeek,
  onPlay,
  onPause,
  onPlan,
  onApply,
  onClose,
}: {
  /** The page's video player, shown large on this screen. */
  player: React.ReactNode;
  currentTime: number;
  voiceLanguage?: VoiceoverLanguage;
  loadTimeline: () => Promise<FixTimelineData>;
  onSeek: (seconds: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onPlan: (selection: Selection, request: string) => Promise<FixPlanPreview>;
  onApply: (preview: FixPlanPreview) => Promise<void>;
  onClose: () => void;
}) {
  const [timeline, setTimeline] = useState<FixTimelineData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [request, setRequest] = useState('');
  const [step, setStep] = useState<'describe' | 'planning' | 'preview' | 'applying'>('describe');
  const [preview, setPreview] = useState<FixPlanPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** "Play this part" stops at the end of the part. */
  const playingPart = useRef<Selection | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTimeline()
      .then((data) => {
        if (cancelled) return;
        setTimeline(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'We could not open this video for editing.');
      });
    return () => {
      cancelled = true;
    };
    // Load once per opening of the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (playingPart.current && currentTime >= playingPart.current.end - 0.05) {
      playingPart.current = null;
      onPause();
    }
  }, [currentTime, onPause]);

  const busy = step === 'planning' || step === 'applying';

  function choose(next: Selection) {
    if (busy) return;
    setSelection(next);
    setPreview(null);
    setError(null);
    if (step === 'preview') setStep('describe');
    onSeek(next.start);
  }

  async function showFix() {
    if (!selection || !request.trim()) return;
    setError(null);
    setStep('planning');
    try {
      setPreview(await onPlan(selection, request.trim()));
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not prepare that fix.');
      setStep('describe');
    }
  }

  async function makeFix() {
    if (!preview) return;
    setError(null);
    setStep('applying');
    try {
      await onApply(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The fix did not work this time.');
      setStep('preview');
    }
  }

  const redo = preview ? `${formatClock(preview.window.startSeconds)}–${formatClock(preview.window.endSeconds)}` : '';

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
      <div className="flex-1 min-w-0 flex flex-col p-4 md:p-6 gap-4 min-h-[560px] lg:min-h-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={step === 'applying'}
            className="inline-flex items-center gap-1.5 text-[14px] px-3 py-2 rounded-lg hover:bg-white/5 disabled:opacity-40"
            style={{ color: '#D4D4DC', border: `1px solid ${LINE}` }}
          >
            <ArrowLeft size={15} />
            Back to my ad
          </button>
          <p className="text-[16px] font-medium" style={{ color: '#F4F4F7' }}>
            Edit a part of your ad
          </p>
        </div>

        <div className="flex-1 min-h-[300px] flex flex-col">{player}</div>

        <FixTimeline
          timeline={timeline}
          loadError={loadError}
          currentTime={currentTime}
          selection={selection}
          redo={preview?.window ?? null}
          disabled={busy}
          onChoose={choose}
          onSeek={onSeek}
        />
      </div>

      <aside
        className="w-full lg:w-[400px] flex-shrink-0 lg:overflow-y-auto px-5 py-6 md:px-6 space-y-6"
        style={{ background: RAIL_BG, borderLeft: `1px solid ${LINE}` }}
      >
        <section>
          <StepTitle n={1} done={Boolean(selection)}>
            Pick the part to change
          </StepTitle>
          {selection ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[15px]" style={{ color: '#F4F4F7' }}>
                {formatClock(selection.start)} – {formatClock(selection.end)}
                <span className="text-[13px] ml-2" style={{ color: MUTED }}>
                  {(selection.end - selection.start).toFixed(1)} sec
                </span>
              </p>
              <button
                type="button"
                onClick={() => {
                  onSeek(selection.start);
                  playingPart.current = selection;
                  onPlay();
                }}
                className="inline-flex items-center gap-1.5 text-[13px] px-3 py-2 rounded-lg"
                style={{ background: SURFACE, border: `1px solid ${LINE}`, color: '#E8E8EE' }}
              >
                <Play size={12} fill="currentColor" />
                Play this part
              </button>
            </div>
          ) : (
            <p className="text-[14px] mt-2 leading-relaxed" style={{ color: MUTED }}>
              Tap a scene on the timeline below the video, or drag across the seconds you want to change.
            </p>
          )}
        </section>

        <section className={selection ? '' : 'opacity-50 pointer-events-none'}>
          <StepTitle n={2} done={step === 'preview' || step === 'applying'}>
            What should change?
          </StepTitle>
          <textarea
            value={request}
            onChange={(e) => {
              setRequest(e.target.value);
              if (step === 'preview') {
                setPreview(null);
                setStep('describe');
              }
            }}
            disabled={busy}
            placeholder="The pickle jar is on the laptop. Put it on the table."
            rows={4}
            className="mt-3 w-full px-3.5 py-3 rounded-xl text-[15px] leading-relaxed resize-none outline-none"
            style={{ background: SURFACE, border: `1px solid ${LINE}`, color: '#EDEDF2' }}
          />
          <div className="mt-2 flex justify-end">
            <VoiceInputButton
              language={voiceLanguage}
              onText={(text) => setRequest((prev) => [prev.trim(), text].filter(Boolean).join(' '))}
            />
          </div>
        </section>

        {error && (
          <p className="text-[14px]" style={{ color: '#FCA5A5' }}>
            {error}
          </p>
        )}

        {step === 'describe' && (
          <button
            type="button"
            onClick={showFix}
            disabled={!selection || !request.trim()}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-[15px] font-semibold disabled:opacity-45 disabled:cursor-not-allowed"
            style={{ background: PURPLE, color: 'white' }}
          >
            <Sparkles size={16} />
            Show me the change (free)
          </button>
        )}

        {busy && (
          <div
            className="rounded-xl px-4 py-5 flex flex-col items-center text-center gap-3"
            style={{ background: SURFACE, border: `1px solid ${LINE}` }}
            aria-live="polite"
          >
            <span className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            <p className="text-[15px] font-medium" style={{ color: '#F4F4F7' }}>
              {step === 'planning' ? 'Preparing a picture of the change…' : `Making your fix (${redo})…`}
            </p>
            <p className="text-[13px]" style={{ color: MUTED }}>
              {step === 'planning' ? 'About 30 seconds. Nothing is charged.' : 'Usually 1–3 minutes. Keep this tab open.'}
            </p>
          </div>
        )}

        {step === 'preview' && preview && (
          <section className="space-y-3">
            <StepTitle n={3}>Check the change</StepTitle>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Before', preview.beforeFrame],
                ['After', preview.afterFrame],
              ].map(([label, src]) => (
                <figure key={label} className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`${label} the change`}
                    className="w-full rounded-lg object-cover"
                    style={{ border: `1px solid ${label === 'After' ? PURPLE_BORDER : LINE}` }}
                  />
                  <figcaption className="text-[12px] text-center" style={{ color: label === 'After' ? '#E9D5FF' : MUTED }}>
                    {label}
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="text-[14px] leading-relaxed" style={{ color: '#F4F4F7' }}>
              {preview.instructions.userSummary}
            </p>
            <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>
              {preview.window.endsMidShot
                ? `This scene is long, so we redo ${redo}. Voice and music stay the same.`
                : `We redo the whole scene (${redo}) so the change blends in. Voice and music stay the same.`}
            </p>
            <p
              className="text-[13px] leading-relaxed rounded-xl px-3.5 py-2.5"
              style={
                preview.price.free
                  ? { background: 'rgba(52,211,153,0.10)', color: '#6EE7B7' }
                  : { background: 'rgba(251,191,36,0.10)', color: '#FCD34D' }
              }
            >
              {preview.priceLabel}
            </p>
            <button
              type="button"
              onClick={makeFix}
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-[15px] font-semibold"
              style={{ background: PURPLE, color: 'white' }}
            >
              <Scissors size={16} />
              {preview.price.free ? 'Make this fix' : `Make this fix (${preview.price.credits} credits)`}
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setStep('describe');
              }}
              className="w-full py-3 rounded-xl text-[14px]"
              style={{ background: SURFACE_2, border: `1px solid ${LINE}`, color: '#E8E8EE' }}
            >
              Try a different change
            </button>
          </section>
        )}
      </aside>
    </div>
  );
}

function StepTitle({ n, done, children }: { n: number; done?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0"
        style={done ? { background: PURPLE, color: 'white' } : { background: SURFACE_2, color: '#D4D4DC' }}
      >
        {n}
      </span>
      <p className="text-[15px] font-medium" style={{ color: '#F4F4F7' }}>
        {children}
      </p>
    </div>
  );
}

/**
 * Scene thumbnails with a draggable selection. Tap = pick that scene;
 * drag = pick exact seconds; edge handles adjust.
 */
function FixTimeline({
  timeline,
  loadError,
  currentTime,
  selection,
  redo,
  disabled,
  onChoose,
  onSeek,
}: {
  timeline: FixTimelineData | null;
  loadError: string | null;
  currentTime: number;
  selection: Selection | null;
  redo: { startSeconds: number; endSeconds: number } | null;
  disabled: boolean;
  onChoose: (selection: Selection) => void;
  onSeek: (seconds: number) => void;
}) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ mode: 'new' | 'start' | 'end'; anchor: number; moved: boolean } | null>(null);
  const [draft, setDraft] = useState<Selection | null>(null);

  if (loadError) {
    return (
      <p className="text-[14px] rounded-xl px-4 py-3" style={{ background: SURFACE, color: '#FCA5A5' }}>
        {loadError}
      </p>
    );
  }
  if (!timeline) {
    return (
      <div className="h-[118px] rounded-xl flex items-center justify-center gap-2" style={{ background: SURFACE }}>
        <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        <span className="text-[13px]" style={{ color: MUTED }}>
          Loading the timeline…
        </span>
      </div>
    );
  }

  const duration = timeline.durationSeconds;
  const pct = (t: number) => `${(Math.max(0, Math.min(duration, t)) / duration) * 100}%`;
  const shown = draft ?? selection;

  function timeAt(clientX: number): number {
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration));
  }

  function clamp(a: number, b: number): Selection {
    let start = Math.min(a, b);
    let end = Math.max(a, b);
    if (end - start > MAX_FIX_SECONDS) end = start + MAX_FIX_SECONDS;
    if (end - start < MIN_FIX_SECONDS) {
      end = Math.min(duration, start + MIN_FIX_SECONDS);
      start = Math.max(0, end - MIN_FIX_SECONDS);
    }
    return { start: Math.round(start * 10) / 10, end: Math.round(end * 10) / 10 };
  }

  function onPointerDown(e: React.PointerEvent, mode: 'new' | 'start' | 'end') {
    if (disabled) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const t = timeAt(e.clientX);
    const anchor = mode === 'start' ? selection?.end ?? t : mode === 'end' ? selection?.start ?? t : t;
    drag.current = { mode, anchor, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const t = timeAt(e.clientX);
    if (d.mode === 'new' && Math.abs(t - d.anchor) < duration * 0.01 && !d.moved) return;
    d.moved = true;
    setDraft(clamp(d.anchor, t));
    onSeek(t);
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved && d.mode === 'new') {
      // A tap picks the whole scene under the finger.
      onChoose(sceneAt(timeAt(e.clientX), timeline!.cuts, duration));
    } else if (draft) {
      onChoose(draft);
    }
    setDraft(null);
  }

  return (
    <div className="select-none">
      <div
        ref={stripRef}
        role="slider"
        aria-label="Timeline: tap a scene or drag to pick seconds"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        tabIndex={0}
        className={`relative h-[84px] rounded-xl overflow-hidden ${disabled ? 'opacity-70' : 'cursor-pointer'}`}
        style={{ background: '#050507', border: `1px solid ${LINE}`, touchAction: 'none' }}
        onPointerDown={(e) => onPointerDown(e, 'new')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="absolute inset-0 flex">
          {timeline.thumbnails.map((thumb) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={thumb.atSeconds}
              src={thumb.dataUrl}
              alt=""
              draggable={false}
              className="h-full flex-1 min-w-0 object-cover opacity-80"
            />
          ))}
        </div>
        {timeline.cuts.map((cut) => (
          <span
            key={cut}
            className="absolute top-0 bottom-0 w-[3px] -ml-[1.5px]"
            style={{ left: pct(cut), background: 'rgba(0,0,0,0.85)' }}
            aria-hidden
          />
        ))}
        {redo && (
          <span
            className="absolute top-0 bottom-0"
            style={{
              left: pct(redo.startSeconds),
              width: `calc(${pct(redo.endSeconds)} - ${pct(redo.startSeconds)})`,
              background: 'rgba(168,85,247,0.14)',
              outline: `1px dashed ${PURPLE_BORDER}`,
            }}
            aria-hidden
          />
        )}
        {shown && (
          <span
            className="absolute top-0 bottom-0"
            style={{
              left: pct(shown.start),
              width: `calc(${pct(shown.end)} - ${pct(shown.start)})`,
              background: PURPLE_SOFT,
              border: `2px solid ${PURPLE}`,
              borderRadius: 8,
            }}
          >
            {(['start', 'end'] as const).map((edge) => (
              <span
                key={edge}
                onPointerDown={(e) => onPointerDown(e, edge)}
                className="absolute top-1/2 -translate-y-1/2 w-4 h-10 rounded-md cursor-ew-resize"
                style={{ [edge === 'start' ? 'left' : 'right']: -9, background: PURPLE }}
                aria-label={edge === 'start' ? 'Move the start' : 'Move the end'}
              />
            ))}
          </span>
        )}
        <span
          className="absolute top-0 bottom-0 w-[2px] pointer-events-none"
          style={{ left: pct(currentTime), background: 'white', boxShadow: '0 0 4px rgba(0,0,0,0.8)' }}
          aria-hidden
        />
      </div>
      <div className="mt-2 flex justify-between text-[12px] tabular-nums" style={{ color: MUTED }}>
        <span>0:00</span>
        <span>Tap a scene, or drag across the seconds to change</span>
        <span>{formatClock(duration)}</span>
      </div>
    </div>
  );
}
