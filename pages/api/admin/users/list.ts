// pages/api/admin/users/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminToken } from '@/lib/admin-auth';
import { db } from '@/database/client';
import { profiles, subscriptions, userCredits, plans } from '@/database/schema';
import { eq, desc, sql } from 'drizzle-orm';

/**
 * GET /api/admin/users/list
 * Get all users with their plan and credit info (admin only)
 * Supports pagination via ?page=1&limit=50
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - no token provided' });
    }

    const { valid } = verifyAdminToken(token);
    if (!valid) {
      return res.status(401).json({ error: 'Unauthorized - invalid token' });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    // Get all profiles with subscription and credit info via left joins
    const users = await db
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        email: profiles.email,
        businessName: profiles.businessName,
        createdAt: profiles.insertedAt,
        // Subscription info
        planName: plans.name,
        planId: subscriptions.planId,
        subscriptionStatus: subscriptions.status,
        // Credit info
        imageCreditsSubscription: userCredits.imageCreditsSubscription,
        imageCreditsAddon: userCredits.imageCreditsAddon,
        videoCreditsSubscription: userCredits.videoCreditsSubscription,
        videoCreditsAddon: userCredits.videoCreditsAddon,
      })
      .from(profiles)
      .leftJoin(subscriptions, eq(profiles.id, subscriptions.userId))
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .leftJoin(userCredits, eq(profiles.id, userCredits.id))
      .orderBy(desc(profiles.insertedAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(profiles);
    const totalCount = Number(countResult[0]?.count ?? 0);

    const formattedUsers = users.map((u) => ({
      id: u.id,
      fullName: u.fullName || null,
      email: u.email || null,
      businessName: u.businessName || null,
      createdAt: u.createdAt || null,
      plan: u.planName || 'Pay-as-you-go',
      subscriptionStatus: u.subscriptionStatus || null,
      imageCredits: (u.imageCreditsSubscription ?? 0) + (u.imageCreditsAddon ?? 0),
      videoCredits: (u.videoCreditsSubscription ?? 0) + (u.videoCreditsAddon ?? 0),
    }));

    return res.status(200).json({
      success: true,
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    console.error('Admin users list error:', error);
    return res.status(500).json({
      error: 'Failed to get users',
      message: error.message,
    });
  }
}
