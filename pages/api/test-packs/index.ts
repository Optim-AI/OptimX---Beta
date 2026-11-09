// GET  /api/test-packs                         → the user's packs
// POST /api/test-packs { productRef, fromAdId? } → new draft pack with 3 proposed angles
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { createPack } from '@/lib/test-packs/service';
import { listPacks } from '@/lib/test-packs/store';
import { sendError } from '@/lib/test-packs/api-errors';

export const config = { maxDuration: 180 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  try {
    if (req.method === 'GET') {
      const packs = await listPacks(userId);
      return res.status(200).json({ packs: packs.map((p) => ({ id: p.id, status: p.status, source: p.source, productName: (p.product as { product_name?: string }).product_name ?? '', createdAt: p.createdAt })) });
    }
    if (req.method === 'POST') {
      const { productRef, fromAdId } = (req.body ?? {}) as { productRef?: unknown; fromAdId?: unknown };
      if (typeof productRef !== 'string' || !productRef) return res.status(400).json({ error: 'product_required', message: 'Choose a product first.' });
      const pack = await createPack({ userId, productRef, fromAdId: typeof fromAdId === 'string' && /^\d{1,30}$/.test(fromAdId) ? fromAdId : null });
      return res.status(201).json({ id: pack.id });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    return sendError(res, err, 'create');
  }
}
