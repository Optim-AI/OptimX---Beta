/** Queue an AI analysis on Trigger.dev (or run inline in local dev with META_SYNC_INLINE=true). */
import { tasks } from '@trigger.dev/sdk';
import { metaLog } from '@/lib/meta/log';
import { inlineSyncAllowed, SyncNotConfiguredError } from '@/lib/meta-sync/enqueue';
import { runAnalysis } from './analyze';
import type { metaAnalyzeConnection } from '@/trigger/meta-analyze';

export async function enqueueAnalysis(input: { userId: string; trigger: 'sync' | 'manual'; force?: boolean }): Promise<void> {
  if (process.env.TRIGGER_SECRET_KEY) {
    await tasks.trigger<typeof metaAnalyzeConnection>('meta-analyze-connection', input, {
      tags: [`user_${input.userId}`, `trigger_${input.trigger}`],
    });
    return;
  }
  if (!inlineSyncAllowed()) throw new SyncNotConfiguredError('TRIGGER_SECRET_KEY is not set');
  void runAnalysis(input).catch((err) => metaLog.error('inline_analysis_failed', { message: (err as Error).message }));
}
