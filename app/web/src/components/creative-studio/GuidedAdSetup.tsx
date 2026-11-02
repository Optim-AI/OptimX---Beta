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
  MicOff,
  Package,
  PartyPopper,
  Plus,
  Rocket,
  Shapes,
  Smartphone,
  Store,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import type { AdBuilderData } from './types';
import { suggestedOccasions } from '@/lib/creative-studio/commercial-production/campaign/ad-type';
import type { ConceptCard } from '@/lib/creative-studio/commercial-production/concepts/generate-concepts';

const PURPLE = '#A855F7';
const PURPLE_SOFT = 'rgba(168, 85, 247, 0.16)';
const PURPLE_BORDER = 'rgba(168, 85, 247, 0.42)';
const SURFACE = '#16161C';
const LINE = 'rgba(255,255,255,0.08)';
const MUTED = '#8B8B98';
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
              <span className={compact ? 'text-[12px] font-medium' : 'text-[14px] font-medium'} style={{ color: TEXT }}>
                {opt.label}
              </span>
            </span>
            {!compact && (
              <span className="block text-[12px] mt-1 leading-snug" style={{ color: MUTED }}>
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
    <p className="text-[11px] tracking-[0.14em] uppercase mb-2" style={{ color: MUTED }}>
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
      <p className="text-[12px]" style={{ color: MUTED }}>
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
            className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-[13px] outline-none"
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
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px]"
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
            <p className="text-[12px] mb-1.5" style={{ color: '#D0D0D8' }}>
              What is the offer?
            </p>
            <input
              value={endCard.offer || ''}
              onChange={(e) => onChange({ ...data, endCard: { ...endCard, enabled: true, offer: e.target.value } })}
              placeholder="e.g. All 3 for ₹499 — save ₹150"
              maxLength={60}
              className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
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
        <p className="text-[12px]" style={{ color: '#D0D0D8' }}>
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
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium"
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
          className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
          style={inputStyle}
        />
      </div>
    );
  }
  if (adType === 'shop_service') {
    return (
      <div className="space-y-1.5">
        <p className="text-[12px]" style={{ color: '#D0D0D8' }}>
          Where are you, and what do you offer?
        </p>
        <input
          value={data.shopDetails || ''}
          onChange={(e) => onChange({ ...data, shopDetails: e.target.value })}
          placeholder="e.g. Family dental clinic in Anna Nagar, Chennai — open 7 days"
          maxLength={140}
          className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
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

type RecognitionResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

const SPEECH_LANG: Record<string, string> = {
  english: 'en-IN',
  tamil: 'ta-IN',
  hindi: 'hi-IN',
  malayalam: 'ml-IN',
  kannada: 'kn-IN',
};

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/** Speak instead of typing (browser speech recognition, in the voiceover language). */
export function VoiceInputButton({
  language,
  onText,
}: {
  language?: string;
  onText: (text: string) => void;
}) {
  // The studio is client-only (ssr: false), so reading window here is safe.
  const [supported] = useState(() => Boolean(getRecognitionCtor()));
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  if (!supported) return null;

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = SPEECH_LANG[language || 'english'] || 'en-IN';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const finals: string[] = [];
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finals.push(e.results[i][0].transcript);
      }
      const text = finals.join(' ').trim();
      if (text) onText(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium"
      style={{
        background: listening ? 'rgba(239, 68, 68, 0.16)' : SURFACE,
        border: `1px solid ${listening ? 'rgba(239, 68, 68, 0.5)' : LINE}`,
        color: listening ? '#FCA5A5' : '#D0D0D8',
      }}
    >
      {listening ? <MicOff size={13} /> : <Mic size={13} />}
      {listening ? 'Stop — I’m listening' : 'Speak instead'}
    </button>
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
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[13px] font-medium disabled:opacity-50"
          style={{ background: PURPLE_SOFT, border: `1px solid ${PURPLE_BORDER}`, color: TEXT }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />}
          {loading ? 'Drawing 3 ideas… (about 30 seconds)' : cards ? 'Show 3 new ideas' : 'Show me 3 ideas first'}
        </button>
        {picked && (
          <button
            type="button"
            onClick={() => onChange({ ...data, approvedConcept: undefined })}
            className="text-[12px] underline"
            style={{ color: MUTED }}
          >
            Let AI decide instead
          </button>
        )}
      </div>
      {!cards && !loading && (
        <p className="text-[12px]" style={{ color: MUTED }}>
          Free — see sketches of three different ads and pick the one you like before using Video Credits.
        </p>
      )}
      {error && (
        <p className="text-[12px]" role="alert" style={{ color: '#FCA5A5' }}>
          {error}
        </p>
      )}
      {picked && !cards && (
        <p className="text-[12px]" style={{ color: '#E9D5FF' }}>
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
                  <span className="block text-[13px] leading-snug" style={{ color: '#D0D0D8' }}>
                    {card.idea}
                  </span>
                  {!compact && card.beats.length > 0 && (
                    <span className="block text-[12px] leading-snug" style={{ color: MUTED }}>
                      {card.beats.map((b, i) => `${i + 1}. ${b}`).join('  ')}
                    </span>
                  )}
                  {!compact && card.whyItWorks && (
                    <span className="block text-[12px] italic" style={{ color: MUTED }}>
                      {card.whyItWorks}
                    </span>
                  )}
                  <span
                    className="inline-block mt-1 text-[12px] font-medium"
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
