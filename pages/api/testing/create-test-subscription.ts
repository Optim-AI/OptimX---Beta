// pages/api/testing/create-test-subscription.ts
// Creates a test subscription without going through Razorpay
// DEVELOPMENT ONLY — Phase 1B-2: canonical plans only, no trial, no credit grant on create

import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';
import { PlansDAO } from '@/database/models/Plans.dao';
import { generateMockId } from '@/lib/testing/razorpay-mock';
import {
  CANONICAL_SUBSCRIPTION_PLAN_IDS,
  isCanonicalSubscriptionPlanId,
} from '@/lib/billing/canonical-plans';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

    const { planId = 'skalx_starter' } = req.body;

    const plan = await PlansDAO.getById(planId);
    if (!plan) {
      return res.status(400).json({
        error: 'Invalid plan',
        availablePlans: [...CANONICAL_SUBSCRIPTION_PLAN_IDS],
      });
    }

    if (plan.billingCycle === 'trial') {
      return res.status(400).json({
        error: 'Free trial is not available',
        availablePlans: [...CANONICAL_SUBSCRIPTION_PLAN_IDS],
      });
    }

    if (!plan.isActive || !isCanonicalSubscriptionPlanId(plan.id)) {
      return res.status(400).json({
        error: 'Only active canonical SkalX plans are allowed',
        availablePlans: [...CANONICAL_SUBSCRIPTION_PLAN_IDS],
      });
    }

    const existing = await SubscriptionsDAO.getOpenByUserId(userId);
    if (existing) {
      return res.status(400).json({
        error: 'User already has an open subscription. Cancel or expire it first.',
      });
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const nextReset = new Date(periodEnd);

    // Pending-like active fixture for local testing — NO credits granted here.
    // Use simulate-webhook subscription.charged to provision entitlements.
    const subscription = await SubscriptionsDAO.create({
      userId,
      planId,
      status: 'active',
      razorpaySubscriptionId: generateMockId('sub'),
      razorpayCustomerId: generateMockId('cust'),
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      nextResetDate: nextReset.toISOString(),
      cancelAtPeriodEnd: false,
    });

    return res.status(200).json({
      success: true,
      message:
        'Test subscription created (no credits granted). Simulate subscription.charged to provision.',
      subscription: {
        id: subscription.id,
        planId: subscription.planId,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextResetDate: subscription.nextResetDate,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
      plan: {
        name: plan.name,
        imageCredits: plan.imageCredits,
        videoCredits: plan.videoCredits,
      },
    });
  } catch (error: any) {
    console.error('Create test subscription error:', error);
    return res.status(500).json({
      error: 'Failed to create test subscription',
      message: error.message,
    });
  }
}
