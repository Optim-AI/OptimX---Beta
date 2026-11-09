// GET /api/test-packs/products?from_ad=<ad id> → products from Ad Studio scans (+ a guess for the ad)
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { productOptions } from '@/lib/test-packs/service';
import { sendError } from '@/lib/test-packs/api-errors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  try {
    const fromAd = typeof req.query.from_ad === 'string' && /^\d{1,30}$/.test(req.query.from_ad) ? req.query.from_ad : null;
    return res.status(200).json(await productOptions(userId, fromAd));
  } catch (err) {
    return sendError(res, err, 'products');
  }
}
