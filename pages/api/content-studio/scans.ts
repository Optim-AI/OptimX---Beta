// pages/api/content-studio/scans.ts
// GET /api/content-studio/scans — list user's scans
// GET /api/content-studio/scans?id=xxx — get specific scan with campaigns/posters

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { ContentStudioScanDAO } from "@/database/models/ContentStudioScan.dao";
import { ContentStudioCampaignDAO } from "@/database/models/ContentStudioCampaign.dao";
import { ContentStudioPosterDAO } from "@/database/models/ContentStudioPoster.dao";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const { id } = req.query;

    if (id && typeof id === "string") {
      const scan = await ContentStudioScanDAO.getByIdAndUser(id, userId);
      if (!scan) {
        return res.status(404).json({ ok: false, error: "Scan not found" });
      }
      const [campaigns, posters] = await Promise.all([
        ContentStudioCampaignDAO.listByScan(scan.id),
        ContentStudioPosterDAO.listByScan(scan.id),
      ]);
      return res.status(200).json({ ok: true, scan, campaigns, posters });
    }

    const scans = await ContentStudioScanDAO.listByUser(userId);
    return res.status(200).json({ ok: true, scans });
  } catch (err: any) {
    console.error("[Content Studio scans]", err?.message);
    return res.status(500).json({ ok: false, error: err?.message || "Failed to fetch scans" });
  }
}
