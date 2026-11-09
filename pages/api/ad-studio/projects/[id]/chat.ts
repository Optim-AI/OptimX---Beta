// POST /api/ad-studio/projects/:id/chat { messages: [{role, content}] } → { reply, direction, ready }
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { chatTurn } from '@/lib/ad-studio/chat';
import { sendError } from '@/lib/ad-studio/api-errors';

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  try {
    return res.status(200).json(await chatTurn(userId, String(req.query.id ?? ''), (req.body ?? {}).messages));
  } catch (err) {
    return sendError(res, err, 'chat');
  }
}
