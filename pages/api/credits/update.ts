// pages/api/credits/update.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';

/**
 * POST/ANY /api/credits/update
 *
 * DISABLED (Phase 12.9.1).
 *
 * Legacy client-callable image credit mutation (always deducted 1).
 * No current application callers. Credits are consumed only by generation
 * server paths (CreditsDAO), never via this route.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.status(403).json({
    error:
      'Direct credit updates are disabled. Credits are consumed by generation APIs only.',
    code: 'CREDIT_MUTATION_DISABLED',
  });
}
