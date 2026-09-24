/**
 * Canonical SkalX subscription plans (Phase 1A catalog).
 * Only these may be used for new customer-facing subscriptions.
 */

export const CANONICAL_SUBSCRIPTION_PLAN_IDS = [
  'skalx_starter',
  'skalx_growth',
  'skalx_pro',
] as const;

export type CanonicalSubscriptionPlanId =
  (typeof CANONICAL_SUBSCRIPTION_PLAN_IDS)[number];

export function isCanonicalSubscriptionPlanId(
  planId: string
): planId is CanonicalSubscriptionPlanId {
  return (CANONICAL_SUBSCRIPTION_PLAN_IDS as readonly string[]).includes(planId);
}
