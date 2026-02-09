// pages/api/features/access.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { FeatureService } from '@/lib/features';

/**
 * GET /api/features/access
 * Gets all feature access for the current user
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const access = await FeatureService.getUserFeatureAccess(userId);

    return res.status(200).json({
      success: true,
      ...access,
    });
  } catch (error: any) {
    console.error('Get feature access error:', error);
    return res.status(500).json({
      error: 'Failed to get feature access',
      message: error.message,
    });
  }
}
