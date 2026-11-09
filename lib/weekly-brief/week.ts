/** Week maths for the Monday brief, in the ad account's timezone. */
import { addDays, todayInTz } from '@/lib/meta-sync/dates';

export const BRIEF_LOCAL_HOUR = 9;

/** Monday–Sunday of the last full week before `today` (YYYY-MM-DD). */
export function lastFullWeek(today: string): { start: string; end: string } {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const sinceMonday = (dow + 6) % 7;
  const thisMonday = addDays(today, -sinceMonday);
  return { start: addDays(thisMonday, -7), end: addDays(thisMonday, -1) };
}

function localParts(timeZone: string | null | undefined, now: Date) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timeZone || 'UTC', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return { weekday: get('weekday'), hour: Number(get('hour')), minute: Number(get('minute')) };
  } catch {
    return { weekday: now.toUTCString().slice(0, 3), hour: now.getUTCHours(), minute: now.getUTCMinutes() };
  }
}

/**
 * The scheduler runs every 30 minutes; a brief is due in the half-hour slot that starts at
 * 9:00 local on Monday. Works for half-hour timezones like India (UTC+5:30).
 */
export function isBriefDue(timeZone: string | null | undefined, now: Date = new Date()): boolean {
  const { weekday, hour, minute } = localParts(timeZone, now);
  return weekday === 'Mon' && hour === BRIEF_LOCAL_HOUR && minute < 30;
}

export function briefWeekFor(timeZone: string | null | undefined, now: Date = new Date()) {
  return lastFullWeek(todayInTz(timeZone, now));
}
