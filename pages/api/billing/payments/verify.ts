// pages/api/billing/payments/verify.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { PaymentService, isRazorpayConfigured } from '@/lib/razorpay';

/**
 * POST /api/billing/payments/verify
 * Verifies a Razorpay payment and adds credits
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

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ error: 'Missing required payment details' });
    }

    const result = await PaymentService.verifyPayment({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!result.success) {
      return res.status(400).json({
        error: result.error || 'Payment verification failed',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified and credits added',
    });
  } catch (error: any) {
    console.error('Verify payment error:', error);
    return res.status(500).json({
      error: 'Failed to verify payment',
    });
  }
}
