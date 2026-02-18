import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { ReportDAO } from "@/database/models/Report.dao";

/**
 * GET /api/reports/my
 * Returns the authenticated user's reports (newest first), excluding images to keep response light.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Please sign in to view your reports." });
    }

    const reports = await ReportDAO.getByUserId(userId);

    // Exclude images field to keep response light
    const reportsWithoutImages = reports.map(({ images, ...rest }) => rest);

    return res.status(200).json({
      success: true,
      reports: reportsWithoutImages,
    });
  } catch (err) {
    console.error("[Reports] GET /api/reports/my error:", err);
    return res.status(500).json({ error: "Failed to fetch reports." });
  }
}
