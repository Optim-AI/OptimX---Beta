// GET /api/cron/monday-brief — Vercel Cron, every 30 minutes. Builds and emails the Monday brief
// for each connection where it's 9:00–9:29 on Monday in its ad account timezone.
import type { NextApiRequest, NextApiResponse } from 'next';
import { isCronRequest } from '@/lib/jobs/cron-auth';
import { runWeeklyBrief } from '@/lib/weekly-brief/run';
import { isBriefDue, briefWeekFor } from '@/lib/weekly-brief/week';
import { hasBriefForWeek } from '@/lib/weekly-brief/store';
import { activeConnectionsWithAccounts } from '@/lib/meta-sync/store';
import { metaLog } from '@/lib/meta/log';

export const config = { maxDuration: 300 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isCronRequest(req)) return res.status(401).json({ error: 'unauthorized' });
  const rows = await activeConnectionsWithAccounts();
  const seen = new Set<string>();
  let built = 0;
  for (const r of rows) {
    if (seen.has(r.connectionId)) continue;
    seen.add(r.connectionId);
    if (!isBriefDue(r.timezoneName)) continue;
    if (await hasBriefForWeek(r.connectionId, briefWeekFor(r.timezoneName).start)) continue;
    try {
      await runWeeklyBrief({ userId: r.userId, trigger: 'schedule', send: true });
      built++;
    } catch (err) {
      metaLog.error('cron_brief_failed', { connectionId: r.connectionId, message: (err as Error).message });
    }
  }
  metaLog.info('cron_monday_brief', { connections: seen.size, built });
  return res.status(200).json({ connections: seen.size, built });
}
