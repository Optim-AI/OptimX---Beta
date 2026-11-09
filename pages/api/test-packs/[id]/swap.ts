// POST /api/test-packs/:id/swap { index } → replace one proposed angle with a different one
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { swapAngle } from '@/lib/test-packs/service';
import { sendError } from '@/lib/test-packs/api-errors';

export const config = { maxDuration: 120 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  try {
    const angles = await swapAngle({ userId, packId: String(req.query.id ?? ''), index: Number((req.body ?? {}).index) });
    return res.status(200).json({ angles });
  } catch (err) {
    return sendError(res, err, 'swap');
  }
}
