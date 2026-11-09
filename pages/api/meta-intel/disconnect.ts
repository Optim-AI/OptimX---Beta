// POST /api/meta-intel/disconnect — revoke at Meta (user tokens), delete token, assets and synced data.
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { disconnectUser } from '@/lib/meta/deletion';
import { metaLog } from '@/lib/meta/log';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  try {
    const result = await disconnectUser(userId);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    metaLog.error('disconnect_failed', { userId, message: (err as Error).message });
    return res.status(500).json({ error: 'disconnect_failed' });
  }
}
