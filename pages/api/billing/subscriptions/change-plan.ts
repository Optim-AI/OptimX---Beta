// pages/api/billing/subscriptions/change-plan.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { PlanChangeService, isRazorpayConfigured } from '@/lib/razorpay';

/**
 * POST /api/billing/subscriptions/change-plan
 * Changes user's subscription plan (upgrade or downgrade)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isRazorpayConfigured()) {
    return res.status(503).json({
      error: 'Payments are not configured yet. Add your Razorpay API keys. See docs/RAZORPAY_SETUP.md',
    });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { subscriptionId, newPlanId } = req.body;

    if (!subscriptionId || !newPlanId) {
      return res.status(400).json({ error: 'subscriptionId and newPlanId are required' });
    }

    const result = await PlanChangeService.changePlan({
      userId,
      subscriptionId,
      newPlanId,
    });

    if (!result.success) {
      return res.status(400).json({
        error: result.error || 'Failed to change plan',
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      proratedAmount: result.proratedAmount,
      effectiveDate: result.effectiveDate,
    });
  } catch (error: any) {
    console.error('Change plan error:', error);
    return res.status(500).json({
      error: 'Failed to change plan',
      message: error.message,
    });
  }
}
