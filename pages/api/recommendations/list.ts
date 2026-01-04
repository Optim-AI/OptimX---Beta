// pages/api/recommendations/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { RecommendationDAO } from '@/database';

/**
 * GET /api/recommendations/list?status=pending&campaignId=xxx
 * Gets recommendations for user
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

    const { status, campaignId } = req.query;

    const recommendations = await RecommendationDAO.listByUser(
      userId,
      status as string | undefined,
      campaignId as string | undefined
    );

    return res.status(200).json({
      success: true,
      data: recommendations
    });
  } catch (error: any) {
    console.error('Recommendations list error:', error);
    return res.status(500).json({
      error: 'Failed to list recommendations',
      message: error.message
    });
  }
}
