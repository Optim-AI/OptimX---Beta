// pages/api/admin/plans/toggle.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminToken } from '@/lib/admin-auth';
import { PlansDAO } from '@/database/models/Plans.dao';

/**
 * POST /api/admin/plans/toggle
 * Toggle all plans on/off (admin only)
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

    // Get enable/disable action
    const { enable } = req.body;
    if (typeof enable !== 'boolean') {
      return res.status(400).json({ error: 'enable must be a boolean' });
    }

    // Toggle all plans
    const updatedCount = await PlansDAO.toggleAllPlans(enable);

    // Get updated status
    const hasActivePlans = await PlansDAO.hasActivePlans();
    const allPlans = await PlansDAO.getAll();

    return res.status(200).json({
      success: true,
      updatedCount,
      plansEnabled: hasActivePlans,
      activePlans: allPlans,
      message: `Successfully ${enable ? 'enabled' : 'disabled'} ${updatedCount} plan(s)`,
    });
  } catch (error: any) {
    console.error('Toggle plans error:', error);
    return res.status(500).json({
      error: 'Failed to toggle plans',
      message: error.message,
    });
  }
}
