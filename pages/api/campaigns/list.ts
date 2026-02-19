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
    const { extractDbError } = await import('@/database/client');
    const dbErr = extractDbError(error);
    console.error('Campaign list error:', JSON.stringify(dbErr, null, 2));
    console.error('Full error stack:', error.stack);
    return res.status(500).json({
      error: 'Failed to list campaigns',
      message: error.message,
      dbError: dbErr,
    });
  }
}
