import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";

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
    const payload = {
      userId,
      type: reportType,
      message: String(message).trim().slice(0, 5000),
      pageUrl: typeof pageUrl === "string" ? pageUrl.trim().slice(0, 500) || null : null,
      imageCount: images.length,
      createdAt: new Date().toISOString(),
    };

    // Log metadata; images are in body (persist to storage/DB as needed)
    console.info("[Report]", JSON.stringify(payload));
    if (images.length > 0) {
      console.info("[Report] images: ", images.length, "attachments (base64)");
    }

    return res.status(200).json({
      success: true,
      message: "Report submitted successfully.",
    });
  } catch (err) {
    console.error("[Report] API error:", err);
    return res.status(500).json({ error: "Failed to submit report. Please try again." });
  }
}
