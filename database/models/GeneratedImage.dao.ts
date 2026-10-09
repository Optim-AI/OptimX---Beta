// database/models/GeneratedImage.dao.ts
import { db } from "../client";
import { userGeneratedImage } from "@/database/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

type GeneratedImage = typeof userGeneratedImage.$inferSelect;

/**
 * Data Access Object for GeneratedImage (AI-generated posters / videos)
 */
export class GeneratedImageDAO {
  static async insert(
    userId: string,
    imageUrl: string,
    imagePath: string | null,
    metadata?: Record<string, any>,
    source?: string | null,
    mediaType: "image" | "video" = "image"
  ): Promise<GeneratedImage> {
    const now = new Date().toISOString();

    const [result] = await db
      .insert(userGeneratedImage)
      .values({
        id: randomUUID(),
        userId,
        imageUrl,
        imagePath,
        source: source ?? "generated",
        mediaType,
        metadata: metadata || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return result;
  }

  static async findExisting(opts: {
    userId: string;
    imagePath?: string | null;
    imageUrl: string;
  }): Promise<GeneratedImage | null> {
    if (opts.imagePath) {
      const byPath = await db
        .select()
        .from(userGeneratedImage)
        .where(
          and(
            eq(userGeneratedImage.userId, opts.userId),
            eq(userGeneratedImage.imagePath, opts.imagePath)
          )
        )
        .limit(1);
      if (byPath[0]) return byPath[0];
    }

    const byUrl = await db
      .select()
      .from(userGeneratedImage)
      .where(
        and(
          eq(userGeneratedImage.userId, opts.userId),
          eq(userGeneratedImage.imageUrl, opts.imageUrl)
        )
      )
      .limit(1);
    return byUrl[0] || null;
  }

  static async updateMetadata(
    id: string,
    metadata: Record<string, any>
  ): Promise<GeneratedImage | null> {
    const [row] = await db
      .update(userGeneratedImage)
      .set({
        metadata,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userGeneratedImage.id, id))
      .returning();
    return row || null;
  }

  static async getByUser(
    userId: string,
    limit: number = 50
  ): Promise<GeneratedImage[]> {
    return db
      .select()
      .from(userGeneratedImage)
      .where(eq(userGeneratedImage.userId, userId))
      .orderBy(desc(userGeneratedImage.createdAt))
      .limit(limit);
  }

  static async listForUser(opts: {
    userId: string;
    mediaType?: "image" | "video" | "all";
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: GeneratedImage[]; total: number }> {
    const limit = Math.min(Math.max(opts.limit ?? 48, 1), 100);
    const offset = Math.max(opts.offset ?? 0, 0);

    const conditions = [eq(userGeneratedImage.userId, opts.userId)];

    if (opts.mediaType === "image" || opts.mediaType === "video") {
      conditions.push(eq(userGeneratedImage.mediaType, opts.mediaType));
    }

    if (opts.search && opts.search.trim()) {
      const q = `%${opts.search.trim()}%`;
      conditions.push(
        or(
          ilike(userGeneratedImage.imageUrl, q),
          ilike(userGeneratedImage.source, q),
          sql`coalesce(${userGeneratedImage.metadata}::text, '') ilike ${q}`
        )!
      );
    }

    const where = and(...conditions);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userGeneratedImage)
      .where(where);

    const rows = await db
      .select()
      .from(userGeneratedImage)
      .where(where)
      .orderBy(desc(userGeneratedImage.createdAt))
      .limit(limit)
      .offset(offset);

    return { rows, total: countRow?.count ?? 0 };
  }

  static async getSavedUrls(userId: string): Promise<Set<string>> {
    const rows = await db
      .select({
        imageUrl: userGeneratedImage.imageUrl,
        metadata: userGeneratedImage.metadata,
      })
      .from(userGeneratedImage)
      .where(eq(userGeneratedImage.userId, userId));

    const urls = new Set<string>();
    for (const row of rows) {
      if (row.imageUrl) urls.add(row.imageUrl);
      const meta = row.metadata as Record<string, any> | null;
      if (meta?.originalChatUrl && typeof meta.originalChatUrl === "string") {
        urls.add(meta.originalChatUrl);
      }
    }
    return urls;
  }

  static async getById(id: string): Promise<GeneratedImage | null> {
    const result = await db
      .select()
      .from(userGeneratedImage)
      .where(eq(userGeneratedImage.id, id))
      .limit(1);

    return result[0] || null;
  }

  static async getByIdForUser(
    id: string,
    userId: string
  ): Promise<GeneratedImage | null> {
    const result = await db
      .select()
      .from(userGeneratedImage)
      .where(
        and(eq(userGeneratedImage.id, id), eq(userGeneratedImage.userId, userId))
      )
      .limit(1);
    return result[0] || null;
  }

  static async delete(id: string): Promise<boolean> {
    try {
      await db.delete(userGeneratedImage).where(eq(userGeneratedImage.id, id));
      return true;
    } catch {
      return false;
    }
  }

  static async deleteByUser(userId: string): Promise<number> {
    await db
      .delete(userGeneratedImage)
      .where(eq(userGeneratedImage.userId, userId));
    return 0;
  }
}
