// pages/api/credits/deduct.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { CreditsDAO } from '@/database/models/Credits.dao';

/**
 * POST /api/credits/deduct
 * Deducts credits from user account
 * 
 * Body params:
 * - type: 'image' | 'video' (defaults to 'image' for backward compatibility)
 * - amount: number (defaults to 1)
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

    const { type = 'image', amount = 1 } = req.body;

    if (type !== 'image' && type !== 'video') {
      return res.status(400).json({ error: 'Type must be "image" or "video"' });
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || !Number.isInteger(amountNum) || amountNum < 1) {
      return res.status(400).json({ error: 'Amount must be a positive integer' });
    }

    let result;
    if (type === 'video') {
      result = await CreditsDAO.deductVideoCredits(userId, amountNum);
    } else {
      result = await CreditsDAO.deductImageCredits(userId, amountNum);
    }

    if (!result.success) {
      // Check if insufficient credits
      if (result.error?.includes('Insufficient')) {
        return res.status(400).json({
          error: 'Insufficient credits',
          creditType: type,
          message: result.error
        });
      }

      return res.status(500).json({
        error: result.error || 'Failed to deduct credits'
      });
    }

    return res.status(200).json({
      success: true,
      creditType: type,
      balance: result.balance,
      // Legacy format for backward compatibility
      credits: type === 'image' 
        ? result.balance?.imageCredits.total 
        : result.balance?.videoCredits.total
    });
  } catch (error: any) {
    const { extractDbError } = await import('@/database/client');
    const dbErr = extractDbError(error);
    console.error('Credits deduct error:', JSON.stringify(dbErr, null, 2));
    console.error('Full error stack:', error.stack);

    // Check if insufficient credits
    if (error.message?.includes('Insufficient')) {
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
