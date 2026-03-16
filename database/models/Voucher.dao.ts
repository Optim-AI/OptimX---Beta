// database/models/Voucher.dao.ts
import { db } from '../client';
import { vouchers, profiles } from '@/database/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

// Type inference from Drizzle schema
export type Voucher = typeof vouchers.$inferSelect;
export type NewVoucher = typeof vouchers.$inferInsert;

export class VoucherDAO {
  /**
   * Create a new voucher
   */
  static async create(data: NewVoucher): Promise<Voucher> {
    const [result] = await db
      .insert(vouchers)
      .values(data)
      .returning();
    return result;
  }

  /**
   * Get voucher by ID
   */
  static async getById(id: string): Promise<Voucher | null> {
    const result = await db
      .select()
      .from(vouchers)
      .where(eq(vouchers.id, id))
      .limit(1);
    return result[0] || null;
  }

  /**
   * Get all active, non-expired vouchers for a user
   */
  static async getActiveByUserId(userId: string): Promise<Voucher[]> {
    return db
      .select()
      .from(vouchers)
      .where(
        and(
          eq(vouchers.userId, userId),
          eq(vouchers.status, 'active'),
          sql`(${vouchers.expiresAt} IS NULL OR ${vouchers.expiresAt} > NOW())`
        )
      )
      .orderBy(desc(vouchers.createdAt));
  }

  /**
   * Get active vouchers for a user filtered by credit type
   */
  static async getActiveByUserIdAndType(userId: string, creditType: string): Promise<Voucher[]> {
    return db
      .select()
      .from(vouchers)
      .where(
        and(
          eq(vouchers.userId, userId),
          eq(vouchers.status, 'active'),
          eq(vouchers.creditType, creditType),
          sql`(${vouchers.expiresAt} IS NULL OR ${vouchers.expiresAt} > NOW())`
        )
      )
      .orderBy(desc(vouchers.createdAt));
  }

  /**
   * Mark voucher as redeemed (race-condition safe via WHERE status='active')
   * Returns the updated voucher if successful, null if already redeemed/revoked
   */
  static async markRedeemed(id: string, paymentId: string): Promise<Voucher | null> {
    const now = new Date().toISOString();
    const result = await db
      .update(vouchers)
      .set({
        status: 'redeemed',
        redeemedAt: now,
        redeemedPaymentId: paymentId,
        updatedAt: now,
      })
      .where(
        and(
          eq(vouchers.id, id),
          eq(vouchers.status, 'active')
        )
      )
      .returning();
    return result[0] || null;
  }

  /**
   * Revoke an active voucher
   */
  static async revoke(id: string): Promise<Voucher | null> {
    const now = new Date().toISOString();
    const result = await db
      .update(vouchers)
      .set({
        status: 'revoked',
        updatedAt: now,
      })
      .where(
        and(
          eq(vouchers.id, id),
          eq(vouchers.status, 'active')
        )
      )
      .returning();
    return result[0] || null;
  }

  /**
   * Get all vouchers with user info (admin list view)
   */
  static async getAll(limit: number = 100, offset: number = 0) {
    return db
      .select({
        id: vouchers.id,
        userId: vouchers.userId,
        creditType: vouchers.creditType,
        credits: vouchers.credits,
        status: vouchers.status,
        expiresAt: vouchers.expiresAt,
        redeemedAt: vouchers.redeemedAt,
        redeemedPaymentId: vouchers.redeemedPaymentId,
        issuedBy: vouchers.issuedBy,
        reportId: vouchers.reportId,
        note: vouchers.note,
        createdAt: vouchers.createdAt,
        updatedAt: vouchers.updatedAt,
        userEmail: profiles.email,
        userFullName: profiles.fullName,
      })
      .from(vouchers)
      .leftJoin(profiles, eq(vouchers.userId, profiles.id))
      .orderBy(desc(vouchers.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get vouchers by report ID
   */
  static async getByReportId(reportId: string): Promise<Voucher[]> {
    return db
      .select()
      .from(vouchers)
      .where(eq(vouchers.reportId, reportId))
      .orderBy(desc(vouchers.createdAt));
  }

  /**
   * Get vouchers for multiple report IDs (batch fetch for user reports page)
   */
  static async getByReportIds(reportIds: string[]): Promise<Voucher[]> {
    if (reportIds.length === 0) return [];
    return db
      .select()
      .from(vouchers)
      .where(sql`${vouchers.reportId} IN (${sql.join(reportIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(desc(vouchers.createdAt));
  }

  /**
   * Validate a voucher for redemption
   * Checks: exists, belongs to user, matches credit type, is active, not expired
   */
  static async validateForRedemption(
    voucherId: string,
    userId: string,
    creditType: string
  ): Promise<{ valid: boolean; voucher?: Voucher; error?: string }> {
    const voucher = await this.getById(voucherId);

    if (!voucher) {
      return { valid: false, error: 'Voucher not found' };
    }
    if (voucher.userId !== userId) {
      return { valid: false, error: 'Voucher does not belong to this user' };
    }
    if (voucher.creditType !== creditType) {
      return { valid: false, error: `Voucher is for ${voucher.creditType} credits, not ${creditType}` };
    }
    if (voucher.status !== 'active') {
      return { valid: false, error: `Voucher is ${voucher.status}` };
    }
    if (voucher.expiresAt && new Date(voucher.expiresAt) < new Date()) {
      return { valid: false, error: 'Voucher has expired' };
    }

    return { valid: true, voucher };
  }
}
