// GET /api/meta-intel/dashboard?range=7|14|30|90 — dashboard payload for the signed-in user.
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { buildDashboard } from '@/lib/meta-intel/summary';
import { parseRange } from '@/lib/meta-intel/kpis';
import { metaLog } from '@/lib/meta/log';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  try {
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json(await buildDashboard(userId, parseRange(req.query.range)));
  } catch (err) {
    metaLog.error('dashboard_failed', { userId, message: (err as Error).message });
    return res.status(500).json({ error: 'dashboard_failed' });
  }
}
