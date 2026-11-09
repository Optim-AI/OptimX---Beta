/** Vercel Cron calls our cron routes with "Authorization: Bearer <CRON_SECRET>". Anyone else is refused. */
import type { NextApiRequest } from 'next';
import { timingSafeEqual } from 'crypto';

export function isCronRequest(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false; // never run open: set CRON_SECRET in Vercel
  const got = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
