/**
 * Daily staggered scheduling. An hourly cron asks each active connection "are you due?".
 * Each connection gets a stable local hour (2–5 AM in its ad account timezone) and a
 * minute offset, so brands don't all hit Meta at once.
 */
import { createHash } from 'crypto';
import { hourInTz } from './dates';

export const MIN_HOURS_BETWEEN_SCHEDULED_SYNCS = 20;

function slot(connectionId: string): number {
  return createHash('sha256').update(connectionId).digest().readUInt32BE(0);
}

export function dueLocalHour(connectionId: string): number {
  return 2 + (slot(connectionId) % 4);
}

export function delayMinutes(connectionId: string): number {
  return Math.floor(slot(connectionId) / 4) % 50;
}

export function isDueForScheduledSync(params: {
  connectionId: string;
  timeZone: string | null;
  lastAttemptAt: string | null;
  now?: Date;
}): boolean {
  const now = params.now ?? new Date();
  if (hourInTz(params.timeZone, now) !== dueLocalHour(params.connectionId)) return false;
  if (!params.lastAttemptAt) return true;
  return now.getTime() - Date.parse(params.lastAttemptAt) >= MIN_HOURS_BETWEEN_SCHEDULED_SYNCS * 3_600_000;
}
