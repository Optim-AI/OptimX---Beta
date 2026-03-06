// lib/razorpay/payment.service.ts
// Service for managing one-time payments (credit top-ups)

import { razorpay, RAZORPAY_KEY_ID } from './client';
import { PaymentsDAO } from '@/database/models/Payments.dao';
import { CreditsDAO } from '@/database/models/Credits.dao';

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
}

export class PaymentService {
  /**
   * Create a Razorpay order for credit pack purchase
   */
  static async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const { userId, creditPackId } = params;

    try {
      // Get credit pack details
      const creditPack = await PaymentsDAO.getCreditPackById(creditPackId);
      if (!creditPack) {
        return { success: false, error: 'Credit pack not found' };
      }

      // Create Razorpay order
      const order = await razorpay.orders.create({
        amount: creditPack.priceInr * 100, // Razorpay uses paise
        currency: 'INR',
        receipt: `credit_${creditPackId}_${Date.now()}`,
        notes: {
          user_id: userId,
          credit_pack_id: creditPackId,
          credit_type: creditPack.creditType,
          credits: creditPack.credits.toString(),
        },
      });

      // Create payment record
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
   * Verify payment and add credits
   */
  static async verifyPayment(params: VerifyPaymentParams): Promise<{ success: boolean; error?: string }> {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;

    try {
      // Get payment record
      const payment = await PaymentsDAO.getByOrderId(razorpayOrderId);
      if (!payment) {
        return { success: false, error: 'Payment not found' };
      }

      // Already processed
      if (payment.status === 'captured') {
        return { success: true };
      }

      // Verify signature
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

      // Update payment status — credits are granted by the webhook handler to avoid double-granting
      await PaymentsDAO.updateStatus(payment.id, 'captured', razorpayPaymentId, razorpaySignature);

      return { success: true };
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      return { success: false, error: error.message || 'Failed to verify payment' };
    }
  }

  /**
   * Get available credit packs
   */
  static async getCreditPacks(type?: 'image' | 'video') {
    return PaymentsDAO.getCreditPacks(type);
  }

  /**
   * Get payment history for a user
   */
  static async getPaymentHistory(userId: string, limit: number = 50) {
    return PaymentsDAO.getByUserId(userId, limit);
  }
}
