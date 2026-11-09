// pages/ugc-studio.tsx
// UGC Studio landing: start a creator-led UGC video and reopen earlier ones.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Sidebar from '@/app/web/src/components/Sidebar';
import { ArrowRight, Loader2, Play, Trash2, Video } from 'lucide-react';
import { ShimmerTile } from '@/app/web/src/components/ui/loaders';
import { showError } from '@/app/web/src/components/ui/alert-modal-api';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import { formatTimestamp, type BrandSnapshot } from '@/app/web/src/components/creative-studio';
import {
  UGC_CREATOR_PRESETS,
  UGC_STUDIO_LIVE,
  ugcPresetImagePath,
} from '@/lib/creative-studio/commercial-production/campaign/ugc-presets';
import { VOICEOVER_LANGUAGES, VOICEOVER_LANGUAGE_LABELS } from '@/lib/creative-studio/commercial-production/audio/voiceover-languages';

type UgcSessionItem = {
  id: string;
  name: string;
  updatedAt: string;
  cover?: string | null;
};

/** Shown over the page while UGC Studio is paused; the page behind can't be used. */
function ComingSoonOverlay({ onBack }: { onBack: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-6" style={{ background: 'rgba(11, 11, 15, 0.55)' }}>
      <div
        role="dialog"
        aria-labelledby="ugc-soon-title"
        className="w-full max-w-md rounded-2xl p-7 text-center"
        style={{ background: '#16161C', border: `1px solid ${colors.border}`, boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }}
      >
        <div className="mx-auto flex -space-x-3 justify-center">
          {['meera', 'jordan', 'bruno', 'yuki'].map((id) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={id}
              src={ugcPresetImagePath(id)}
              alt=""
              className="h-12 w-12 rounded-full object-cover"
              style={{ border: '2px solid #16161C' }}
            />
          ))}
        </div>
        <span
          className="mt-5 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: '#f5b942', background: 'rgba(245, 185, 66, 0.14)' }}
        >
          Coming soon
        </span>
        <h2 id="ugc-soon-title" className="mt-3 text-xl font-semibold" style={{ color: colors.foreground }}>
          UGC Studio is on its way
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: colors.mutedForeground }}>
          Real-looking creator videos for your product — a person, a pet or a mascot, in your customers&apos; language.
          We&apos;ll let you know as soon as it&apos;s ready.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold text-white"
          style={{ background: '#A855F7' }}
        >
          Make a video in Brand Studio
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** A few faces for the hero strip — people, an animal and a mascot. */
const HERO_FACES = ['meera', 'jordan', 'yuki', 'amara', 'luca', 'bruno', 'priya', 'pip'];

export default function UgcStudioLanding() {
  const router = useRouter();
  const [sessions, setSessions] = useState<UgcSessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [brand, setBrand] = useState<BrandSnapshot | null>(null);
  const [brandLoaded, setBrandLoaded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [videoCredits, setVideoCredits] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [sessionsRes, brandRes, creditsRes] = await Promise.all([
          authFetch('/api/creative-studio/sessions?type=ugc&includeMedia=1&limit=100'),
          authFetch('/api/brand/snapshot'),
          authFetch('/api/credits/balance'),
        ]);
        const sessionsData = await sessionsRes.json().catch(() => null);
        if (sessionsData?.ok) {
          setSessions(
            sessionsData.sessions.map(
              (s: { id: string; name: string; updatedAt: string; generatedVideos?: Array<{ url?: string }> | null }) => ({
                id: s.id,
                name: s.name,
                updatedAt: s.updatedAt,
                cover: s.generatedVideos?.find((v) => v.url && !v.url.startsWith('data:'))?.url ?? null,
              })
            )
          );
        }
        const brandData = await brandRes.json().catch(() => null);
        if (brandData?.brandSnapshot) setBrand(brandData.brandSnapshot);
        const creditsData = await creditsRes.json().catch(() => null);
        if (creditsData?.success) setVideoCredits(creditsData.videoCredits?.total ?? 0);
      } catch (err) {
        console.error('[ugc-studio] load failed', err);
      } finally {
        setIsLoading(false);
        setBrandLoaded(true);
      }
    })();
  }, []);

  async function startNew() {
    if (!brand) {
      void router.push({ pathname: '/brand-kit', query: { welcome: '1' } });
      return;
    }
    setIsCreating(true);
    try {
      const res = await authFetch('/api/creative-studio/sessions', {
        method: 'POST',
        body: JSON.stringify({ name: 'UGC video', sessionType: 'ugc', brandSnapshot: brand }),
      });
      const data = await res.json();
      if (data.ok && data.session?.id) {
        void router.push(`/ugc-studio/video?id=${data.session.id}`);
      } else {
        showError('Could not start a new video: ' + (data.error || 'Unknown error'));
      }
    } catch {
      showError('Could not start a new video. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await authFetch(`/api/creative-studio/sessions?id=${deleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) setSessions((prev) => prev.filter((s) => s.id !== deleteId));
      else showError('Could not delete: ' + (data.error || 'Unknown error'));
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="h-screen flex overflow-hidden app-page">
      <div className="flex-shrink-0 h-full">
        <Sidebar showChatHistory={false} />
      </div>

      <div className="relative flex-1 flex flex-col h-full overflow-hidden" style={{ backgroundColor: colors.background }}>
        {!UGC_STUDIO_LIVE && <ComingSoonOverlay onBack={() => router.push('/brand-studio')} />}
        <div
          className={`flex-1 overflow-y-auto ${UGC_STUDIO_LIVE ? '' : 'pointer-events-none select-none blur-[6px] opacity-60'}`}
          aria-hidden={!UGC_STUDIO_LIVE}
          inert={!UGC_STUDIO_LIVE || undefined}
        >
          <div className="mx-auto max-w-6xl px-6 py-8">
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold" style={{ color: colors.foreground }}>
                  UGC Studio
                </h1>
                <p className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                  Real-looking creator videos for your product — a person, a pet or a mascot, in your customers&apos; language.
                </p>
              </div>
              {videoCredits !== null && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
                  style={{ border: `1px solid ${colors.border}`, color: colors.mutedForeground }}
                >
                  <Video className="h-3.5 w-3.5" style={{ color: 'hsl(270 80% 70%)' }} />
                  <strong style={{ color: colors.foreground }}>{videoCredits}</strong> video credits
                </span>
              )}
            </header>

            <section
              className="mt-6 rounded-2xl p-6 md:p-8 flex flex-col lg:flex-row lg:items-center gap-6"
              style={{ background: 'linear-gradient(135deg, #1A1424 0%, #121218 100%)', border: `1px solid ${colors.border}` }}
            >
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold" style={{ color: colors.foreground }}>
                  Make a UGC video
                </h2>
                <ol className="mt-3 space-y-1.5 text-[15px]" style={{ color: colors.mutedForeground }}>
                  <li>1. Pick a creator — {UGC_CREATOR_PRESETS.length} ready faces, your own photo, or describe one</li>
                  <li>2. Add your product and choose the kind of video</li>
                  <li>3. Choose the language and get a 15 or 30 second video</li>
                </ol>
                <p className="mt-3 text-[13px]" style={{ color: colors.mutedForeground }}>
                  {VOICEOVER_LANGUAGES.map((l) => VOICEOVER_LANGUAGE_LABELS[l]).join(' · ')}
                </p>
                <button
                  type="button"
                  onClick={startNew}
                  disabled={isCreating || !brandLoaded}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold text-white disabled:opacity-60"
                  style={{ background: '#A855F7' }}
                >
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {isCreating ? 'Starting…' : 'New UGC video'}
                </button>
                {brandLoaded && !brand && (
                  <p className="mt-2 text-[13px]" style={{ color: colors.mutedForeground }}>
                    You&apos;ll set up your Brand Kit first — it takes about a minute.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 w-full lg:w-[360px] flex-shrink-0">
                {HERO_FACES.map((id) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={id}
                    src={ugcPresetImagePath(id)}
                    alt=""
                    className="w-full aspect-square rounded-xl object-cover"
                    style={{ border: `1px solid ${colors.border}` }}
                  />
                ))}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-sm font-medium" style={{ color: colors.foreground }}>
                Your UGC videos
              </h2>
              {isLoading ? (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <ShimmerTile key={i} className="aspect-[4/3] rounded-xl" />
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <p className="mt-3 text-sm" style={{ color: colors.mutedForeground }}>
                  Nothing yet. Your UGC videos will show up here.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="group relative rounded-xl overflow-hidden"
                      style={{ border: `1px solid ${colors.border}`, background: '#121218' }}
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/ugc-studio/video?id=${s.id}`)}
                        className="block w-full text-left"
                      >
                        <div className="aspect-[4/3] flex items-center justify-center" style={{ background: '#0E0E13' }}>
                          {s.cover ? (
                            <video src={s.cover} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                          ) : (
                            <Video className="h-6 w-6" style={{ color: colors.mutedForeground }} />
                          )}
                        </div>
                        <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: colors.foreground }}>
                              {s.name}
                            </p>
                            <p className="text-xs" style={{ color: colors.mutedForeground }}>
                              {formatTimestamp(new Date(s.updatedAt).getTime())}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 flex-shrink-0" style={{ color: colors.mutedForeground }} />
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(s.id)}
                        aria-label={`Delete ${s.name}`}
                        className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100"
                        style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: '#16161C', border: `1px solid ${colors.border}` }}>
            <p className="text-[15px] font-medium" style={{ color: colors.foreground }}>
              Delete this UGC video?
            </p>
            <p className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
              Its videos will be removed from this list. This can&apos;t be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-lg text-sm" style={{ color: colors.mutedForeground }}>
                Cancel
              </button>
              <button type="button" onClick={confirmDelete} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#DC2626' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
