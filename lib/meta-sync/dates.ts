/** Date helpers in the ad account's timezone (Meta reports days in the account timezone). */

export const FULL_SYNC_DAYS = 90;
export const REPULL_DAYS = 7;

export function todayInTz(timeZone: string | null | undefined, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function hourInTz(timeZone: string | null | undefined, now: Date = new Date()): number {
  try {
    const h = new Intl.DateTimeFormat('en-GB', { timeZone: timeZone || 'UTC', hour: '2-digit', hourCycle: 'h23' }).format(now);
    return Number(h);
  } catch {
    return now.getUTCHours();
  }
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Range to pull. Full: last 90 days incl. today. Incremental: re-pull the last 7 days,
 * extended back to cover any gap since the last successful sync (capped at 90 days).
 */
export function syncRange(
  kind: 'full' | 'incremental',
  timeZone: string | null | undefined,
  lastSyncedUntil: string | null,
  now: Date = new Date(),
): { since: string; until: string } {
  const until = todayInTz(timeZone, now);
  const earliest = addDays(until, -(FULL_SYNC_DAYS - 1));
  if (kind === 'full') return { since: earliest, until };
  let since = addDays(until, -(REPULL_DAYS - 1));
  if (lastSyncedUntil) {
    const gapStart = addDays(lastSyncedUntil, -(REPULL_DAYS - 1));
    if (gapStart < since) since = gapStart;
  }
  return { since: since < earliest ? earliest : since, until };
}

/** Split a range into windows of at most `size` days (for non-async insight calls). */
export function chunkRange(since: string, until: string, size: number): { since: string; until: string }[] {
  const out: { since: string; until: string }[] = [];
  let start = since;
  while (start <= until) {
    const end = addDays(start, size - 1);
    out.push({ since: start, until: end > until ? until : end });
    start = addDays(end, 1);
  }
  return out;
}
