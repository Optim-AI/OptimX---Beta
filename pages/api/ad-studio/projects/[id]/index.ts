// GET /api/ad-studio/projects/:id → project, drafts (watermarked previews; full image only once kept), credits, drafts left today
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { projectView } from '@/lib/ad-studio/service';
import { sendError } from '@/lib/ad-studio/api-errors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const id = String(req.query.id ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: 'bad_id' });
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    return res.status(200).json(await projectView(userId, id));
  } catch (err) {
    return sendError(res, err, 'view');
  }
}
