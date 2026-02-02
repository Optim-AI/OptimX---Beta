// pages/api/creative-studio/save-session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/auth/supabase/client";
import { getUserIdFromRequest } from "@/auth/request";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Get authenticated user ID using staging's auth helper
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const { name, brandSnapshot, productData, config } = req.body ?? {};

    if (!name || typeof name !== "string") {
      return res.status(400).json({ ok: false, error: "Missing session name" });
    }

    if (!brandSnapshot) {
      return res.status(400).json({ ok: false, error: "Missing brand snapshot" });
    }

    // Save session data
    try {
      const payload = {
        user_id: userId,
        name: name,
        brand_snapshot: brandSnapshot,
        product_data: productData || null,
        config: config || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabaseAdmin
        .from("creative_studio_sessions")
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error("Failed to insert session:", error);
        
        // Check if it's a "relation does not exist" error
        if (error.message?.includes("does not exist") || error.code === "42P01") {
          return res.status(500).json({
            ok: false,
            error: "Sessions table not configured. Please run the database migration.",
            details: "Run: supabase db reset or apply the migration manually",
          });
        }

        return res.status(500).json({
          ok: false,
          error: `Failed to save session: ${error.message}`,
        });
      }

      return res.status(200).json({
        ok: true,
        sessionId: data.id,
        session: data,
      });
    } catch (e: any) {
      console.error("Save session error:", e);
      return res.status(500).json({
        ok: false,
        error: `Failed to save session: ${e.message || "Unknown error"}`,
      });
    }
  } catch (err: any) {
    console.error("save-session error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Internal server error",
    });
  }
}
