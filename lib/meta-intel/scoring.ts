/**
 * Ad scoring in code (no AI). Every threshold lives in SCORING so it can be tuned in one place.
 *
 *  - Enough data: spend ≥ min(base minimum for the currency ≈ ₹1,500, 3 × account avg CPA)
 *                 and impressions ≥ 1,000
 *  - Winner:      CPA ≥ 20% better than the account average, or ROAS ≥ 20% higher
 *  - Losing:      CPA ≥ 30% worse than average (an ad with no purchases after spending
 *                 1.3 × the average CPA counts as losing too)
 *  - Fatiguing:   CTR down ≥ 25% (last 7 days vs the 7 before) while frequency > 3 and rising
 *                 (a flag that can sit alongside any status)
 * Winner is checked before losing (a high-ROAS ad with a high CPA is still earning).
 */
import { minSpendFor } from './kpis';

export const SCORING = {
  MIN_SPEND_CPA_MULTIPLE: 3,
  MIN_IMPRESSIONS: 1000,
  WINNER_CPA_BETTER: 0.2,
  WINNER_ROAS_BETTER: 0.2,
  LOSING_CPA_WORSE: 0.3,
  FATIGUE_CTR_DROP: 0.25,
  FATIGUE_MIN_FREQUENCY: 3,
  FATIGUE_MIN_WINDOW_IMPRESSIONS: 500,
} as const;

export type AdStatus = 'winner' | 'losing' | 'steady' | 'not_enough_data';

export type WindowStats = { impressions: number; clicks: number; frequency: number | null };

export type AdStats = {
  adId: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number | null; // null = purchases not tracked
  revenue: number | null;   // null = purchase value not tracked
  last7: WindowStats;
  prev7: WindowStats;
};

export type AccountAverages = { cpa: number | null; roas: number | null; ctr: number | null };

export type AdScore = {
  status: AdStatus;
  fatiguing: boolean;
  /** Plain-language reasons, with numbers. */
  reasons: string[];
  cpa: number | null;
  roas: number | null;
  ctr: number | null;
  cpaVsAvgPct: number | null;   // negative = cheaper than average
  roasVsAvgPct: number | null;  // positive = better than average
  ctrLast7: number | null;
  ctrPrev7: number | null;
  ctrChangePct: number | null;
  frequencyLast7: number | null;
  frequencyPrev7: number | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;
const pctDiff = (v: number | null, base: number | null) => (v === null || base === null || base === 0 ? null : r1(((v - base) / base) * 100));
const ctrOf = (w: { impressions: number; clicks: number }) => (w.impressions > 0 ? r2((w.clicks / w.impressions) * 100) : null);

export function accountAverages(ads: Pick<AdStats, 'spend' | 'purchases' | 'revenue' | 'clicks' | 'impressions'>[]): AccountAverages {
  let spend = 0, purchases = 0, purchaseTracked = false, revenue = 0, revenueSpend = 0, clicks = 0, impressions = 0;
  for (const a of ads) {
    spend += a.spend;
    clicks += a.clicks;
    impressions += a.impressions;
    if (a.purchases !== null) { purchases += a.purchases; purchaseTracked = true; }
    if (a.revenue !== null) { revenue += a.revenue; revenueSpend += a.spend; }
  }
  return {
    cpa: purchaseTracked && purchases > 0 ? r2(spend / purchases) : null,
    roas: revenueSpend > 0 ? r2(revenue / revenueSpend) : null,
    ctr: impressions > 0 ? r2((clicks / impressions) * 100) : null,
  };
}

export function minSpendThreshold(currency: string | null, avgCpa: number | null): number {
  const base = minSpendFor(currency);
  return avgCpa && avgCpa > 0 ? Math.min(base, r2(SCORING.MIN_SPEND_CPA_MULTIPLE * avgCpa)) : base;
}

export function scoreAd(ad: AdStats, avg: AccountAverages, currency: string | null): AdScore {
  const cpa = ad.purchases && ad.purchases > 0 ? r2(ad.spend / ad.purchases) : null;
  const roas = ad.revenue !== null && ad.spend > 0 ? r2(ad.revenue / ad.spend) : null;
  const ctr = ctrOf(ad);
  const ctrLast7 = ctrOf(ad.last7);
  const ctrPrev7 = ctrOf(ad.prev7);
  const fLast = ad.last7.frequency;
  const fPrev = ad.prev7.frequency;
  const reasons: string[] = [];

  const fatiguing =
    ad.last7.impressions >= SCORING.FATIGUE_MIN_WINDOW_IMPRESSIONS &&
    ad.prev7.impressions >= SCORING.FATIGUE_MIN_WINDOW_IMPRESSIONS &&
    ctrLast7 !== null && ctrPrev7 !== null && ctrPrev7 > 0 &&
    ctrLast7 <= ctrPrev7 * (1 - SCORING.FATIGUE_CTR_DROP) &&
    fLast !== null && fLast > SCORING.FATIGUE_MIN_FREQUENCY &&
    fPrev !== null && fLast > fPrev;
  if (fatiguing) {
    reasons.push(`Click rate fell from ${ctrPrev7}% to ${ctrLast7}% this week while people saw it ${r2(fLast!)} times on average (up from ${r2(fPrev!)}).`);
  }

  const base: Omit<AdScore, 'status' | 'reasons'> = {
    fatiguing, cpa, roas, ctr,
    cpaVsAvgPct: pctDiff(cpa, avg.cpa), roasVsAvgPct: pctDiff(roas, avg.roas),
    ctrLast7, ctrPrev7, ctrChangePct: pctDiff(ctrLast7, ctrPrev7),
    frequencyLast7: fLast === null ? null : r2(fLast), frequencyPrev7: fPrev === null ? null : r2(fPrev),
  };

  const minSpend = minSpendThreshold(currency, avg.cpa);
  if (ad.spend < minSpend || ad.impressions < SCORING.MIN_IMPRESSIONS) {
    reasons.unshift(`Spent ${r2(ad.spend)} with ${ad.impressions} impressions — below the ${minSpend} spend / ${SCORING.MIN_IMPRESSIONS} impressions needed to judge it.`);
    return { ...base, status: 'not_enough_data', reasons };
  }

  const cpaWinner = avg.cpa !== null && cpa !== null && cpa <= avg.cpa * (1 - SCORING.WINNER_CPA_BETTER);
  const roasWinner = avg.roas !== null && roas !== null && roas >= avg.roas * (1 + SCORING.WINNER_ROAS_BETTER);
  if (cpaWinner || roasWinner) {
    if (cpaWinner) reasons.unshift(`Cost per purchase ${cpa} vs account average ${avg.cpa}.`);
    if (roasWinner) reasons.unshift(`ROAS ${roas} vs account average ${avg.roas}.`);
    return { ...base, status: 'winner', reasons };
  }

  if (avg.cpa !== null && ad.purchases !== null) {
    const limit = avg.cpa * (1 + SCORING.LOSING_CPA_WORSE);
    if (cpa !== null && cpa >= limit) {
      reasons.unshift(`Cost per purchase ${cpa} vs account average ${avg.cpa}.`);
      return { ...base, status: 'losing', reasons };
    }
    if (cpa === null && ad.spend >= limit) {
      reasons.unshift(`No purchases after spending ${r2(ad.spend)} (account average cost per purchase is ${avg.cpa}).`);
      return { ...base, status: 'losing', reasons };
    }
  }

  if (avg.cpa === null && avg.roas === null) reasons.unshift('Purchases are not being tracked, so only clicks can be compared.');
  return { ...base, status: 'steady', reasons };
}

export function scoreAds(ads: AdStats[], currency: string | null): { averages: AccountAverages; minSpend: number; scores: Map<string, AdScore> } {
  const averages = accountAverages(ads);
  const scores = new Map(ads.map((a) => [a.adId, scoreAd(a, averages, currency)]));
  return { averages, minSpend: minSpendThreshold(currency, averages.cpa), scores };
}
