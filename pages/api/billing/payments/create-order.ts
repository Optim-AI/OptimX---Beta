// pages/api/billing/payments/create-order.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { razorpay, RAZORPAY_KEY_ID, isRazorpayConfigured } from '@/lib/razorpay/client';
import { PaymentsDAO } from '@/database/models/Payments.dao';
import { VoucherDAO } from '@/database/models/Voucher.dao';
import { calculateTotalsInrFromDb } from '@/lib/billing/pricing.server';
import { getMinQuantity, getMaxQuantity } from '@/lib/billing/pricing';

/**
 * POST /api/billing/payments/create-order
 * Creates a Razorpay order for custom credit purchase (pay-as-you-go)
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

    const { creditType, credits, billingEmail, voucherId } = req.body;

    // Validate inputs
    if (!creditType || (creditType !== 'image' && creditType !== 'video')) {
      return res.status(400).json({ error: 'Valid credit type (image or video) is required' });
    }

    const creditsNum = Number(credits);
    if (!Number.isFinite(creditsNum) || !Number.isInteger(creditsNum)) {
      return res.status(400).json({ error: 'Credits must be a whole number' });
    }

    const minQty = getMinQuantity(creditType);
    const maxQty = getMaxQuantity(creditType);
    if (creditsNum < minQty || creditsNum > maxQty) {
      return res.status(400).json({
        error: `Credits must be between ${minQty} and ${maxQty}`,
      });
    }
    if (creditType === 'video' && creditsNum % 8 !== 0) {
      return res.status(400).json({
        error: 'Video credits must be a multiple of 8 seconds',
      });
    }

    // IMPORTANT: compute amount server-side (never trust client-sent amount)
    const totals = await calculateTotalsInrFromDb({ creditType, credits: creditsNum });

    // Validate voucher if provided
    let voucherCredits = 0;
    if (voucherId) {
      const validation = await VoucherDAO.validateForRedemption(voucherId, userId, creditType);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      voucherCredits = validation.voucher!.credits;
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: totals.totalInr * 100, // Razorpay uses paise
      currency: 'INR',
      receipt: `credit_${creditType}_${creditsNum}_${Date.now()}`,
      notes: {
        user_id: userId,
        credit_type: creditType,
        credits: creditsNum.toString(),
        subtotal_inr: totals.subtotalInr.toString(),
        gst_rate: totals.gstRate.toString(),
        gst_amount_inr: totals.gstAmountInr.toString(),
        total_inr: totals.totalInr.toString(),
        ...(billingEmail ? { billing_email: billingEmail } : {}),
      },
    });

    // Create payment record
    const paymentType = creditType === 'image' ? 'image_topup' : 'video_topup';
    const payment = await PaymentsDAO.create({
      userId,
      creditPackId: null, // No pack ID for custom purchases
      razorpayOrderId: order.id,
      amount: totals.totalInr,
      currency: 'INR',
      status: 'created',
      paymentType,
      metadata: {
        creditType,
        credits: creditsNum,
        subtotalInr: totals.subtotalInr,
        gstRate: totals.gstRate,
        gstAmountInr: totals.gstAmountInr,
        totalInr: totals.totalInr,
        ...(billingEmail ? { billingEmail } : {}),
        ...(voucherId ? { voucherId, voucherCredits } : {}),
      },
    });

    return res.status(200).json({
      success: true,
      orderId: payment.id,
      razorpayOrderId: order.id,
      // Razorpay checkout expects amount in paise
      amount: totals.totalInr * 100,
      currency: 'INR',
      key: RAZORPAY_KEY_ID,
      subtotalInr: totals.subtotalInr,
      gstRate: totals.gstRate,
      gstAmountInr: totals.gstAmountInr,
      totalInr: totals.totalInr,
      ...(voucherCredits > 0 ? { voucherCredits } : {}),
    });
  } catch (error: any) {
    console.error('Create order error:', error);
    return res.status(500).json({
      error: 'Failed to create order',
    });
  }
}
