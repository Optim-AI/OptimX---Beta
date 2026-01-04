// lib/googleAdsTokens.ts
// REFACTORED: Now uses Prisma GoogleAdsDAO instead of direct Supabase
import { GoogleAdsDAO } from '@/database';
import type { GoogleAdsToken } from '@/database';

export type GoogleAdsTokenRow = GoogleAdsToken;

export async function upsertGoogleAdsToken(
  userId: string,
  refreshToken: string,
  accessToken: string | null,
  expiryDate: number | null,
  scope: string | null
) {
  return GoogleAdsDAO.upsertToken(userId, refreshToken, accessToken, expiryDate, scope);
}

export async function getGoogleAdsTokenRow(userId: string): Promise<GoogleAdsTokenRow | null> {
  return GoogleAdsDAO.getToken(userId);
}
