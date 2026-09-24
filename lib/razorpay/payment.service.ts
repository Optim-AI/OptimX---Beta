// lib/razorpay/payment.service.ts
// Service for managing one-time payments (credit top-ups).
//
// Credits are granted exactly once via PaymentsDAO.captureIfCreated +
// grantCreditsForCapturedPayment. Either verifyPayment OR payment.captured
// webhook wins the race — never both.

import { razorpay, RAZORPAY_KEY_ID } from './client';
import { PaymentsDAO } from '@/database/models/Payments.dao';
import { VoucherDAO } from '@/database/models/Voucher.dao';

interface CreateOrderParams {
  userId: string;
  creditPackId: string;
}

interface CreateOrderResult {
  success: boolean;
  orderId?: string;
  razorpayOrderId?: string;
  amount?: number;
  currency?: string;
  key?: string;
  error?: string;
}

interface VerifyPaymentParams {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  /** Authenticated caller — must own the payment. */
  userId: string;
}

export class PaymentService {
  /**
   * Create a Razorpay order for credit pack purchase (legacy pack catalog).
   * Prefer /api/billing/payments/create-order for PAYG custom quantities.
   */
  static async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const { userId, creditPackId } = params;

    try {
      const creditPack = await PaymentsDAO.getCreditPackById(creditPackId);
      if (!creditPack) {
        return { success: false, error: 'Credit pack not found' };
      }

      const order = await razorpay.orders.create({
        amount: creditPack.priceInr * 100,
        currency: 'INR',
        receipt: `credit_${creditPackId}_${Date.now()}`,
        notes: {
          user_id: userId,
          credit_pack_id: creditPackId,
          credit_type: creditPack.creditType,
          credits: creditPack.credits.toString(),
        },
      });

      const paymentType = creditPack.creditType === 'image' ? 'image_topup' : 'video_topup';
      const payment = await PaymentsDAO.create({
        userId,
        creditPackId,
        razorpayOrderId: order.id,
        amount: creditPack.priceInr,
        currency: 'INR',
        status: 'created',
        paymentType,
        metadata: {
          creditType: creditPack.creditType,
          credits: creditPack.credits,
        },
      });

      return {
        success: true,
        orderId: payment.id,
        razorpayOrderId: order.id,
        amount: creditPack.priceInr * 100,
        currency: 'INR',
        key: RAZORPAY_KEY_ID,
      };
    } catch (error: any) {
      console.error('Error creating order:', error);
      return { success: false, error: error.message || 'Failed to create order' };
    }
  }

  /**
   * Verify Razorpay checkout signature for the authenticated user.
   * May atomically capture + grant via the shared helper if it wins the race
   * against the payment.captured webhook.
   */
  static async verifyPayment(params: VerifyPaymentParams): Promise<{
    success: boolean;
    alreadyCaptured?: boolean;
    creditsPending?: boolean;
    error?: string;
  }> {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, userId } = params;

    try {
      const payment = await PaymentsDAO.getByOrderId(razorpayOrderId);
      if (!payment) {
        return { success: false, error: 'Payment not found' };
      }

      if (payment.userId !== userId) {
        return { success: false, error: 'Payment does not belong to this user' };
      }

      if (payment.status === 'captured') {
        return { success: true, alreadyCaptured: true, creditsPending: false };
      }

      const crypto = await import('crypto');
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (
        generatedSignature.length !== razorpaySignature.length ||
        !crypto.timingSafeEqual(Buffer.from(generatedSignature), Buffer.from(razorpaySignature))
      ) {
        await PaymentsDAO.updateStatus(payment.id, 'failed');
        return { success: false, error: 'Invalid payment signature' };
      }

      // Store signature / payment id without granting credits.
      // Prefer leaving status as created so the webhook performs the sole grant via captureIfCreated.
      // If webhook already raced ahead, we're done.
      const fresh = await PaymentsDAO.getById(payment.id);
      if (fresh?.status === 'captured') {
        return { success: true, alreadyCaptured: true, creditsPending: false };
      }

      // Update payment ids but keep status created — webhook grants.
      // If webhook never arrives, an admin/ops path can capture; for UX we also try capture+grant
      // ONLY through the shared grant helper used by the webhook (see grantCreditsForCapturedPayment).
      // Actually: to avoid "payment succeeded but credits missing if webhook fails",
      // verify may call the shared grant path AFTER captureIfCreated.
      const captured = await PaymentsDAO.captureIfCreated(
        payment.id,
        razorpayPaymentId,
        razorpaySignature
      );

      if (!captured) {
        // Another process (webhook) already captured — credits granted there
        return { success: true, alreadyCaptured: true, creditsPending: false };
      }

      // We won the race — grant exactly once via shared helper
      const { grantCreditsForCapturedPayment } = await import('./credit-grant');
      await grantCreditsForCapturedPayment(captured);

      return { success: true, creditsPending: false };
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      return { success: false, error: error.message || 'Failed to verify payment' };
    }
  }

  static async getCreditPacks(type?: 'image' | 'video') {
    return PaymentsDAO.getCreditPacks(type);
  }

  static async getPaymentHistory(userId: string, limit: number = 50) {
    return PaymentsDAO.getByUserId(userId, limit);
  }
}
