import { and, desc, eq } from "drizzle-orm";
import { db } from "@/database/client";
import { socialPosts } from "@/database/schema";

export type SocialPostStatus = "draft" | "publishing" | "published" | "failed";

export type SocialPostInsert = {
  userId: string;
  integrationId?: string | null;
  provider?: string;
  destinationPageId?: string | null;
  destinationPageName?: string | null;
  sourceImageId?: string | null;
  sourceImageUrl: string;
  sourceImagePath?: string | null;
  caption?: string | null;
  status?: SocialPostStatus;
  metaPostId?: string | null;
  metaPhotoId?: string | null;
  permalink?: string | null;
  errorMessage?: string | null;
  publishedAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

export class SocialPostDAO {
  static async create(input: SocialPostInsert) {
    const now = new Date().toISOString();
    const [row] = await db
      .insert(socialPosts)
      .values({
        userId: input.userId,
        integrationId: input.integrationId ?? null,
        provider: input.provider ?? "meta-publish",
        destinationPageId: input.destinationPageId ?? null,
        destinationPageName: input.destinationPageName ?? null,
        sourceImageId: input.sourceImageId ?? null,
        sourceImageUrl: input.sourceImageUrl,
        sourceImagePath: input.sourceImagePath ?? null,
        caption: input.caption ?? null,
        status: input.status ?? "draft",
        metaPostId: input.metaPostId ?? null,
        metaPhotoId: input.metaPhotoId ?? null,
        permalink: input.permalink ?? null,
        errorMessage: input.errorMessage ?? null,
        publishedAt: input.publishedAt ?? null,
        metadata: input.metadata ?? {},
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return row;
  }

  static async update(
    id: string,
    userId: string,
    patch: Partial<SocialPostInsert> & { status?: SocialPostStatus }
  ) {
    const [row] = await db
      .update(socialPosts)
      .set({
        ...patch,
        updatedAt: new Date().toISOString(),
      } as any)
      .where(and(eq(socialPosts.id, id), eq(socialPosts.userId, userId)))
      .returning();
    return row ?? null;
  }

  static async findByIdForUser(id: string, userId: string) {
    const rows = await db
      .select()
      .from(socialPosts)
      .where(and(eq(socialPosts.id, id), eq(socialPosts.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  }

  static async listByUser(userId: string, limit = 50) {
    return db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.userId, userId))
      .orderBy(desc(socialPosts.createdAt))
      .limit(limit);
  }

  static async findByMetaPostId(userId: string, metaPostId: string) {
    const rows = await db
      .select()
      .from(socialPosts)
      .where(
        and(eq(socialPosts.userId, userId), eq(socialPosts.metaPostId, metaPostId))
      )
      .limit(1);
    return rows[0] ?? null;
  }
}
