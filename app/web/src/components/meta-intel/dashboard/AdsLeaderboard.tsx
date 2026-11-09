import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ImageOff, Sparkles, Trophy, TrendingDown, BatteryLow, Hourglass, Wand2 } from 'lucide-react';
import colors from '@/lib/ui/colors';
import type { LeaderboardAd } from '@/lib/meta-intel/summary';
import { money, count, ratio, pct, deliveryBadge, GOOD, BAD } from './format';

type SortKey = 'spend' | 'revenue' | 'roas' | 'cpa' | 'purchases' | 'ctr' | 'frequency';
const COLS: { key: SortKey; label: string }[] = [
  { key: 'spend', label: 'Spend' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'roas', label: 'ROAS' },
  { key: 'cpa', label: 'Cost / purchase' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'ctr', label: 'CTR' },
  { key: 'frequency', label: 'Frequency' },
];

function fmt(key: SortKey, ad: LeaderboardAd, currency: string | null) {
  switch (key) {
    case 'spend': return money(ad.spend, currency);
    case 'revenue': return money(ad.revenue, currency);
    case 'roas': return ratio(ad.roas);
    case 'cpa': return money(ad.cpa, currency);
    case 'purchases': return count(ad.purchases);
    case 'ctr': return pct(ad.ctr);
    case 'frequency': return ad.frequency === null ? '—' : ad.frequency.toFixed(2);
  }
}

function Thumb({ ad }: { ad: LeaderboardAd }) {
  const [broken, setBroken] = useState(false);
  return ad.thumbnailUrl && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={ad.thumbnailUrl} alt="" onError={() => setBroken(true)} className="h-12 w-12 shrink-0 rounded-lg object-cover" style={{ background: colors.muted }} />
  ) : (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg" style={{ background: colors.muted, color: colors.mutedForeground }}><ImageOff size={16} /></div>
  );
}

const WARN = 'hsl(38 92% 60%)';
const SCORE_BADGE = {
  winner: { label: 'Winner', Icon: Trophy, color: GOOD },
  losing: { label: 'Losing', Icon: TrendingDown, color: BAD },
  not_enough_data: { label: 'Too early', Icon: Hourglass, color: colors.mutedForeground },
} as const;

function Badges({ ad }: { ad: LeaderboardAd }) {
  const d = deliveryBadge(ad.status);
  const toneColor = d.tone === 'good' ? GOOD : d.tone === 'warn' ? WARN : colors.mutedForeground;
  const sb = ad.score.status === 'steady' ? null : SCORE_BADGE[ad.score.status];
  const why = ad.score.reasons.join(' ');
  return (
    <div className="mt-1 flex flex-wrap gap-1.5" title={why}>
      {sb ? (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: colors.muted, color: sb.color }}>
          <sb.Icon size={11} aria-hidden /> {sb.label}
        </span>
      ) : null}
      {ad.score.status === 'winner' ? (
        <Link href={`/content-studio/posters/new?from_ad=${encodeURIComponent(ad.adId)}`} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: colors.primary, color: colors.primaryForeground }}>
          <Wand2 size={11} aria-hidden /> Make more like this
        </Link>
      ) : null}
      {ad.score.fatiguing ? (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: colors.muted, color: WARN }}>
          <BatteryLow size={11} aria-hidden /> Tiring
        </span>
      ) : null}
      <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: colors.muted, color: toneColor }}>● {d.label}</span>
      {ad.madeBySkalx ? (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: colors.accent, color: colors.accentForeground }}>
          <Sparkles size={11} aria-hidden /> Made by SkalX
        </span>
      ) : null}
    </div>
  );
}

export default function AdsLeaderboard({ ads, currency }: { ads: LeaderboardAd[]; currency: string | null }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'spend', dir: 'desc' });
  const [onlySkx, setOnlySkx] = useState(false);
  const skxCount = ads.filter((a) => a.madeBySkalx).length;

  const sorted = useMemo(() => {
    const list = onlySkx ? ads.filter((a) => a.madeBySkalx) : ads;
    return [...list].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === null && bv === null) return 0;
      if (av === null) return 1; // unknowns always last
      if (bv === null) return -1;
      return sort.dir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
  }, [ads, sort, onlySkx]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'cpa' ? 'asc' : 'desc' }));

  return (
    <section className="rounded-2xl p-4 sm:p-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold" style={{ color: colors.foreground }}>Your ads</h2>
          <p className="text-xs" style={{ color: colors.mutedForeground }}>{ads.length} ads with results in this period</p>
        </div>
        <div className="inline-flex rounded-lg p-1" role="tablist" style={{ background: colors.muted }}>
          {[{ v: false, l: 'All ads' }, { v: true, l: `Made by SkalX (${skxCount})` }].map((o) => (
            <button key={String(o.v)} type="button" role="tab" aria-selected={onlySkx === o.v} onClick={() => setOnlySkx(o.v)}
              className="rounded-md px-3 py-1.5 text-xs font-medium"
              style={{ background: onlySkx === o.v ? colors.primary : 'transparent', color: onlySkx === o.v ? colors.primaryForeground : colors.mutedForeground }}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: colors.mutedForeground }}>
          {onlySkx ? 'No ads made with SkalX have run in this period yet. Name your ads starting with SKX- so SkalX can find them.' : 'No ads ran in this period.'}
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: colors.mutedForeground }}>
                  <th className="pb-2 text-left text-xs font-medium">Ad</th>
                  {COLS.map((c) => (
                    <th key={c.key} className="whitespace-nowrap pb-2 pl-4 text-right text-xs font-medium">
                      <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 hover:underline"
                        aria-sort={sort.key === c.key ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none'}>
                        {c.label}
                        {sort.key === c.key ? (sort.dir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((ad) => (
                  <tr key={ad.adId} style={{ borderTop: `1px solid ${colors.border}` }}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <Thumb ad={ad} />
                        <div className="min-w-0 max-w-[240px]">
                          <p className="truncate font-medium" style={{ color: colors.foreground }} title={ad.name ?? ''}>{ad.name || ad.adId}</p>
                          <p className="truncate text-xs" style={{ color: colors.mutedForeground }} title={ad.headline ?? ''}>{ad.headline || ad.campaignName || '—'}</p>
                          <Badges ad={ad} />
                        </div>
                      </div>
                    </td>
                    {COLS.map((c) => (
                      <td key={c.key} className="whitespace-nowrap py-3 pl-4 text-right tabular-nums" style={{ color: sort.key === c.key ? colors.foreground : colors.secondaryForeground }}>
                        {fmt(c.key, ad, currency)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            <label className="flex items-center gap-2 text-xs" style={{ color: colors.mutedForeground }}>
              Sort by
              <select value={sort.key} onChange={(e) => toggle(e.target.value as SortKey)} className="rounded-md px-2 py-1.5 text-xs"
                style={{ background: colors.muted, color: colors.foreground, border: `1px solid ${colors.border}` }}>
                {COLS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </label>
            {sorted.map((ad) => (
              <div key={ad.adId} className="rounded-xl p-3" style={{ background: colors.secondary, border: `1px solid ${colors.border}` }}>
                <div className="flex gap-3">
                  <Thumb ad={ad} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" style={{ color: colors.foreground }}>{ad.name || ad.adId}</p>
                    <Badges ad={ad} />
                  </div>
                </div>
                {ad.score.reasons[0] ? <p className="mt-2 text-xs" style={{ color: colors.mutedForeground }}>{ad.score.reasons[0]}</p> : null}
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  {(['spend', 'roas', 'cpa', 'purchases', 'ctr', 'revenue'] as SortKey[]).map((k) => (
                    <div key={k}>
                      <dt style={{ color: colors.mutedForeground }}>{COLS.find((c) => c.key === k)?.label}</dt>
                      <dd className="tabular-nums" style={{ color: colors.foreground }}>{fmt(k, ad, currency)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
