// pages/api/images/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { GeneratedImageDAO } from '@/database';

/**
 * GET /api/images/list?limit=50
 * Gets user's generated images
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

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const images = await GeneratedImageDAO.getByUser(userId, limit);

    return res.status(200).json({
      success: true,
      data: images
    });
  } catch (error: any) {
    const { extractDbError } = await import('@/database/client');
    const dbErr = extractDbError(error);
    console.error('Images list error:', JSON.stringify(dbErr, null, 2));
    console.error('Full error stack:', error.stack);
    return res.status(500).json({
      error: 'Failed to list images',
      message: error.message,
      dbError: dbErr,
    });
  }
}
