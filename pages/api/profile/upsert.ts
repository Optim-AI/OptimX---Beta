// pages/api/profile/upsert.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { ProfileDAO } from '@/database';

/**
 * POST /api/profile/upsert
 * Upserts user profile data using Prisma (replaces supabase.from("profiles").upsert)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user ID from session token
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - no valid session' });
    }

    // Get profile data from request body
    const profileData = req.body || {};

    // Upsert profile using Prisma DAO
    const profile = await ProfileDAO.upsert(userId, profileData);

    return res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error: any) {
    console.error('Profile upsert error:', error);
    return res.status(500).json({
      error: 'Failed to upsert profile',
      message: error.message
    });
  }
}
