// database/models/Payments.dao.ts
import { db } from '../client';
import { payments, webhookEvents, creditPacks } from '@/database/schema';
import { eq, and, desc } from 'drizzle-orm';

// Type inference from Drizzle schema
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type CreditPack = typeof creditPacks.$inferSelect;

/**
 * Data Access Object for Payments operations
 */
export class PaymentsDAO {
  /**
   * Create a new payment record
   */
  static async create(data: NewPayment): Promise<Payment> {
    const [result] = await db
      .insert(payments)
      .values(data)
      .returning();
    return result;
  }

  /**
   * Get payment by ID
   */
  static async getById(id: string): Promise<Payment | null> {
    const result = await db
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1);
    return result[0] || null;
  }

  /**
   * Get payment by Razorpay payment ID
   */
  static async getByRazorpayId(razorpayPaymentId: string): Promise<Payment | null> {
    const result = await db
      .select()
      .from(payments)
      .where(eq(payments.razorpayPaymentId, razorpayPaymentId))
      .limit(1);
    return result[0] || null;
  }

  /**
   * Get payment by Razorpay order ID
   */
  static async getByOrderId(razorpayOrderId: string): Promise<Payment | null> {
    const result = await db
      .select()
      .from(payments)
      .where(eq(payments.razorpayOrderId, razorpayOrderId))
      .limit(1);
    return result[0] || null;
  }

  /**
   * Update payment status
   */
  static async updateStatus(
    id: string, 
    status: string, 
    razorpayPaymentId?: string,
    razorpaySignature?: string
  ): Promise<Payment | null> {
    const [updated] = await db
      .update(payments)
      .set({ 
        status,
        ...(razorpayPaymentId ? { razorpayPaymentId } : {}),
        ...(razorpaySignature ? { razorpaySignature } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(payments.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Get payment history for a user
   */
  static async getByUserId(userId: string, limit: number = 50): Promise<Payment[]> {
    return db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt))
      .limit(limit);
  }

  /**
   * Get all credit packs
   */
  static async getCreditPacks(creditType?: 'image' | 'video'): Promise<CreditPack[]> {
    if (creditType) {
      return db
        .select()
        .from(creditPacks)
        .where(and(
          eq(creditPacks.isActive, true),
          eq(creditPacks.creditType, creditType)
        ))
        .orderBy(creditPacks.displayOrder);
    }
    return db
      .select()
      .from(creditPacks)
      .where(eq(creditPacks.isActive, true))
      .orderBy(creditPacks.displayOrder);
  }

  /**
   * Get credit pack by ID
   */
  static async getCreditPackById(id: string): Promise<CreditPack | null> {
    const result = await db
      .select()
      .from(creditPacks)
      .where(eq(creditPacks.id, id))
      .limit(1);
    return result[0] || null;
  }
}

/**
 * Data Access Object for Webhook Events (idempotency)
 */
export class WebhookEventsDAO {
  /**
   * Check if event already processed
   */
  static async exists(razorpayEventId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.razorpayEventId, razorpayEventId))
      .limit(1);
    return result.length > 0;
  }

  /**
   * Create webhook event record
   */
  static async create(
    razorpayEventId: string,
    eventType: string,
    payload: any
  ): Promise<WebhookEvent> {
    const [result] = await db
      .insert(webhookEvents)
      .values({
        razorpayEventId,
        eventType,
        payload,
        status: 'pending',
      })
      .returning();
    return result;
  }

  /**
   * Mark event as processed
   */
  static async markProcessed(id: string): Promise<WebhookEvent | null> {
    const [updated] = await db
      .update(webhookEvents)
      .set({ 
        status: 'processed',
        processedAt: new Date().toISOString(),
      })
      .where(eq(webhookEvents.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Mark event as failed
   */
  static async markFailed(id: string, errorMessage: string): Promise<WebhookEvent | null> {
    const [updated] = await db
      .update(webhookEvents)
      .set({ 
        status: 'failed',
        errorMessage,
        processedAt: new Date().toISOString(),
      })
      .where(eq(webhookEvents.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Get event by Razorpay event ID
   */
  static async getByRazorpayId(razorpayEventId: string): Promise<WebhookEvent | null> {
    const result = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.razorpayEventId, razorpayEventId))
      .limit(1);
    return result[0] || null;
  }
}
