// lib/billing/pricing.server.ts
// Server-only pricing functions that read from the database.
// Keep separate from pricing.ts to avoid pulling pg/fs into client bundles.

import { SettingsDAO } from '@/database/models/Settings.dao';
import { BUY_CREDITS_PRICING } from './pricing';

/**
 * Reads credit pricing from the database (appSettings), falling back to hardcoded defaults.
 */
export async function getServerPricing(): Promise<{
  imageCreditPriceInr: number;
  videoSecondPriceInr: number;
  gstRate: number;
}> {
  const value = await SettingsDAO.getSetting('credit_pricing');
  const pricing = value && typeof value === 'object' ? value : {};
  return {
    imageCreditPriceInr:
      typeof pricing.imageCreditPriceInr === 'number'
        ? pricing.imageCreditPriceInr
        : BUY_CREDITS_PRICING.imageCreditPriceInr,
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
  const unitPriceInr =
    creditType === 'image'
      ? serverPricing.imageCreditPriceInr
      : serverPricing.videoSecondPriceInr;
  const subtotalInr = credits * unitPriceInr;
  const gstRate = serverPricing.gstRate;
  const gstAmountInr = Math.round(subtotalInr * gstRate);
  const totalInr = subtotalInr + gstAmountInr;
  return { unitPriceInr, subtotalInr, gstRate, gstAmountInr, totalInr };
}
