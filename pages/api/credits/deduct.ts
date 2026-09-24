// pages/api/credits/deduct.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';

/**
 * POST /api/credits/deduct
 *
 * DISABLED (Phase 12.9.1).
 *
 * Legacy client-callable image credit mutation. Image credits are deducted
 * only after successful generation via server CreditsDAO paths
 * (poster generate/iterate, campaign generate). Video credits use
 * reserve → finalize on /api/commercial/generate.
 *
 * Authenticated callers previously could deduct 1–3 of their own image credits
 * without generating. No current UI/server flow calls this route.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.status(403).json({
    error:
      'Direct credit deduction is disabled. Credits are consumed by generation APIs only.',
    code: 'CREDIT_MUTATION_DISABLED',
  });
}
