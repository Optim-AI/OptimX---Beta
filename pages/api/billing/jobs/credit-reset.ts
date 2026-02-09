// pages/api/billing/jobs/credit-reset.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { CreditResetJob } from '@/lib/jobs/credit-reset.job';

/**
 * POST /api/billing/jobs/credit-reset
 * Triggers the credit reset job
 * 
 * This endpoint should be called by a cron scheduler (e.g., Vercel Cron, GitHub Actions)
 * Protected by a secret key in production
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify cron secret in production
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret = req.headers['x-cron-secret'] || req.query.secret;

    if (cronSecret && providedSecret !== cronSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[API] Starting credit reset job...');
    const result = await CreditResetJob.run();

    return res.status(200).json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('Credit reset job error:', error);
    return res.status(500).json({
      error: 'Job failed',
      message: error.message,
    });
  }
}
