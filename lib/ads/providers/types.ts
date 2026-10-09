import type {
  AdsProviderId,
  DailyMetricInput,
  DiscoveredAdAccount,
  DiscoveredAsset,
  PlatformEntityInput,
  SyncDateRange,
  SyncResult,
} from "@/lib/ads/types";

export interface AdsProviderContext {
  userId: string;
  integrationId: string;
  accessToken: string;
  refreshToken?: string | null;
  /** Selected advertising account external id (no act_ prefix for Meta) */
  selectedAccountId?: string | null;
  /** Google Ads MCC / login-customer-id */
  managerCustomerId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AdsProvider {
  id: AdsProviderId;

  /** Discover ad accounts the user can access with current tokens. */
  listAdAccounts(ctx: AdsProviderContext): Promise<DiscoveredAdAccount[]>;

  /** Optional: pages, businesses, lead forms, etc. */
  listAssets?(
    ctx: AdsProviderContext
  ): Promise<DiscoveredAsset[]>;

  /** Fetch campaign / ad hierarchy for the selected account. */
  fetchEntities(
    ctx: AdsProviderContext,
    accountId: string
  ): Promise<PlatformEntityInput[]>;

  /** Fetch daily metrics for account (+ campaign-level when available). */
  fetchDailyMetrics(
    ctx: AdsProviderContext,
    accountId: string,
    range: SyncDateRange
  ): Promise<DailyMetricInput[]>;

  /** Refresh access token when supported; return new tokens or null. */
  refreshAccessToken?(
    ctx: AdsProviderContext
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: string } | null>;
}

export type { SyncResult };
