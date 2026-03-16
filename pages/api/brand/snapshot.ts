// pages/api/brand/snapshot.ts
// API endpoint to get and update user's brand snapshot (Drizzle ORM)

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { db } from "@/database/client";
import { profiles } from "@/database/schema";
import { eq } from "drizzle-orm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

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
    const [row] = await db
      .select({ brandSnapshot: profiles.brandSnapshot })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    return res.status(200).json({
      ok: true,
      brandSnapshot: row?.brandSnapshot || null,
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
  const { brandSnapshot } = req.body ?? {};

  if (!brandSnapshot) {
    return res.status(400).json({
      ok: false,
      error: "Brand snapshot is required",
    });
  }

  try {
    await db
      .update(profiles)
      .set({
        brandSnapshot,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(profiles.id, userId));

    return res.status(200).json({
      ok: true,
      brandSnapshot,
    });
  } catch (e: any) {
    console.error("Update brand snapshot error:", e);
    return res.status(500).json({
      ok: false,
      error: `Failed to update brand snapshot: ${e.message || "Unknown error"}`,
    });
  }
}
