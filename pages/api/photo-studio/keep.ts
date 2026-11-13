// pages/api/photo-studio/keep.ts
// POST { sessionId, photoIds[] } → charge 1 image credit per newly kept photo and release
// the full-quality files. Photos already kept are never charged again.

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { getShootView, keepPhotos, PhotoStudioError } from "@/lib/photo-studio/shoot";

export const config = { maxDuration: 120 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  const photoIds = Array.isArray(req.body?.photoIds) ? (req.body.photoIds as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 100) : [];
  if (!sessionId) return res.status(400).json({ ok: false, error: "Which shoot? Missing sessionId." });

  try {
    const { charged } = await keepPhotos(userId, sessionId, photoIds);
    const shoot = await getShootView(userId, sessionId);
    return res.status(200).json({ ok: true, charged, results: shoot?.results ?? [], credits: shoot?.credits ?? 0 });
  } catch (e) {
    if (e instanceof PhotoStudioError) return res.status(e.status).json({ ok: false, error: e.message, code: e.code });
    console.error("[photoStudio] keep failed", { userId, sessionId, error: (e as Error)?.message });
    return res.status(500).json({ ok: false, error: "We couldn't keep those photos. No credits were charged — try again." });
  }
}
