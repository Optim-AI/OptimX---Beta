// pages/api/billing/webhooks/razorpay.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { WebhookService } from '@/lib/razorpay';

// Disable body parsing - we need the raw body for signature verification
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

  try {
    // Read raw body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks).toString('utf8');

    // Get signature from header
    const signature = req.headers['x-razorpay-signature'] as string;
    
    if (!signature) {
      console.error('Missing Razorpay signature');
      return res.status(401).json({ error: 'Missing signature' });
    }

    // Verify signature
    const isValid = WebhookService.verifySignature(rawBody, signature);
    if (!isValid) {
      console.error('Invalid Razorpay signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse payload
    const payload = JSON.parse(rawBody);
    
    // Generate event ID from payload (Razorpay doesn't always include one)
    const eventId = payload.id || `${payload.event}_${payload.created_at}_${Date.now()}`;

    // Process webhook
    const result = await WebhookService.processWebhook(payload, eventId);

    if (!result.success) {
      console.error('Webhook processing failed:', result.error);
      // Still return 200 to prevent Razorpay from retrying
      return res.status(200).json({ received: true, error: result.error });
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    // Return 200 to prevent Razorpay from retrying on parse errors
    return res.status(200).json({ received: true, error: error.message });
  }
}
