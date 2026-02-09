// pages/api/admin/plans/update.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminToken } from '@/lib/admin-auth';
import { PlansDAO } from '@/database/models/Plans.dao';

/**
 * POST /api/admin/plans/update
 * Update plan details (admin only)
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

    // Get plan data
    const { planId, ...updateData } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    // Validate update data
    const allowedFields = ['name', 'description', 'priceInr', 'imageCredits', 'videoCredits', 'displayOrder'];
    const invalidFields = Object.keys(updateData).filter(key => !allowedFields.includes(key));

    if (invalidFields.length > 0) {
      return res.status(400).json({
        error: `Invalid fields: ${invalidFields.join(', ')}. Allowed fields: ${allowedFields.join(', ')}`
      });
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No update data provided' });
    }

    // Update the plan
    const updatedPlan = await PlansDAO.updatePlan(planId, updateData);

    if (!updatedPlan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    return res.status(200).json({
      success: true,
      plan: updatedPlan,
      message: `Successfully updated plan: ${updatedPlan.name}`,
    });
  } catch (error: any) {
    console.error('Update plan error:', error);
    return res.status(500).json({
      error: 'Failed to update plan',
      message: error.message,
    });
  }
}
