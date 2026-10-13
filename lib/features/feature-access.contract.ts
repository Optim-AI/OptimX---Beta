/**
 * Static contracts for Analytics entitlement (no DAO/DB imports).
 *
 * PAYG in this product = authenticated user with **zero** `subscriptions` rows.
 * Trials are `subscriptions.status = 'trialing'` and are subscribers, not PAYG.
 * Absence of an *active* subscription is not enough (expired/cancelled/pending).
 */

export const SKALX_BASIC_ANALYTICS_PLAN_IDS = [
  "skalx_starter",
  "skalx_growth",
  "skalx_pro",
] as const;

export type SkalxBasicAnalyticsPlanId =
  (typeof SKALX_BASIC_ANALYTICS_PLAN_IDS)[number];

/** Granted only after FeatureService proves the user is PAYG (no subscription history). */
export const PAYG_BASIC_ANALYTICS_CONTRACT = {
  enabled: true,
  comingSoon: false,
} as const;

/** Fail-closed default when entitlement cannot be established. */
export const BASIC_ANALYTICS_DENIED_CONTRACT = {
  enabled: false,
  comingSoon: false,
  reason: "Not included in plan",
} as const;

export const ADVANCED_ANALYTICS_STILL_GATED_CONTRACT = {
  enabled: false,
  comingSoon: true,
  reason: "Coming soon",
} as const;
