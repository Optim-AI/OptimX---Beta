// pages/api/billing/plans/status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PlansDAO } from '@/database/models/Plans.dao';

/**
 * GET /api/billing/plans/status
 * Check if the plan system is enabled (any active plans exist)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const plansEnabled = await PlansDAO.hasActivePlans();

    return res.status(200).json({
      success: true,
      plansEnabled,
    });
  } catch (error: any) {
    console.error('Plans status check error:', error);
    return res.status(500).json({
      error: 'Failed to check plans status',
      message: error.message,
    });
  }
}
