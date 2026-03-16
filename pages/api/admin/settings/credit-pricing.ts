// pages/api/admin/settings/credit-pricing.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyAdminToken } from "@/lib/admin-auth";
import { SettingsDAO } from "@/database/models/Settings.dao";

const SETTING_KEY = "credit_pricing";
const DEFAULTS = { imageCreditPriceInr: 10, videoSecondPriceInr: 26 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Admin auth check
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ success: false, error: "Unauthorized - no token provided" });
  }
  const { valid } = verifyAdminToken(token);
  if (!valid) {
    return res.status(401).json({ success: false, error: "Unauthorized - invalid token" });
  }

  if (req.method === "GET") {
    try {
      const value = await SettingsDAO.getSetting(SETTING_KEY);
      const pricing = value && typeof value === "object" ? value : DEFAULTS;
      return res.status(200).json({
        success: true,
        imageCreditPriceInr: typeof pricing.imageCreditPriceInr === "number" ? pricing.imageCreditPriceInr : DEFAULTS.imageCreditPriceInr,
        videoSecondPriceInr: typeof pricing.videoSecondPriceInr === "number" ? pricing.videoSecondPriceInr : DEFAULTS.videoSecondPriceInr,
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message || "Failed to read setting" });
    }
  }

  if (req.method === "POST") {
    const { imageCreditPriceInr, videoSecondPriceInr } = req.body ?? {};

    const imgPrice = Number(imageCreditPriceInr);
    const vidPrice = Number(videoSecondPriceInr);

    if (!Number.isFinite(imgPrice) || imgPrice <= 0) {
      return res.status(400).json({ success: false, error: "imageCreditPriceInr must be a positive number" });
    }
    if (!Number.isFinite(vidPrice) || vidPrice <= 0) {
      return res.status(400).json({ success: false, error: "videoSecondPriceInr must be a positive number" });
    }

    try {
      await SettingsDAO.setSetting(SETTING_KEY, {
        imageCreditPriceInr: imgPrice,
        videoSecondPriceInr: vidPrice,
      });
      return res.status(200).json({
        success: true,
        message: `Credit pricing updated: image ₹${imgPrice}, video ₹${vidPrice}`,
        imageCreditPriceInr: imgPrice,
        videoSecondPriceInr: vidPrice,
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message || "Failed to save setting" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
