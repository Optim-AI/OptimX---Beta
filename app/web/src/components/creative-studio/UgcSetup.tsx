'use client';

/**
 * UGC Studio setup: pick the on-screen creator (our faces, your photo, or
 * describe one), the kind of UGC video, and whether they talk to the camera or
 * act while a voice speaks. Large, plain choices for non-technical owners.
 */

import React, { useState } from 'react';
import { Check, ImagePlus, Loader2, Mic, Sparkles, UserRound, Video, X } from 'lucide-react';
import type { AdBuilderData, UgcSetupData } from './types';
import {
  normalizeVoiceoverLanguage,
  usesGeminiTts,
  VOICEOVER_LANGUAGE_LABELS,
} from '@/lib/creative-studio/commercial-production/audio/voiceover-languages';
import { authFetch } from '@/lib/utils';
import {
  UGC_FORMATS,
  type UgcCreatorKind,
  type UgcFormatId,
} from '@/lib/creative-studio/commercial-production/campaign/ugc';
import {
  UGC_CREATOR_PRESETS,
  UGC_PRESET_GROUPS,
  ugcPresetImagePath,
  type UgcPresetGroup,
} from '@/lib/creative-studio/commercial-production/campaign/ugc-presets';

const PURPLE = '#A855F7';
const PURPLE_SOFT = 'rgba(168, 85, 247, 0.16)';
const PURPLE_BORDER = 'rgba(168, 85, 247, 0.42)';
const SURFACE = '#16161C';
const LINE = 'rgba(255,255,255,0.08)';
const MUTED = '#A3A3AF';
const TEXT = '#F4F4F7';
const UPLOAD_MAX_DIM = 768;

export const DEFAULT_UGC_SETUP: UgcSetupData = { format: 'review', delivery: 'voiceover' };

type Source = 'ours' | 'upload' | 'describe';

const KIND_OPTIONS: Array<{ id: UgcCreatorKind; label: string }> = [
  { id: 'person', label: 'Person' },
  { id: 'animal', label: 'Animal' },
  { id: 'mascot', label: 'Cartoon / mascot' },
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] tracking-[0.14em] uppercase mb-2" style={{ color: MUTED }}>
      {children}
    </p>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-[14px] font-medium"
      style={{
        background: selected ? PURPLE_SOFT : SURFACE,
        border: `1px solid ${selected ? PURPLE_BORDER : LINE}`,
        color: selected ? TEXT : MUTED,
      }}
    >
      {children}
    </button>
  );
}

/** Square JPEG data URL so the photo stays small in the saved session. */
function readSquarePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const size = Math.min(UPLOAD_MAX_DIM, side);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Could not read the photo.'));
      // Centre crop, a little above middle so faces stay in frame.
      const sx = (img.width - side) / 2;
      const sy = Math.max(0, (img.height - side) * 0.35);
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read the photo. Please try a JPG or PNG.'));
    };
    img.src = url;
  });
}

function CreatorPicker({ ugc, onChange }: { ugc: UgcSetupData; onChange: (next: UgcSetupData) => void }) {
  const [source, setSource] = useState<Source>(ugc.creator && !ugc.creator.presetId ? 'upload' : 'ours');
  const [group, setGroup] = useState<UgcPresetGroup>('india');
  const [pending, setPending] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [kind, setKind] = useState<UgcCreatorKind>('person');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creator = ugc.creator;

  const setCreator = (next: UgcSetupData['creator']) => onChange({ ...ugc, creator: next });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      setPending(await readSquarePhoto(file));
      setConsent(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the photo.');
    }
  };

  const usePhoto = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch('/api/ugc/creator', {
        method: 'POST',
        body: JSON.stringify({ mode: 'check', image: pending, consent }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        kind?: UgcCreatorKind;
        description?: string;
        error?: string;
      } | null;
      if (!data?.ok) throw new Error(data?.error || 'We could not use this photo. Please try another.');
      setCreator({ kind: data.kind || 'person', name: 'Your creator', description: data.description, image: pending });
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not use this photo.');
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch('/api/ugc/creator', {
        method: 'POST',
        body: JSON.stringify({ mode: 'describe', kind, description }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; image?: string; error?: string } | null;
      if (!data?.ok || !data.image) throw new Error(data?.error || 'Could not create that creator. Please try again.');
      setPending(data.image);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create that creator.');
    } finally {
      setBusy(false);
    }
  };

  if (creator?.image) {
    return (
      <div className="flex items-center gap-4 rounded-xl p-3" style={{ background: SURFACE, border: `1px solid ${PURPLE_BORDER}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={creator.image} alt={creator.name || 'Creator'} className="w-20 h-20 rounded-xl object-cover" />
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-medium" style={{ color: TEXT }}>
            {creator.name || 'Your creator'}
          </p>
          <p className="text-[13px] mt-0.5 truncate" style={{ color: MUTED }}>
            {creator.description || (creator.kind === 'person' ? 'Your photo' : creator.kind === 'animal' ? 'Animal' : 'Mascot')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreator(undefined)}
          className="px-3 py-2 rounded-lg text-[14px]"
          style={{ border: `1px solid ${LINE}`, color: '#D0D0D8' }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Chip selected={source === 'ours'} onClick={() => { setSource('ours'); setPending(null); setError(null); }}>
          <span className="inline-flex items-center gap-1.5"><UserRound size={14} /> Our creators</span>
        </Chip>
        <Chip selected={source === 'upload'} onClick={() => { setSource('upload'); setPending(null); setError(null); }}>
          <span className="inline-flex items-center gap-1.5"><ImagePlus size={14} /> Upload a photo</span>
        </Chip>
        <Chip selected={source === 'describe'} onClick={() => { setSource('describe'); setPending(null); setError(null); }}>
          <span className="inline-flex items-center gap-1.5"><Sparkles size={14} /> Describe one</span>
        </Chip>
      </div>

      {source === 'ours' && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {UGC_PRESET_GROUPS.map((g) => (
              <Chip key={g.id} selected={group === g.id} onClick={() => setGroup(g.id)}>
                {g.label}
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {UGC_CREATOR_PRESETS.filter((p) => p.group === group).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  setCreator({
                    kind: p.kind,
                    name: p.name,
                    description: p.description,
                    image: ugcPresetImagePath(p.id),
                    presetId: p.id,
                    voiceGender: p.voiceGender,
                  })
                }
                className="text-left rounded-xl overflow-hidden transition-colors"
                style={{ background: SURFACE, border: `1px solid ${LINE}` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ugcPresetImagePath(p.id)} alt={p.name} loading="lazy" className="w-full aspect-square object-cover" />
                <span className="block px-2 py-1.5">
                  <span className="block text-[14px] font-medium" style={{ color: TEXT }}>
                    {p.name}
                  </span>
                  <span className="block text-[12px] leading-tight" style={{ color: MUTED }}>
                    {p.label}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {source === 'upload' && !pending && (
        <label
          className="flex flex-col items-center justify-center gap-2 rounded-xl py-8 cursor-pointer"
          style={{ background: SURFACE, border: `1px dashed ${PURPLE_BORDER}`, color: '#D0D0D8' }}
        >
          <ImagePlus size={22} />
          <span className="text-[15px] font-medium">Choose a photo</span>
          <span className="text-[13px]" style={{ color: MUTED }}>
            A clear photo of a person, pet or mascot looking at the camera
          </span>
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      )}

      {source === 'describe' && !pending && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {KIND_OPTIONS.map((k) => (
              <Chip key={k.id} selected={kind === k.id} onClick={() => setKind(k.id)}>
                {k.label}
              </Chip>
            ))}
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              kind === 'person'
                ? 'e.g. Tamil woman, about 35, cotton saree, friendly smile'
                : kind === 'animal'
                  ? 'e.g. Golden retriever with a red collar'
                  : 'e.g. Happy cartoon mango with big eyes'
            }
            maxLength={300}
            className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
            style={{ background: SURFACE, border: `1px solid ${LINE}`, color: TEXT }}
          />
          <button
            type="button"
            onClick={create}
            disabled={busy || description.trim().length < 3}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[14px] font-semibold disabled:opacity-50"
            style={{ background: PURPLE, color: '#fff' }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {busy ? 'Creating… (about 15 seconds)' : 'Create my creator'}
          </button>
        </div>
      )}

      {pending && (
        <div className="rounded-xl p-3 space-y-3" style={{ background: SURFACE, border: `1px solid ${LINE}` }}>
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pending} alt="New creator" className="w-28 h-28 rounded-xl object-cover" />
            <button type="button" onClick={() => setPending(null)} aria-label="Remove" className="ml-auto" style={{ color: MUTED }}>
              <X size={16} />
            </button>
          </div>
          {source === 'upload' ? (
            <>
              <label className="flex items-start gap-2 text-[14px] leading-snug" style={{ color: '#D0D0D8' }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
                If this is a real person, I have their permission to use their photo in ads.
              </label>
              <button
                type="button"
                onClick={usePhoto}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[14px] font-semibold disabled:opacity-50"
                style={{ background: PURPLE, color: '#fff' }}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {busy ? 'Checking the photo…' : 'Use this photo'}
              </button>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreator({ kind, name: 'Your creator', description: description.trim(), image: pending });
                  setPending(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[14px] font-semibold"
                style={{ background: PURPLE, color: '#fff' }}
              >
                <Check size={14} /> Use this creator
              </button>
              <button
                type="button"
                onClick={create}
                disabled={busy}
                className="px-4 py-2.5 rounded-xl text-[14px] disabled:opacity-50"
                style={{ border: `1px solid ${LINE}`, color: '#D0D0D8' }}
              >
                {busy ? 'Creating…' : 'Try another'}
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-[13px]" role="alert" style={{ color: '#FCA5A5' }}>
          {error}
        </p>
      )}
    </div>
  );
}

export function UgcSetup({
  data,
  onChange,
}: {
  data: AdBuilderData;
  onChange: (next: AdBuilderData) => void;
}) {
  const ugc = data.ugc ?? DEFAULT_UGC_SETUP;
  const language = data.voiceover?.language ?? 'english';
  // The video model speaks English only; other languages use the presenter style.
  const canTalk = !usesGeminiTts(language);
  const languageLabel = VOICEOVER_LANGUAGE_LABELS[normalizeVoiceoverLanguage(language)];
  // A picked idea was made for the old creator / format.
  const set = (next: UgcSetupData) => onChange({ ...data, ugc: next, approvedConcept: undefined });

  return (
    <div className="space-y-5">
      <div>
        <Label>1. Who is in your video?</Label>
        <CreatorPicker ugc={ugc} onChange={set} />
      </div>

      <div>
        <Label>2. What kind of video?</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(Object.keys(UGC_FORMATS) as UgcFormatId[]).map((id) => {
            const selected = ugc.format === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => set({ ...ugc, format: id })}
                className="text-left rounded-xl px-3 py-3"
                style={{ background: selected ? PURPLE_SOFT : SURFACE, border: `1px solid ${selected ? PURPLE_BORDER : LINE}` }}
              >
                <span className="block text-[14px] font-medium" style={{ color: TEXT }}>
                  {UGC_FORMATS[id].label}
                </span>
                <span className="block text-[13px] mt-1 leading-snug" style={{ color: MUTED }}>
                  {UGC_FORMATS[id].hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>3. How should they talk?</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            {
              id: 'talk_to_camera' as const,
              icon: Video,
              title: 'Talks to the camera',
              hint: canTalk
                ? 'Looks at the camera and speaks, like a real review.'
                : `Faces the camera, says a quick "Hey friends!", then shows and reacts while the voice speaks in ${languageLabel}.`,
              disabled: false,
            },
            {
              id: 'voiceover' as const,
              icon: Mic,
              title: 'Voice-over',
              hint: 'Shows and uses the product while a voice speaks. Any language — and you can make other languages later for free.',
              disabled: false,
            },
          ].map((opt) => {
            const selected = ugc.delivery === opt.id;
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={selected}
                disabled={opt.disabled}
                onClick={() => set({ ...ugc, delivery: opt.id })}
                className="text-left rounded-xl px-3.5 py-3 disabled:opacity-50"
                style={{ background: selected ? PURPLE_SOFT : SURFACE, border: `1px solid ${selected ? PURPLE_BORDER : LINE}` }}
              >
                <span className="flex items-center gap-2 text-[15px] font-medium" style={{ color: TEXT }}>
                  <Icon size={16} style={{ color: selected ? '#E9D5FF' : MUTED }} /> {opt.title}
                </span>
                <span className="block text-[13px] mt-1 leading-snug" style={{ color: MUTED }}>
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Voice-over videos can be re-voiced into another language without a new video. */
export function RevoiceBar({
  languages,
  currentLanguage,
  busyLanguage,
  onRevoice,
}: {
  languages: Array<{ id: string; label: string }>;
  currentLanguage?: string;
  busyLanguage: string | null;
  onRevoice: (language: string) => void;
}) {
  return (
    <div className="rounded-xl p-3" style={{ background: SURFACE, border: `1px solid ${LINE}` }}>
      <p className="text-[14px] font-medium" style={{ color: TEXT }}>
        Make it in another language
      </p>
      <p className="text-[13px] mt-0.5 mb-2" style={{ color: MUTED }}>
        Same video, new voice. Free — no Video Credits.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {languages
          .filter((l) => l.id !== (currentLanguage || 'english'))
          .map((l) => (
            <button
              key={l.id}
              type="button"
              disabled={Boolean(busyLanguage)}
              onClick={() => onRevoice(l.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14px] font-medium disabled:opacity-50"
              style={{ background: SURFACE, border: `1px solid ${PURPLE_BORDER}`, color: '#E9D5FF' }}
            >
              {busyLanguage === l.id && <Loader2 size={13} className="animate-spin" />}
              {busyLanguage === l.id ? `Making ${l.label}…` : l.label}
            </button>
          ))}
      </div>
    </div>
  );
}
