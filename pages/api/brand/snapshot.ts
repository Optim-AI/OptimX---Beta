// pages/api/brand/snapshot.ts
// API endpoint to get and update user's brand snapshot (Drizzle ORM)

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { db } from "@/database/client";
import { profiles } from "@/database/schema";
import { eq } from "drizzle-orm";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { getUserBrand, syncSnapshotIntoKits } from "@/lib/brand-kit/server";
import { carryResearchForward } from "@/lib/research/store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    // Ensure profile exists before UPDATE so onboarding state is never silently dropped.
    await ensureProfile(userId);

    if (req.method === "GET") {
      return handleGetBrandSnapshot(res, userId);
    } else if (req.method === "PUT") {
      return handleUpdateBrandSnapshot(req, res, userId);
    } else {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }
  } catch (err: any) {
    console.error("brand/snapshot API error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Internal server error",
    });
  }
}

async function handleGetBrandSnapshot(res: NextApiResponse, userId: string) {
  try {
    // The Brand Kit is the source of truth; it is served in the snapshot shape
    // the studio pages read (falls back to the legacy guideline when no kit).
    const { snapshot, kit } = await getUserBrand(userId);
    return res.status(200).json({
      ok: true,
      brandSnapshot: snapshot,
      brandKitId: kit?.id ?? null,
    });
  } catch (e: any) {
    console.error("Get brand snapshot error:", e);
    return res.status(500).json({
      ok: false,
      error: `Failed to fetch brand snapshot: ${e.message || "Unknown error"}`,
    });
  }
}

async function handleUpdateBrandSnapshot(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const { brandSnapshot: incoming } = req.body ?? {};

  if (!incoming) {
    return res.status(400).json({
      ok: false,
      error: "Brand snapshot is required",
    });
  }

  try {
    const [existing] = await db
      .select({ brandSnapshot: profiles.brandSnapshot })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    const brandSnapshot = carryResearchForward(incoming, existing?.brandSnapshot as Record<string, any> | null);

    await db
      .update(profiles)
      .set({
        brandSnapshot,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(profiles.id, userId));

    // Keep the Brand Kit in step: this brand becomes the user's default kit.
    // The guideline is already saved, so a kit failure must not fail the request.
    const kit = await syncSnapshotIntoKits(userId, brandSnapshot).catch((e) => {
      console.error("[brandKit] could not sync saved brand into kits", { userId, error: e?.message });
      return null;
    });
    const { snapshot } = await getUserBrand(userId);

    return res.status(200).json({
      ok: true,
      brandSnapshot: snapshot ?? brandSnapshot,
      brandKitId: kit?.id ?? null,
    });
  } catch (e: any) {
    console.error("Update brand snapshot error:", e);
    return res.status(500).json({
      ok: false,
      error: `Failed to update brand snapshot: ${e.message || "Unknown error"}`,
    });
  }
}
