// pages/api/billing/plans.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PlansDAO } from '@/database/models/Plans.dao';

/**
 * GET /api/billing/plans
 * Gets all available subscription plans
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { grouped } = req.query;

    if (grouped === 'true') {
      const plans = await PlansDAO.getGroupedPlans();
      return res.status(200).json({
        success: true,
        plans,
      });
    }

    const plans = await PlansDAO.getAll();
    return res.status(200).json({
      success: true,
      plans,
    });
  } catch (error: any) {
    console.error('Get plans error:', error);
    return res.status(500).json({
      error: 'Failed to get plans',
      message: error.message,
    });
  }
}
