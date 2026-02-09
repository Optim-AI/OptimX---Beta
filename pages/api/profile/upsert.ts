// pages/api/profile/upsert.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { ProfileDAO } from '@/database';
import { CreditsDAO } from '@/database/models/Credits.dao';

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

    // Check if this is a new user
    const existingProfile = await ProfileDAO.get(userId);
    const isNewUser = !existingProfile;

    // Upsert profile using Prisma DAO
    const profile = await ProfileDAO.upsert(userId, profileData);

    // Initialize free credits for new users (pay-as-you-go welcome bonus)
    if (isNewUser) {
      const INITIAL_IMAGE_CREDITS = 10;
      const INITIAL_VIDEO_SECONDS = 30;

      await CreditsDAO.initializeCredits(
        userId,
        0, // No subscription credits
        0  // No subscription video credits
      );

      // Add welcome bonus as addon credits (these don't expire)
      await CreditsDAO.addImageCreditsAddon(userId, INITIAL_IMAGE_CREDITS);
      await CreditsDAO.addVideoCreditsAddon(userId, INITIAL_VIDEO_SECONDS);

      console.log(`Initialized welcome credits for new user ${userId}: ${INITIAL_IMAGE_CREDITS} image credits, ${INITIAL_VIDEO_SECONDS}s video`);
    }

    return res.status(200).json({
      success: true,
      data: profile,
      isNewUser
    });
  } catch (error: any) {
    console.error('Profile upsert error:', error);
    return res.status(500).json({
      error: 'Failed to upsert profile',
      message: error.message
    });
  }
}
