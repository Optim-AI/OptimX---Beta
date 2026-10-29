// pages/brand-studio.tsx
// Brand Studio Landing Page - Refactored for modular architecture

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { showError } from '@/app/web/src/components/ui/alert-modal-api';
import Link from 'next/link';
import Sidebar from '@/app/web/src/components/Sidebar';
import { ArrowRight, Clapperboard, Image as ImageIcon, LayoutTemplate, Play, Trash2, Video } from 'lucide-react';
import { ShimmerTile } from '@/app/web/src/components/ui/loaders';
import colors from '@/lib/ui/colors';
import {
  type BrandSnapshot,
  type SessionListItem,
  type SessionType,
  SessionNameModal,
  formatTimestamp,
} from '@/app/web/src/components/creative-studio';
import { authFetch } from '@/lib/utils';
import BrandKitCard from '@/app/web/src/components/creative-studio/BrandKitCard';

export default function BrandStudioLanding() {
  const router = useRouter();

  // Session state
  const [sessions, setSessions] = useState<Array<SessionListItem & { cover?: string | null; coverKind?: 'image' | 'video' }>>([]);
  const [sessionFilter, setSessionFilter] = useState<'all' | 'poster' | 'video'>('all');
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  // Brand state
  const [brand, setBrand] = useState<BrandSnapshot | null>(null);
  const [brandLoaded, setBrandLoaded] = useState(false);

  // Session naming modal state
  const [showNameModal, setShowNameModal] = useState(false);
  const [newSessionType, setNewSessionType] = useState<SessionType>('poster');
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Delete session state
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // Credits state
  const [imageCredits, setImageCredits] = useState<number | null>(null);
  const [videoCredits, setVideoCredits] = useState<number | null>(null);
  const [creditsPending, setCreditsPending] = useState(false);

  // ============== Load Sessions & Credits ==============

  useEffect(() => {
    if (!router.isReady) return;
    setCreditsPending(router.query.credits === 'pending');
  }, [router.isReady, router.query.credits]);

  useEffect(() => {
    async function loadCredits() {
      try {
        const response = await authFetch('/api/credits/balance');
        const data = await response.json();
        if (data.success) {
          const img = data.imageCredits?.total ?? 0;
          const vid = data.videoCredits?.total ?? 0;
          setImageCredits(img);
          setVideoCredits(vid);
          if (img > 0 || vid > 0) {
            setCreditsPending(false);
          }
        }
      } catch (err) {
        console.error('Error loading credits:', err);
      }
    }
    void loadCredits();
    const onFocus = () => {
      void loadCredits();
    };
    window.addEventListener('focus', onFocus);
    const intervalId = window.setInterval(() => {
      void loadCredits();
    }, creditsPending ? 4000 : 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(intervalId);
    };
  }, [creditsPending]);

  useEffect(() => {
    async function loadSessions() {
      setIsLoadingSessions(true);
      try {
        const response = await authFetch('/api/creative-studio/sessions?includeMedia=1&limit=100');
        const data = await response.json();

        if (data.ok) {
          setSessions(
            data.sessions
              // Brand Studio sessions only (Photo Studio shoots live in Photo Studio).
              .filter((s: any) => s.sessionType === 'poster' || s.sessionType === 'video')
              .map((s: any) => {
                const poster = Array.isArray(s.generatedPosters) ? s.generatedPosters.find((u: unknown) => typeof u === 'string' && u) : null;
                const video = Array.isArray(s.generatedVideos) ? s.generatedVideos.find((v: any) => v?.url)?.url : null;
                return {
                  id: s.id,
                  name: s.name,
                  sessionType: s.sessionType,
                  updatedAt: s.updatedAt,
                  createdAt: s.createdAt,
                  cover: poster || video || null,
                  coverKind: poster ? 'image' as const : video ? 'video' as const : undefined,
                };
              })
          );
        }
      } catch (err) {
        console.error('Error loading sessions:', err);
      } finally {
        setIsLoadingSessions(false);
      }
    }

    loadSessions();
  }, []);

  // ============== Brand Helper ==============

  // ============== Load Brand from DB & show entry popup ==============

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Load brand from DB
      try {
        const res = await authFetch('/api/brand/snapshot');
        const data = await res.json();
        if (!cancelled && data.brandSnapshot) {
          setBrand(data.brandSnapshot);
          setBrandLoaded(true);
          return;
        }
      } catch {
        // no snapshot available
      }
      if (cancelled) return;
      // No brand yet: the page shows a Brand Kit setup banner instead of a pop-up.
      setBrandLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // ============== Session Handlers ==============

  /** Brand Studio builds from the Brand Kit, so set that up first. */
  function goToBrandKitSetup() {
    void router.push({ pathname: '/brand-kit', query: { welcome: '1' } });
  }

  function handleStartPosterSession() {
    if (!brand) {
      goToBrandKitSetup();
      return;
    }
    setNewSessionType('poster');
    void handleCreateSession('Untitled Poster', 'poster');
  }

  function handleStartVideoSession() {
    if (!brand) {
      goToBrandKitSetup();
      return;
    }
    setNewSessionType('video');
    setShowNameModal(true);
  }

  async function handleCreateSession(name: string, sessionTypeOverride?: 'poster' | 'video') {
    if (!brand) {
      goToBrandKitSetup();
      return;
    }

    const sessionType = sessionTypeOverride || newSessionType || 'poster';
    setIsCreatingSession(true);

    try {
      const response = await authFetch('/api/creative-studio/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim() || (sessionType === 'poster' ? 'Untitled Poster' : 'Untitled Video'),
          sessionType,
          brandSnapshot: brand,
          phase: sessionType === 'poster' ? 'input' : undefined,
        }),
      });

      const data = await response.json();

      if (data.ok && data.session) {
        setShowNameModal(false);
        if (sessionType === 'poster') {
          router.push(`/brand-studio/poster?id=${data.session.id}`);
        } else {
          router.push(`/brand-studio/video?id=${data.session.id}`);
        }
      } else {
        showError('Failed to create session: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error creating session:', err);
      showError('Failed to create session');
    } finally {
      setIsCreatingSession(false);
    }
  }

  function handleSessionClick(session: SessionListItem) {
    if (session.sessionType === 'poster') {
      router.push(`/brand-studio/poster?id=${session.id}`);
    } else {
      router.push(`/brand-studio/video?id=${session.id}`);
    }
  }

  function handleSessionDelete(e: React.MouseEvent, sessionId: string) {
    e.stopPropagation();
    e.preventDefault();
    setDeleteSessionId(sessionId);
  }

  async function confirmDeleteSession() {
    if (!deleteSessionId) return;
    setIsDeletingSession(true);
    try {
      const response = await authFetch(`/api/creative-studio/sessions?id=${deleteSessionId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== deleteSessionId));
      } else {
        showError('Failed to delete session: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Delete session error:', err);
      showError('Failed to delete session');
    } finally {
      setIsDeletingSession(false);
      setDeleteSessionId(null);
    }
  }

  // ============== Brand Handlers ==============



  // ============== Separate sessions by type ==============

  // ============== Render ==============

  return (
    <div className="h-screen flex overflow-hidden app-page">
      {/* Sidebar - Without chat history */}
      <div className="flex-shrink-0 h-full">
        <Sidebar
          showChatHistory={false}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ backgroundColor: colors.background }}>
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-6 py-8">
            {/* Header */}
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold" style={{ color: colors.foreground }}>Brand Studio</h1>
                <p className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                  On-brand posters and video ads, built from your Brand Kit.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {creditsPending && (imageCredits === 0 || imageCredits === null) && (
                  <span className="rounded-full px-3 py-1.5 text-xs" style={{ background: 'hsl(45 90% 50% / 0.15)', color: colors.foreground }}>
                    Payment received — credits are confirming…
                  </span>
                )}
                {imageCredits !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs" style={{ border: `1px solid ${colors.border}`, color: colors.mutedForeground }}>
                    <ImageIcon className="h-3.5 w-3.5" style={{ color: colors.primary }} />
                    <strong style={{ color: colors.foreground }}>{imageCredits}</strong> image credits
                  </span>
                )}
                {videoCredits !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs" style={{ border: `1px solid ${colors.border}`, color: colors.mutedForeground }}>
                    <Video className="h-3.5 w-3.5" style={{ color: 'hsl(270 80% 70%)' }} />
                    <strong style={{ color: colors.foreground }}>{videoCredits}</strong> video credits
                  </span>
                )}
              </div>
            </header>

            {/* Guided banner (shown when user skipped onboarding) */}
            {router.query.guided === '1' && (
              <div className="mt-6 flex items-center justify-between gap-4 rounded-xl p-4" style={{ backgroundColor: 'hsl(213 100% 55% / 0.12)', border: '1px solid hsl(213 100% 55% / 0.35)' }}>
                <p className="text-sm" style={{ color: colors.foreground }}>Set up your brand for better results. You can do this anytime.</p>
                <Link href="/brand-kit" className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium" style={{ backgroundColor: colors.primary, color: 'white' }}>
                  Set up Brand Kit
                </Link>
              </div>
            )}

            {/* Create — the main action, first */}
            <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              {([
                {
                  type: 'poster' as const,
                  onClick: handleStartPosterSession,
                  Icon: LayoutTemplate,
                  title: 'New poster',
                  body: 'Strategy, three concepts, then finished posters and carousels in your brand style.',
                  tint: 'hsl(213 100% 60%)',
                  chips: ['Feed and story sizes', 'Carousels', 'Your product, untouched'],
                },
                {
                  type: 'video' as const,
                  onClick: handleStartVideoSession,
                  Icon: Clapperboard,
                  title: 'New video',
                  body: 'Script, scenes and a finished video ad from your product and brand.',
                  tint: 'hsl(270 80% 70%)',
                  chips: ['Reels and shorts', 'Voiceover', 'Scene by scene'],
                },
              ]).map((c) => (
                <button
                  key={c.type}
                  type="button"
                  onClick={c.onClick}
                  disabled={isCreatingSession}
                  className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all hover:-translate-y-0.5 disabled:opacity-60"
                  style={{ background: colors.card, border: `1px solid ${colors.border}` }}
                >
                  <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-35" style={{ background: c.tint }} />
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${c.tint} 18%, transparent)`, color: c.tint }}>
                      <c.Icon className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-5 w-5 opacity-40 transition-all group-hover:translate-x-1 group-hover:opacity-100" style={{ color: colors.foreground }} />
                  </div>
                  <p className="mt-5 text-lg font-semibold" style={{ color: colors.foreground }}>{c.title}</p>
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>{c.body}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {c.chips.map((chip) => (
                      <span key={chip} className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: colors.secondary, color: colors.mutedForeground }}>{chip}</span>
                    ))}
                  </div>
                  {isCreatingSession && newSessionType === c.type && (
                    <p className="mt-3 text-xs" style={{ color: c.tint }}>Opening studio…</p>
                  )}
                </button>
              ))}
            </section>

            {/* Brand Kit strip, or a setup prompt when there's no brand yet */}
            {brandLoaded && brand && (
              <div className="mt-8">
                <BrandKitCard brand={brand} />
              </div>
            )}
            {brandLoaded && !brand && (
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5" style={{ background: 'hsl(213 100% 55% / 0.1)', border: '1px solid hsl(213 100% 55% / 0.35)' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: colors.foreground }}>Set up your Brand Kit first</p>
                  <p className="mt-0.5 text-sm" style={{ color: colors.mutedForeground }}>
                    Paste your website and we&apos;ll pull in your logo, colours, fonts and what you sell. Every poster and video uses it.
                  </p>
                </div>
                <button type="button" onClick={goToBrandKitSetup} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium" style={{ background: colors.primary, color: colors.primaryForeground }}>
                  Set up Brand Kit <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Recent sessions */}
            <section className="mt-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold" style={{ color: colors.foreground }}>Recent sessions</h2>
                {sessions.length > 0 && (
                  <div role="tablist" aria-label="Session type" className="inline-flex rounded-lg p-1" style={{ background: colors.secondary }}>
                    {([
                      ['all', 'All', sessions.length],
                      ['poster', 'Posters', sessions.filter((x) => x.sessionType === 'poster').length],
                      ['video', 'Videos', sessions.filter((x) => x.sessionType === 'video').length],
                    ] as const).map(([id, label, n]) => {
                      const on = sessionFilter === id;
                      return (
                        <button key={id} role="tab" aria-selected={on} type="button" onClick={() => { setSessionFilter(id); setShowAllSessions(false); }}
                          className="rounded-md px-3 py-1 text-xs transition-colors"
                          style={on ? { background: colors.card, color: colors.foreground } : { color: colors.mutedForeground }}>
                          {label} <span className="opacity-60">{n}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {isLoadingSessions ? (
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="space-y-2">
                      <ShimmerTile className="aspect-[4/3]" />
                      <ShimmerTile className="h-3 w-2/3 rounded" />
                    </div>
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <p className="mt-4 rounded-xl px-4 py-8 text-center text-sm" style={{ border: `1px dashed ${colors.border}`, color: colors.mutedForeground }}>
                  Your poster and video sessions will appear here.
                </p>
              ) : (
                (() => {
                  const list = sessions.filter((x) => sessionFilter === 'all' || x.sessionType === sessionFilter);
                  const shown = showAllSessions ? list : list.slice(0, 8);
                  return (
                    <>
                      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                        {shown.map((session) => {
                          const isPoster = session.sessionType === 'poster';
                          const tint = isPoster ? 'hsl(213 100% 60%)' : 'hsl(270 80% 70%)';
                          return (
                            <div
                              key={session.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleSessionClick(session)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSessionClick(session); }}
                              className="group relative cursor-pointer overflow-hidden rounded-xl transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                              style={{ background: colors.card, border: `1px solid ${colors.border}` }}
                            >
                              <div className="relative aspect-[4/3] w-full overflow-hidden" style={{ background: colors.secondary }}>
                                {session.cover && session.coverKind === 'image' ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={session.cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                                ) : session.cover && session.coverKind === 'video' ? (
                                  <>
                                    <video src={session.cover} muted preload="metadata" playsInline className="h-full w-full object-cover" />
                                    <span className="absolute inset-0 flex items-center justify-center">
                                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55"><Play className="ml-0.5 h-4 w-4 text-white" fill="white" /></span>
                                    </span>
                                  </>
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center" style={{ color: tint }}>
                                    {isPoster ? <LayoutTemplate className="h-7 w-7 opacity-60" /> : <Clapperboard className="h-7 w-7 opacity-60" />}
                                  </span>
                                )}
                                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                                  {isPoster ? <ImageIcon className="h-3 w-3" /> : <Video className="h-3 w-3" />}
                                  {isPoster ? 'Poster' : 'Video'}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleSessionDelete(e, session.id)}
                                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                                  style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                                  title="Delete session"
                                  aria-label={`Delete ${session.name}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <div className="px-3 py-2.5">
                                <p className="truncate text-sm font-medium" style={{ color: colors.foreground }}>{session.name}</p>
                                <p className="mt-0.5 text-[11px]" style={{ color: colors.mutedForeground }}>{formatTimestamp(session.updatedAt)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {list.length > 8 && (
                        <div className="mt-4 text-center">
                          <button type="button" onClick={() => setShowAllSessions((v) => !v)} className="rounded-lg px-4 py-2 text-sm" style={{ border: `1px solid ${colors.border}`, color: colors.foreground }}>
                            {showAllSessions ? 'Show fewer' : `Show all ${list.length}`}
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()
              )}
            </section>

            {/* Refund note — quiet footnote */}
            <p className="mt-10 pb-6 text-center text-xs leading-relaxed" style={{ color: colors.mutedForeground }}>
              A generation looks off?{' '}
              <Link href="/report" className="underline underline-offset-2" style={{ color: colors.foreground }}>Send us a screenshot</Link>
              {' '}and we&apos;ll refund the credit. Subject to Terms &amp; Conditions.
            </p>
          </div>
        </div>

        {/* Session Name Modal */}
        <SessionNameModal
          isOpen={showNameModal}
          sessionType={newSessionType}
          onClose={() => setShowNameModal(false)}
          onSubmit={handleCreateSession}
          isLoading={isCreatingSession}
        />

        {/* Delete Confirmation Modal */}
        {deleteSessionId && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isDeletingSession) {
                setDeleteSessionId(null);
              }
            }}
          >
            <div className="rounded-xl shadow-xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full" style={{ backgroundColor: 'hsl(0 84% 55% / 0.2)' }}>
                    <svg className="w-6 h-6" style={{ color: colors.destructive }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: colors.foreground }}>Delete Session</h3>
                    <p className="text-sm" style={{ color: colors.mutedForeground }}>This action cannot be undone</p>
                  </div>
                </div>
                <p className="mb-6" style={{ color: colors.mutedForeground }}>
                  Are you sure you want to delete this session? All data including generated posters or videos will be permanently removed.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteSessionId(null)}
                    disabled={isDeletingSession}
                    className="flex-1 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                    style={{ backgroundColor: colors.muted, color: colors.foreground }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteSession}
                    disabled={isDeletingSession}
                    className="flex-1 px-4 py-3 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    style={{ backgroundColor: colors.destructive }}
                  >
                    {isDeletingSession ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
