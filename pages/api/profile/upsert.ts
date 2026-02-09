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

      try {
        // Initialize credit record
        const initResult = await CreditsDAO.initializeCredits(
          userId,
          0, // No subscription credits
          0  // No subscription video credits
        );

        if (!initResult.success) {
          console.error(`Failed to initialize credits for user ${userId}:`, initResult.error);
        }

        // Add welcome bonus as addon credits (these don't expire)
        const imageResult = await CreditsDAO.addImageCreditsAddon(userId, INITIAL_IMAGE_CREDITS);
        if (!imageResult.success) {
          console.error(`Failed to add image credits for user ${userId}:`, imageResult.error);
        }

        const videoResult = await CreditsDAO.addVideoCreditsAddon(userId, INITIAL_VIDEO_SECONDS);
        if (!videoResult.success) {
          console.error(`Failed to add video credits for user ${userId}:`, videoResult.error);
        }

        if (initResult.success && imageResult.success && videoResult.success) {
          console.log(`✓ Initialized welcome credits for new user ${userId}: ${INITIAL_IMAGE_CREDITS} image credits, ${INITIAL_VIDEO_SECONDS}s video`);
        } else {
          console.warn(`⚠ Partial credit initialization for user ${userId}. Init: ${initResult.success}, Image: ${imageResult.success}, Video: ${videoResult.success}`);
        }
      } catch (creditsError: any) {
        // Don't fail the signup if credits fail, but log it prominently
        console.error(`❌ CREDITS INITIALIZATION ERROR for user ${userId}:`, creditsError);
        console.error('Stack:', creditsError.stack);
      }
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
