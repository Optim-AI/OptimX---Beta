// pages/api/billing/subscriptions/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { SubscriptionService, isRazorpayConfigured } from '@/lib/razorpay';
import { isCanonicalSubscriptionPlanId } from '@/lib/billing/canonical-plans';

function readBody(req: NextApiRequest): Record<string, unknown> {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

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

    const body = readBody(req);
    const planIdRaw =
      body.planId ??
      body.plan_id ??
      (typeof req.query.planId === 'string' ? req.query.planId : undefined);
    const emailRaw = body.email ?? body.billingEmail;
    const contact = typeof body.contact === 'string' ? body.contact : undefined;

    const planId = typeof planIdRaw === 'string' ? planIdRaw.trim() : '';
    const email = typeof emailRaw === 'string' ? emailRaw.trim() : '';

    if (!planId) {
      console.error('[subscriptions/create] missing planId');
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    if (!isCanonicalSubscriptionPlanId(planId)) {
      return res.status(400).json({
        error: 'Invalid plan. Only SkalX Starter, Growth, and Pro are available.',
      });
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
      key: result.key,
    });
  } catch (error: any) {
    console.error('Create subscription error:', error);
    return res.status(500).json({
      error: 'Failed to create subscription',
    });
  }
}
