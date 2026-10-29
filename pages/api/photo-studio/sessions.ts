// pages/api/photo-studio/sessions.ts
// GET            → recent shoots
// GET ?id=…      → one shoot (source, product read, settings, photos)
// DELETE ?id=…   → delete a shoot and its photos

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { CreativeStudioSessionDAO } from "@/database/models/CreativeStudioSession.dao";
import { deleteShootSession, getShootSession } from "@/lib/photo-studio/shoot";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "DELETE") {
    res.setHeader("Allow", "GET, DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (req.method === "DELETE") {
    if (!id) return res.status(400).json({ ok: false, error: "Which shoot? Missing id." });
    const result = await deleteShootSession(userId, id);
    if (result === "not_found") return res.status(404).json({ ok: false, error: "Shoot not found" });
    if (result === "failed") return res.status(500).json({ ok: false, error: "We couldn't delete that shoot. Try again." });
    return res.status(200).json({ ok: true });
  }
  if (id) {
    const shoot = await getShootSession(userId, id);
    return shoot ? res.status(200).json({ ok: true, shoot }) : res.status(404).json({ ok: false, error: "Shoot not found" });
  }
  const rows = await CreativeStudioSessionDAO.listByUser(userId, { sessionType: "photo", limit: 20 });
  return res.status(200).json({
    ok: true,
    shoots: rows.map((r) => ({
      id: r.id,
      name: r.name,
      updatedAt: r.updatedAt,
      sourceUrl: (r.productData as any)?.sourceUrl ?? null,
      photos: Array.isArray(r.generatedPosters) ? (r.generatedPosters as string[]).length : 0,
      cover: Array.isArray(r.generatedPosters) ? (r.generatedPosters as string[])[0] ?? null : null,
    })),
  });
}
