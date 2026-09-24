// pages/api/profile/upsert.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { ProfileDAO } from '@/database';
import { CreditsDAO } from '@/database/models/Credits.dao';

const isConnectionError = (err: unknown): boolean => {
  const msg = String(err instanceof Error ? err.message : err);
  return /connection|ECONNREFUSED|ECONNRESET|timeout|ETIMEDOUT/i.test(msg);
};

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < maxAttempts - 1 && isConnectionError(e)) {
        await new Promise((r) => setTimeout(r, 100 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

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

    // Check if this is a new user (with retry for cold-start connection issues)
    const existingProfile = await withRetry(() => ProfileDAO.get(userId));
    const isNewUser = !existingProfile;

    // Upsert profile using Prisma DAO (with retry for cold-start connection issues)
    const profile = await withRetry(() => ProfileDAO.upsert(userId, profileData));

    // New users: initialize empty wallet (0 / 0). Do NOT grant the historical welcome bonus
    // (5 image + 600 video). Existing users who already received welcome_bonus are untouched.
    if (isNewUser) {
      try {
        const initResult = await CreditsDAO.initializeCredits(
          userId,
          0, // No subscription credits
          0 // No subscription video credits
        );

        if (!initResult.success) {
          console.error(`Failed to initialize credits for user ${userId}:`, initResult.error);
        } else {
          console.log(`✓ Initialized empty credit wallet for new user ${userId} (0 image, 0 video)`);
        }
      } catch (creditsError: any) {
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
    const { extractDbError } = await import('@/database/client');
    const dbErr = extractDbError(error);
    console.error('Profile upsert error:', JSON.stringify(dbErr, null, 2));
    if (error?.stack) console.error('Stack:', error.stack);
    return res.status(500).json({
      error: 'Failed to upsert profile',
      message: error?.message ?? String(error),
      dbError: dbErr,
    });
  }
}
