// pages/api/testing/create-test-subscription.ts
// Creates a test subscription without going through Razorpay
// DEVELOPMENT ONLY

import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';
import { CreditsDAO } from '@/database/models/Credits.dao';
import { PlansDAO } from '@/database/models/Plans.dao';
import { generateMockId } from '@/lib/testing/razorpay-mock';

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

    const { planId = 'starter_monthly' } = req.body;

    // Get plan details
    const plan = await PlansDAO.getById(planId);
    if (!plan) {
      return res.status(400).json({ 
        error: 'Invalid plan',
        availablePlans: [
          'free_trial',
          'basic_monthly', 'basic_quarterly',
          'starter_monthly', 'starter_quarterly',
          'lite_growth_monthly', 'lite_growth_quarterly',
          'growth_pro_monthly', 'growth_pro_quarterly',
        ],
      });
    }

    // Check if user already has active subscription
    const existing = await SubscriptionsDAO.getActiveByUserId(userId);
    if (existing) {
      // If user has existing subscription, update it (plan change)
      const now = new Date();
      const periodEnd = new Date(now);
      
      if (plan.billingCycle === 'trial') {
        periodEnd.setDate(periodEnd.getDate() + 5);
      } else if (plan.billingCycle === 'monthly') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 3);
      }

      // Update existing subscription to new plan
      await SubscriptionsDAO.updatePlan(
        existing.id,
        planId,
        generateMockId('sub'),
        now,
        periodEnd
      );

      // Reset credits to new plan limits
      await CreditsDAO.resetSubscriptionCredits(userId, plan.imageCredits, plan.videoCredits);

      // Get updated credits
      const credits = await CreditsDAO.getFullBalance(userId);

      return res.status(200).json({
        success: true,
        message: 'Plan changed successfully',
        subscription: {
          id: existing.id,
          planId: planId,
          status: existing.status,
          currentPeriodEnd: periodEnd.toISOString(),
        },
        plan: {
          name: plan.name,
          imageCredits: plan.imageCredits,
          videoCredits: plan.videoCredits,
        },
        credits,
      });
    }

    const now = new Date();
    const periodEnd = new Date(now);
    const nextReset = new Date(now);

    if (plan.billingCycle === 'trial') {
      periodEnd.setDate(periodEnd.getDate() + 5);
    } else if (plan.billingCycle === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 3);
    }
    nextReset.setMonth(nextReset.getMonth() + 1);

    // Create subscription
    const subscription = await SubscriptionsDAO.create({
      userId,
      planId,
      status: plan.billingCycle === 'trial' ? 'trialing' : 'active',
      razorpaySubscriptionId: generateMockId('sub'),
      razorpayCustomerId: generateMockId('cust'),
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      trialEndsAt: plan.billingCycle === 'trial' ? periodEnd.toISOString() : undefined,
      nextResetDate: plan.billingCycle === 'trial' ? periodEnd.toISOString() : nextReset.toISOString(),
    });

    // Initialize credits
    await CreditsDAO.initializeCredits(userId, plan.imageCredits, plan.videoCredits);

    // Get updated credits
    const credits = await CreditsDAO.getFullBalance(userId);

    return res.status(200).json({
      success: true,
      message: 'Test subscription created successfully',
      subscription: {
        id: subscription.id,
        planId: subscription.planId,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextResetDate: subscription.nextResetDate,
      },
      plan: {
        name: plan.name,
        imageCredits: plan.imageCredits,
        videoCredits: plan.videoCredits,
      },
      credits,
    });
  } catch (error: any) {
    console.error('Create test subscription error:', error);
    return res.status(500).json({
      error: 'Failed to create test subscription',
      message: error.message,
    });
  }
}
