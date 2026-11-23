// POST /api/ad-studio/projects { scope?: 'product'|'brand', scanId, productName, goal, offer?, formats[], direction?, fromAdId? }
// scope 'brand' = an ad for the whole brand: no product needed (scanId optional, for product photos)
// → creates the project and starts round 1 (research + 8 draft posters, nothing charged)
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { createAdProject, claimNextRound } from '@/lib/ad-studio/service';
import { enqueueRound } from '@/lib/ad-studio/enqueue';
import { sendError } from '@/lib/ad-studio/api-errors';

// Starts background work that keeps running after the response (lib/jobs/background).
export const config = { maxDuration: 300 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const b = (req.body ?? {}) as Record<string, unknown>;
  const scope = b.scope === 'brand' ? 'brand' : 'product';
  const scanId = typeof b.scanId === 'string' && /^[0-9a-f-]{36}$/.test(b.scanId) ? b.scanId : null;
  if (scope === 'product' && (!scanId || typeof b.productName !== 'string' || !b.productName.trim())) {
    return res.status(400).json({ error: 'product_required', message: 'Choose a product first.' });
  }
  try {
    const project = await createAdProject({
      userId, scope, scanId, productName: typeof b.productName === 'string' ? b.productName : '', goal: b.goal, offer: b.offer, formats: b.formats, direction: b.direction,
      fromAdId: typeof b.fromAdId === 'string' && /^\d{1,30}$/.test(b.fromAdId) ? b.fromAdId : null,
    });
    const { round, size } = await claimNextRound(userId, project.id);
    await enqueueRound({ projectId: project.id, round, size });
    return res.status(201).json({ id: project.id });
  } catch (err) {
    return sendError(res, err, 'create');
  }
}
