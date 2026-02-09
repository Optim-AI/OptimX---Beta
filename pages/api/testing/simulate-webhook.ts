// pages/api/testing/simulate-webhook.ts
// API route to simulate Razorpay webhooks for local testing
// DEVELOPMENT ONLY

import type { NextApiRequest, NextApiResponse } from 'next';
import { MockPayloads, sendMockWebhook, generateMockId } from '@/lib/testing/razorpay-mock';
import { PaymentsDAO } from '@/database/models/Payments.dao';
import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';

// Block in production
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CRITICAL: Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This endpoint is only available in development mode' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { event, data } = req.body;

    if (!event) {
      return res.status(400).json({ 
        error: 'Missing event type',
        availableEvents: [
          'payment.captured',
          'subscription.activated',
          'subscription.charged',
          'subscription.cancelled',
          'payment.failed',
        ],
      });
    }

    let payload: any;

    switch (event) {
      case 'payment.captured': {
        // For credit pack purchase simulation
        const { orderId, userId, amount = 199, creditPackId = 'image_10' } = data || {};
        
        // If no orderId provided, create a test payment first
        let testOrderId = orderId;
        if (!orderId && userId) {
          const payment = await PaymentsDAO.create({
            userId,
            creditPackId,
            razorpayOrderId: generateMockId('order'),
            amount,
            currency: 'INR',
            status: 'created',
            paymentType: creditPackId?.startsWith('video') ? 'video_topup' : 'image_topup',
            metadata: {
              creditType: creditPackId?.startsWith('video') ? 'video' : 'image',
              credits: creditPackId === 'image_10' ? 10 : creditPackId === 'image_25' ? 25 : 30,
            },
          });
          testOrderId = payment.razorpayOrderId;
        }

        if (!testOrderId) {
          return res.status(400).json({ error: 'orderId or userId is required' });
        }

        payload = MockPayloads.paymentCaptured({
          orderId: testOrderId!,
          amount,
          userId: userId || 'test-user',
          creditPackId,
        });
        break;
      }

      case 'subscription.activated': {
        const { subscriptionId, userId, planId = 'starter_monthly' } = data || {};
        
        if (!subscriptionId) {
          return res.status(400).json({ error: 'subscriptionId is required' });
        }

        // Get subscription to get razorpay ID
        const subscription = await SubscriptionsDAO.getById(subscriptionId);
        
        payload = MockPayloads.subscriptionActivated({
          subscriptionId,
          razorpaySubscriptionId: subscription?.razorpaySubscriptionId || generateMockId('sub'),
          planId,
          userId: userId || subscription?.userId || 'test-user',
        });
        break;
      }

      case 'subscription.charged': {
        const { razorpaySubscriptionId, userId, amount = 1499 } = data || {};
        
        if (!razorpaySubscriptionId) {
          return res.status(400).json({ error: 'razorpaySubscriptionId is required' });
        }

        payload = MockPayloads.subscriptionCharged({
          razorpaySubscriptionId,
          amount,
          userId: userId || 'test-user',
        });
        break;
      }

      case 'subscription.cancelled': {
        const { razorpaySubscriptionId, userId } = data || {};
        
        if (!razorpaySubscriptionId) {
          return res.status(400).json({ error: 'razorpaySubscriptionId is required' });
        }

        payload = MockPayloads.subscriptionCancelled({
          razorpaySubscriptionId,
          userId: userId || 'test-user',
        });
        break;
      }

      case 'payment.failed': {
        const { orderId, amount = 199 } = data || {};
        
        if (!orderId) {
          return res.status(400).json({ error: 'orderId is required' });
        }

        payload = MockPayloads.paymentFailed({
          orderId,
          amount,
        });
        break;
      }

      default:
        return res.status(400).json({ 
          error: `Unknown event type: ${event}`,
          availableEvents: [
            'payment.captured',
            'subscription.activated', 
            'subscription.charged',
            'subscription.cancelled',
            'payment.failed',
          ],
        });
    }

    // Send the mock webhook to our own server
    const result = await sendMockWebhook(payload);

    return res.status(200).json({
      success: true,
      event,
      payload,
      webhookResult: result,
    });
  } catch (error: any) {
    console.error('Simulate webhook error:', error);
    return res.status(500).json({
      error: 'Failed to simulate webhook',
      message: error.message,
    });
  }
}
