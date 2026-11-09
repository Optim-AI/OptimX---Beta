/** Queue a brief build on Trigger.dev (or inline in local dev with META_SYNC_INLINE=true). */
import { tasks } from '@trigger.dev/sdk';
import { metaLog } from '@/lib/meta/log';
import { inlineSyncAllowed, SyncNotConfiguredError } from '@/lib/meta-sync/enqueue';
import { runWeeklyBrief } from './run';
import type { mondayBriefBuild } from '@/trigger/monday-brief';

export async function enqueueBrief(input: { userId: string; trigger: 'schedule' | 'manual'; send: boolean }): Promise<void> {
  if (process.env.TRIGGER_SECRET_KEY) {
    await tasks.trigger<typeof mondayBriefBuild>('monday-brief-build', input, { tags: [`user_${input.userId}`, `trigger_${input.trigger}`] });
    return;
  }
  if (!inlineSyncAllowed()) throw new SyncNotConfiguredError('TRIGGER_SECRET_KEY is not set');
  void runWeeklyBrief(input).catch((err) => metaLog.error('inline_brief_failed', { message: (err as Error).message }));
}
