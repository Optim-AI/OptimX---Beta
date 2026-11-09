/**
 * Monday brief content, built in code from the dashboard numbers (no AI, so every
 * figure is exactly what the dashboard shows for that week).
 */
import type { DashboardPayload, LeaderboardAd } from '@/lib/meta-intel/summary';

export type BriefAdLine = { adId: string; name: string; line: string };
export type BriefContent = {
  weekStart: string;
  weekEnd: string;
  currency: string | null;
  oneLine: string;
  winners: BriefAdLine[];
  stop: (BriefAdLine & { reason: 'losing' | 'tiring' })[];
  topPost: { platform: string; caption: string | null; permalink: string | null; thumbnailUrl: string | null; line: string } | null;
  notEnoughData: boolean;
  /** 'posters' = a poster project with free drafts (current); 'test_pack' = older briefs. */
  pack: { id: string; ads: number; kind?: 'posters' | 'test_pack' } | null;
  packNote: string | null;
};

export function fmtMoney(v: number | null, currency: string | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', minimumFractionDigits: 0, maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2 }).format(v);
  } catch {
    return String(Math.round(v));
  }
}
const fmtNum = (v: number | null) => (v === null ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v));
const change = (pct: number | null, label: string) =>
  pct === null ? '' : pct === 0 ? `, the same ${label} as the week before` : `, ${label} ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(1)}% on the week before`;

export function oneLineSummary(d: DashboardPayload): string {
  const k = d.kpis;
  if (d.dataState === 'empty' || k.spend === 0) return 'No ads ran last week.';
  const spent = `You spent ${fmtMoney(k.spend, d.currency)}`;
  if (k.revenue !== null && k.roas !== null) {
    return `${spent} and made ${fmtMoney(k.revenue, d.currency)} in sales (${k.roas.toFixed(2)}× back)${change(d.deltas.roas, 'return')}.`;
  }
  if (k.purchases !== null && k.purchases > 0 && k.cpa !== null) {
    return `${spent} and got ${fmtNum(k.purchases)} purchases at ${fmtMoney(k.cpa, d.currency)} each${change(d.deltas.cpa, 'cost per purchase')}.`;
  }
  return `${spent}; Meta isn’t reporting purchases for these ads yet${k.ctr !== null ? `, and ${k.ctr.toFixed(2)}% of people who saw them clicked` : ''}.`;
}

function winnerLine(a: LeaderboardAd, currency: string | null): string {
  const parts: string[] = [];
  if (a.roas !== null) parts.push(`${a.roas.toFixed(2)}× back on ${fmtMoney(a.spend, currency)}`);
  if (a.purchases) parts.push(`${fmtNum(a.purchases)} purchases${a.cpa !== null ? ` at ${fmtMoney(a.cpa, currency)} each` : ''}`);
  if (!parts.length && a.ctr !== null) parts.push(`${a.ctr.toFixed(2)}% click rate`);
  return parts.join(' · ');
}

const isLive = (a: LeaderboardAd) => (a.status || '').toUpperCase() === 'ACTIVE';

export function buildBriefContent(d: DashboardPayload, week: { start: string; end: string }): BriefContent {
  const byRoas = (x: LeaderboardAd, y: LeaderboardAd) => (y.roas ?? -1) - (x.roas ?? -1) || (x.cpa ?? Infinity) - (y.cpa ?? Infinity);
  const winners = d.ads.filter((a) => a.score.status === 'winner').sort(byRoas).slice(0, 2)
    .map((a) => ({ adId: a.adId, name: a.name || a.adId, line: winnerLine(a, d.currency) }));

  const losing = d.ads.filter((a) => a.score.status === 'losing' && isLive(a)).sort((x, y) => y.spend - x.spend)
    .map((a) => ({
      adId: a.adId, name: a.name || a.adId, reason: 'losing' as const,
      line: a.cpa !== null && d.averages.cpa !== null
        ? `${fmtMoney(a.cpa, d.currency)} per purchase vs your average ${fmtMoney(d.averages.cpa, d.currency)}`
        : `No purchases after spending ${fmtMoney(a.spend, d.currency)}`,
    }));
  const tiring = d.ads.filter((a) => a.score.fatiguing && isLive(a) && a.score.status !== 'losing')
    .map((a) => ({
      adId: a.adId, name: a.name || a.adId, reason: 'tiring' as const,
      line: `Click rate fell from ${a.score.ctrPrev7}% to ${a.score.ctrLast7}% while people saw it ${a.score.frequencyLast7} times on average`,
    }));

  const post = d.organic[0] ?? null;
  return {
    weekStart: week.start,
    weekEnd: week.end,
    currency: d.currency,
    oneLine: oneLineSummary(d),
    winners,
    stop: [...losing, ...tiring].slice(0, 2),
    topPost: post ? {
      platform: post.platform, caption: post.caption ? post.caption.slice(0, 140) : null, permalink: post.permalink, thumbnailUrl: post.thumbnailUrl,
      line: `${fmtNum(post.engagement)} likes, comments, saves and shares${post.views !== null ? ` · ${fmtNum(post.views)} views` : ''}`,
    } : null,
    notEnoughData: d.dataState !== 'ok',
    pack: null,
    packNote: null,
  };
}
