// POST /api/ad-studio/projects/:id/keep { draftIds[] } → charge 1 image credit per newly kept poster, unlock the full image
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { keepDrafts } from '@/lib/ad-studio/service';
import { sendError } from '@/lib/ad-studio/api-errors';

export const config = { maxDuration: 120 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const ids = Array.isArray((req.body ?? {}).draftIds) ? (req.body.draftIds as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  try {
    return res.status(200).json(await keepDrafts(userId, String(req.query.id ?? ''), ids));
  } catch (err) {
    return sendError(res, err, 'keep');
  }
}
