// pages/api/admin/plans/status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminToken } from '@/lib/admin-auth';
import { PlansDAO } from '@/database/models/Plans.dao';
import { db } from '@/database/client';
import { plans } from '@/database/schema';

/**
 * GET /api/admin/plans/status
 * Get detailed plan system status (admin only)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check admin token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - no token provided' });
    }

    const { valid } = verifyAdminToken(token);
    if (!valid) {
      return res.status(401).json({ error: 'Unauthorized - invalid token' });
    }

    // Get all plans (including inactive ones for admin view)
    const allPlans = await db.select().from(plans);
    const hasActivePlans = await PlansDAO.hasActivePlans();
    const activePlans = await PlansDAO.getAll();

    // Get plan statistics
    const totalPlans = allPlans.length;
    const activePlanCount = activePlans.length;
    const inactivePlanCount = totalPlans - activePlanCount;

    return res.status(200).json({
      success: true,
      plansEnabled: hasActivePlans,
      statistics: {
        total: totalPlans,
        active: activePlanCount,
        inactive: inactivePlanCount,
      },
      plans: allPlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        billingCycle: plan.billingCycle,
        priceInr: plan.priceInr,
        imageCredits: plan.imageCredits,
        videoCredits: plan.videoCredits,
        isActive: plan.isActive,
        displayOrder: plan.displayOrder,
      })),
    });
  } catch (error: any) {
    console.error('Get plans status error:', error);
    return res.status(500).json({
      error: 'Failed to get plans status',
      message: error.message,
    });
  }
}
