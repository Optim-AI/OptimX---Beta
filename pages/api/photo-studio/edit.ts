// pages/api/photo-studio/edit.ts
// Edit one photo of a saved Photo Studio shoot from a plain-words request.
// The edited photo is added next to the original as a free draft (1 image credit if kept).

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { editPhoto, MAX_EDIT_CHARS } from "@/lib/photo-studio/edit";
import { getShootSession, PhotoStudioError } from "@/lib/photo-studio/shoot";

export const config = { maxDuration: 300 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  // The photo's id; older clients sent its address, which is the id of photos made before keep-to-pay.
  const photoId = typeof req.body?.photoId === "string" ? req.body.photoId : typeof req.body?.photoUrl === "string" ? req.body.photoUrl : "";
  const request = typeof req.body?.request === "string" ? req.body.request.trim().slice(0, MAX_EDIT_CHARS) : "";
  if (!sessionId || !photoId || !request) {
    return res.status(400).json({ ok: false, error: "Pick a photo and say what you'd like to change." });
  }

  try {
    const state = await getShootSession(userId, sessionId);
    if (!state) return res.status(404).json({ ok: false, error: "Shoot not found" });
    const result = await editPhoto({ userId, sessionId, photoId, request, state });
    return res.status(200).json({ ok: true, result });
  } catch (e) {
    if (e instanceof PhotoStudioError) return res.status(e.status).json({ ok: false, error: e.message, code: e.code });
    console.error("[photoStudio] edit failed", { userId, sessionId, error: (e as Error)?.message });
    return res.status(500).json({ ok: false, error: "This edit didn't come out. Try again." });
  }
}
