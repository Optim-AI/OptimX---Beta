// pages/api/billing/payments/create-order.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { razorpay, RAZORPAY_KEY_ID } from '@/lib/razorpay/client';
import { PaymentsDAO } from '@/database/models/Payments.dao';

/**
 * POST /api/billing/payments/create-order
 * Creates a Razorpay order for custom credit purchase (pay-as-you-go)
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

    const { creditType, credits, amount } = req.body;

    // Validate inputs
    if (!creditType || (creditType !== 'image' && creditType !== 'video')) {
      return res.status(400).json({ error: 'Valid credit type (image or video) is required' });
    }

    if (!credits || credits <= 0) {
      return res.status(400).json({ error: 'Credits must be greater than 0' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amount * 100, // Razorpay uses paise
      currency: 'INR',
      receipt: `credit_${creditType}_${credits}_${Date.now()}`,
      notes: {
        user_id: userId,
        credit_type: creditType,
        credits: credits.toString(),
      },
    });

    // Create payment record
    const paymentType = creditType === 'image' ? 'image_topup' : 'video_topup';
    const payment = await PaymentsDAO.create({
      userId,
      creditPackId: null, // No pack ID for custom purchases
      razorpayOrderId: order.id,
      amount: amount,
      currency: 'INR',
      status: 'created',
      paymentType,
      metadata: {
        creditType,
        credits,
      },
    });

    return res.status(200).json({
      success: true,
      orderId: payment.id,
      razorpayOrderId: order.id,
      amount: amount * 100,
      currency: 'INR',
      key: RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error('Create order error:', error);
    return res.status(500).json({
      error: 'Failed to create order',
      message: error.message,
    });
  }
}
