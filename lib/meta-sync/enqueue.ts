/**
 * Start a sync: create the sync_runs row, then run it in the background (same Vercel function,
 * see lib/jobs/background). When the numbers changed, the AI analysis runs right after.
 */
import { runInBackground } from '@/lib/jobs/background';
import { createQueuedRun, runQueuedSync } from './run';
import * as store from './store';

/** Kept for callers that still catch it; background work no longer needs any setup. */
export class SyncNotConfiguredError extends Error {}

export type EnqueueResult = { runId: string; queued: true } | { queued: false; reason: 'already_running'; runId: string | null };

export async function enqueueSync(input: {
  connectionId: string; userId: string; trigger: 'initial' | 'schedule' | 'manual'; delayMinutes?: number;
}): Promise<EnqueueResult> {
  const run = await createQueuedRun(input);
  if (!run) {
    const active = await store.activeRun(input.connectionId);
    return { queued: false, reason: 'already_running', runId: active?.id ?? null };
  }
  runInBackground('meta-sync', () => syncThenAnalyse(run.id));
  return { runId: run.id, queued: true };
}

/** One sync, then a fresh analysis if the numbers changed (used by requests and the daily cron). */
export async function syncThenAnalyse(runId: string): Promise<void> {
  const result = await runQueuedSync(runId);
  if (result.dataChanged && result.status !== 'failed' && result.userId) {
    const { runAnalysis } = await import('@/lib/meta-intel/analyze');
    await runAnalysis({ userId: result.userId, trigger: 'sync' });
  }
}
