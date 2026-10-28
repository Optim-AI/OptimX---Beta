// database/models/BrandKit.dao.ts
import { db } from '../client';
import { brandKits } from '@/database/schema';
import { and, asc, desc, eq } from 'drizzle-orm';
import type {
  BrandKit,
  BrandKitExtraction,
  BrandKitGuidelines,
  BrandKitInput,
  BrandKitLogo,
  BrandKitColor,
  BrandKitFont,
} from '@/lib/brand-kit/types';
import { cleanIdentity } from '@/lib/brand-kit/types';

type BrandKitRow = typeof brandKits.$inferSelect;

function toBrandKit(row: BrandKitRow): BrandKit {
  const fonts = (row.fonts || {}) as { heading?: BrandKitFont | null; body?: BrandKitFont | null };
  const guidelines = (row.guidelines || {}) as Partial<BrandKitGuidelines>;
  return {
    id: row.id,
    name: row.name,
    websiteUrl: row.websiteUrl,
    isDefault: row.isDefault,
    logo: (row.logo as BrandKitLogo | null) ?? null,
    colors: Array.isArray(row.colors) ? (row.colors as BrandKitColor[]) : [],
    fonts: { heading: fonts.heading ?? null, body: fonts.body ?? null },
    guidelines: {
      mustInclude: guidelines.mustInclude ?? [],
      dos: guidelines.dos ?? [],
      donts: guidelines.donts ?? [],
    },
    identity: cleanIdentity(row.identity),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Data Access Object for Brand Kits. Every query is scoped by userId.
 */
export class BrandKitDAO {
  static async listByUser(userId: string): Promise<BrandKit[]> {
    const rows = await db
      .select()
      .from(brandKits)
      .where(eq(brandKits.userId, userId))
      .orderBy(desc(brandKits.isDefault), asc(brandKits.createdAt));
    return rows.map(toBrandKit);
  }

  static async getById(id: string, userId: string): Promise<BrandKit | null> {
    const [row] = await db
      .select()
      .from(brandKits)
      .where(and(eq(brandKits.id, id), eq(brandKits.userId, userId)))
      .limit(1);
    return row ? toBrandKit(row) : null;
  }

  /** The kit posters use: the default kit, else the oldest one. */
  static async hasAny(userId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: brandKits.id })
      .from(brandKits)
      .where(eq(brandKits.userId, userId))
      .limit(1);
    return !!row;
  }

  static async getDefault(userId: string): Promise<BrandKit | null> {
    const [row] = await db
      .select()
      .from(brandKits)
      .where(eq(brandKits.userId, userId))
      .orderBy(desc(brandKits.isDefault), asc(brandKits.createdAt))
      .limit(1);
    return row ? toBrandKit(row) : null;
  }

  /** The user's first kit always becomes the default. */
  static async create(
    userId: string,
    input: BrandKitInput,
    extraction?: BrandKitExtraction | null
  ): Promise<BrandKit> {
    return db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: brandKits.id })
        .from(brandKits)
        .where(eq(brandKits.userId, userId))
        .limit(1);
      const makeDefault = input.isDefault || existing.length === 0;
      if (makeDefault) {
        await tx
          .update(brandKits)
          .set({ isDefault: false })
          .where(and(eq(brandKits.userId, userId), eq(brandKits.isDefault, true)));
      }
      const [row] = await tx
        .insert(brandKits)
        .values({
          userId,
          name: input.name,
          websiteUrl: input.websiteUrl,
          isDefault: makeDefault,
          logo: input.logo,
          colors: input.colors,
          fonts: input.fonts,
          guidelines: input.guidelines,
          identity: input.identity,
          extraction: extraction ?? null,
        })
        .returning();
      return toBrandKit(row);
    });
  }

  static async update(id: string, userId: string, input: BrandKitInput): Promise<BrandKit | null> {
    return db.transaction(async (tx) => {
      if (input.isDefault) {
        await tx
          .update(brandKits)
          .set({ isDefault: false })
          .where(and(eq(brandKits.userId, userId), eq(brandKits.isDefault, true)));
      }
      const [row] = await tx
        .update(brandKits)
        .set({
          name: input.name,
          websiteUrl: input.websiteUrl,
          ...(input.isDefault ? { isDefault: true } : {}),
          logo: input.logo,
          colors: input.colors,
          fonts: input.fonts,
          guidelines: input.guidelines,
          identity: input.identity,
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(brandKits.id, id), eq(brandKits.userId, userId)))
        .returning();
      return row ? toBrandKit(row) : null;
    });
  }

  /** Deleting the default promotes the user's oldest remaining kit. */
  static async delete(id: string, userId: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [deleted] = await tx
        .delete(brandKits)
        .where(and(eq(brandKits.id, id), eq(brandKits.userId, userId)))
        .returning({ isDefault: brandKits.isDefault });
      if (!deleted) return false;
      if (deleted.isDefault) {
        const [next] = await tx
          .select({ id: brandKits.id })
          .from(brandKits)
          .where(eq(brandKits.userId, userId))
          .orderBy(asc(brandKits.createdAt))
          .limit(1);
        if (next) {
          await tx.update(brandKits).set({ isDefault: true }).where(eq(brandKits.id, next.id));
        }
      }
      return true;
    });
  }
}
