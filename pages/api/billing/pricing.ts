// pages/api/billing/pricing.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { SettingsDAO } from "@/database/models/Settings.dao";
import { BUY_CREDITS_PRICING } from "@/lib/billing/pricing";

/**
 * GET /api/billing/pricing
 * Public endpoint (no auth) — returns current credit pricing for the buy-credits page.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const value = await SettingsDAO.getSetting("credit_pricing");
    const pricing = value && typeof value === "object" ? value : {};

    return res.status(200).json({
      imageCreditPriceInr:
        typeof pricing.imageCreditPriceInr === "number"
          ? pricing.imageCreditPriceInr
          : BUY_CREDITS_PRICING.imageCreditPriceInr,
      videoSecondPriceInr:
        typeof pricing.videoSecondPriceInr === "number"
          ? pricing.videoSecondPriceInr
          : BUY_CREDITS_PRICING.videoSecondPriceInr,
      gstRate: BUY_CREDITS_PRICING.gstRate,
    });
  } catch (e: any) {
    // Fallback to hardcoded defaults on error
    return res.status(200).json({
      imageCreditPriceInr: BUY_CREDITS_PRICING.imageCreditPriceInr,
      videoSecondPriceInr: BUY_CREDITS_PRICING.videoSecondPriceInr,
      gstRate: BUY_CREDITS_PRICING.gstRate,
    });
  }
}
