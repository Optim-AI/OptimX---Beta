// lib/razorpay/plan-change.service.ts
// Plan changes are temporarily unavailable (Phase 1B-2).
// Full redesign (no speculative proration / no auto Razorpay plan create) is deferred.

interface PlanChangeParams {
  userId: string;
  newPlanId: string;
  subscriptionId: string;
}

interface PlanChangeResult {
  success: boolean;
  message?: string;
  error?: string;
  proratedAmount?: number;
  effectiveDate?: string;
  code?: 'PLAN_CHANGE_UNAVAILABLE';
}

/**
 * Plan Change Service — Phase 1B-2 safety lock.
 *
 * Previous implementation cancelled Razorpay subs, auto-created plans,
 * wrote plan_upgrade payment rows, and granted prorated addon credits.
 * That path is unsafe against the charge-driven subscription_cycles model.
 */
export class PlanChangeService {
  static async changePlan(_params: PlanChangeParams): Promise<PlanChangeResult> {
    return {
      success: false,
      code: 'PLAN_CHANGE_UNAVAILABLE',
      error:
        'Plan changes are temporarily unavailable. Please cancel at period end and subscribe to the new plan, or contact support.',
    };
  }
}
