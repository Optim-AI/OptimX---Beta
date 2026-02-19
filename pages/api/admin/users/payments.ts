// pages/api/admin/users/payments.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminToken } from '@/lib/admin-auth';
import { db } from '@/database/client';
import { payments, plans, subscriptions } from '@/database/schema';
import { eq, desc, and } from 'drizzle-orm';

/**
 * GET /api/admin/users/payments?userId=xxx
 * Get payment history for a specific user (admin only)
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

    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }

    // Get all payments for the user, with plan info
    const userPayments = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        paymentType: payments.paymentType,
        metadata: payments.metadata,
        createdAt: payments.createdAt,
        razorpayPaymentId: payments.razorpayPaymentId,
        // Plan info via subscription
        planName: plans.name,
      })
      .from(payments)
      .leftJoin(subscriptions, eq(payments.subscriptionId, subscriptions.id))
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt));

    const formattedPayments = userPayments.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      paymentType: p.paymentType,
      planName: p.planName || null,
      metadata: p.metadata || null,
      createdAt: p.createdAt,
      razorpayPaymentId: p.razorpayPaymentId || null,
    }));

    return res.status(200).json({
      success: true,
      payments: formattedPayments,
    });
  } catch (error: any) {
    console.error('Admin user payments error:', error);
    return res.status(500).json({
      error: 'Failed to get payments',
      message: error.message,
    });
  }
}
