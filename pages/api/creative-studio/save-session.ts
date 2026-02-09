// pages/api/creative-studio/save-session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { CreativeStudioSessionDAO } from "@/database/models/CreativeStudioSession.dao";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Get authenticated user ID
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
        userId,
        name: name.trim(),
        sessionType: 'poster' as const, // Default to poster type
        brandSnapshot,
        productData: productData || null,
        config: config || null,
      };

      const data = await CreativeStudioSessionDAO.create(payload);

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
