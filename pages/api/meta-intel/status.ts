// GET /api/meta-intel/status — connection state + assets (never tokens).
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { getMetaStatus } from '@/lib/meta/status';
import { metaLog } from '@/lib/meta/log';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(await getMetaStatus(userId, { checkHealth: true }));
  } catch (err) {
    metaLog.error('status_failed', { userId, message: (err as Error).message });
    return res.status(500).json({ error: 'status_failed' });
  }
}
