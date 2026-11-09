// pages/api/library/delete.ts
// Delete one poster from Generated Contents, wherever it actually lives:
//  - Brand / Photo Studio: the URL is removed from that studio session's poster list.
//  - Ad Studio kept poster ("draft-<id>"): the draft and its stored files are removed.
//  - Older Ad Studio posters ("ad-<assetId>"): the image is removed from its engine session.
// Campaign uploads (user_generated_image) are deleted by the page itself, as before.

import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { getUserIdFromRequest } from "@/auth/request";
import { db } from "@/database/client";
import { adStudioDrafts, creativeStudioSessions, posterGenerationSessions } from "@/database/schema";
import { DRAFT_BUCKET, PUBLIC_BUCKET } from "@/lib/ad-studio/storage";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

  const { source, id, imageUrl, sessionId } = (req.body ?? {}) as { source?: string; id?: string; imageUrl?: string; sessionId?: string };
  if (typeof id !== "string" || typeof imageUrl !== "string" || !imageUrl) {
    return res.status(400).json({ ok: false, error: "Missing image" });
  }

  try {
    if (source === "brand" || source === "photo") {
      if (typeof sessionId !== "string" || !UUID.test(sessionId)) return res.status(400).json({ ok: false, error: "Missing session" });
      const [session] = await db
        .select({ posters: creativeStudioSessions.generatedPosters })
        .from(creativeStudioSessions)
        .where(and(eq(creativeStudioSessions.id, sessionId), eq(creativeStudioSessions.userId, userId)));
      if (!session) return res.status(404).json({ ok: false, error: "Not found" });
      const posters = ((session.posters as string[] | null) ?? []).filter((u) => u !== imageUrl);
      await db
        .update(creativeStudioSessions)
        .set({ generatedPosters: posters, updatedAt: new Date().toISOString() })
        .where(and(eq(creativeStudioSessions.id, sessionId), eq(creativeStudioSessions.userId, userId)));
      return res.status(200).json({ ok: true });
    }

    if (source === "ad" && id.startsWith("draft-")) {
      const draftId = id.slice("draft-".length);
      if (!UUID.test(draftId)) return res.status(400).json({ ok: false, error: "Bad id" });
      const [draft] = await db
        .delete(adStudioDrafts)
        .where(and(eq(adStudioDrafts.id, draftId), eq(adStudioDrafts.userId, userId)))
        .returning({ storagePath: adStudioDrafts.storagePath, previewPath: adStudioDrafts.previewPath, finalPath: adStudioDrafts.finalPath });
      if (!draft) return res.status(404).json({ ok: false, error: "Not found" });
      // Files are best-effort: the poster is already gone from SkalX once the row is deleted.
      const { supabaseAdmin } = await import("@/auth/supabase/admin");
      const priv = [draft.storagePath, draft.previewPath].filter((p): p is string => !!p);
      await Promise.all([
        priv.length ? supabaseAdmin.storage.from(DRAFT_BUCKET).remove(priv) : null,
        draft.finalPath ? supabaseAdmin.storage.from(PUBLIC_BUCKET).remove([draft.finalPath]) : null,
      ]).catch((e) => console.warn("[library/delete] file cleanup", (e as Error)?.message));
      return res.status(200).json({ ok: true });
    }

    if (source === "ad" && id.startsWith("ad-")) {
      const assetId = id.slice("ad-".length);
      if (typeof sessionId !== "string" || !UUID.test(sessionId)) return res.status(400).json({ ok: false, error: "Missing session" });
      const where = and(eq(posterGenerationSessions.id, sessionId), eq(posterGenerationSessions.userId, userId), isNull(posterGenerationSessions.studioSessionId));
      const [session] = await db.select({ assets: posterGenerationSessions.assets, version: posterGenerationSessions.version }).from(posterGenerationSessions).where(where);
      if (!session) return res.status(404).json({ ok: false, error: "Not found" });
      const assets = ((session.assets as Array<{ id?: string; imageUrl?: string }>) ?? []).filter((a) => !(a?.id === assetId && a?.imageUrl === imageUrl));
      await db
        .update(posterGenerationSessions)
        .set({ assets, version: session.version + 1, updatedAt: new Date().toISOString() })
        .where(and(where, eq(posterGenerationSessions.version, session.version)));
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: "This item can't be deleted here" });
  } catch (e) {
    console.error("[library/delete]", (e as Error)?.message);
    return res.status(500).json({ ok: false, error: "We couldn't delete this image. Please try again." });
  }
}
