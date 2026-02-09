// pages/api/testing/reset-test-credits.ts
// Manually triggers credit reset for testing
// DEVELOPMENT ONLY

import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';
import { CreditsDAO } from '@/database/models/Credits.dao';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CRITICAL: Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This endpoint is only available in development mode' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get active subscription
    const subscription = await SubscriptionsDAO.getActiveByUserId(userId);
    if (!subscription) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Reset credits to plan defaults
    const result = await CreditsDAO.resetSubscriptionCredits(
      userId,
      subscription.plan.imageCredits,
      subscription.plan.videoCredits
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Update next reset date
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    await SubscriptionsDAO.updateNextResetDate(subscription.id, nextReset);

    return res.status(200).json({
      success: true,
      message: 'Credits reset successfully',
      plan: {
        name: subscription.plan.name,
        imageCredits: subscription.plan.imageCredits,
        videoCredits: subscription.plan.videoCredits,
      },
      balance: result.balance,
      nextResetDate: nextReset.toISOString(),
    });
  } catch (error: any) {
    console.error('Reset test credits error:', error);
    return res.status(500).json({
      error: 'Failed to reset credits',
      message: error.message,
    });
  }
}
