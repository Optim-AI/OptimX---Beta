// pages/api/credits/balance.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { CreditsDAO } from '@/database';

/**
 * GET /api/credits/balance
 * Gets current credit balance for user
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await CreditsDAO.getBalance(userId);

    if (!result.success) {
      return res.status(404).json({
        error: result.error || 'Credits not found'
      });
    }

    return res.status(200).json({
      success: true,
      credits: result.credits || 0
    });
  } catch (error: any) {
    console.error('Credits balance error:', error);
    return res.status(500).json({
      error: 'Failed to get credits balance',
      message: error.message
    });
  }
}
