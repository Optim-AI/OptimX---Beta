// GET  /api/trends → this brand's trends (latest), whether a refresh is running, refreshes left today
// POST /api/trends → refresh now (a few per day; one at a time)
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { trendsView, startBrandTrends, TrendsError } from '@/lib/trends/service';
import { enqueueBrandTrends } from '@/lib/trends/enqueue';
import { SyncNotConfiguredError } from '@/lib/meta-sync/enqueue';
import { metaLog } from '@/lib/meta/log';

// Starts background work that keeps running after the response (lib/jobs/background).
export const config = { maxDuration: 300 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(await trendsView(userId));
    }
    if (req.method === 'POST') {
      const { id, started } = await startBrandTrends(userId, 'manual');
      if (started) await enqueueBrandTrends(id);
      return res.status(202).json({ ok: true, running: true });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    if (err instanceof TrendsError) return res.status(err.status).json({ error: err.code, message: err.message });
    if (err instanceof SyncNotConfiguredError) return res.status(503).json({ error: 'not_configured', message: 'Trends are not set up yet. Please contact support.' });
    metaLog.error('trends_api_failed', { userId, message: (err as Error).message });
    return res.status(500).json({ error: 'trends_failed', message: 'Something went wrong. Please try again.' });
  }
}
