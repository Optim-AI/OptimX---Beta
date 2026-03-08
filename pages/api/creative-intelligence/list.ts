// pages/api/creative-intelligence/list.ts
// GET list of runs for the current user

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { db } from "@/database/client";
import { creativeIntelligenceRuns } from "@/database/schema";
import { eq, desc } from "drizzle-orm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const runs = await db
      .select({
        id: creativeIntelligenceRuns.id,
        brandUrl: creativeIntelligenceRuns.brandUrl,
        status: creativeIntelligenceRuns.status,
        createdAt: creativeIntelligenceRuns.createdAt,
      })
      .from(creativeIntelligenceRuns)
      .where(eq(creativeIntelligenceRuns.userId, userId))
      .orderBy(desc(creativeIntelligenceRuns.createdAt))
      .limit(20);

    return res.status(200).json({
      ok: true,
      runs: runs.filter((r) => r.status === "completed"),
    });
  } catch (err: any) {
    console.error("List runs error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to list runs",
    });
  }
}
