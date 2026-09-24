// pages/api/admin/settings/credit-pricing.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyAdminToken } from "@/lib/admin-auth";
import { SettingsDAO } from "@/database/models/Settings.dao";
import { VIDEO_CREDIT_BLOCK_PRICE_INR, VIDEO_CREDIT_BLOCK_SIZE } from "@/lib/billing/video-credits";

const SETTING_KEY = "credit_pricing";
const DEFAULTS = {
  imageCreditPriceInr: 10,
  videoCreditBlockPriceInr: VIDEO_CREDIT_BLOCK_PRICE_INR,
  videoCreditBlockSize: VIDEO_CREDIT_BLOCK_SIZE,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
      const pricing = value && typeof value === "object" ? (value as Record<string, unknown>) : DEFAULTS;
      return res.status(200).json({
        success: true,
        imageCreditPriceInr:
          typeof pricing.imageCreditPriceInr === "number"
            ? pricing.imageCreditPriceInr
            : DEFAULTS.imageCreditPriceInr,
        videoCreditBlockPriceInr:
          typeof pricing.videoCreditBlockPriceInr === "number"
            ? pricing.videoCreditBlockPriceInr
            : DEFAULTS.videoCreditBlockPriceInr,
        videoCreditBlockSize: VIDEO_CREDIT_BLOCK_SIZE,
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message || "Failed to read setting" });
    }
  }

  if (req.method === "POST") {
    const { imageCreditPriceInr, videoCreditBlockPriceInr } = req.body ?? {};

    const imgPrice = Number(imageCreditPriceInr);
    const blockPrice = Number(videoCreditBlockPriceInr);

    if (!Number.isFinite(imgPrice) || imgPrice <= 0) {
      return res.status(400).json({ success: false, error: "imageCreditPriceInr must be a positive number" });
    }
    if (!Number.isFinite(blockPrice) || blockPrice <= 0) {
      return res.status(400).json({
        success: false,
        error: "videoCreditBlockPriceInr must be a positive number (price for 100 Video Credits)",
      });
    }

    try {
      await SettingsDAO.setSetting(SETTING_KEY, {
        imageCreditPriceInr: imgPrice,
        videoCreditBlockPriceInr: blockPrice,
        videoCreditBlockSize: VIDEO_CREDIT_BLOCK_SIZE,
      });
      return res.status(200).json({
        success: true,
        message: `Credit pricing updated: image ₹${imgPrice}/credit, video ₹${blockPrice} per ${VIDEO_CREDIT_BLOCK_SIZE} credits`,
        imageCreditPriceInr: imgPrice,
        videoCreditBlockPriceInr: blockPrice,
        videoCreditBlockSize: VIDEO_CREDIT_BLOCK_SIZE,
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message || "Failed to save setting" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
