// pages/api/creative-intelligence/run.ts
// GET run by id - returns full analysis results

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { db } from "@/database/client";
import {
  creativeIntelligenceRuns,
  creativeIntelligenceBrands,
  creativeIntelligenceCompetitors,
  creativeIntelligenceReviews,
  creativeIntelligenceHooks,
  creativeIntelligenceStrategies,
  creativeIntelligenceMetaAds,
} from "@/database/schema";
import { eq, and, asc } from "drizzle-orm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ ok: false, error: "Run ID required" });
  }

  try {
    const [run] = await db
      .select()
      .from(creativeIntelligenceRuns)
      .where(
        and(
          eq(creativeIntelligenceRuns.id, id),
          eq(creativeIntelligenceRuns.userId, userId)
        )
      )
      .limit(1);

    if (!run) {
      return res.status(404).json({ ok: false, error: "Run not found" });
    }

    const [brand] = await db
      .select()
      .from(creativeIntelligenceBrands)
      .where(eq(creativeIntelligenceBrands.runId, id))
      .limit(1);

    const competitors = await db
      .select()
      .from(creativeIntelligenceCompetitors)
      .where(eq(creativeIntelligenceCompetitors.runId, id))
      .orderBy(creativeIntelligenceCompetitors.createdAt);

    const reviews = await db
      .select()
      .from(creativeIntelligenceReviews)
      .where(eq(creativeIntelligenceReviews.runId, id));

    const hooks = await db
      .select()
      .from(creativeIntelligenceHooks)
      .where(eq(creativeIntelligenceHooks.runId, id))
      .orderBy(asc(creativeIntelligenceHooks.rank));

    const [strategy] = await db
      .select()
      .from(creativeIntelligenceStrategies)
      .where(eq(creativeIntelligenceStrategies.runId, id))
      .limit(1);

    let metaAds: any[] = [];
    try {
      metaAds = await db
        .select()
        .from(creativeIntelligenceMetaAds)
        .where(eq(creativeIntelligenceMetaAds.runId, id));
    } catch {
      // Table may not exist if migration not run yet
    }

    return res.status(200).json({
      ok: true,
      run: {
        id: run.id,
        status: run.status,
        brandUrl: run.brandUrl,
        industry: run.industry,
        targetAudience: run.targetAudience,
        campaignGoal: run.campaignGoal,
        createdAt: run.createdAt,
      },
      brand: brand || null,
      competitors,
      reviews,
      hooks,
      strategies: strategy?.content || null,
      metaAds,
    });
  } catch (err: any) {
    console.error("Run fetch error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to fetch run",
    });
  }
}
