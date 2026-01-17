// pages/api/campaigns/create.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { CampaignDAO } from '@/database';

/**
 * POST /api/campaigns/create
 * Creates a new campaign using Prisma
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, status, data } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Campaign name is required' });
    }

    const campaign = await CampaignDAO.create({
      userId,
      name,
      ...data
    });

    return res.status(201).json({
      success: true,
      data: campaign
    });
  } catch (error: any) {
    console.error('Campaign create error:', error);
    return res.status(500).json({
      error: 'Failed to create campaign',
      message: error.message
    });
  }
}
