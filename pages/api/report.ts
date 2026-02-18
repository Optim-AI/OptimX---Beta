import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { ReportDAO } from "@/database/models/Report.dao";

/**
 * POST /api/report
 * Submit an error report or feedback. Requires auth.
 * Body: { type: 'error' | 'feedback', message: string, pageUrl?: string, images?: string[] } (images as base64 data URLs)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Please sign in to submit a report." });
    }

    const { type, message, pageUrl, images: rawImages } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required." });
    }

    const images = Array.isArray(rawImages)
      ? rawImages.filter((x): x is string => typeof x === "string").slice(0, 3)
      : [];

    const reportType = type === "error" ? "error" : "feedback";

    await ReportDAO.create({
      userId,
      type: reportType,
      message: String(message).trim().slice(0, 5000),
      pageUrl: typeof pageUrl === "string" ? pageUrl.trim().slice(0, 500) || null : null,
      images,
    });

    return res.status(200).json({
      success: true,
      message: "Report submitted successfully.",
    });
  } catch (err) {
    console.error("[Report] API error:", err);
    return res.status(500).json({ error: "Failed to submit report. Please try again." });
  }
}
