// pages/api/admin/settings/image-retention.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyAdminToken } from "@/lib/admin-auth";
import { SettingsDAO } from "@/database/models/Settings.dao";

const SETTING_KEY = "image_retention_days";
const DEFAULT_DAYS = 7;

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
      return res.status(200).json({
        success: true,
        image_retention_days: typeof value === "number" ? value : DEFAULT_DAYS,
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message || "Failed to read setting" });
    }
  }

  if (req.method === "POST") {
    const { days } = req.body ?? {};
    const parsed = Number(days);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 365) {
      return res.status(400).json({ success: false, error: "days must be a number between 0 and 365" });
    }

    try {
      await SettingsDAO.setSetting(SETTING_KEY, Math.round(parsed));
      return res.status(200).json({
        success: true,
        message: `Image retention set to ${Math.round(parsed)} days`,
        image_retention_days: Math.round(parsed),
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message || "Failed to save setting" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
