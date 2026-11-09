/** Draft limits: drafts are free to make (only kept posters are charged), so they are capped. */
export const DRAFTS_PER_ROUND = 8;
export const FREE_DRAFTS_PER_PRODUCT_PER_DAY = 24; // 3 rounds of 8
export const MIN_CREDITS_TO_START = 1;

export function draftsLeftToday(draftsLast24h: number): number {
  return Math.max(0, FREE_DRAFTS_PER_PRODUCT_PER_DAY - draftsLast24h);
}

/** How many drafts the next round may draw (0 = blocked until tomorrow). */
export function nextRoundSize(draftsLast24h: number): number {
  return Math.min(DRAFTS_PER_ROUND, draftsLeftToday(draftsLast24h));
}
