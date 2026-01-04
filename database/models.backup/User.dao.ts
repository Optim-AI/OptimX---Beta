// lib/db/models/User.dao.ts
import { db } from '../client';
import { users } from '@/database/schema';
import { eq, count } from 'drizzle-orm';

// Type inference from Drizzle schema
type User = typeof users.$inferSelect;
type UserInsert = typeof users.$inferInsert;

/**
 * Data Access Object for User operations
 */
export class UserDAO {
  /**
   * Create a new user
   */
  static async create(id: string, email: string): Promise<User> {
    const now = new Date().toISOString();

    const [result] = await db
      .insert(users)
      .values({
        id,
        email,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return result;
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | null> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Update user
   */
  static async update(
    id: string,
    data: Partial<UserInsert>
  ): Promise<User> {
    const now = new Date().toISOString();

    const [result] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(users.id, id))
      .returning();

    return result;
  }

  /**
   * Upsert user (create or update)
   */
  static async upsert(id: string, email: string): Promise<User> {
    const now = new Date().toISOString();

    const [result] = await db
      .insert(users)
      .values({
        id,
        email,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email,
          updatedAt: now,
        },
      })
      .returning();

    return result;
  }

  /**
   * Delete user
   */
  static async delete(id: string): Promise<boolean> {
    try {
      await db
        .delete(users)
        .where(eq(users.id, id));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if user exists
   */
  static async exists(id: string): Promise<boolean> {
    const result = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.id, id));

    return (result[0]?.count ?? 0) > 0;
  }
}
