// GET /api/ad-studio/projects/:id → project, drafts (watermarked previews; full image only once kept), credits, drafts left today
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { projectView } from '@/lib/ad-studio/service';
import { enqueueRound } from '@/lib/ad-studio/enqueue';
import { claimResume } from '@/lib/ad-studio/store';
import { sendError } from '@/lib/ad-studio/api-errors';
import { metaLog } from '@/lib/meta/log';

// May pick up a killed background round via waitUntil.
export const config = { maxDuration: 300 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const id = String(req.query.id ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: 'bad_id' });
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const { resume, ...view } = await projectView(userId, id);
    if (resume) {
      const claimed = await claimResume(userId, id);
      if (claimed) {
        metaLog.info('ad_studio_round_resume', { projectId: id, round: claimed.rounds });
        await enqueueRound({ projectId: id, round: claimed.rounds, size: view.nextRoundSize });
      }
    }
    return res.status(200).json(view);
  } catch (err) {
    return sendError(res, err, 'view');
  }
}
