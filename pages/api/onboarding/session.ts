import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { ensureGuestSession } from '@/lib/onboarding/guest-session';

/**
 * POST /api/onboarding/session
 * Ensures a guest cookie for visitors. Authenticated users keep their account.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (userId) {
      return res.status(200).json({ ok: true, authenticated: true });
    }
    const guest = await ensureGuestSession(req, res);
    return res.status(200).json({
      ok: true,
      authenticated: false,
      guest: true,
      sessionId: guest.id,
    });
  } catch (err: unknown) {
    console.error('[onboarding/session]', err);
    return res.status(500).json({ ok: false, error: 'Could not start onboarding session' });
  }
}
