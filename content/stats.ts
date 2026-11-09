/**
 * Numbers shown on the site. Every stat needs a `source` (where the number comes from,
 * e.g. "Product logs, Oct 2026: median of 214 runs"). Stats without a source are never
 * rendered, and the stats band hides itself when fewer than 3 are sourced.
 */
export type Stat = {
  value: string;
  label: string;
  /** Required to render. Leave empty until the number is measured. */
  source: string;
};

export const STATS: Stat[] = [
  // Measure from product logs, then add a source:
  // { value: '~X min', label: 'from product link to first ad pack', source: '' },
  // { value: '6', label: 'variants in every test pack', source: '' },
  // { value: '15s & 30s', label: 'video ads', source: '' },
];

export function sourcedStats(list: Stat[] = STATS): Stat[] {
  return list.filter((s) => s.source.trim().length > 0);
}

export const MIN_STATS_TO_SHOW = 3;
