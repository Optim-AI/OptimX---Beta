// database/models/Report.dao.ts
import { db } from '../client';
import { reports, profiles } from '@/database/schema';
import { eq, desc } from 'drizzle-orm';

type Report = typeof reports.$inferSelect;
type ReportInsert = typeof reports.$inferInsert;
type ReportWithUser = Report & { userEmail: string | null; userFullName: string | null };

/**
 * Data Access Object for Report operations
 */
export class ReportDAO {
  /**
   * Create a new report
   */
  static async create(data: {
    userId: string;
    type: string;
    message: string;
    pageUrl?: string | null;
    images?: string[];
  }): Promise<Report> {
    const now = new Date().toISOString();
    const [result] = await db
      .insert(reports)
      .values({
        userId: data.userId,
        type: data.type,
        message: data.message,
        pageUrl: data.pageUrl || null,
        images: data.images && data.images.length > 0 ? data.images : null,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return result;
  }

  /**
   * Get all reports, newest first
   */
  static async getAll(): Promise<Report[]> {
    return db
      .select()
      .from(reports)
      .orderBy(desc(reports.createdAt));
  }

  /**
   * Get all reports with user email/name from profiles, newest first
   */
  static async getAllWithUserInfo(): Promise<ReportWithUser[]> {
    const rows = await db
      .select({
        id: reports.id,
        userId: reports.userId,
        type: reports.type,
        message: reports.message,
        pageUrl: reports.pageUrl,
        images: reports.images,
        status: reports.status,
        createdAt: reports.createdAt,
        updatedAt: reports.updatedAt,
        userEmail: profiles.email,
        userFullName: profiles.fullName,
      })
      .from(reports)
      .leftJoin(profiles, eq(reports.userId, profiles.id))
      .orderBy(desc(reports.createdAt));

    return rows;
  }

  /**
   * Get reports for a specific user, newest first
   */
  static async getByUserId(userId: string): Promise<Report[]> {
    return db
      .select()
      .from(reports)
      .where(eq(reports.userId, userId))
      .orderBy(desc(reports.createdAt));
  }

  /**
   * Update report status
   */
  static async updateStatus(
    reportId: string,
    status: string
  ): Promise<Report> {
    const now = new Date().toISOString();
    const [result] = await db
      .update(reports)
      .set({ status, updatedAt: now })
      .where(eq(reports.id, reportId))
      .returning();

    return result;
  }
}
