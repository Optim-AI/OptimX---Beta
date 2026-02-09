// pages/api/credits/balance.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { CreditsDAO } from '@/database/models/Credits.dao';
import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';

/**
 * GET /api/credits/balance
 * Gets current credit balance for user (new format with image/video split)
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

    const balance = await CreditsDAO.getFullBalance(userId);
    const subscription = await SubscriptionsDAO.getActiveByUserId(userId);

    if (!balance) {
      return res.status(404).json({
        error: 'Credits not found'
      });
    }

    return res.status(200).json({
      success: true,
      // New format
      imageCredits: balance.imageCredits,
      videoCredits: balance.videoCredits,
      lastResetAt: balance.lastResetAt,
      nextResetDate: subscription?.nextResetDate || null,
      // Legacy format for backward compatibility
      credits: balance.imageCredits.total
    });
  } catch (error: any) {
    console.error('Credits balance error:', error);
    return res.status(500).json({
      error: 'Failed to get credits balance',
      message: error.message
    });
  }
}
