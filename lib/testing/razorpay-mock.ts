// lib/testing/razorpay-mock.ts
// Mock utilities for testing Razorpay integration locally
// DEVELOPMENT ONLY - Do not use in production

import crypto from 'crypto';

function assertNotProduction() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Razorpay mock utilities cannot be used in production');
  }
}

/**
 * Generate a mock Razorpay signature for webhook testing
 */
export function generateMockSignature(payload: string, secret: string = 'test_webhook_secret'): string {
  assertNotProduction();
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Generate a mock Razorpay ID
 */
export function generateMockId(prefix: string): string {
  const random = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${random}`;
}

/**
 * Mock Razorpay event payloads
 */
export const MockPayloads = {
  /**
   * Generate payment.captured event payload
   */
  paymentCaptured(options: {
    orderId: string;
    amount: number;
    userId: string;
    creditPackId?: string;
  }) {
    const paymentId = generateMockId('pay');
    return {
      entity: 'event',
      account_id: 'acc_test123',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: paymentId,
            entity: 'payment',
            amount: options.amount * 100, // Razorpay uses paise
            currency: 'INR',
            status: 'captured',
            order_id: options.orderId,
            method: 'card',
            captured: true,
            description: 'Credit pack purchase',
            notes: {
              user_id: options.userId,
              credit_pack_id: options.creditPackId || '',
            },
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };
  },

  /**
   * Generate subscription.activated event payload
   */
  subscriptionActivated(options: {
    subscriptionId: string;
    razorpaySubscriptionId?: string;
    planId: string;
    userId: string;
  }) {
    const rzpSubId = options.razorpaySubscriptionId || generateMockId('sub');
    const customerId = generateMockId('cust');
    return {
      entity: 'event',
      account_id: 'acc_test123',
      event: 'subscription.activated',
      contains: ['subscription'],
      payload: {
        subscription: {
          entity: {
            id: rzpSubId,
            entity: 'subscription',
            plan_id: generateMockId('plan'),
            status: 'active',
            current_start: Math.floor(Date.now() / 1000),
            current_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
            customer_id: customerId,
            notes: {
              user_id: options.userId,
              subscription_id: options.subscriptionId,
              plan_name: options.planId,
            },
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };
  },

  /**
   * Generate subscription.charged event payload (renewal)
   */
  subscriptionCharged(options: {
    razorpaySubscriptionId: string;
    amount: number;
    userId: string;
  }) {
    const paymentId = generateMockId('pay');
    const orderId = generateMockId('order');
    return {
      entity: 'event',
      account_id: 'acc_test123',
      event: 'subscription.charged',
      contains: ['subscription', 'payment'],
      payload: {
        subscription: {
          entity: {
            id: options.razorpaySubscriptionId,
            entity: 'subscription',
            status: 'active',
            current_start: Math.floor(Date.now() / 1000),
            current_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            notes: {
              user_id: options.userId,
            },
          },
        },
        payment: {
          entity: {
            id: paymentId,
            entity: 'payment',
            amount: options.amount * 100,
            currency: 'INR',
            status: 'captured',
            order_id: orderId,
            notes: {},
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };
  },

  /**
   * Generate subscription.cancelled event payload
   */
  subscriptionCancelled(options: {
    razorpaySubscriptionId: string;
    userId: string;
  }) {
    return {
      entity: 'event',
      account_id: 'acc_test123',
      event: 'subscription.cancelled',
      contains: ['subscription'],
      payload: {
        subscription: {
          entity: {
            id: options.razorpaySubscriptionId,
            entity: 'subscription',
            status: 'cancelled',
            cancelled_at: Math.floor(Date.now() / 1000),
            notes: {
              user_id: options.userId,
            },
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };
  },

  /**
   * Generate payment.failed event payload
   */
  paymentFailed(options: {
    orderId: string;
    amount: number;
    errorCode?: string;
    errorDescription?: string;
  }) {
    const paymentId = generateMockId('pay');
    return {
      entity: 'event',
      account_id: 'acc_test123',
      event: 'payment.failed',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: paymentId,
            entity: 'payment',
            amount: options.amount * 100,
            currency: 'INR',
            status: 'failed',
            order_id: options.orderId,
            error_code: options.errorCode || 'BAD_REQUEST_ERROR',
            error_description: options.errorDescription || 'Payment failed',
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };
  },
};

/**
 * Send a mock webhook to the local server
 */
export async function sendMockWebhook(
  payload: any,
  baseUrl: string = 'http://localhost:3000'
): Promise<{ success: boolean; response?: any; error?: string }> {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret';
  const body = JSON.stringify(payload);
  const signature = generateMockSignature(body, webhookSecret);

  try {
    const response = await fetch(`${baseUrl}/api/billing/webhooks/razorpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Razorpay-Signature': signature,
      },
      body,
    });

    const data = await response.json();
    return { success: response.ok, response: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
