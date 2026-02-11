// lib/razorpay/client.ts
// Razorpay SDK Client Singleton

import Razorpay from 'razorpay';

const globalForRazorpay = globalThis as unknown as {
  razorpay: Razorpay | undefined;
};

/** Placeholder values that mean "not configured yet" */
const PLACEHOLDER_MARKERS = ['placeholder', 'your_key', 'your_secret', 'here'];

/**
 * Returns true only when Razorpay API keys are set and not placeholders.
 * Use this in API routes before calling Razorpay so we return a clear error
 * instead of failing with an API error.
 */
export function isRazorpayConfigured(): boolean {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!keyId || !keySecret) return false;
  const lower = `${keyId} ${keySecret}`.toLowerCase();
  if (PLACEHOLDER_MARKERS.some((m) => lower.includes(m))) return false;
  // Real test keys start with rzp_test_, live with rzp_live_
  if (keyId.startsWith('rzp_test_') || keyId.startsWith('rzp_live_')) return true;
  return false;
}

function createRazorpayClient(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in environment variables');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

export const razorpay = globalForRazorpay.razorpay ?? createRazorpayClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRazorpay.razorpay = razorpay;
}

export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
export const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
