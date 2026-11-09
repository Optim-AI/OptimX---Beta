import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, Lightbulb, Loader2, RefreshCw, Wand2, ExternalLink, Sparkles, Quote, Trophy, Swords } from 'lucide-react';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import { showError } from '@/app/web/src/components/ui/alert-modal-api';
import type { InsightAction, InsightAngle, Insights } from '@/lib/meta-intel/insights-types';
import type { LeaderboardAd } from '@/lib/meta-intel/summary';
import { GOOD, BAD } from './format';

type Resp = {
  insight: { id: string; output: Insights; createdAt: string; periodSince: string | null; periodUntil: string | null } | null;
  running: boolean;
  lastError: string | null;
};

const SOURCE = {
  past_winner: { label: 'From your winning ad', Icon: Trophy },
  customer_voice: { label: 'From what customers say', Icon: Quote },
  competitor: { label: 'From a competitor gap', Icon: Swords },
} as const;

function ActionButton({ a }: { a: InsightAction }) {
  const cls = 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold';
  if (a.cta === 'make_more_like_this' && a.ad_id) {
    return <Link href={`/content-studio/posters/new?from_ad=${encodeURIComponent(a.ad_id)}`} className={cls} style={{ background: colors.primary, color: colors.primaryForeground }}><Wand2 size={13} aria-hidden /> Make more like this</Link>;
  }
  if (a.cta === 'pause_in_ads_manager') {
    const href = `https://adsmanager.facebook.com/adsmanager/manage/ads${a.ad_id ? `?selected_ad_ids=${encodeURIComponent(a.ad_id)}` : ''}`;
    return <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={{ background: colors.secondary, color: colors.foreground, border: `1px solid ${colors.border}` }}>Open in Ads Manager <ExternalLink size={12} aria-hidden /></a>;
  }
  if (a.cta === 'fix_tracking') {
    return <a href="https://business.facebook.com/events_manager2" target="_blank" rel="noopener noreferrer" className={cls} style={{ background: colors.secondary, color: colors.foreground, border: `1px solid ${colors.border}` }}>Open Events Manager <ExternalLink size={12} aria-hidden /></a>;
  }
  if (a.cta === 'test_new_angle') {
    return <Link href="/content-studio/posters/new" className={cls} style={{ background: colors.secondary, color: colors.foreground, border: `1px solid ${colors.border}` }}><Wand2 size={13} aria-hidden /> Make poster ads</Link>;
  }
  return null;
}

function Angle({ a }: { a: InsightAngle }) {
  const s = SOURCE[a.source];
  return (
    <div className="rounded-xl p-3" style={{ background: colors.secondary, border: `1px solid ${colors.border}` }}>
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: colors.mutedForeground }}><s.Icon size={12} aria-hidden /> {s.label}</p>
      <p className="mt-1 text-sm font-semibold" style={{ color: colors.foreground }}>{a.angle}</p>
      <p className="mt-1 text-sm italic" style={{ color: colors.secondaryForeground }}>“{a.hook}”</p>
      <p className="mt-2 text-xs" style={{ color: colors.mutedForeground }}>{a.source_detail}. {a.why}</p>
    </div>
  );
}

function PointList({ title, items, tone, adName }: { title: string; items: { point: string; evidence: string; ad_ids?: string[] }[]; tone: 'good' | 'bad' | 'neutral'; adName: (id: string) => string | null }) {
  if (!items.length) return null;
  const Icon = tone === 'good' ? CheckCircle2 : tone === 'bad' ? XCircle : Lightbulb;
  const color = tone === 'good' ? GOOD : tone === 'bad' ? BAD : 'hsl(38 92% 60%)';
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: colors.mutedForeground }}>{title}</h3>
      <ul className="space-y-2.5">
        {items.map((p, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <Icon size={16} className="mt-0.5 shrink-0" style={{ color }} aria-hidden />
            <div>
              <p style={{ color: colors.foreground }}>{p.point}</p>
              <p className="text-xs" style={{ color: colors.mutedForeground }}>
                {p.evidence}
                {p.ad_ids?.length ? ` · ${p.ad_ids.map((id) => adName(id) ?? id).join(', ')}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** AI insights (Phase 4). Shows only stored analyses — never placeholder insights. */
export default function InsightsPanel({ dataState, ads }: { dataState: 'ok' | 'limited' | 'empty'; ads: LeaderboardAd[] }) {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const pollUntil = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/meta-intel/insights');
      if (res.ok) setData((await res.json()) as Resp);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Poll while an analysis runs (and for a short grace period after asking for one).
  const running = !!data?.running || requesting;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      await load();
      if (Date.now() > pollUntil.current) setRequesting(false);
    }, 5000);
    return () => clearInterval(t);
  }, [running, load]);

  async function refresh() {
    setRequesting(true);
    pollUntil.current = Date.now() + 20_000;
    try {
      const res = await authFetch('/api/meta-intel/insights', { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message || 'Could not start the analysis.');
    } catch (e) {
      setRequesting(false);
      showError((e as Error).message);
    }
  }

  const adName = (id: string) => ads.find((a) => a.adId === id)?.name ?? null;
  const ins = data?.insight?.output;

  return (
    <section className="rounded-2xl p-4 sm:p-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: colors.foreground }}>
          <Sparkles size={16} style={{ color: colors.accentForeground }} aria-hidden /> What SkalX sees
        </h2>
        <div className="flex items-center gap-2 text-xs" style={{ color: colors.mutedForeground }}>
          {data?.insight ? <span>Last 30 days · analysed {new Date(data.insight.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span> : null}
          {dataState !== 'empty' ? (
            <button type="button" onClick={refresh} disabled={running} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-medium disabled:opacity-60"
              style={{ background: colors.secondary, border: `1px solid ${colors.border}`, color: colors.foreground }}>
              {running ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} {running ? 'Analysing…' : 'Refresh'}
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-sm" style={{ color: colors.mutedForeground }}><Loader2 size={14} className="animate-spin" /> Loading insights…</p>
      ) : !ins ? (
        <div className="mt-3">
          <p className="text-sm" style={{ color: colors.mutedForeground }}>
            {running
              ? 'SkalX is reading your results. This takes about a minute.'
              : dataState === 'ok'
                ? 'No analysis yet. Insights appear automatically after each sync, or click Refresh.'
                : 'SkalX needs a little more ad spend before it can say what’s working with confidence.'}
          </p>
          {data?.lastError && !running ? <p className="mt-2 text-xs" style={{ color: BAD }}>{data.lastError} Try Refresh.</p> : null}
        </div>
      ) : (
        <div className="mt-3 space-y-5">
          <p className="text-lg font-semibold leading-snug" style={{ color: colors.foreground }}>{ins.headline}</p>
          <div className="grid gap-5 md:grid-cols-2">
            <PointList title="Working" items={ins.working} tone="good" adName={adName} />
            <PointList title="Not working" items={ins.not_working} tone="bad" adName={adName} />
          </div>
          <PointList title="Patterns" items={ins.patterns} tone="neutral" adName={adName} />
          {ins.next_actions.length ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: colors.mutedForeground }}>Do next</h3>
              <ol className="space-y-2">
                {ins.next_actions.map((a, i) => (
                  <li key={i} className="flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between" style={{ background: colors.secondary, border: `1px solid ${colors.border}` }}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: colors.foreground }}>{i + 1}. {a.action}</p>
                      <p className="text-xs" style={{ color: colors.mutedForeground }}>{a.why}</p>
                    </div>
                    <ActionButton a={a} />
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {ins.angles_to_test.length ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: colors.mutedForeground }}>Angles to test next</h3>
              <div className="grid gap-3 md:grid-cols-3">{ins.angles_to_test.map((a, i) => <Angle key={i} a={a} />)}</div>
            </div>
          ) : null}
          <p className="text-[11px]" style={{ color: colors.mutedForeground }}>Written by AI from your synced Meta numbers. Every figure is checked against your data; anything that didn’t match was left out.</p>
        </div>
      )}
    </section>
  );
}
