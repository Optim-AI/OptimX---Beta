// pages/api/creative-studio/get-sessions.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/auth/supabase/client";
import { getUserIdFromRequest } from "@/auth/request";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Get authenticated user ID using staging's auth helper
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    try {
      const { data, error } = await supabaseAdmin
        .from("creative_studio_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) {
        // If table doesn't exist, return empty array
        if (error.message?.includes("does not exist") || error.code === "42P01") {
          return res.status(200).json({
            ok: true,
            sessions: [],
            message: "Sessions table not configured",
          });
        }

        console.error("Failed to fetch sessions:", error);
        return res.status(500).json({
          ok: false,
          error: `Failed to fetch sessions: ${error.message}`,
        });
      }

      return res.status(200).json({
        ok: true,
        sessions: data || [],
      });
    } catch (e: any) {
      console.error("Get sessions error:", e);
      return res.status(500).json({
        ok: false,
        error: `Failed to fetch sessions: ${e.message || "Unknown error"}`,
      });
    }
  } catch (err: any) {
    console.error("get-sessions error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Internal server error",
    });
  }
}
