// pages/api/billing/subscriptions/current.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';
import { CreditsDAO } from '@/database/models/Credits.dao';

/**
 * GET /api/billing/subscriptions/current
 * Gets the current active subscription for the user
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

    const subscription = await SubscriptionsDAO.getActiveByUserId(userId);
    const credits = await CreditsDAO.getFullBalance(userId);

    if (!subscription) {
      return res.status(200).json({
        success: true,
        hasSubscription: false,
        subscription: null,
        credits,
      });
    }

    return res.status(200).json({
      success: true,
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan: {
          id: subscription.plan.id,
          name: subscription.plan.name,
          billingCycle: subscription.plan.billingCycle,
          imageCredits: subscription.plan.imageCredits,
          videoCredits: subscription.plan.videoCredits,
        },
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialEndsAt: subscription.trialEndsAt,
        nextResetDate: subscription.nextResetDate,
      },
      credits,
    });
  } catch (error: any) {
    console.error('Get subscription error:', error);
    return res.status(500).json({
      error: 'Failed to get subscription',
      message: error.message,
    });
  }
}
