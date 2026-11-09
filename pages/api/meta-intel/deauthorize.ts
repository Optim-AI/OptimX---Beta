// POST /api/meta-intel/deauthorize — Meta "Deauthorize Callback URL" (app removed by the user).
import type { NextApiRequest, NextApiResponse } from 'next';
import { parseSignedRequest } from '@/lib/meta/signed-request';
import { handleMetaDeauthorize } from '@/lib/meta/deletion';
import { metaLog } from '@/lib/meta/log';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const payload = parseSignedRequest((req.body as Record<string, unknown>)?.signed_request, process.env.FACEBOOK_APP_SECRET ?? '');
  if (!payload?.user_id) return res.status(400).json({ error: 'invalid_signed_request' });
  try {
    await handleMetaDeauthorize(String(payload.user_id));
  } catch (err) {
    metaLog.error('deauthorize_failed', { message: (err as Error).message });
  }
  return res.status(200).json({ ok: true });
}
