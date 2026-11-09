// GET   /api/test-packs/:id → pack, variants, credit balance, real results
// PATCH /api/test-packs/:id { angles } → save the user's edits (draft only)
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { getPack, listVariants } from '@/lib/test-packs/store';
import { imageCreditBalance, updateAngles } from '@/lib/test-packs/service';
import { packResults } from '@/lib/test-packs/results';
import { sendError } from '@/lib/test-packs/api-errors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const id = String(req.query.id ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: 'bad_id' });
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    if (req.method === 'GET') {
      const pack = await getPack(userId, id);
      if (!pack) return res.status(404).json({ error: 'not_found' });
      const variants = await listVariants(pack.id);
      const [balance, results] = await Promise.all([
        imageCreditBalance(userId),
        ['ready', 'partial'].includes(pack.status) ? packResults(userId, pack, variants) : Promise.resolve(null),
      ]);
      return res.status(200).json({
        pack: {
          id: pack.id, status: pack.status, source: pack.source, sourceAd: pack.sourceAdSnapshot, product: pack.product,
          angles: pack.angles, formats: pack.formats, creditsEstimated: pack.creditsEstimated, creditsCharged: pack.creditsCharged,
          testPlan: pack.testPlan, hasZip: !!pack.zipPath, error: pack.error, createdAt: pack.createdAt,
        },
        variants: variants.map((v) => ({
          id: v.id, angleIndex: v.angleIndex, format: v.format, adName: v.adName, hook: v.hook, primaryText: v.primaryText,
          headline: v.headline, whatItTests: v.whatItTests, whyItMightWork: v.whyItMightWork, testFirst: v.testFirst,
          status: v.status, imageUrl: v.imageUrl, error: v.error, matchedAdId: v.matchedAdMetaId, matchedBy: v.matchedBy,
        })),
        creditBalance: balance,
        results,
      });
    }
    if (req.method === 'PATCH') {
      const angles = await updateAngles({ userId, packId: id, angles: (req.body ?? {}).angles });
      return res.status(200).json({ angles });
    }
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    return sendError(res, err, 'get');
  }
}
