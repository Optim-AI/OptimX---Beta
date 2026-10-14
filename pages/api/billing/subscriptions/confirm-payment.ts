// pages/api/billing/subscriptions/confirm-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { isRazorpayConfigured } from '@/lib/razorpay';
import { confirmSubscriptionPayment } from '@/lib/billing/subscription-confirm';

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
 * POST /api/billing/subscriptions/confirm-payment
 *
 * Authenticated confirmation after Razorpay Checkout. Does not trust the browser
 * alone: verifies ownership, signature, live payment capture, invoice, and amount,
 * then calls the same provisioner used by payment.captured webhooks.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isRazorpayConfigured()) {
    return res.status(503).json({
      error:
        'Payments are not configured yet. Add your Razorpay API keys. See docs/RAZORPAY_SETUP.md',
    });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = readBody(req);
    const subscriptionId =
      typeof body.subscriptionId === 'string' ? body.subscriptionId.trim() : '';
    const razorpayPaymentId =
      typeof body.razorpayPaymentId === 'string' ? body.razorpayPaymentId.trim() : '';
    const razorpaySubscriptionId =
      typeof body.razorpaySubscriptionId === 'string'
        ? body.razorpaySubscriptionId.trim()
        : '';
    const razorpaySignature =
      typeof body.razorpaySignature === 'string' ? body.razorpaySignature.trim() : '';

    if (!subscriptionId || !razorpayPaymentId || !razorpaySubscriptionId) {
      return res.status(400).json({
        error: 'subscriptionId, razorpayPaymentId, and razorpaySubscriptionId are required',
      });
    }

    const result = await confirmSubscriptionPayment({
      userId,
      subscriptionId,
      razorpayPaymentId,
      razorpaySubscriptionId,
      razorpaySignature: razorpaySignature || undefined,
    });

    if (result.status === 'provisioned') {
      return res.status(200).json({
        success: true,
        status: 'provisioned',
        alreadyProvisioned: result.alreadyProvisioned,
        subscriptionId: result.subscriptionId,
        cycleId: result.cycleId,
        message: result.alreadyProvisioned
          ? 'Subscription credits were already applied.'
          : 'Subscription credits applied.',
      });
    }

    if (result.status === 'pending') {
      return res.status(202).json({
        success: true,
        status: 'pending',
        reason: result.reason,
        message: result.message,
      });
    }

    return res.status(400).json({
      success: false,
      status: 'rejected',
      reason: result.reason,
      permanent: result.permanent,
      message: result.message,
      error: result.message,
    });
  } catch (error: any) {
    console.error('Confirm subscription payment error:', error);
    return res.status(500).json({
      error: 'Failed to confirm subscription payment',
    });
  }
}
