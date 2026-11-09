// GET /api/meta-intel/callback — Meta redirects here after Facebook Login for Business.
import type { NextApiRequest, NextApiResponse } from 'next';
import { parse, serialize } from 'cookie';
import { verifyState, STATE_COOKIE } from '@/lib/meta/oauth-state';
import { completeConnect } from '@/lib/meta/connect';
import { MetaGraphError } from '@/lib/meta/graph';
import { BrandKitDAO } from '@/database';
import { metaLog } from '@/lib/meta/log';

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const settingsUrl = (meta: string, reason?: string) =>
  `/settings?tab=integrations&meta=${meta}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Nonce cookie is single-use.
  res.setHeader('Set-Cookie', serialize(STATE_COOKIE, '', { path: '/api/meta-intel', maxAge: 0 }));

  if (first(req.query.error)) {
    metaLog.info('connect_cancelled', { reason: first(req.query.error_reason) });
    return res.redirect(302, settingsUrl('cancelled'));
  }

  const cookies = parse(req.headers.cookie ?? '');
  const verified = verifyState(first(req.query.state), cookies[STATE_COOKIE]);
  if (!verified.ok) {
    metaLog.warn('connect_bad_state', { reason: verified.reason });
    return res.redirect(302, settingsUrl('error', verified.reason === 'expired' ? 'expired' : 'state'));
  }

  const code = first(req.query.code);
  if (!code) return res.redirect(302, settingsUrl('error', 'no_code'));

  try {
    const kit = await BrandKitDAO.getDefault(verified.userId).catch(() => null);
    await completeConnect({ userId: verified.userId, brandKitId: kit?.id ?? null, code });
    return res.redirect(302, '/integrations/meta-intel/select');
  } catch (err) {
    const reason = err instanceof MetaGraphError ? `meta_${err.code ?? err.status}` : 'server';
    metaLog.error('connect_callback_failed', { userId: verified.userId, reason, message: (err as Error).message });
    return res.redirect(302, settingsUrl('error', reason));
  }
}
