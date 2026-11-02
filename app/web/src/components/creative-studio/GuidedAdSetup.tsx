'use client';

/**
 * Guided ad setup for non-technical users: pick what you're advertising and how
 * it should look from picture cards, speak instead of typing, and choose one of
 * three storyboarded ideas before spending Video Credits.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Boxes,
  Check,
  Clapperboard,
  Film,
  Gem,
  Gift,
  Heart,
  Home,
  ImagePlus,
  Lightbulb,
  Loader2,
  Mic,
  Square,
  Package,
  PartyPopper,
  Plus,
  Rocket,
  Shapes,
  Smartphone,
  Sparkles,
  X,
  Store,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import type { AdBuilderData } from './types';
import { authFetch } from '@/lib/utils';
import { suggestedOccasions } from '@/lib/creative-studio/commercial-production/campaign/ad-type';
import type { ConceptCard } from '@/lib/creative-studio/commercial-production/concepts/generate-concepts';
import {
  CAST_AGES,
  CAST_REGIONS,
  MOODS,
  SETTINGS,
  VIEWER_ACTIONS,
  type AdDirection,
  type CastAgeId,
} from '@/lib/creative-studio/commercial-production/campaign/ad-direction';

const PURPLE = '#A855F7';
const PURPLE_SOFT = 'rgba(168, 85, 247, 0.16)';
const PURPLE_BORDER = 'rgba(168, 85, 247, 0.42)';
const SURFACE = '#16161C';
const LINE = 'rgba(255,255,255,0.08)';
const MUTED = '#A3A3AF';
const TEXT = '#F4F4F7';

const MAX_EXTRA_PRODUCTS = 3;
const EXTRA_IMAGE_MAX_DIM = 768;

type Option = {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Short silent loop showing the look (public/videos/styles/<name>.mp4 + .jpg poster). */
  sample?: string;
};

export const AD_TYPE_OPTIONS: Option[] = [
  { id: 'product', label: 'One product', hint: 'Sell a single product', icon: Package },
  { id: 'multi_product', label: 'Many products', hint: 'Show your range together', icon: Boxes },
  { id: 'combo_offer', label: 'Combo / offer', hint: 'Buy together, special price', icon: Gift },
  { id: 'brand', label: 'My brand', hint: 'What your business stands for', icon: Heart },
  { id: 'shop_service', label: 'Shop / service', hint: 'Bring customers to you', icon: Store },
  { id: 'festival', label: 'Festival', hint: 'Greetings and festive offers', icon: PartyPopper },
  { id: 'launch', label: 'New launch', hint: 'Announce something new', icon: Rocket },
];

/** Values match the Studio creative formats (adSetup.creativeFormat). */
export const STYLE_OPTIONS: Option[] = [
  { id: 'Commercial', label: 'TV-ad style', hint: 'Polished, quick cuts, product as hero', icon: Clapperboard, sample: 'commercial' },
  { id: 'Lifestyle', label: 'Everyday life', hint: 'Real people using it at home or work', icon: Home, sample: 'lifestyle' },
  { id: 'Product Showcase', label: 'Close-up beauty', hint: 'Studio shots, textures, slow moves', icon: Gem, sample: 'product_showcase' },
  { id: 'UGC', label: 'Phone video', hint: 'Like a customer filmed it on a phone', icon: Smartphone, sample: 'ugc' },
  { id: 'Motion Graphics', label: 'Animated', hint: 'Bold colours, shapes, graphic moves', icon: Shapes, sample: 'motion_graphics' },
  { id: 'Cinematic', label: 'Movie-like story', hint: 'Emotional, filmic storytelling', icon: Film, sample: 'cinematic' },
];

/**
 * Silent looping preview of a style. People choose a look faster by watching
 * than by reading. Stays on the poster frame when the viewer prefers reduced motion.
 */
function StyleSample({ name, fallbackName, label }: { name: string; fallbackName?: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  // Not every ad type has every style yet — fall back to the default sample.
  const [src, setSrc] = useState(name);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    video.play().catch(() => undefined);
  }, [src]);
  return (
    <video
      ref={ref}
      src={`/videos/styles/${src}.mp4`}
      poster={`/videos/styles/${src}.jpg`}
      onError={() => {
        if (fallbackName && src !== fallbackName) setSrc(fallbackName);
      }}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={`Example of the ${label} look`}
      className="w-full aspect-[4/5] object-cover rounded-lg mb-2"
      style={{ background: '#0B0B0F' }}
    />
  );
}

/** Ad types with their own style samples; others (and "product") use the default set. */
const AD_TYPES_WITH_SAMPLES = new Set([
  'multi_product',
  'combo_offer',
  'brand',
  'shop_service',
  'festival',
  'launch',
]);

function OptionCards({
  options,
  value,
  onChange,
  compact,
  sampleFolder,
}: {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
  /** Sub-folder of /videos/styles for the chosen ad type, so samples match it. */
  sampleFolder?: string;
}) {
  return (
    <div
      className={
        compact
          ? 'grid grid-cols-2 gap-1.5'
          : // Video previews need room to be watchable: at most 3 per row.
            options.some((o) => o.sample)
            ? 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2'
            : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2'
      }
    >
      {options.map((opt) => {
        const selected = value === opt.id;
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.id)}
            className={`text-left rounded-xl transition-colors ${compact ? 'px-2.5 py-2' : 'px-3 py-3'}`}
            style={{
              background: selected ? PURPLE_SOFT : SURFACE,
              border: `1px solid ${selected ? PURPLE_BORDER : LINE}`,
            }}
          >
            {!compact && opt.sample && (
              <StyleSample
                // Remount on ad-type change so the new clip loads and autoplays.
                key={`${sampleFolder || 'product'}-${opt.sample}`}
                name={sampleFolder ? `${sampleFolder}/${opt.sample}` : opt.sample}
                fallbackName={opt.sample}
                label={opt.label}
              />
            )}
            <span className="flex items-center gap-2">
              <Icon size={compact ? 14 : 18} style={{ color: selected ? '#E9D5FF' : MUTED }} aria-hidden />
              <span className={compact ? 'text-[13px] font-medium' : 'text-[14px] font-medium'} style={{ color: TEXT }}>
                {opt.label}
              </span>
            </span>
            {!compact && (
              <span className="block text-[13px] mt-1 leading-snug" style={{ color: MUTED }}>
                {opt.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] tracking-[0.14em] uppercase mb-2" style={{ color: MUTED }}>
      {children}
    </p>
  );
}

const inputStyle = { background: SURFACE, border: `1px solid ${LINE}`, color: TEXT };

/** Downscale an uploaded photo so it stays small in the saved session. */
function readImageAsSmallDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not open the image'));
      img.onload = () => {
        const scale = Math.min(1, EXTRA_IMAGE_MAX_DIM / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not process the image'));
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function ExtraProductsEditor({
  value,
  onChange,
}: {
  value: AdBuilderData['extraProducts'];
  onChange: (next: NonNullable<AdBuilderData['extraProducts']>) => void;
}) {
  const items = value ?? [];
  const update = (i: number, patch: Partial<{ name: string; image?: string }>) =>
    onChange(items.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className="space-y-2">
      <p className="text-[13px]" style={{ color: MUTED }}>
        Your main product is the one under Product reference. Add up to {MAX_EXTRA_PRODUCTS} more, each with a clear photo.
      </p>
      {items.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <label
            className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center cursor-pointer overflow-hidden"
            style={{ background: SURFACE, border: `1px dashed ${LINE}` }}
            title="Add product photo"
          >
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt={p.name || 'Product photo'} className="w-full h-full object-cover" />
            ) : (
              <ImagePlus size={16} style={{ color: MUTED }} aria-hidden />
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label={`Photo for product ${i + 2}`}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  update(i, { image: await readImageAsSmallDataUrl(file) });
                } catch {
                  // Unreadable file: keep the row without a photo.
                }
              }}
            />
          </label>
          <input
            value={p.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder={`Product ${i + 2} name`}
            maxLength={60}
            className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-[14px] outline-none"
            style={inputStyle}
          />
          <button
            type="button"
            aria-label={`Remove product ${i + 2}`}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="p-2 rounded-lg"
            style={{ color: MUTED }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      {items.length < MAX_EXTRA_PRODUCTS && (
        <button
          type="button"
          onClick={() => onChange([...items, { name: '' }])}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[14px]"
          style={{ ...inputStyle, color: '#E9D5FF' }}
        >
          <Plus size={14} /> Add another product
        </button>
      )}
    </div>
  );
}

function AdTypeExtras({
  data,
  onChange,
}: {
  data: AdBuilderData;
  onChange: (next: AdBuilderData) => void;
}) {
  const adType = data.adType ?? 'product';
  const endCard = data.endCard ?? { enabled: true };
  if (adType === 'multi_product' || adType === 'combo_offer') {
    return (
      <div className="space-y-3">
        <ExtraProductsEditor
          value={data.extraProducts}
          onChange={(extraProducts) => onChange({ ...data, extraProducts })}
        />
        {adType === 'combo_offer' && (
          <div>
            <p className="text-[13px] mb-1.5" style={{ color: '#D0D0D8' }}>
              What is the offer?
            </p>
            <input
              value={endCard.offer || ''}
              onChange={(e) => onChange({ ...data, endCard: { ...endCard, enabled: true, offer: e.target.value } })}
              placeholder="e.g. All 3 for ₹499 — save ₹150"
              maxLength={60}
              className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
              style={inputStyle}
            />
          </div>
        )}
      </div>
    );
  }
  if (adType === 'festival') {
    const suggested = suggestedOccasions();
    return (
      <div className="space-y-2">
        <p className="text-[13px]" style={{ color: '#D0D0D8' }}>
          Which festival or occasion?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {suggested.map((occasion) => {
            const selected = data.occasion === occasion;
            return (
              <button
                key={occasion}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ ...data, occasion })}
                className="px-3 py-1.5 rounded-lg text-[14px] font-medium"
                style={{
                  background: selected ? PURPLE_SOFT : SURFACE,
                  border: `1px solid ${selected ? PURPLE_BORDER : LINE}`,
                  color: selected ? TEXT : MUTED,
                }}
              >
                {occasion}
              </button>
            );
          })}
        </div>
        <input
          value={data.occasion || ''}
          onChange={(e) => onChange({ ...data, occasion: e.target.value })}
          placeholder="Or type any occasion — e.g. Shop anniversary"
          maxLength={40}
          className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
          style={inputStyle}
        />
      </div>
    );
  }
  if (adType === 'shop_service') {
    return (
      <div className="space-y-1.5">
        <p className="text-[13px]" style={{ color: '#D0D0D8' }}>
          Where are you, and what do you offer?
        </p>
        <input
          value={data.shopDetails || ''}
          onChange={(e) => onChange({ ...data, shopDetails: e.target.value })}
          placeholder="e.g. Family dental clinic in Anna Nagar, Chennai — open 7 days"
          maxLength={140}
          className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
          style={inputStyle}
        />
      </div>
    );
  }
  return null;
}

/**
 * "What are you advertising?" + type-specific details + "How should it look?".
 * `compact` is the studio side-rail version.
 */
export function GuidedAdSetup({
  data,
  onChange,
  compact,
}: {
  data: AdBuilderData;
  onChange: (next: AdBuilderData) => void;
  compact?: boolean;
}) {
  const adType = data.adType ?? 'product';
  return (
    <div className="space-y-4">
      <div>
        <Label>What are you advertising?</Label>
        <OptionCards
          options={AD_TYPE_OPTIONS}
          value={adType}
          compact={compact}
          // A new type invalidates an idea picked for the old one.
          onChange={(id) => onChange({ ...data, adType: id, approvedConcept: undefined })}
        />
      </div>
      <AdTypeExtras data={data} onChange={onChange} />
      <div>
        <Label>How should it look?</Label>
        <OptionCards
          options={STYLE_OPTIONS}
          value={data.adSetup.creativeFormat}
          compact={compact}
          sampleFolder={data.adType && AD_TYPES_WITH_SAMPLES.has(data.adType) ? data.adType : undefined}
          onChange={(id) =>
            onChange({
              ...data,
              approvedConcept: undefined,
              adSetup: { ...data.adSetup, creativeFormat: id as AdBuilderData['adSetup']['creativeFormat'] },
            })
          }
        />
      </div>
    </div>
  );
}

/* ---------------- Voice input ---------------- */

/** Longest recording we accept (the server caps size too). */
const MAX_RECORDING_SECONDS = 120;

function pickRecordingMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Speak instead of typing. Records the microphone and has the server write it
 * down (any browser; browser speech recognition only works in desktop Chrome).
 */
export function VoiceInputButton({
  language,
  onText,
}: {
  language?: string;
  onText: (text: string) => void;
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  // Latest callback, so text lands on the brief as it is when transcription finishes.
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    if (state !== 'recording') return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(elapsed);
      if (elapsed >= MAX_RECORDING_SECONDS) recorderRef.current?.stop();
    }, 500);
    return () => clearInterval(timer);
  }, [state]);

  useEffect(
    () => () => {
      const rec = recorderRef.current;
      if (rec && rec.state !== 'inactive') {
        rec.onstop = null;
        rec.stop();
        rec.stream.getTracks().forEach((t) => t.stop());
      }
    },
    []
  );

  const transcribe = async (blob: Blob) => {
    setState('transcribing');
    try {
      const response = await authFetch('/api/commercial/transcribe', {
        method: 'POST',
        body: JSON.stringify({ audio: await blobToBase64(blob), mimeType: blob.type || 'audio/webm', language }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; text?: string; error?: string };
      if (!response.ok || !result.ok) {
        setMessage(result.error || 'We couldn’t hear that clearly. Please try again.');
      } else if (!result.text?.trim()) {
        setMessage('We didn’t catch any words. Please speak a little closer to the microphone.');
      } else {
        onTextRef.current(result.text.trim());
        setMessage(null);
      }
    } catch {
      setMessage('No internet connection. Please try again.');
    } finally {
      setState('idle');
    }
  };

  const start = async () => {
    setMessage(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMessage('This browser can’t record your voice. Please type instead, or open SkalX in Chrome or Safari.');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setMessage(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Please allow microphone access (the icon in the address bar), then tap Speak again.'
          : 'We couldn’t find a microphone. Please check it is connected.'
      );
      return;
    }
    const mimeType = pickRecordingMimeType();
    const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/webm' });
      if (blob.size < 1000) {
        setState('idle');
        setMessage('That was too short. Tap Speak, talk, then tap Done.');
        return;
      }
      void transcribe(blob);
    };
    recorderRef.current = rec;
    rec.start();
    setSeconds(0);
    setState('recording');
  };

  const recording = state === 'recording';
  const busy = state === 'transcribing';
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => (recording ? recorderRef.current?.stop() : start())}
        disabled={busy}
        aria-pressed={recording}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[14px] font-medium min-h-[40px] disabled:opacity-70"
        style={{
          background: recording ? 'rgba(239, 68, 68, 0.16)' : SURFACE,
          border: `1px solid ${recording ? 'rgba(239, 68, 68, 0.5)' : LINE}`,
          color: recording ? '#FCA5A5' : '#D0D0D8',
        }}
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : recording ? (
          <Square size={12} fill="currentColor" />
        ) : (
          <Mic size={14} />
        )}
        {busy ? 'Writing it down…' : recording ? `Done (${clock})` : 'Speak instead'}
      </button>
      {recording && (
        <span className="absolute right-0 top-full mt-1 w-[260px] text-right text-[12px]" style={{ color: '#FCA5A5' }} aria-live="polite">
          Listening… talk about your product, then tap Done.
        </span>
      )}
      {message && !recording && (
        <span className="absolute right-0 top-full mt-1 w-[280px] text-right text-[12px] z-10" style={{ color: '#FCD34D' }} role="status">
          {message}
        </span>
      )}
    </span>
  );
}

/* ---------------- Idea cards ---------------- */

/**
 * "Show me 3 ideas": plain-language concepts with a storyboard each.
 * Picking one stores it as approvedConcept; the director builds on it.
 */
export function IdeaCards({
  data,
  onChange,
  onRequestConcepts,
  disabled,
  compact,
}: {
  data: AdBuilderData;
  onChange: (next: AdBuilderData) => void;
  onRequestConcepts: () => Promise<ConceptCard[]>;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [cards, setCards] = useState<ConceptCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picked = data.approvedConcept;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setCards(await onRequestConcepts());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create ideas right now.');
    } finally {
      setLoading(false);
    }
  };

  const pick = (card: ConceptCard) =>
    onChange({ ...data, approvedConcept: { title: card.title, idea: card.idea, beats: card.beats } });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={load}
          disabled={disabled || loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[14px] font-medium disabled:opacity-50"
          style={{ background: PURPLE_SOFT, border: `1px solid ${PURPLE_BORDER}`, color: TEXT }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />}
          {loading ? 'Drawing 3 ideas… (about 30 seconds)' : cards ? 'Show 3 new ideas' : 'Show me 3 ideas first'}
        </button>
        {picked && (
          <button
            type="button"
            onClick={() => onChange({ ...data, approvedConcept: undefined })}
            className="text-[13px] underline"
            style={{ color: MUTED }}
          >
            Let AI decide instead
          </button>
        )}
      </div>
      {!cards && !loading && (
        <p className="text-[13px]" style={{ color: MUTED }}>
          Free — see sketches of three different ads and pick the one you like before using Video Credits.
        </p>
      )}
      {error && (
        <p className="text-[13px]" role="alert" style={{ color: '#FCA5A5' }}>
          {error}
        </p>
      )}
      {picked && !cards && (
        <p className="text-[13px]" style={{ color: '#E9D5FF' }}>
          Using your idea: <span className="font-medium">{picked.title}</span>
        </p>
      )}
      {cards && (
        <div className={compact ? 'space-y-2' : 'grid grid-cols-1 md:grid-cols-3 gap-3'}>
          {cards.map((card) => {
            const selected = picked?.title === card.title && picked?.idea === card.idea;
            return (
              <button
                key={card.id}
                type="button"
                aria-pressed={selected}
                onClick={() => pick(card)}
                className="text-left rounded-xl overflow-hidden flex flex-col"
                style={{
                  background: SURFACE,
                  border: `1px solid ${selected ? PURPLE : LINE}`,
                  boxShadow: selected ? `0 0 0 1px ${PURPLE}` : undefined,
                }}
              >
                {card.storyboardImage && !compact && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.storyboardImage} alt={`Storyboard for ${card.title}`} className="w-full aspect-video object-cover" />
                )}
                <span className="block p-3 space-y-1.5">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-medium" style={{ color: TEXT }}>
                      {card.title}
                    </span>
                    {selected && <Check size={15} style={{ color: PURPLE }} aria-label="Picked" />}
                  </span>
                  <span className="block text-[14px] leading-snug" style={{ color: '#D0D0D8' }}>
                    {card.idea}
                  </span>
                  {!compact && card.beats.length > 0 && (
                    <span className="block text-[13px] leading-snug" style={{ color: MUTED }}>
                      {card.beats.map((b, i) => `${i + 1}. ${b}`).join('  ')}
                    </span>
                  )}
                  {!compact && card.whyItWorks && (
                    <span className="block text-[13px] italic" style={{ color: MUTED }}>
                      {card.whyItWorks}
                    </span>
                  )}
                  <span
                    className="inline-block mt-1 text-[13px] font-medium"
                    style={{ color: selected ? '#E9D5FF' : PURPLE }}
                  >
                    {selected ? 'Picked — this will be your ad' : 'Use this idea'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Help me write it ---------------- */

function ChipRow<T extends string>({
  table,
  value,
  onToggle,
}: {
  table: Record<T, { label: string }>;
  value: (id: T) => boolean;
  onToggle: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(table) as T[]).map((id) => {
        const selected = value(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(id)}
            className="px-3 py-1.5 rounded-lg text-[14px] font-medium"
            style={{
              background: selected ? PURPLE_SOFT : SURFACE,
              border: `1px solid ${selected ? PURPLE_BORDER : LINE}`,
              color: selected ? TEXT : MUTED,
            }}
          >
            {table[id].label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Tap-only questions (what viewers should do, feeling, who, where) that the AI
 * turns into the "In your own words" text. Answers are saved as they are tapped,
 * so ideas and the video follow them even if the owner never presses "Write it".
 */
export function WriteHelper({
  data,
  onChange,
  onRequestWrite,
  disabled,
}: {
  data: AdBuilderData;
  onChange: (next: AdBuilderData) => void;
  onRequestWrite: (direction: AdDirection | undefined) => Promise<string>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previousText, setPreviousText] = useState<string | null>(null);
  const [writtenText, setWrittenText] = useState<string | null>(null);
  const direction = data.adDirection ?? {};
  // Offer "Undo" only while the written text is untouched; once it is enhanced or
  // edited, that change has its own undo and two "Undo" links would be confusing.
  const canUndo = previousText != null && writtenText != null && data.userDescription === writtenText;

  // Answers change the ad, so an idea picked earlier no longer fits.
  const setDirection = (next: AdDirection) =>
    onChange({ ...data, adDirection: next, approvedConcept: undefined });
  const toggle = <K extends 'viewerAction' | 'mood' | 'castRegion' | 'setting'>(key: K, id: AdDirection[K]) =>
    setDirection({ ...direction, [key]: direction[key] === id ? undefined : id });
  const toggleAge = (id: CastAgeId) => {
    const ages = direction.castAges ?? [];
    const next = ages.includes(id) ? ages.filter((a) => a !== id) : [...ages, id];
    setDirection({ ...direction, castAges: next.length ? next : undefined });
  };

  const write = async () => {
    setLoading(true);
    setError(null);
    try {
      const text = await onRequestWrite(data.adDirection);
      setPreviousText(data.userDescription || '');
      setWrittenText(text);
      onChange({ ...data, userDescription: text, approvedConcept: undefined });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not write that right now.');
    } finally {
      setLoading(false);
    }
  };

  const undo = () => {
    if (previousText == null) return;
    onChange({ ...data, userDescription: previousText });
    setPreviousText(null);
    setWrittenText(null);
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[14px] font-medium disabled:opacity-50"
          style={{ background: PURPLE_SOFT, border: `1px solid ${PURPLE_BORDER}`, color: TEXT }}
        >
          <Sparkles size={14} />
          Help me write it
        </button>
        {canUndo ? (
          <span className="text-[13px]" style={{ color: '#E9D5FF' }}>
            Written for you — change anything you like.{' '}
            <button type="button" onClick={undo} className="underline" style={{ color: MUTED }}>
              Undo
            </button>
          </span>
        ) : (
          <span className="text-[13px]" style={{ color: MUTED }}>
            Answer a few taps and we&apos;ll write it for you.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl p-3.5 space-y-4" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${PURPLE_BORDER}` }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] font-medium" style={{ color: TEXT }}>
          Help me write it
        </p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ color: MUTED }}>
          <X size={16} />
        </button>
      </div>
      <p className="text-[13px] -mt-2" style={{ color: MUTED }}>
        Tap what fits. Skip anything you&apos;re not sure about.
      </p>

      <div>
        <Label>What should people do after watching?</Label>
        <ChipRow table={VIEWER_ACTIONS} value={(id) => direction.viewerAction === id} onToggle={(id) => toggle('viewerAction', id)} />
      </div>
      <div>
        <Label>How should it feel?</Label>
        <ChipRow table={MOODS} value={(id) => direction.mood === id} onToggle={(id) => toggle('mood', id)} />
      </div>
      <div>
        <Label>Who should be in it?</Label>
        <ChipRow table={CAST_REGIONS} value={(id) => direction.castRegion === id} onToggle={(id) => toggle('castRegion', id)} />
        {direction.castRegion !== 'no_people' && (
          <div className="mt-2">
            <p className="text-[13px] mb-1.5" style={{ color: '#D0D0D8' }}>
              Their age (pick any)
            </p>
            <ChipRow table={CAST_AGES} value={(id) => Boolean(direction.castAges?.includes(id))} onToggle={toggleAge} />
          </div>
        )}
      </div>
      <div>
        <Label>Where?</Label>
        <ChipRow table={SETTINGS} value={(id) => direction.setting === id} onToggle={(id) => toggle('setting', id)} />
      </div>
      <div>
        <Label>Anything you must show or say?</Label>
        <input
          value={direction.mustInclude || ''}
          onChange={(e) => setDirection({ ...direction, mustInclude: e.target.value || undefined })}
          placeholder="e.g. Made at home with no preservatives — show the jar being opened"
          maxLength={300}
          className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
          style={inputStyle}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={write}
          disabled={disabled || loading}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[14px] font-semibold disabled:opacity-50"
          style={{ background: PURPLE, color: '#fff' }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? 'Writing…' : 'Write it for me'}
        </button>
        <span className="text-[13px]" style={{ color: MUTED }}>
          Free. {data.userDescription?.trim() ? 'Keeps what you already wrote.' : 'You can change the words after.'}
        </span>
      </div>
      {error && (
        <p className="text-[13px]" role="alert" style={{ color: '#FCA5A5' }}>
          {error}
        </p>
      )}
    </div>
  );
}
