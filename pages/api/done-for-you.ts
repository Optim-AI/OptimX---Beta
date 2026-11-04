import type { NextApiRequest, NextApiResponse } from 'next';
import { getClientIp, hashClientIp } from '@/lib/audit/rate-limit';
import { notifyDfyEnquiry, validateDfyRequest } from '@/lib/contact/done-for-you';
import { isRateLimited } from '@/lib/marketing/rate-limit';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

/**
 * POST /api/done-for-you
 * Emails a "Done for you" enquiry to the support inbox (same path as /api/contact). Stores nothing.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;

  // Honeypot: real visitors never see or fill this field. Pretend success so bots move on.
  if (typeof body.company_url === 'string' && body.company_url.trim()) {
    return res.status(200).json({ ok: true });
  }

  const validated = validateDfyRequest(body);
  if (!validated.ok) {
    return res.status(400).json({ ok: false, error: 'Please fix the highlighted fields.', errors: validated.errors });
  }

  if (isRateLimited(`dfy:${hashClientIp(getClientIp(req))}`)) {
    res.setHeader('Retry-After', '3600');
    return res.status(429).json({ ok: false, error: 'Too many requests from this network. Please try again later.' });
  }

  const sent = await notifyDfyEnquiry(validated.value);
  if (!sent.ok) {
    console.error('[done-for-you] email failed', sent.provider, sent.error);
    return res.status(502).json({ ok: false, error: GENERIC_ERROR });
  }

  console.info('[done-for-you] enquiry emailed via', sent.provider);
  return res.status(200).json({ ok: true });
}
