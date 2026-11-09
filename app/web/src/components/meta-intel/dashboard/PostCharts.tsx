// "What works in your posts": average engagements per post by format, day and time of day.
// One card per platform (Instagram and Facebook are never mixed). Bars are one colour (it's one
// measure), every bar is labelled with its number and post count, and the best one is called out in words.
import React, { useEffect, useState } from 'react';
import { Instagram, Facebook } from 'lucide-react';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import type { PostStats, PostStatRow } from '@/lib/meta-intel/analysis-input';
import type { PostStatsResponse } from '@/pages/api/meta-intel/post-stats';
import { SERIES } from './format';

/** Fewer posts than this: say plainly it's an early read. */
const EARLY_POSTS = 10;
/** Never call a group "best" on the strength of a single post. */
const MIN_POSTS_FOR_BEST = 2;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Bars({ title, rows }: { title: string; rows: PostStatRow[] }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.avgEngagement), 1);
  const best = rows.reduce((a, b) => (b.avgEngagement > a.avgEngagement ? b : a), rows[0]);
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.mutedForeground }}>{title}</h4>
      {rows.length > 1 && best.avgEngagement > 0 && best.posts >= MIN_POSTS_FOR_BEST ? (
        <p className="mt-0.5 text-xs" style={{ color: colors.secondaryForeground }}>Best: <b style={{ color: colors.foreground }}>{cap(best.label)}</b></p>
      ) : null}
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[84px_1fr_auto] items-center gap-2 text-xs"
            title={`${cap(r.label)}: ${r.avgEngagement} engagements per post on average, from ${r.posts} post${r.posts === 1 ? '' : 's'}`}>
            <span className="truncate" style={{ color: colors.secondaryForeground }}>{cap(r.label)}</span>
            <span className="h-3 rounded-full" style={{ background: colors.muted }}>
              <span className="block h-3 rounded-full" style={{ width: `${Math.max((r.avgEngagement / max) * 100, 2)}%`, background: SERIES.spend, opacity: r === best ? 1 : 0.55 }} />
            </span>
            <span className="tabular-nums" style={{ color: colors.foreground }}>
              {r.avgEngagement} <span style={{ color: colors.mutedForeground }}>({r.posts})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlatformCard({ s, rangeDays }: { s: PostStats; rangeDays: number }) {
  const Icon = s.platform === 'instagram' ? Instagram : Facebook;
  const name = s.platform === 'instagram' ? 'Instagram' : 'Facebook';
  return (
    <div className="rounded-xl p-4" style={{ background: colors.secondary, border: `1px solid ${colors.border}` }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: colors.foreground }}><Icon size={15} aria-hidden /> {name}</h3>
        <p className="text-xs" style={{ color: colors.mutedForeground }}>
          {s.posts} post{s.posts === 1 ? '' : 's'} in {rangeDays} days · {s.avgEngagement} engagements per post on average
        </p>
      </div>
      {s.posts < EARLY_POSTS ? (
        <p className="mt-1 text-[11px]" style={{ color: 'hsl(38 92% 60%)' }}>Early read: based on only {s.posts} post{s.posts === 1 ? '' : 's'}. It gets more reliable as you post more.</p>
      ) : null}
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <Bars title="By format" rows={s.byFormat} />
        <Bars title="By day" rows={s.byDay} />
        <Bars title="By time of day" rows={s.byTime} />
      </div>
    </div>
  );
}

export default function PostCharts() {
  const [data, setData] = useState<PostStatsResponse | null>(null);
  useEffect(() => {
    let alive = true;
    authFetch('/api/meta-intel/post-stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!data?.platforms.length) return null;
  return (
    <section aria-label="What works in your posts" className="rounded-2xl p-4 sm:p-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <h2 className="text-base font-semibold" style={{ color: colors.foreground }}>What works in your posts</h2>
      <p className="mt-0.5 text-xs" style={{ color: colors.mutedForeground }}>
        Average engagements (likes, comments, saves and shares) per post. The number in brackets is how many posts it’s based on.
      </p>
      <div className="mt-3 space-y-3">{data.platforms.map((s) => <PlatformCard key={s.platform} s={s} rangeDays={data.rangeDays} />)}</div>
    </section>
  );
}
