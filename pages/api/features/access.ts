// pages/api/features/access.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { FeatureService } from '@/lib/features';
import { extractDbError } from '@/database/client';

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
    const dbErr = extractDbError(error);
    console.error('Get feature access error:', JSON.stringify(dbErr, null, 2));
    console.error('Full error stack:', error.stack);
    return res.status(500).json({
      error: 'Failed to get feature access',
      message: error.message,
      dbError: dbErr,
    });
  }
}
