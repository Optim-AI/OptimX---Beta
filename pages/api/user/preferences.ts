// pages/api/user/preferences.ts
// GET/PUT user UI preferences stored in profiles.ui_preferences JSONB

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
      const [row] = await db
        .select({ uiPreferences: profiles.uiPreferences })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);

      return res.status(200).json({
        ok: true,
        preferences: (row?.uiPreferences as Record<string, any>) || {},
      });
    }

    if (req.method === "PUT") {
      const { preferences } = req.body ?? {};
      if (!preferences || typeof preferences !== "object") {
        return res.status(400).json({ ok: false, error: "preferences object required" });
      }

      // Merge incoming keys into existing preferences
      const [current] = await db
        .select({ uiPreferences: profiles.uiPreferences })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);

      const existing = (current?.uiPreferences as Record<string, any>) || {};
      const merged = { ...existing, ...preferences };

      await db
        .update(profiles)
        .set({ uiPreferences: merged, updatedAt: new Date().toISOString() })
        .where(eq(profiles.id, userId));

      return res.status(200).json({ ok: true, preferences: merged });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err: any) {
    console.error("user/preferences API error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Internal server error",
    });
  }
}
