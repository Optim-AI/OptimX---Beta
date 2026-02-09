// pages/api/billing/subscriptions/cancel.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';
import { SubscriptionService } from '@/lib/razorpay';

/**
 * POST /api/billing/subscriptions/cancel
 * Cancels the user's active subscription
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

    // Get active subscription
    const subscription = await SubscriptionsDAO.getActiveByUserId(userId);
    if (!subscription) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    const result = await SubscriptionService.cancelSubscription(subscription.id);

    if (!result.success) {
      return res.status(400).json({
        error: result.error || 'Failed to cancel subscription',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
    });
  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    return res.status(500).json({
      error: 'Failed to cancel subscription',
      message: error.message,
    });
  }
}
