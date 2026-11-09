// GET /api/test-packs/:id/zip → short-lived download link for the pack ZIP
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { zipDownloadUrl } from '@/lib/test-packs/service';
import { sendError } from '@/lib/test-packs/api-errors';

export const config = { maxDuration: 120 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  try {
    return res.status(200).json({ url: await zipDownloadUrl(userId, String(req.query.id ?? '')) });
  } catch (err) {
    return sendError(res, err, 'zip');
  }
}
