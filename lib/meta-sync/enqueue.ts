/**
 * Queue a sync: create the sync_runs row, then hand it to Trigger.dev.
 * Local dev without Trigger.dev: META_SYNC_INLINE=true runs it in-process (never in production).
 */
import { tasks } from '@trigger.dev/sdk';
import { metaLog } from '@/lib/meta/log';
import { createQueuedRun, runQueuedSync } from './run';
import * as store from './store';
import type { metaSyncConnection } from '@/trigger/meta-sync';

export class SyncNotConfiguredError extends Error {}

export function inlineSyncAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.META_SYNC_INLINE === 'true';
}

export type EnqueueResult = { runId: string; queued: true } | { queued: false; reason: 'already_running'; runId: string | null };

export async function enqueueSync(input: {
  connectionId: string; userId: string; trigger: 'initial' | 'schedule' | 'manual'; delayMinutes?: number;
}): Promise<EnqueueResult> {
  if (!process.env.TRIGGER_SECRET_KEY && !inlineSyncAllowed()) {
    throw new SyncNotConfiguredError('TRIGGER_SECRET_KEY is not set');
  }
  const run = await createQueuedRun(input);
  if (!run) {
    const active = await store.activeRun(input.connectionId);
    return { queued: false, reason: 'already_running', runId: active?.id ?? null };
  }

  if (!process.env.TRIGGER_SECRET_KEY) {
    // Local dev only: fire and forget in this process.
    void runQueuedSync(run.id)
      .then(async (result) => {
        // Same as the Trigger.dev task: re-analyse when the numbers changed.
        if (result.dataChanged && result.status !== 'failed' && result.userId) {
          const { enqueueAnalysis } = await import('@/lib/meta-intel/enqueue-analysis');
          await enqueueAnalysis({ userId: result.userId, trigger: 'sync' });
        }
      })
      .catch((err) => metaLog.error('inline_sync_failed', { runId: run.id, message: (err as Error).message }));
    return { runId: run.id, queued: true };
  }

  try {
    const handle = await tasks.trigger<typeof metaSyncConnection>(
      'meta-sync-connection',
      { runId: run.id },
      {
        idempotencyKey: `meta-sync-${run.id}`,
        ...(input.delayMinutes ? { delay: `${input.delayMinutes}m` } : {}),
        tags: [`connection_${input.connectionId}`, `trigger_${input.trigger}`],
      },
    );
    await store.updateRun(run.id, { externalRunId: handle.id });
  } catch (err) {
    await store.updateRun(run.id, { status: 'failed', finishedAt: new Date().toISOString(), errors: [{ step: 'enqueue', message: (err as Error).message.slice(0, 300) }] });
    throw err;
  }
  return { runId: run.id, queued: true };
}
