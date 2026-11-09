// pages/api/library/ad-studio.ts
// Ad Studio posters and carousel slides for Generated Contents. They live on poster
// engine sessions with no Brand Studio session (studio_session_id is null), so the
// creative-studio session list never includes them.
//
// Poster drafts (ad_studio_drafts) are free until kept, so only KEPT ones are listed,
// using their published copy. Unkept drafts — and the private, unwatermarked images on
// their engine sessions — never appear here.

import type { NextApiRequest, NextApiResponse } from "next";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { getUserIdFromRequest } from "@/auth/request";
import { db } from "@/database/client";
import { adStudioDrafts, posterGenerationSessions } from "@/database/schema";

type Item = { id: string; imageUrl: string; createdAt: string; sessionId: string | null };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

  try {
    const [rows, drafts] = await Promise.all([
      db
        .select({ id: posterGenerationSessions.id, assets: posterGenerationSessions.assets, updatedAt: posterGenerationSessions.updatedAt })
        .from(posterGenerationSessions)
        .where(and(eq(posterGenerationSessions.userId, userId), isNull(posterGenerationSessions.studioSessionId)))
        .orderBy(desc(posterGenerationSessions.updatedAt))
        .limit(200),
      db
        .select({ id: adStudioDrafts.id, sessionId: adStudioDrafts.sessionId, kept: adStudioDrafts.kept, finalUrl: adStudioDrafts.finalUrl, keptAt: adStudioDrafts.keptAt, createdAt: adStudioDrafts.createdAt })
        .from(adStudioDrafts)
        .where(and(eq(adStudioDrafts.userId, userId), isNotNull(adStudioDrafts.sessionId))),
    ]);

    // Every engine session that belongs to a poster draft (kept or not) is hidden as a session.
    const draftSessions = new Set(drafts.map((d) => d.sessionId as string));
    const kept: Item[] = drafts
      .filter((d) => d.kept && d.finalUrl)
      .map((d) => ({ id: `draft-${d.id}`, imageUrl: d.finalUrl as string, createdAt: new Date(d.keptAt ?? d.createdAt).toISOString(),sessionId: d.sessionId }));

    const others: Item[] = rows
      .filter((r) => !draftSessions.has(r.id))
      .flatMap((r) =>
        ((r.assets as Array<{ id?: string; imageUrl?: string; status?: string; createdAt?: string }>) || [])
          .filter((a) => a?.status === "generated" && typeof a.imageUrl === "string" && a.imageUrl)
          .map((a) => ({ id: `ad-${a.id}`, imageUrl: a.imageUrl as string, createdAt: a.createdAt || r.updatedAt || new Date().toISOString(), sessionId: r.id }))
      );

    const items = [...kept, ...others].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.status(200).json({ ok: true, items });
  } catch (e) {
    console.error("[library/ad-studio]", (e as Error)?.message);
    return res.status(500).json({ ok: false, error: "We couldn't load your Ad Studio creatives." });
  }
}
