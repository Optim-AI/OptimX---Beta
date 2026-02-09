// pages/api/features/check.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { FeatureService, FeatureKey } from '@/lib/features';

/**
 * GET /api/features/check?key=feature_key
 * Checks if a specific feature is accessible for the user
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

    const { key } = req.query;
    
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'Feature key is required' });
    }

    const access = await FeatureService.checkFeatureAccess(userId, key as FeatureKey);

    return res.status(200).json({
      success: true,
      featureKey: key,
      ...access,
    });
  } catch (error: any) {
    console.error('Check feature access error:', error);
    return res.status(500).json({
      error: 'Failed to check feature access',
      message: error.message,
    });
  }
}
