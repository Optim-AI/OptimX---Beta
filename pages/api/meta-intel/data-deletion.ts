// POST /api/meta-intel/data-deletion — Meta "Data Deletion Request" callback.
// Meta sends form-encoded `signed_request`; we delete and reply { url, confirmation_code }.
import type { NextApiRequest, NextApiResponse } from 'next';
import { parseSignedRequest } from '@/lib/meta/signed-request';
import { handleMetaDeletionRequest } from '@/lib/meta/deletion';
import { metaLog } from '@/lib/meta/log';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const appSecret = process.env.FACEBOOK_APP_SECRET ?? '';
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://skalxai.app').replace(/\/$/, '');
  const payload = parseSignedRequest((req.body as Record<string, unknown>)?.signed_request, appSecret);
  if (!payload?.user_id) {
    metaLog.warn('deletion_bad_signed_request');
    return res.status(400).json({ error: 'invalid_signed_request' });
  }
  const code = await handleMetaDeletionRequest(String(payload.user_id));
  metaLog.info('deletion_request_handled', { confirmation: code });
  return res.status(200).json({
    url: `${appUrl}/meta-data-deletion?code=${encodeURIComponent(code)}`,
    confirmation_code: code,
  });
}
