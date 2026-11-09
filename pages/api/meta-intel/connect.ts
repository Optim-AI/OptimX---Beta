// POST /api/meta-intel/connect → { url } for Facebook Login for Business (config_id).
// Sets a short-lived httpOnly nonce cookie that the callback checks against the signed state.
import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';
import { getUserIdFromRequest } from '@/auth/request';
import { getMetaConnectConfig, MetaConfigError } from '@/lib/meta/config';
import { createState, STATE_COOKIE, STATE_TTL_SECONDS } from '@/lib/meta/oauth-state';
import { META_DIALOG_BASE } from '@/lib/meta/version';
import { metaLog } from '@/lib/meta/log';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  try {
    const cfg = getMetaConnectConfig();
    const { state, nonce } = createState(userId);
    const url = new URL(META_DIALOG_BASE);
    url.searchParams.set('client_id', cfg.appId);
    url.searchParams.set('config_id', cfg.configId);
    url.searchParams.set('redirect_uri', cfg.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('override_default_response_type', 'true');
    url.searchParams.set('state', state);

    res.setHeader(
      'Set-Cookie',
      serialize(STATE_COOKIE, nonce, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/meta-intel',
        maxAge: STATE_TTL_SECONDS,
      }),
    );
    return res.status(200).json({ url: url.toString() });
  } catch (err) {
    if (err instanceof MetaConfigError) {
      metaLog.error('connect_not_configured', { message: err.message });
      return res.status(503).json({ error: 'not_configured', message: 'Meta connection is not set up yet. Please contact support.' });
    }
    metaLog.error('connect_failed', { message: (err as Error).message });
    return res.status(500).json({ error: 'connect_failed' });
  }
}
