// pages/api/campaigns/[id].ts
import type { NextApiRequest, NextApiResponse} from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { CampaignDAO } from '@/database';

/**
 * GET /api/campaigns/[id] - Get a campaign
 * PUT /api/campaigns/[id] - Update a campaign
 * DELETE /api/campaigns/[id] - Delete a campaign
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Campaign ID is required' });
    }

    if (req.method === 'GET') {
      const campaign = await CampaignDAO.getById(id);

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Verify ownership
      if (campaign.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      return res.status(200).json({
        success: true,
        data: campaign
      });
    }

    if (req.method === 'PUT') {
      const { name, status, data } = req.body;

      // Verify ownership
      const existing = await CampaignDAO.getById(id);
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const campaign = await CampaignDAO.update(id, name, status, data);

      return res.status(200).json({
        success: true,
        data: campaign
      });
    }

    if (req.method === 'DELETE') {
      // Verify ownership
      const existing = await CampaignDAO.getById(id);
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const deleted = await CampaignDAO.delete(id);

      return res.status(200).json({
        success: true,
        deleted
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Campaign operation error:', error);
    return res.status(500).json({
      error: 'Campaign operation failed',
      message: error.message
    });
  }
}
