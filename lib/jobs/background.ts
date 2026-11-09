/**
 * Background work without a job service: the API route answers right away and the work keeps
 * running in the same Vercel function (waitUntil) until it finishes or the route's maxDuration
 * (BACKGROUND_MAX_DURATION) is reached. Off Vercel (local dev) the promise simply runs.
 *
 * Every job records its own status in the database, so the page polls for progress, and a job
 * that's cut off is picked up by each feature's "stuck for too long" check.
 */
import { waitUntil } from '@vercel/functions';
import { metaLog } from '@/lib/meta/log';

/** Seconds a route that starts background work may run (Vercel Pro allows up to 300 here). */
export const BACKGROUND_MAX_DURATION = 300;

export function runInBackground(label: string, work: () => Promise<unknown>): void {
  const p = Promise.resolve()
    .then(work)
    .catch((err) => metaLog.error('background_job_failed', { job: label, message: (err as Error)?.message }));
  waitUntil(p);
}
