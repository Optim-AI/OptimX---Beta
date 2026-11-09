// /trends — what's going viral in India right now, and ready ideas for this brand to use it.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Flame, RefreshCw, Loader2, TrendingUp, TrendingDown, CalendarDays, Sparkles, Newspaper, Trophy, ShoppingBag,
  Laugh, PlayCircle, Wand2, Copy, Check, ChevronDown, ExternalLink, AlertTriangle,
} from 'lucide-react';
import Sidebar from '../app/web/src/components/Sidebar';
import ComingSoonGate from '@/app/web/src/components/ui/ComingSoonGate';
import { TRENDS_LIVE } from '@/lib/launch-flags';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import { showError } from '@/app/web/src/components/ui/alert-modal-api';
import type { BrandTrend, TrendIdea, TrendKind, TrendStage, TrendsResponse } from '@/lib/trends/types';

const GOOD = 'hsl(142 70% 50%)';
const WARN = 'hsl(38 92% 60%)';

const KIND: Record<TrendKind, { label: string; Icon: typeof Flame }> = {
  viral_moment: { label: 'Viral moment', Icon: Flame },
  meme_format: { label: 'Meme / format', Icon: Laugh },
  news: { label: 'In the news', Icon: Newspaper },
  festival_event: { label: 'Festival / event', Icon: CalendarDays },
  sport_entertainment: { label: 'Sport & films', Icon: Trophy },
  shopping: { label: 'Shopping', Icon: ShoppingBag },
  video: { label: 'Trending video', Icon: PlayCircle },
};

const STAGE: Record<TrendStage, { label: string; Icon: typeof Flame; color: string }> = {
  rising: { label: 'Rising', Icon: TrendingUp, color: GOOD },
  peaking: { label: 'Everywhere now', Icon: Flame, color: WARN },
  fading: { label: 'Fading', Icon: TrendingDown, color: colors.mutedForeground },
  upcoming: { label: 'Coming up', Icon: CalendarDays, color: 'hsl(210 90% 65%)' },
};

const FIT = {
  high: { label: 'Great fit', bars: 3, color: GOOD },
  medium: { label: 'Good fit', bars: 2, color: WARN },
  low: { label: 'A stretch', bars: 1, color: colors.mutedForeground },
} as const;

const FILTERS: { id: string; label: string; test: (t: BrandTrend) => boolean }[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'best', label: 'Best fit', test: (t) => t.fit === 'high' },
  { id: 'events', label: 'Festivals & events', test: (t) => t.kind === 'festival_event' || t.kind === 'shopping' },
  { id: 'memes', label: 'Memes & viral', test: (t) => t.kind === 'meme_format' || t.kind === 'viral_moment' },
  { id: 'culture', label: 'Sport & films', test: (t) => t.kind === 'sport_entertainment' },
  { id: 'news', label: 'News', test: (t) => t.kind === 'news' },
  { id: 'video', label: 'Videos', test: (t) => t.kind === 'video' },
];

const domain = (url: string, title: string) => {
  // Google's grounding links redirect; their title is the site name.
  if (/vertexaisearch|grounding-api-redirect/.test(url)) return title;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return title; }
};

function FitMeter({ fit, reason }: { fit: BrandTrend['fit']; reason: string }) {
  const f = FIT[fit];
  return (
    <div className="rounded-lg p-2.5" style={{ background: colors.muted }}>
      <div className="flex items-center gap-2">
        <div className="flex gap-1" aria-hidden>
          {[1, 2, 3].map((i) => <span key={i} className="h-2 w-6 rounded-full" style={{ background: i <= f.bars ? f.color : colors.border }} />)}
        </div>
        <span className="text-xs font-semibold" style={{ color: f.color }}>{f.label} for your brand</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: colors.secondaryForeground }}>{reason}</p>
    </div>
  );
}

function ideaText(i: TrendIdea, t: BrandTrend): string {
  return [`Trend: ${t.title}`, `Hook: ${i.hook}`, `Show: ${i.show}`, ...(i.script.length ? ['Script:', ...i.script.map((s, k) => `${k + 1}. ${s}`)] : [])].join('\n');
}

function IdeaCard({ idea, trend }: { idea: TrendIdea; trend: BrandTrend }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const strip = (t: string) => t.trim().replace(/[.!?…]+$/, '');
  const posterHref = `/content-studio/posters/new?idea=${encodeURIComponent(`Use the trend “${trend.title}”. Hook: ${strip(idea.hook)}. Show: ${strip(idea.show)}.`.slice(0, 900))}`;
  const isVideo = idea.format === 'reel' || idea.format === 'story';
  async function copy() {
    try {
      await navigator.clipboard.writeText(ideaText(idea, trend));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showError('Couldn’t copy. Select the text and copy it instead.');
    }
  }
  return (
    <div className="rounded-xl p-3" style={{ background: colors.secondary, border: `1px solid ${colors.border}` }}>
      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: colors.muted, color: colors.mutedForeground }}>{idea.format}</span>
      <p className="mt-2 text-sm font-semibold leading-snug" style={{ color: colors.foreground }}>“{idea.hook}”</p>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium hover:underline" style={{ color: colors.mutedForeground }}>
        {open ? 'Hide the idea' : 'See the idea'} <ChevronDown size={12} className={open ? 'rotate-180' : ''} aria-hidden />
      </button>
      {open ? (
        <div className="mt-2 space-y-2 text-xs leading-relaxed" style={{ color: colors.secondaryForeground }}>
          <p><b style={{ color: colors.foreground }}>What to show:</b> {idea.show}</p>
          {idea.script.length ? (
            <ol className="list-decimal space-y-0.5 pl-4">{idea.script.map((s, k) => <li key={k}>{s}</li>)}</ol>
          ) : null}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={posterHref} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold" style={{ background: colors.primary, color: colors.primaryForeground }}>
          <Wand2 size={13} aria-hidden /> {isVideo ? 'Make a poster version' : 'Make this poster'}
        </Link>
        <button type="button" onClick={copy} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium" style={{ background: colors.muted, color: colors.foreground }}>
          {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />} {copied ? 'Copied' : 'Copy idea'}
        </button>
      </div>
    </div>
  );
}

function TrendCard({ t }: { t: BrandTrend }) {
  const k = KIND[t.kind] ?? KIND.viral_moment;
  const s = STAGE[t.stage] ?? STAGE.rising;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      {t.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: colors.muted, color: colors.secondaryForeground }}><k.Icon size={12} aria-hidden /> {k.label}</span>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: colors.muted, color: s.color }} title="SkalX’s estimate from the sources’ dates">
            <s.Icon size={12} aria-hidden /> {s.label}
          </span>
          {t.when ? <span className="text-[11px]" style={{ color: colors.mutedForeground }}>{t.when}</span> : null}
        </div>
        <div>
          <h2 className="text-base font-semibold leading-snug" style={{ color: colors.foreground }}>{t.title}</h2>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: colors.secondaryForeground }}>{t.what}</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: colors.mutedForeground }}>{t.whyNow}</p>
        </div>
        <FitMeter fit={t.fit} reason={t.fitReason} />
        <div className="grid gap-2">{t.ideas.map((i, n) => <IdeaCard key={n} idea={i} trend={t} />)}</div>
        <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" style={{ color: colors.mutedForeground }}>
          Found in:
          {t.sources.map((src, n) => (
            <a key={n} href={src.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline" style={{ color: colors.secondaryForeground }}>
              {domain(src.url, src.title)} <ExternalLink size={10} aria-hidden />
            </a>
          ))}
        </p>
      </div>
    </article>
  );
}

export default function TrendsPage() {
  const router = useRouter();
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [filter, setFilter] = useState('all');
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const load = useCallback(async () => {
    const res = await authFetch('/api/trends');
    if (res.status === 401) { router.replace('/login'); return null; }
    const body = (await res.json()) as TrendsResponse;
    setData(body);
    return body;
  }, [router]);

  const refresh = useCallback(async () => {
    setStarting(true);
    setProblem(null);
    try {
      const res = await authFetch('/api/trends', { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        if (res.status === 409) setProblem(body.message ?? 'Add your brand first.');
        else showError(body.message || 'Could not check trends.');
      }
      await load();
    } finally {
      setStarting(false);
    }
  }, [load]);

  useEffect(() => {
    // While Trends is "Coming soon", don't load or start anything (a check makes paid AI calls).
    if (!TRENDS_LIVE) return;
    void load().then((d) => {
      // First visit of the day: start a check automatically (it counts as one refresh).
      if (d && !autoStarted.current && d.refreshesLeftToday > 0 && (d.state === 'none' || (d.state === 'ready' && d.day !== null && d.day < new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)))) {
        autoStarted.current = true;
        void refresh();
      }
    });
  }, [load, refresh]);

  useEffect(() => {
    if (data?.state !== 'running') return;
    const t = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(t);
  }, [data?.state, load]);

  const shown = useMemo(() => (data?.trends ?? []).filter(FILTERS.find((f) => f.id === filter)!.test), [data, filter]);
  const running = data?.state === 'running' || starting;

  return (
    <div className="h-screen flex overflow-hidden app-page" style={{ background: colors.background }}>
      <Head><title>Trends | SkalX AI</title></Head>
      <Sidebar />
      <div className="relative min-w-0 flex-1 overflow-hidden">
      {!TRENDS_LIVE && <ComingSoonGate Icon={Flame} title="Trends is on its way" body="What’s going viral in India right now, and ready ideas for your brand to use it. We’ll let you know as soon as it’s ready." onBack={() => router.push('/brand-studio')} />}
      <main className={`h-full min-w-0 overflow-y-auto ${TRENDS_LIVE ? '' : 'pointer-events-none select-none blur-[6px] opacity-60'}`} aria-hidden={!TRENDS_LIVE} inert={!TRENDS_LIVE || undefined}>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold" style={{ color: colors.foreground }}><Flame size={22} aria-hidden /> Trends</h1>
              <p className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                What’s going viral in India right now{data?.category ? <> for <b style={{ color: colors.foreground }}>{data.category}</b></> : ''}, and ready ideas to use it.
                {data?.updatedAt ? ` Updated ${new Date(data.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.` : ''}
              </p>
            </div>
            <button type="button" onClick={() => void refresh()} disabled={!data || running || data.refreshesLeftToday === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium disabled:opacity-60"
              style={{ background: colors.secondary, border: `1px solid ${colors.border}`, color: colors.foreground }}>
              {running ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {running ? 'Checking trends…' : data ? `Refresh (${data.refreshesLeftToday} left today)` : 'Refresh'}
            </button>
          </header>

          {problem ? (
            <div className="mt-6 flex items-start gap-2 rounded-xl p-4 text-sm" style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.foreground }}>
              <AlertTriangle size={16} style={{ color: WARN }} className="mt-0.5 shrink-0" /> <span>{problem} <Link href="/brand-kit" className="font-semibold underline">Open Brand Kit</Link></span>
            </div>
          ) : null}

          {!data ? (
            <p className="mt-10 flex items-center gap-2 text-sm" style={{ color: colors.mutedForeground }}><Loader2 size={16} className="animate-spin" /> Loading…</p>
          ) : running && !data.trends.length ? (
            <div className="mt-8 rounded-2xl p-8 text-center" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
              <Loader2 size={28} className="mx-auto animate-spin" style={{ color: colors.mutedForeground }} />
              <p className="mt-3 text-base font-semibold" style={{ color: colors.foreground }}>Checking what’s trending in India…</p>
              <p className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>SkalX searches the web live, then picks what suits your brand. This takes about 1–2 minutes.</p>
            </div>
          ) : data.state === 'failed' && !data.trends.length ? (
            <div className="mt-8 rounded-2xl p-6" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
              <p className="text-sm" style={{ color: colors.foreground }}>{data.error ?? 'Something went wrong.'}</p>
            </div>
          ) : data.state === 'ready' && !data.trends.length ? (
            <div className="mt-8 rounded-2xl p-6 text-sm" style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.secondaryForeground }}>
              Nothing trending today is a good fit for your brand{data.skipped ? ` (SkalX checked ${data.skipped} trends)` : ''}. Check again tomorrow.
            </div>
          ) : data.trends.length ? (
            <>
              <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter trends">
                {FILTERS.filter((f) => f.id === 'all' || data.trends.some(f.test)).map((f) => (
                  <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
                    className="rounded-full px-3 py-1.5 text-xs font-medium"
                    style={{ background: filter === f.id ? colors.primary : colors.muted, color: filter === f.id ? colors.primaryForeground : colors.secondaryForeground }}>
                    {f.label} <span className="opacity-70">{data.trends.filter(f.test).length}</span>
                  </button>
                ))}
              </div>
              {running ? <p className="mt-3 flex items-center gap-2 text-xs" style={{ color: colors.mutedForeground }}><Loader2 size={13} className="animate-spin" /> Checking for newer trends…</p> : null}
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {shown.map((t) => <TrendCard key={t.id} t={t} />)}
              </div>
              <p className="mt-6 flex items-start gap-1.5 text-[11px]" style={{ color: colors.mutedForeground }}>
                <Sparkles size={12} className="mt-0.5 shrink-0" aria-hidden />
                Trends come from a live Google search{data.trends.some((t) => t.kind === 'video') ? ' and YouTube’s trending list in India' : ''}; every card links to where it was found. “Rising”, “Everywhere now” and “Fading” are SkalX’s estimate. Ideas are written by AI for your brand. Check them before you post.
                {data.skipped ? ` ${data.skipped} trends were left out as a poor fit or not safe for brands.` : ''}
              </p>
            </>
          ) : null}
        </div>
      </main>
      </div>
    </div>
  );
}
