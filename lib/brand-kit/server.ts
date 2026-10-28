/**
 * Server-side "the user's brand" — the default Brand Kit, served to existing
 * pages in the BrandSnapshot shape. Server-only (database access).
 */

import { eq } from "drizzle-orm";
import { db } from "@/database/client";
import { profiles } from "@/database/schema";
import { BrandKitDAO } from "@/database/models/BrandKit.dao";
import type { BrandSnapshot } from "@/app/web/src/components/creative-studio/types";
import type { BrandKit } from "./types";
import {
  fillKitFromSnapshot,
  isMeaningfulSnapshot,
  kitInputFromSnapshot,
  kitToSnapshot,
  sameBrandName,
} from "./snapshot";

async function readLegacySnapshot(userId: string): Promise<BrandSnapshot | null> {
  const [row] = await db
    .select({ brandSnapshot: profiles.brandSnapshot })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return (row?.brandSnapshot as BrandSnapshot | null) ?? null;
}

/**
 * The user's brand: their default kit (created from an old guideline the first
 * time if they have none) and the same data in the BrandSnapshot shape.
 */
export async function getUserBrand(userId: string): Promise<{ kit: BrandKit | null; snapshot: BrandSnapshot | null }> {
  const legacy = await readLegacySnapshot(userId);
  try {
    let kit = await BrandKitDAO.getDefault(userId);
    if (!kit && isMeaningfulSnapshot(legacy)) {
      const input = kitInputFromSnapshot(legacy, { isDefault: true });
      if (input) kit = await BrandKitDAO.create(userId, input);
    }
    return { kit, snapshot: kit ? kitToSnapshot(kit, legacy) : legacy };
  } catch (e) {
    // Brand Kits unavailable (e.g. migration not applied yet): the old guideline still works.
    console.error("[brandKit] kit lookup failed; serving the saved brand guideline", {
      userId,
      error: (e as Error)?.message,
    });
    return { kit: null, snapshot: legacy };
  }
}

/**
 * A setup flow saved a guideline: make that brand the user's default kit.
 * Same-named kit → fill its empty fields (curated values are never overwritten);
 * otherwise → a new kit. Placeholders ("My Brand" with no content) are ignored.
 */
export async function syncSnapshotIntoKits(userId: string, snapshot: Partial<BrandSnapshot>): Promise<BrandKit | null> {
  if (!isMeaningfulSnapshot(snapshot)) return BrandKitDAO.getDefault(userId);
  const kits = await BrandKitDAO.listByUser(userId);
  const match = kits.find((k) => sameBrandName(k.name, snapshot.name));
  if (match) {
    const filled = fillKitFromSnapshot(match, snapshot);
    if (filled || !match.isDefault) {
      return BrandKitDAO.update(match.id, userId, { ...(filled ?? stripMeta(match)), isDefault: true });
    }
    return match;
  }
  const input = kitInputFromSnapshot(snapshot, { isDefault: true });
  return input ? BrandKitDAO.create(userId, input) : BrandKitDAO.getDefault(userId);
}

function stripMeta(kit: BrandKit) {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = kit;
  return rest;
}

export async function userHasBrand(userId: string): Promise<boolean> {
  return BrandKitDAO.hasAny(userId);
}

/**
 * Fill an empty kit look (logo, colours, fonts) from the brand's website.
 * Best effort with a time limit; never throws.
 */
export async function enrichKitLookFromWebsite(userId: string, kit: BrandKit, timeoutMs = 8000): Promise<BrandKit> {
  if (!kit.websiteUrl || (kit.colors.length && kit.fonts.heading && kit.logo)) return kit;
  try {
    const [{ extractBrandKitFromWebsite }, { safeBrandFetch }] = await Promise.all([
      import("./extract"),
      import("./fetch"),
    ]);
    const extraction = await Promise.race([
      extractBrandKitFromWebsite(kit.websiteUrl, safeBrandFetch),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!extraction) return kit;
    const updated = await BrandKitDAO.update(kit.id, userId, {
      ...stripMeta(kit),
      logo: kit.logo ?? (extraction.logoCandidates[0] ? { url: extraction.logoCandidates[0].url } : null),
      colors: kit.colors.length ? kit.colors : extraction.colors.map(({ hex, role }) => ({ hex, role })),
      fonts: {
        heading: kit.fonts.heading ?? extraction.fonts.heading,
        body: kit.fonts.body ?? extraction.fonts.body,
      },
    });
    return updated ?? kit;
  } catch (e) {
    console.warn("[brandKit] website look enrichment skipped", { error: (e as Error)?.message });
    return kit;
  }
}

/**
 * A signed-in user turned an audit into a campaign: their audit brand becomes
 * (or fills) their default kit, and the session gets the kit's brand.
 */
export async function connectAuditBrand(
  userId: string,
  auditSnapshot: Partial<BrandSnapshot>
): Promise<BrandSnapshot | null> {
  try {
    let kit = await syncSnapshotIntoKits(userId, auditSnapshot);
    if (!kit) return null;
    kit = await enrichKitLookFromWebsite(userId, kit);
    return kitToSnapshot(kit, auditSnapshot);
  } catch (e) {
    console.warn("[brandKit] could not connect audit brand", { error: (e as Error)?.message });
    return null;
  }
}
