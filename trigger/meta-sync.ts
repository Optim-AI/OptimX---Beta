/**
 * Trigger.dev tasks for Meta Intelligence sync. These run on Trigger.dev workers, not Vercel.
 * - meta-sync-connection: runs one queued sync_runs row
 * - meta-sync-scheduler: hourly; enqueues each connection once a day in its own 2–5 AM local slot
 */
import { logger, queue, schedules, task } from '@trigger.dev/sdk';
import { runQueuedSync } from '@/lib/meta-sync/run';
import { activeConnectionsWithAccounts, latestRuns } from '@/lib/meta-sync/store';
import { isDueForScheduledSync, delayMinutes } from '@/lib/meta-sync/schedule';
import { metaAnalyzeConnection } from './meta-analyze';

const metaSyncQueue = queue({ name: 'meta-sync', concurrencyLimit: 3 });

export const metaSyncConnection = task({
  id: 'meta-sync-connection',
  queue: metaSyncQueue,
  maxDuration: 3600,
  retry: { maxAttempts: 2, minTimeoutInMs: 60_000, maxTimeoutInMs: 300_000, factor: 2 },
  run: async (payload: { runId: string }) => {
    const result = await runQueuedSync(payload.runId);
    logger.info('meta sync finished', { ...result });
    // Re-analyse only when the numbers actually changed.
    if (result.dataChanged && result.status !== 'failed' && result.userId) {
      await metaAnalyzeConnection.trigger({ userId: result.userId, trigger: 'sync' }, { tags: [`user_${result.userId}`] });
    }
    return result;
  },
});

export const metaSyncScheduler = schedules.task({
  id: 'meta-sync-scheduler',
  cron: '0 * * * *',
  maxDuration: 300,
  run: async () => {
    // Imported lazily so the task module stays light.
    const { enqueueSync } = await import('@/lib/meta-sync/enqueue');
    const rows = await activeConnectionsWithAccounts();
    const byConnection = new Map<string, { userId: string; timeZone: string | null }>();
    for (const r of rows) if (!byConnection.has(r.connectionId)) byConnection.set(r.connectionId, { userId: r.userId, timeZone: r.timezoneName });

    let queued = 0;
    for (const [connectionId, c] of byConnection) {
      const [last] = await latestRuns(connectionId, 1);
      if (!isDueForScheduledSync({ connectionId, timeZone: c.timeZone, lastAttemptAt: last?.createdAt ?? null })) continue;
      try {
        const r = await enqueueSync({ connectionId, userId: c.userId, trigger: 'schedule', delayMinutes: delayMinutes(connectionId) });
        if (r.queued) queued++;
      } catch (err) {
        logger.error('failed to enqueue scheduled sync', { connectionId, message: (err as Error).message });
      }
    }
    logger.info('meta sync scheduler', { connections: byConnection.size, queued });
    return { connections: byConnection.size, queued };
  },
});
