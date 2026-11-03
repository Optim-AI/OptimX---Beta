/**
 * Brand research is saved on the user's brand snapshot (profiles.brand_snapshot.research)
 * so every studio can read it without re-running the web research.
 */

import { eq } from "drizzle-orm";
import { db } from "@/database/client";
import { profiles } from "@/database/schema";
import type { BrandResearch } from "./brand-research";

function sameSite(a?: string | null, b?: string | null): boolean {
  const host = (u?: string | null) => {
    try {
      return u ? new URL(u).hostname.replace(/^www\./, "").toLowerCase() : "";
    } catch {
      return "";
    }
  };
  return Boolean(host(a)) && host(a) === host(b);
}

export async function getBrandResearch(userId: string, websiteUrl?: string | null): Promise<BrandResearch | null> {
  const [row] = await db
    .select({ brandSnapshot: profiles.brandSnapshot })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  const research = (row?.brandSnapshot as { research?: BrandResearch } | null)?.research;
  if (!research || research.version !== 1) return null;
  if (websiteUrl && !sameSite(research.websiteUrl, websiteUrl)) return null;
  return research;
}

/** Merge research into the saved snapshot without touching any other field. */
export async function saveBrandResearch(userId: string, research: BrandResearch): Promise<void> {
  const [row] = await db
    .select({ brandSnapshot: profiles.brandSnapshot })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  const current = (row?.brandSnapshot as Record<string, unknown> | null) ?? {};
  await db
    .update(profiles)
    .set({ brandSnapshot: { ...current, research }, updatedAt: new Date().toISOString() })
    .where(eq(profiles.id, userId));
}

/**
 * A snapshot save from the browser usually doesn't carry the research. Keep the
 * saved research when the incoming snapshot is for the same website.
 */
export function carryResearchForward(
  incoming: Record<string, any>,
  existing: Record<string, any> | null | undefined
): Record<string, any> {
  if (incoming.research || !existing?.research) return incoming;
  const site = incoming.website_url || existing.website_url;
  return sameSite(existing.research.websiteUrl, site) ? { ...incoming, research: existing.research } : incoming;
}

/** Without a website to match on, accept saved research only if its domain names this brand. */
export function researchMatchesBrandName(research: BrandResearch, brandName?: string | null): boolean {
  const name = (brandName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (name.length < 3) return false;
  try {
    const host = new URL(research.websiteUrl).hostname.replace(/^www\./, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return host.includes(name.slice(0, 12));
  } catch {
    return false;
  }
}
