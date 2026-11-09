/**
 * Test plan for a pack: equal budget per variant, how long to run, when to judge,
 * and the SKX- naming reminder. Uses the same minimum spend as ad scoring so
 * "judge after" matches when the dashboard will start labelling winners.
 */
import { minSpendThreshold } from '@/lib/meta-intel/scoring';

export const PLAN = {
  DAYS_TO_REACH_MIN_SPEND: 5,
  RUN_DAYS: 7,
  NO_EDIT_DAYS: 3,
} as const;

export type TestPlan = {
  currency: string;
  variants: number;
  minSpendPerVariant: number;
  dailyBudgetPerVariant: number;
  totalDailyBudget: number;
  runDays: number;
  smallerStart: { variants: number; totalDailyBudget: number };
  steps: string[];
};

function roundUp(n: number, currency: string): number {
  const step = currency === 'INR' ? 50 : 5;
  return Math.ceil(n / step) * step;
}

export function buildTestPlan(params: { variants: number; currency: string | null; avgCpa: number | null; adNames: string[]; hasTestFirst?: boolean }): TestPlan {
  const currency = params.currency || 'INR';
  const minSpend = minSpendThreshold(currency, params.avgCpa);
  const perDay = roundUp(minSpend / PLAN.DAYS_TO_REACH_MIN_SPEND, currency);
  const total = perDay * params.variants;
  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  return {
    currency,
    variants: params.variants,
    minSpendPerVariant: minSpend,
    dailyBudgetPerVariant: perDay,
    totalDailyBudget: total,
    runDays: PLAN.RUN_DAYS,
    smallerStart: { variants: 2, totalDailyBudget: perDay * 2 },
    steps: [
      `In Ads Manager, create one Sales campaign with ${params.variants} ad sets — one per ad — each with the same daily budget of ${fmt(perDay)} (about ${fmt(total)} a day in total). Equal budgets keep the test fair.`,
      'Use the same audience and placements setting in every ad set; only the ad should differ.',
      `Name every ad exactly like its file name (for example ${params.adNames[0] ?? 'SKX-…'}). SkalX uses the SKX- name to find the results.`,
      `Don’t change anything for the first ${PLAN.NO_EDIT_DAYS} days — Meta needs time to learn.`,
      `Judge after ${PLAN.RUN_DAYS} days, or once each ad has spent at least ${fmt(minSpend)}. SkalX will show which one won on Ad Performance.`,
      params.hasTestFirst === false
        ? `Smaller budget? Start with your two favourites at ${fmt(perDay * 2)} a day.`
        : `Smaller budget? Start with the two ads marked “Test first” at ${fmt(perDay * 2)} a day.`,
    ],
  };
}

/** The angle to test first: one grounded in a past winner, else customer voice, else the first. */
export function testFirstAngleIndex(sources: string[]): number {
  const winner = sources.indexOf('past_winner');
  if (winner >= 0) return winner;
  const voice = sources.indexOf('customer_voice');
  return voice >= 0 ? voice : 0;
}
