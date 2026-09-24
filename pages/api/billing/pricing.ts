// pages/api/billing/pricing.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { SettingsDAO } from "@/database/models/Settings.dao";
import { BUY_CREDITS_PRICING } from "@/lib/billing/pricing";
import {
  VIDEO_CREDIT_BLOCK_PRICE_INR,
  VIDEO_CREDIT_BLOCK_SIZE,
  VIDEO_CREDIT_MIN_PURCHASE,
  VIDEO_CREDIT_PURCHASE_STEP,
  VIDEO_CREDITS_BY_DURATION,
} from "@/lib/billing/video-credits";

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
    const pricing = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

    const imageCreditPriceInr =
      typeof pricing.imageCreditPriceInr === "number"
        ? pricing.imageCreditPriceInr
        : BUY_CREDITS_PRICING.imageCreditPriceInr;

    const videoCreditBlockPriceInr =
      typeof pricing.videoCreditBlockPriceInr === "number"
        ? pricing.videoCreditBlockPriceInr
        : VIDEO_CREDIT_BLOCK_PRICE_INR;

    return res.status(200).json({
      imageCreditPriceInr,
      videoCreditBlockPriceInr,
      videoCreditBlockSize: VIDEO_CREDIT_BLOCK_SIZE,
      minVideoCredits: VIDEO_CREDIT_MIN_PURCHASE,
      videoCreditStep: VIDEO_CREDIT_PURCHASE_STEP,
      videoCreditsByDuration: VIDEO_CREDITS_BY_DURATION,
      gstRate: BUY_CREDITS_PRICING.gstRate,
      // Backward-compatible aliases (deprecated)
      videoSecondPriceInr: undefined,
    });
  } catch {
    return res.status(200).json({
      imageCreditPriceInr: BUY_CREDITS_PRICING.imageCreditPriceInr,
      videoCreditBlockPriceInr: VIDEO_CREDIT_BLOCK_PRICE_INR,
      videoCreditBlockSize: VIDEO_CREDIT_BLOCK_SIZE,
      minVideoCredits: VIDEO_CREDIT_MIN_PURCHASE,
      videoCreditStep: VIDEO_CREDIT_PURCHASE_STEP,
      videoCreditsByDuration: VIDEO_CREDITS_BY_DURATION,
      gstRate: BUY_CREDITS_PRICING.gstRate,
    });
  }
}
