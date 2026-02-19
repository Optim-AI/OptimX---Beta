// pages/api/profile/get.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { ProfileDAO } from '@/database';

/**
 * GET /api/profile/get
 * Gets user profile data using Prisma (replaces supabase.from("profiles").select)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user ID from session token
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - no valid session' });
    }

    // Get profile using Prisma DAO
    const profile = await ProfileDAO.get(userId);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    return res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error: any) {
    const { extractDbError } = await import('@/database/client');
    const dbErr = extractDbError(error);
    console.error('Profile get error:', JSON.stringify(dbErr, null, 2));
    console.error('Full error stack:', error.stack);
    return res.status(500).json({
      error: 'Failed to get profile',
      message: error.message,
      dbError: dbErr,
    });
  }
}
