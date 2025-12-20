// utils/googleAdsTokens.ts
import { supabase } from '../lib/supabaseClient';

export type GoogleAdsTokenRow = {
  user_id: string;
  refresh_token: string;
  access_token: string | null;
  token_expires_at: string | null;
  scope: string | null;
};

export async function upsertGoogleAdsToken(
  userId: string,
  refreshToken: string,
  accessToken: string | null,
  expiryDate: number | null,
  scope: string | null
) {
  const { data, error } = await supabase
    .from('google_ads_tokens')
    .upsert({
      user_id: userId,
      refresh_token: refreshToken,
      access_token: accessToken,
      token_expires_at: expiryDate ? new Date(expiryDate).toISOString() : null,
      scope: scope,
    }, { onConflict: 'user_id' });
  if (error) {
    console.error('upsertGoogleAdsToken error', error);
    throw error;
  }
  return data;
}

export async function getGoogleAdsTokenRow(userId: string): Promise<GoogleAdsTokenRow | null> {
  const { data, error } = await supabase
    .from('google_ads_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) {
    console.error('getGoogleAdsTokenRow error', error);
    return null;
  }
  return data as GoogleAdsTokenRow;
}
