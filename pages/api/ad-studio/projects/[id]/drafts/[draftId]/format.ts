// POST /api/ad-studio/projects/:id/drafts/:draftId/format { format } → same design in another size (1 credit, charged when it comes out)
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { requestFormat } from '@/lib/ad-studio/ops';
import { enqueueDraftOp } from '@/lib/ad-studio/enqueue';
import { sendError } from '@/lib/ad-studio/api-errors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  try {
    const op = await requestFormat(userId, String(req.query.id ?? ''), String(req.query.draftId ?? ''), (req.body ?? {}).format);
    await enqueueDraftOp(op);
    return res.status(202).json({ ok: true, draftId: op.draftId });
  } catch (err) {
    return sendError(res, err, 'format');
  }
}
