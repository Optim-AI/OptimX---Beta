import type { AdsProvider } from "@/lib/ads/providers/types";
import type { AdsProviderId } from "@/lib/ads/types";
import { metaAdsProvider } from "@/lib/ads/providers/meta/provider";
import { googleAdsProvider } from "@/lib/ads/providers/google/provider";
import { linkedInAdsProvider } from "@/lib/ads/providers/linkedin/provider";

const PROVIDERS: Record<AdsProviderId, AdsProvider> = {
  meta: metaAdsProvider,
  "google-ads": googleAdsProvider,
  linkedin: linkedInAdsProvider,
};

export function getAdsProvider(provider: string): AdsProvider {
  const p = PROVIDERS[provider as AdsProviderId];
  if (!p) throw new Error(`Unsupported ads provider: ${provider}`);
  return p;
}

export function listAdsProviderIds(): AdsProviderId[] {
  return Object.keys(PROVIDERS) as AdsProviderId[];
}

export { metaAdsProvider, googleAdsProvider, linkedInAdsProvider };
