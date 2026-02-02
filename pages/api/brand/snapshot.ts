// pages/api/brand/snapshot.ts
// API endpoint to get and update user's brand snapshot

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/auth/supabase/client";
import { getUserIdFromRequest } from "@/auth/request";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Get authenticated user ID
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

/**
 * GET /api/brand/snapshot
 * Returns the user's brand snapshot
 */
async function handleGetBrandSnapshot(res: NextApiResponse, userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("brand_snapshot")
      .eq("id", userId)
      .single();

    if (error) {
      // Profile might not exist yet - that's okay
      if (error.code === "PGRST116") {
        return res.status(200).json({
          ok: true,
          brandSnapshot: null,
        });
      }

      console.error("Failed to fetch brand snapshot:", error);
      return res.status(500).json({
        ok: false,
        error: `Failed to fetch brand snapshot: ${error.message}`,
      });
    }

    return res.status(200).json({
      ok: true,
      brandSnapshot: data?.brand_snapshot || null,
    });
  } catch (e: any) {
    console.error("Get brand snapshot error:", e);
    return res.status(500).json({
      ok: false,
      error: `Failed to fetch brand snapshot: ${e.message || "Unknown error"}`,
    });
  }
}

/**
 * PUT /api/brand/snapshot
 * Updates the user's brand snapshot
 */
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
    // Upsert - update if exists, insert if not
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          brand_snapshot: brandSnapshot,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        }
      )
      .select("brand_snapshot")
      .single();

    if (error) {
      console.error("Failed to update brand snapshot:", error);
      return res.status(500).json({
        ok: false,
        error: `Failed to update brand snapshot: ${error.message}`,
      });
    }

    return res.status(200).json({
      ok: true,
      brandSnapshot: data?.brand_snapshot,
    });
  } catch (e: any) {
    console.error("Update brand snapshot error:", e);
    return res.status(500).json({
      ok: false,
      error: `Failed to update brand snapshot: ${e.message || "Unknown error"}`,
    });
  }
}
