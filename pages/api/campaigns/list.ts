// pages/api/campaigns/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { CampaignDAO } from '@/database';

/**
 * GET /api/campaigns/list
 * Gets all campaigns for the authenticated user
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

    const campaigns = await CampaignDAO.listByUser(userId);

    return res.status(200).json({
      success: true,
      data: campaigns
    });
  } catch (error: any) {
    console.error('Campaign list error:', error);
    return res.status(500).json({
      error: 'Failed to list campaigns',
      message: error.message
    });
  }
}
