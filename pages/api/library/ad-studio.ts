// pages/api/library/ad-studio.ts
// Ad Studio posters and carousel slides for Generated Contents. They live on poster
// engine sessions with no Brand Studio session (studio_session_id is null), so the
// creative-studio session list never includes them.

import type { NextApiRequest, NextApiResponse } from "next";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getUserIdFromRequest } from "@/auth/request";
import { db } from "@/database/client";
import { posterGenerationSessions } from "@/database/schema";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

  try {
    const rows = await db
      .select({ id: posterGenerationSessions.id, assets: posterGenerationSessions.assets, updatedAt: posterGenerationSessions.updatedAt })
      .from(posterGenerationSessions)
      .where(and(eq(posterGenerationSessions.userId, userId), isNull(posterGenerationSessions.studioSessionId)))
      .orderBy(desc(posterGenerationSessions.updatedAt))
      .limit(200);
    const items = rows.flatMap((r) =>
      ((r.assets as Array<{ id?: string; imageUrl?: string; status?: string; createdAt?: string }>) || [])
        .filter((a) => a?.status === "generated" && typeof a.imageUrl === "string" && a.imageUrl)
        .map((a) => ({ id: `ad-${a.id}`, imageUrl: a.imageUrl as string, createdAt: a.createdAt || r.updatedAt || new Date().toISOString(), sessionId: r.id }))
    );
    return res.status(200).json({ ok: true, items });
  } catch (e) {
    console.error("[library/ad-studio]", (e as Error)?.message);
    return res.status(500).json({ ok: false, error: "We couldn't load your Ad Studio creatives." });
  }
}
