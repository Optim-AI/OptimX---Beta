// lib/billing/pricing.server.ts
// Server-only pricing functions that read from the database.
// Keep separate from pricing.ts to avoid pulling pg/fs into client bundles.

import { SettingsDAO } from '@/database/models/Settings.dao';
import { BUY_CREDITS_PRICING, calculateTotalsInr } from './pricing';
import { VIDEO_CREDIT_BLOCK_PRICE_INR, VIDEO_CREDIT_BLOCK_SIZE } from './video-credits';

export type ServerCreditPricing = {
  imageCreditPriceInr: number;
  /** ₹ per 100 Video Credits (block). */
  videoCreditBlockPriceInr: number;
  /**
   * @deprecated Legacy admin key. If present without videoCreditBlockPriceInr,
   * ignored for new video pricing (block price is authoritative).
   */
  videoSecondPriceInr?: number;
  gstRate: number;
};

/**
 * Reads credit pricing from the database (appSettings), falling back to hardcoded defaults.
 */
export async function getServerPricing(): Promise<ServerCreditPricing> {
  const value = await SettingsDAO.getSetting('credit_pricing');
  const pricing = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  const imageCreditPriceInr =
    typeof pricing.imageCreditPriceInr === 'number'
      ? pricing.imageCreditPriceInr
      : BUY_CREDITS_PRICING.imageCreditPriceInr;

  const videoCreditBlockPriceInr =
    typeof pricing.videoCreditBlockPriceInr === 'number'
      ? pricing.videoCreditBlockPriceInr
      : VIDEO_CREDIT_BLOCK_PRICE_INR;

  return {
    imageCreditPriceInr,
    videoCreditBlockPriceInr,
    videoSecondPriceInr:
      typeof pricing.videoSecondPriceInr === 'number'
        ? pricing.videoSecondPriceInr
        : BUY_CREDITS_PRICING.videoSecondPriceInr,
    gstRate: BUY_CREDITS_PRICING.gstRate,
  };
}

/**
 * Server-side calculation that reads pricing from the database.
 * Use this in API routes (e.g. create-order) so the order amount always reflects admin-configured pricing.
 */
export async function calculateTotalsInrFromDb(params: {
  creditType: 'image' | 'video';
  credits: number;
}) {
  const { creditType, credits } = params;
  const serverPricing = await getServerPricing();

  if (creditType === 'image') {
    return calculateTotalsInr({
      creditType: 'image',
      credits,
      overrides: { unitPriceInr: serverPricing.imageCreditPriceInr },
    });
  }

  return calculateTotalsInr({
    creditType: 'video',
    credits,
    overrides: { videoBlockPriceInr: serverPricing.videoCreditBlockPriceInr },
  });
}

export { VIDEO_CREDIT_BLOCK_SIZE, VIDEO_CREDIT_BLOCK_PRICE_INR };
