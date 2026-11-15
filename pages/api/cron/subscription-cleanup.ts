// GET /api/cron/subscription-cleanup — hourly (vercel.json).
// Closes out subscriptions that were cancelled by the customer and have reached the end of
// their paid period, in case Razorpay's webhook was missed. Grants and removes no credits.
import type { NextApiRequest, NextApiResponse } from 'next';
import { isCronRequest } from '@/lib/jobs/cron-auth';
import { CreditResetJob } from '@/lib/jobs/credit-reset.job';

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isCronRequest(req)) return res.status(401).json({ error: 'unauthorized' });
  try {
    const result = await CreditResetJob.finalizePeriodEndCancellations();
    if (result.finalized || result.failed) console.log('[cron] subscription-cleanup', result);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron] subscription-cleanup failed', (error as Error)?.message);
    return res.status(500).json({ ok: false });
  }
}
