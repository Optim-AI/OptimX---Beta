import type { NextApiRequest, NextApiResponse } from 'next';
import { getClientIp, hashClientIp } from '@/lib/audit/rate-limit';
import { validateContactRequest } from '@/lib/contact/validate';
import { notifyContactMessage } from '@/lib/contact/notify';
import { isRateLimited } from '@/lib/marketing/rate-limit';
import { SITE_SUPPORT_EMAIL } from '@/lib/seo/site';

/**
 * POST /api/contact
 * Emails a /Contact message to the support inbox. Stores nothing.
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

  const validated = validateContactRequest(body);
  if (!validated.ok) {
    return res.status(400).json({ ok: false, error: 'Please fix the highlighted fields.', errors: validated.errors });
  }

  if (isRateLimited(`contact:${hashClientIp(getClientIp(req))}`)) {
    res.setHeader('Retry-After', '3600');
    return res.status(429).json({
      ok: false,
      error: `Too many messages from this network. Please try again later or email ${SITE_SUPPORT_EMAIL}.`,
    });
  }

  const sent = await notifyContactMessage(validated.value);
  if (!sent.ok) {
    console.error('[contact] email failed', sent.provider, sent.error);
    return res.status(502).json({
      ok: false,
      error: `We couldn't send your message. Please try again, or email ${SITE_SUPPORT_EMAIL}.`,
    });
  }

  console.info('[contact] message emailed via', sent.provider);
  return res.status(200).json({ ok: true });
}
