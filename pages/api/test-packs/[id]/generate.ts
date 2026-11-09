// POST /api/test-packs/:id/generate → check credits, write the 6 variants + test plan, start the background job
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { prepareGeneration } from '@/lib/test-packs/service';
import { enqueuePackGeneration } from '@/lib/test-packs/enqueue';
import { sendError } from '@/lib/test-packs/api-errors';

// Starts background work that keeps running after the response (lib/jobs/background).
export const config = { maxDuration: 300 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const id = String(req.query.id ?? '');
  try {
    await prepareGeneration(userId, id);
    await enqueuePackGeneration(id);
    return res.status(202).json({ ok: true });
  } catch (err) {
    return sendError(res, err, 'generate');
  }
}
