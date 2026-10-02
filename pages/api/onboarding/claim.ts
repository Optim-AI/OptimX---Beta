import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { claimGuestSession } from '@/lib/onboarding/guest-session';

/**
 * POST /api/onboarding/claim
 * After sign-in, move the guest brand, creatives, and generation sessions
 * onto the existing account. Does not create a second user.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }

  try {
    const result = await claimGuestSession(req, res, userId);
    return res.status(200).json({ ok: true, ...result });
  } catch (err: unknown) {
    console.error('[onboarding/claim]', err);
    return res.status(500).json({ ok: false, error: 'Could not restore onboarding session' });
  }
}
