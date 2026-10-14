/**
 * CTA resolution for subscription cards on Plans & Purchases.
 * Plan changes (upgrade/downgrade) are currently unavailable in billing —
 * only net-new purchases are enabled when the user has no active paid plan.
 */

import {
  MARKETING_SUBSCRIPTION_PLANS,
  type MarketingPlanId,
  isMarketingPlanId,
} from './marketing-plans';

export type PaidPlanEntitlement = {
  planId: string;
  status: string;
};

export type PlanCardActionKind =
  | 'buy'
  | 'current'
  | 'upgrade_unavailable'
  | 'downgrade_unavailable';

export type PlanCardAction = {
  kind: PlanCardActionKind;
  label: string;
  disabled: boolean;
  /** When true, CTA may navigate to /subscribe?plan=… */
  canCheckout: boolean;
};

const PLAN_RANK: Record<MarketingPlanId, number> = {
  skalx_starter: 1,
  skalx_growth: 2,
  skalx_pro: 3,
};

/** Active paid entitlement — matches /api/billing/subscriptions/current. */
export function isActivePaidSubscription(
  sub: PaidPlanEntitlement | null | undefined
): sub is PaidPlanEntitlement {
  if (!sub?.planId) return false;
  return sub.status === 'active' || sub.status === 'trialing';
}

export function resolvePlanCardAction(
  targetPlanId: MarketingPlanId,
  current: PaidPlanEntitlement | null | undefined
): PlanCardAction {
  const plan = MARKETING_SUBSCRIPTION_PLANS.find((p) => p.id === targetPlanId);
  const name = plan?.name ?? 'plan';

  if (!isActivePaidSubscription(current) || !isMarketingPlanId(current.planId)) {
    return {
      kind: 'buy',
      label: `Buy ${name}`,
      disabled: false,
      canCheckout: true,
    };
  }

  if (current.planId === targetPlanId) {
    return {
      kind: 'current',
      label: 'Current Plan',
      disabled: true,
      canCheckout: false,
    };
  }

  const currentRank = PLAN_RANK[current.planId];
  const targetRank = PLAN_RANK[targetPlanId];
  const upgrading = targetRank > currentRank;

  // PlanChangeService is locked — do not offer checkout for switches.
  return {
    kind: upgrading ? 'upgrade_unavailable' : 'downgrade_unavailable',
    label: upgrading ? `Upgrade to ${name}` : `Downgrade to ${name}`,
    disabled: true,
    canCheckout: false,
  };
}

export const PLAN_SWITCH_UNAVAILABLE_NOTE =
  'Plan switching is temporarily unavailable. To change plans, cancel at period end and subscribe to the new plan, or contact support.';
