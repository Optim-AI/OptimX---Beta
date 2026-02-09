// pages/api/creative-studio/get-sessions.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { CreativeStudioSessionDAO } from "@/database/models/CreativeStudioSession.dao";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Get authenticated user ID
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    try {
      const sessions = await CreativeStudioSessionDAO.listByUser(userId, { limit: 50 });

      return res.status(200).json({
        ok: true,
        sessions,
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
