import type { NextApiRequest, NextApiResponse } from 'next';
import { getClientIp, hashClientIp } from '@/lib/audit/rate-limit';
import { validateFreeAdRequest } from '@/lib/free-ad/validate';
import { notifyFreeAdRequest } from '@/lib/free-ad/notify';
import { SITE_SUPPORT_EMAIL } from '@/lib/seo/site';

/**
 * POST /api/free-ad
 * Emails a free-ad request to the founder inbox. Stores nothing.
 * Rate limiting is best-effort and per server instance (no database by design).
 */
const WINDOW_MS = 3600_000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (recent.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(key, hits);
    return true;
  }
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 5000) recent.clear();
  return false;
}

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

  const validated = validateFreeAdRequest(body);
  if (!validated.ok) {
    return res.status(400).json({ ok: false, error: 'Please fix the highlighted fields.', errors: validated.errors });
  }

  if (rateLimited(hashClientIp(getClientIp(req)))) {
    res.setHeader('Retry-After', '3600');
    return res.status(429).json({
      ok: false,
      error: `Too many requests from this network. Please try again later or email ${SITE_SUPPORT_EMAIL}.`,
    });
  }

  const sent = await notifyFreeAdRequest(validated.value);
  if (!sent.ok) {
    console.error('[free-ad] email failed', sent.provider, sent.error);
    return res.status(502).json({
      ok: false,
      error: `We couldn't send your request. Please try again, or email ${SITE_SUPPORT_EMAIL}.`,
    });
  }

  console.info('[free-ad] request emailed via', sent.provider);
  return res.status(200).json({ ok: true });
}
