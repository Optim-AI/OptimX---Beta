// GET /api/ad-studio/projects/:id/download → short-lived link to a ZIP of the kept posters (+ copy + test plan)
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { keptZipUrl } from '@/lib/ad-studio/download';
import { sendError } from '@/lib/ad-studio/api-errors';

export const config = { maxDuration: 120 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  try {
    return res.status(200).json({ url: await keptZipUrl(userId, String(req.query.id ?? '')) });
  } catch (err) {
    return sendError(res, err, 'download');
  }
}
