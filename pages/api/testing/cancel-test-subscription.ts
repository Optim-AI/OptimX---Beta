// pages/api/testing/cancel-test-subscription.ts
// Cancels subscription without going through Razorpay
// DEVELOPMENT ONLY

import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';

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

    // Cancel subscription
    await SubscriptionsDAO.updateStatus(subscription.id, 'cancelled');

    return res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      subscriptionId: subscription.id,
    });
  } catch (error: any) {
    console.error('Cancel test subscription error:', error);
    return res.status(500).json({
      error: 'Failed to cancel subscription',
      message: error.message,
    });
  }
}
