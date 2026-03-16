// pages/api/content-studio/posters.ts
// POST — save generated poster URLs to DB
// GET ?scanId=xxx — list posters for a scan

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { ContentStudioPosterDAO } from "@/database/models/ContentStudioPoster.dao";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  if (req.method === "POST") {
    const { scanId, productName, angle, imageUrls } = req.body;
    if (!scanId || !productName || !imageUrls) {
      return res.status(400).json({ ok: false, error: "scanId, productName, and imageUrls are required" });
    }
    try {
      const poster = await ContentStudioPosterDAO.create({
        userId,
        scanId,
        productName,
        angle: angle || null,
        imageUrls,
      });
      return res.status(200).json({ ok: true, poster });
    } catch (err: any) {
      console.error("[Content Studio posters]", err?.message);
      return res.status(500).json({ ok: false, error: err?.message || "Failed to save posters" });
    }
  }

  if (req.method === "GET") {
    const { scanId } = req.query;
    if (!scanId || typeof scanId !== "string") {
      return res.status(400).json({ ok: false, error: "scanId query parameter required" });
    }
    try {
      const posters = await ContentStudioPosterDAO.listByScan(scanId);
      return res.status(200).json({ ok: true, posters });
    } catch (err: any) {
      console.error("[Content Studio posters]", err?.message);
      return res.status(500).json({ ok: false, error: err?.message || "Failed to fetch posters" });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
