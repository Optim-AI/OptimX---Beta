// pages/api/admin/plans/toggle-single.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminToken } from '@/lib/admin-auth';
import { PlansDAO } from '@/database/models/Plans.dao';

/**
 * POST /api/admin/plans/toggle-single
 * Toggle a single plan on/off (admin only)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
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

    // Get planId and isActive
    const { planId, isActive } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    // Toggle the plan
    const updatedPlan = await PlansDAO.togglePlan(planId, isActive);

    if (!updatedPlan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Get updated status
    const hasActivePlans = await PlansDAO.hasActivePlans();

    return res.status(200).json({
      success: true,
      plan: updatedPlan,
      plansEnabled: hasActivePlans,
      message: `Successfully ${isActive ? 'enabled' : 'disabled'} plan: ${updatedPlan.name}`,
    });
  } catch (error: any) {
    console.error('Toggle plan error:', error);
    return res.status(500).json({
      error: 'Failed to toggle plan',
      message: error.message,
    });
  }
}
