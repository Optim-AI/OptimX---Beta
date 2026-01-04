// pages/api/credits/deduct.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { CreditsDAO } from '@/database';

/**
 * POST /api/credits/deduct
 * Deducts credits from user account (replaces Supabase RPC call)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { amount = 1 } = req.body;

    // Deduct credits
    const result = await CreditsDAO.deduct(userId, amount);

    return res.status(200).json({
      success: true,
      credits: result.credits
    });
  } catch (error: any) {
    console.error('Credits deduct error:', error);

    // Check if insufficient credits
    if (error.message?.includes('Insufficient credits')) {
      return res.status(400).json({
        error: 'Insufficient credits',
        message: error.message
      });
    }

    return res.status(500).json({
      error: 'Failed to deduct credits',
      message: error.message
    });
  }
}
