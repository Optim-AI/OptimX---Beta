/**
 * Monday brief: a scheduler every 30 minutes finds connections where it's 9:00 Monday in
 * their ad account timezone and no brief exists for last week, and queues one build each.
 */
import { logger, queue, schedules, task } from '@trigger.dev/sdk';
import { runWeeklyBrief } from '@/lib/weekly-brief/run';
import { isBriefDue, briefWeekFor } from '@/lib/weekly-brief/week';
import { hasBriefForWeek } from '@/lib/weekly-brief/store';
import { activeConnectionsWithAccounts } from '@/lib/meta-sync/store';

const briefQueue = queue({ name: 'monday-brief', concurrencyLimit: 3 });

export const mondayBriefBuild = task({
  id: 'monday-brief-build',
  queue: briefQueue,
  maxDuration: 900,
  retry: { maxAttempts: 2, minTimeoutInMs: 60_000, maxTimeoutInMs: 300_000, factor: 2 },
  run: async (payload: { userId: string; trigger: 'schedule' | 'manual'; send: boolean }) => {
    const result = await runWeeklyBrief(payload);
    logger.info('monday brief', { userId: payload.userId, ...result });
    return result;
  },
});

export const mondayBriefScheduler = schedules.task({
  id: 'monday-brief-scheduler',
  cron: '0,30 * * * *',
  maxDuration: 300,
  run: async () => {
    const rows = await activeConnectionsWithAccounts();
    const seen = new Set<string>();
    let queued = 0;
    for (const r of rows) {
      if (seen.has(r.connectionId)) continue;
      seen.add(r.connectionId);
      if (!isBriefDue(r.timezoneName)) continue;
      if (await hasBriefForWeek(r.connectionId, briefWeekFor(r.timezoneName).start)) continue;
      await mondayBriefBuild.trigger({ userId: r.userId, trigger: 'schedule', send: true }, { idempotencyKey: `brief-${r.connectionId}-${briefWeekFor(r.timezoneName).start}` });
      queued++;
    }
    logger.info('monday brief scheduler', { connections: seen.size, queued });
    return { connections: seen.size, queued };
  },
});
