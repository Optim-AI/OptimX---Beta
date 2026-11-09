// GET /api/cron/meta-sync — Vercel Cron, every hour. Syncs each connection once a day at its
// quiet hour (2–5 AM in its ad account timezone), then re-analyses when the numbers changed.
import type { NextApiRequest, NextApiResponse } from 'next';
import { isCronRequest } from '@/lib/jobs/cron-auth';
import { createQueuedRun } from '@/lib/meta-sync/run';
import { syncThenAnalyse } from '@/lib/meta-sync/enqueue';
import { activeConnectionsWithAccounts, latestRuns } from '@/lib/meta-sync/store';
import { isDueForScheduledSync } from '@/lib/meta-sync/schedule';
import { metaLog } from '@/lib/meta/log';

export const config = { maxDuration: 300 };
const PARALLEL = 3;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isCronRequest(req)) return res.status(401).json({ error: 'unauthorized' });
  const rows = await activeConnectionsWithAccounts();
  const due: { connectionId: string; userId: string }[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.connectionId)) continue;
    seen.add(r.connectionId);
    const [last] = await latestRuns(r.connectionId, 1);
    if (isDueForScheduledSync({ connectionId: r.connectionId, timeZone: r.timezoneName, lastAttemptAt: last?.createdAt ?? null })) {
      due.push({ connectionId: r.connectionId, userId: r.userId });
    }
  }
  let done = 0;
  for (let i = 0; i < due.length; i += PARALLEL) {
    await Promise.all(due.slice(i, i + PARALLEL).map(async (c) => {
      try {
        const run = await createQueuedRun({ ...c, trigger: 'schedule' });
        if (!run) return; // one already running
        await syncThenAnalyse(run.id);
        done++;
      } catch (err) {
        metaLog.error('cron_sync_failed', { connectionId: c.connectionId, message: (err as Error).message });
      }
    }));
  }
  metaLog.info('cron_meta_sync', { connections: seen.size, due: due.length, done });
  return res.status(200).json({ connections: seen.size, due: due.length, done });
}
