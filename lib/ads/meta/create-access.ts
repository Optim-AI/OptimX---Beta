/**
 * Paid Meta Ads **creation** entitlement (PR W2.1).
 *
 * There is no dedicated `meta_ads_create` plan feature flag in production yet.
 * Do **not** reuse `basic_analytics` or `create_campaigns` (creative drafts).
 *
 * Smallest safe gate without billing/plan migrations:
 * - Default: **denied** (fail closed / coming soon).
 * - Enable only when `META_ADS_CREATE_ENABLED=true`.
 * - Optional allowlist: `META_ADS_CREATE_USER_ALLOWLIST=uuid,uuid`.
 *
 * A later PR should add `meta_ads_create` to `feature_keys` + plan flags.
 */

export const META_ADS_CREATE_FEATURE = "meta_ads_create" as const;

export type MetaAdsCreateAccess = {
  feature: typeof META_ADS_CREATE_FEATURE;
  entitled: boolean;
  comingSoon: boolean;
  reason: string | null;
  /** How entitlement was decided (for ops/debug; safe to return). */
  gate: "env_disabled" | "env_enabled" | "allowlist" | "allowlist_miss";
};

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw || !raw.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/**
 * Decide whether the authenticated user may use Meta Ads draft/create APIs.
 * Call only after `getUserIdFromRequest` succeeded.
 */
export function decideMetaAdsCreateAccess(
  authenticatedUserId: string,
  env: Record<string, string | undefined> = process.env
): MetaAdsCreateAccess {
  const enabled = String(env.META_ADS_CREATE_ENABLED || "").toLowerCase() === "true";
  const allowlist = parseAllowlist(env.META_ADS_CREATE_USER_ALLOWLIST);

  if (!enabled) {
    return {
      feature: META_ADS_CREATE_FEATURE,
      entitled: false,
      comingSoon: true,
      reason:
        "Meta Ads campaign creation is not enabled for this environment. Set META_ADS_CREATE_ENABLED only for reviewed staging.",
      gate: "env_disabled",
    };
  }

  if (allowlist.size > 0) {
    if (allowlist.has(authenticatedUserId)) {
      return {
        feature: META_ADS_CREATE_FEATURE,
        entitled: true,
        comingSoon: false,
        reason: null,
        gate: "allowlist",
      };
    }
    return {
      feature: META_ADS_CREATE_FEATURE,
      entitled: false,
      comingSoon: false,
      reason: "Your account is not on the Meta Ads create allowlist.",
      gate: "allowlist_miss",
    };
  }

  return {
    feature: META_ADS_CREATE_FEATURE,
    entitled: true,
    comingSoon: false,
    reason: null,
    gate: "env_enabled",
  };
}
