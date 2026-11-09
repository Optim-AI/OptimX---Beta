// POST /api/ad-studio/projects/:id/rounds { feedback? } → another round of draft posters (free, capped per day)
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { claimNextRound } from '@/lib/ad-studio/service';
import { enqueueRound } from '@/lib/ad-studio/enqueue';
import { sendError } from '@/lib/ad-studio/api-errors';

// Starts background work that keeps running after the response (lib/jobs/background).
export const config = { maxDuration: 300 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const id = String(req.query.id ?? '');
  const feedback = typeof (req.body ?? {}).feedback === 'string' ? String(req.body.feedback).trim().slice(0, 1000) : null;
  try {
    const { round, size } = await claimNextRound(userId, id);
    await enqueueRound({ projectId: id, round, size, feedback: feedback || null });
    return res.status(202).json({ ok: true, round, size });
  } catch (err) {
    return sendError(res, err, 'round');
  }
}
