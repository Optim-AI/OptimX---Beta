/**
 * Feature entitlement helpers — UI hiding is not authorization.
 *
 * Analytics uses {@link decideBasicAnalyticsAccess}. APIs must go through
 * FeatureService (or this module) so UI and handlers cannot drift.
 */

import {
  BASIC_ANALYTICS_DENIED_CONTRACT,
  PAYG_BASIC_ANALYTICS_CONTRACT,
} from "@/lib/features/feature-access.contract";

export type FeatureAccessLike = {
  enabled?: boolean;
  comingSoon?: boolean;
  reason?: string;
} | null | undefined;

/** True only when the feature is fully usable (enabled and not coming soon). */
export function isFeatureEntitled(access: FeatureAccessLike): boolean {
  return Boolean(access?.enabled) && !Boolean(access?.comingSoon);
}

/** Classify why analytics (or any feature) is blocked for messaging. */
export function featureBlockReason(
  access: FeatureAccessLike
): "entitled" | "coming_soon" | "not_included" | "unknown" {
  if (!access) return "unknown";
  if (isFeatureEntitled(access)) return "entitled";
  if (access.comingSoon) return "coming_soon";
  if (!access.enabled) return "not_included";
  return "unknown";
}

/**
 * Billing cohort for Analytics.
 * - payg: no subscription rows ever (credits-only product path)
 * - active_subscriber: status active or trialing (plan flags apply, including trials)
 * - inactive_subscriber: history exists but not active/trialing
 */
export type AnalyticsBillingCohort =
  | "payg"
  | "active_subscriber"
  | "inactive_subscriber";

export function classifyAnalyticsBillingCohort(input: {
  hasActiveOrTrialingSubscription: boolean;
  subscriptionRowCount: number;
}): AnalyticsBillingCohort {
  if (input.hasActiveOrTrialingSubscription) return "active_subscriber";
  if (input.subscriptionRowCount > 0) return "inactive_subscriber";
  return "payg";
}

export type BasicAnalyticsDecision = {
  enabled: boolean;
  comingSoon: boolean;
  reason?: string;
  entitled: boolean;
  cohort: AnalyticsBillingCohort;
};

/** Canonical basic_analytics decision. Deny by default when entitlement is unclear. */
export function decideBasicAnalyticsAccess(input: {
  cohort: AnalyticsBillingCohort;
  planFlag?: { enabled: boolean; comingSoon: boolean } | null;
}): BasicAnalyticsDecision {
  if (input.cohort === "payg") {
    return {
      ...PAYG_BASIC_ANALYTICS_CONTRACT,
      entitled: true,
      cohort: "payg",
    };
  }

  if (input.cohort === "active_subscriber") {
    const flag = input.planFlag;
    if (!flag) {
      return {
        ...BASIC_ANALYTICS_DENIED_CONTRACT,
        entitled: false,
        cohort: "active_subscriber",
      };
    }
    const access = {
      enabled: flag.enabled,
      comingSoon: flag.comingSoon,
      reason: flag.comingSoon
        ? "Coming soon"
        : flag.enabled
          ? undefined
          : "Not included in plan",
    };
    return {
      ...access,
      entitled: isFeatureEntitled(access),
      cohort: "active_subscriber",
    };
  }

  return {
    ...BASIC_ANALYTICS_DENIED_CONTRACT,
    entitled: false,
    cohort: "inactive_subscriber",
  };
}

export const BASIC_ANALYTICS_FEATURE = "basic_analytics" as const;

export function basicAnalyticsForbiddenBody(access: FeatureAccessLike): {
  ok: false;
  error: "feature_not_entitled";
  feature: "basic_analytics";
  enabled: boolean;
  comingSoon: boolean;
  reason: string;
} {
  return {
    ok: false,
    error: "feature_not_entitled",
    feature: BASIC_ANALYTICS_FEATURE,
    enabled: Boolean(access?.enabled),
    comingSoon: Boolean(access?.comingSoon),
    reason: access?.reason || "Analytics is not available on your plan",
  };
}

/**
 * HTTP gate for metrics APIs.
 * Unauthenticated → 401 missing_user (does not treat missing auth as PAYG).
 * Not entitled → 403.
 */
export function enforceBasicAnalyticsForMetricsApi(opts: {
  userId: string | null | undefined;
  access: FeatureAccessLike & { entitled?: boolean };
}):
  | { ok: true }
  | { ok: false; status: 401; body: { error: "missing_user" } }
  | {
      ok: false;
      status: 403;
      body: ReturnType<typeof basicAnalyticsForbiddenBody>;
    } {
  if (!opts.userId) {
    return { ok: false, status: 401, body: { error: "missing_user" } };
  }
  const entitled =
    typeof opts.access?.entitled === "boolean"
      ? opts.access.entitled
      : isFeatureEntitled(opts.access);
  if (!entitled) {
    return {
      ok: false,
      status: 403,
      body: basicAnalyticsForbiddenBody(opts.access),
    };
  }
  return { ok: true };
}
