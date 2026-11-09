// POST /api/ad-studio/projects { scanId, productName, goal, offer?, formats[], direction?, fromAdId? }
// → creates the project and starts round 1 (research + 8 draft posters, nothing charged)
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { createAdProject, claimNextRound } from '@/lib/ad-studio/service';
import { enqueueRound } from '@/lib/ad-studio/enqueue';
import { sendError } from '@/lib/ad-studio/api-errors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const b = (req.body ?? {}) as Record<string, unknown>;
  if (typeof b.scanId !== 'string' || !/^[0-9a-f-]{36}$/.test(b.scanId) || typeof b.productName !== 'string' || !b.productName.trim()) {
    return res.status(400).json({ error: 'product_required', message: 'Choose a product first.' });
  }
  try {
    const project = await createAdProject({
      userId, scanId: b.scanId, productName: b.productName, goal: b.goal, offer: b.offer, formats: b.formats, direction: b.direction,
      fromAdId: typeof b.fromAdId === 'string' && /^\d{1,30}$/.test(b.fromAdId) ? b.fromAdId : null,
    });
    const { round, size } = await claimNextRound(userId, project.id);
    await enqueueRound({ projectId: project.id, round, size });
    return res.status(201).json({ id: project.id });
  } catch (err) {
    return sendError(res, err, 'create');
  }
}
