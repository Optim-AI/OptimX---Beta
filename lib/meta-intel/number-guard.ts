/**
 * "Never invent metrics" guard. Every number the AI model writes must match a number in the input
 * (allowing for rounding). Bullets with unsupported numbers are dropped; the caller retries
 * once if the headline fails or too much was dropped.
 */
import { INSIGHT_LIMITS, type Insights } from './insights-types';

const NUM_RE = /-?\d[\d,]*(?:\.\d+)?/g;

/** Every number in the input: numeric values and numbers inside strings (dates, ids, names). */
export function collectNumbers(input: unknown): number[] {
  const out: number[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'number' && Number.isFinite(v)) out.push(v);
    else if (typeof v === 'string') out.push(...extractNumbers(v).map((t) => t.value));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(input);
  return out;
}

export type NumberToken = { raw: string; value: number; decimals: number };

export function extractNumbers(text: string): NumberToken[] {
  return (text.match(NUM_RE) ?? []).map((raw) => {
    const clean = raw.replace(/,/g, '');
    const dot = clean.indexOf('.');
    return { raw, value: Number(clean), decimals: dot === -1 ? 0 : clean.length - dot - 1 };
  }).filter((t) => Number.isFinite(t.value));
}

/** Small counts ("3 ads", "7 days", "2 weeks") are always fine. */
const FREE_INTEGER_MAX = 14;

export function isSupported(token: NumberToken, pool: readonly number[]): boolean {
  const n = Math.abs(token.value);
  if (token.decimals === 0 && n <= FREE_INTEGER_MAX) return true;
  const tol = (v: number) => Math.max(token.decimals === 0 ? 0.5 : 0.5 * 10 ** -token.decimals + 1e-9, 0.005 * Math.abs(v));
  return pool.some((v) => Math.abs(n - Math.abs(v)) <= tol(v));
}

export function unsupportedNumbers(text: string, pool: readonly number[]): string[] {
  return extractNumbers(text).filter((t) => !isSupported(t, pool)).map((t) => t.raw);
}

export type GuardResult = {
  clean: Insights;
  dropped: { section: string; text: string; numbers: string[] }[];
  headlineOk: boolean;
  totalItems: number;
};

export function guardInsights(ins: Insights, input: unknown, knownAdIds: ReadonlySet<string>): GuardResult {
  const pool = collectNumbers(input);
  const dropped: GuardResult['dropped'] = [];
  let total = 0;

  const keep = <T>(section: keyof typeof INSIGHT_LIMITS, items: T[], textOf: (t: T) => string): T[] => {
    const kept: T[] = [];
    for (const item of items) {
      total++;
      const bad = unsupportedNumbers(textOf(item), pool);
      if (bad.length) dropped.push({ section, text: textOf(item).slice(0, 300), numbers: bad });
      else kept.push(item);
    }
    return kept.slice(0, INSIGHT_LIMITS[section]);
  };
  const ids = (xs: string[]) => xs.filter((id) => knownAdIds.has(id));

  const headlineBad = unsupportedNumbers(ins.headline, pool);
  if (headlineBad.length) dropped.push({ section: 'headline', text: ins.headline, numbers: headlineBad });

  const clean: Insights = {
    headline: ins.headline,
    working: keep('working', ins.working, (p) => `${p.point} ${p.evidence}`).map((p) => ({ ...p, ad_ids: ids(p.ad_ids) })),
    not_working: keep('not_working', ins.not_working, (p) => `${p.point} ${p.evidence}`).map((p) => ({ ...p, ad_ids: ids(p.ad_ids) })),
    patterns: keep('patterns', ins.patterns, (p) => `${p.point} ${p.evidence}`),
    next_actions: keep('next_actions', ins.next_actions, (a) => `${a.action} ${a.why}`).map((a) => ({
      ...a, ad_id: a.ad_id && knownAdIds.has(a.ad_id) ? a.ad_id : null,
      cta: a.cta === 'make_more_like_this' && !(a.ad_id && knownAdIds.has(a.ad_id)) ? 'test_new_angle' : a.cta,
    })),
    angles_to_test: keep('angles_to_test', ins.angles_to_test, (a) => `${a.angle} ${a.hook} ${a.source_detail} ${a.why}`),
  };
  return { clean, dropped, headlineOk: headlineBad.length === 0, totalItems: total };
}

/** Retry when the headline cites an unsupported number or more than a third of items were dropped. */
export function needsRetry(g: GuardResult): boolean {
  const itemDrops = g.dropped.filter((d) => d.section !== 'headline').length;
  return !g.headlineOk || (g.totalItems > 0 && itemDrops / g.totalItems > 1 / 3);
}
