// pages/api/billing/subscriptions/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { SubscriptionService, isRazorpayConfigured } from '@/lib/razorpay';

/**
 * POST /api/billing/subscriptions/create
 * Creates a new subscription for the user
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isRazorpayConfigured()) {
    return res.status(503).json({
      error: 'Payments are not configured yet. Add your Razorpay API keys to environment variables. See docs/RAZORPAY_SETUP.md',
    });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { planId, email, contact } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await SubscriptionService.createSubscription({
      userId,
      planId,
      email,
      contact,
    });

    if (!result.success) {
      return res.status(400).json({
        error: result.error || 'Failed to create subscription',
      });
    }

    return res.status(200).json({
      success: true,
      subscriptionId: result.subscriptionId,
      razorpaySubscriptionId: result.razorpaySubscriptionId,
      shortUrl: result.shortUrl,
    });
  } catch (error: any) {
    console.error('Create subscription error:', error);
    return res.status(500).json({
      error: 'Failed to create subscription',
      message: error.message,
    });
  }
}
