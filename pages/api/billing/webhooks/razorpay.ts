// pages/api/billing/webhooks/razorpay.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { WebhookService, RAZORPAY_WEBHOOK_SECRET } from '@/lib/razorpay';

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * POST /api/billing/webhooks/razorpay
 * Handles Razorpay webhook events
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const hasSecret = RAZORPAY_WEBHOOK_SECRET && RAZORPAY_WEBHOOK_SECRET.trim();
  if (!hasSecret) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Razorpay webhook: running without signature verification (development only)');
    } else {
      console.error('Razorpay webhook: RAZORPAY_WEBHOOK_SECRET not set');
      return res.status(503).json({ error: 'Webhook not configured' });
    }
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks).toString('utf8');

    const signature = req.headers['x-razorpay-signature'] as string;

    if (!signature) {
      console.error('Missing Razorpay signature');
      return res.status(401).json({ error: 'Missing signature' });
    }

    const isValid = WebhookService.verifySignature(rawBody, signature);
    if (!isValid) {
      console.error('Invalid Razorpay signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(rawBody);

    const eventId = WebhookService.resolveEventId(
      payload,
      req.headers['x-razorpay-event-id']
    );
    if (!eventId) {
      console.error('Unable to resolve stable Razorpay event id');
      return res.status(400).json({ error: 'Missing event id' });
    }

    const result = await WebhookService.processWebhook(payload, eventId);

    if (!result.success) {
      console.error('Webhook processing failed:', result.error);
      // Still return 200 to prevent infinite Razorpay retries for logic errors
      return res.status(200).json({ received: true, error: result.error });
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    if (error instanceof SyntaxError) {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    return res.status(200).json({ received: true });
  }
}
