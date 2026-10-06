/**
 * Pure post-auth routing decision (no DB imports).
 * Shared by resolvePostAuthDestination and resolveTryEntry.
 */

export type PostAuthTryStep =
  | 'brand'
  | 'brand_started'
  | 'analyzing'
  | 'brand_analyzed'
  | 'demo_ready'
  | 'demo_pending'
  | 'demo_complete'
  | 'pricing'
  | 'skipped';

export type PostAuthDecisionOk = {
  ok: true;
  destination: 'workspace' | 'try';
  step?: PostAuthTryStep;
};

export type PostAuthDecisionErr = {
  ok: false;
  error: string;
};

export type PostAuthDecision = PostAuthDecisionOk | PostAuthDecisionErr;

/** Minimal onboarding shape needed for routing (avoids importing try-onboarding). */
export type PostAuthOnboarding = {
  status: string;
} | null;

export type PostAuthState = {
  hasCapturedPayment: boolean;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: string | Date | null;
  onboarding: PostAuthOnboarding;
  businessName: string | null;
  brandSnapshotName: string | null;
  now?: Date;
};

export const POST_AUTH_WORKSPACE_PATH = '/content-studio';

const IN_PROGRESS_STATUSES = new Set([
  'brand_started',
  'analyzing',
  'brand_analyzed',
  'demo_ready',
  'demo_pending',
  'demo_complete',
  'pricing_seen',
  'skipped',
]);

function periodEndMs(value: string | Date | null | undefined): number | null {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Valid paid entitlement (priority 1).
 * `pending` alone is NOT entitlement.
 */
export function hasValidEntitlement(state: PostAuthState): boolean {
  if (state.hasCapturedPayment) return true;

  const status = (state.subscriptionStatus || '').toLowerCase();
  if (status === 'active' || status === 'trialing') return true;

  if (status === 'cancelled' || status === 'past_due') {
    const end = periodEndMs(state.subscriptionCurrentPeriodEnd);
    const now = (state.now ?? new Date()).getTime();
    if (end != null && end > now) return true;
  }

  return false;
}

function isInProgressOnboarding(onboarding: PostAuthOnboarding): boolean {
  if (!onboarding?.status) return false;
  return IN_PROGRESS_STATUSES.has(onboarding.status);
}

function stepForStatus(status: string): PostAuthTryStep {
  if (status === 'pricing_seen') return 'pricing';
  if (status === 'brand_started') return 'brand_started';
  if (status === 'analyzing') return 'analyzing';
  if (status === 'brand_analyzed') return 'brand_analyzed';
  if (status === 'demo_ready') return 'demo_ready';
  if (status === 'demo_pending') return 'demo_pending';
  if (status === 'demo_complete') return 'demo_complete';
  if (status === 'skipped') return 'skipped';
  return 'brand';
}

/**
 * Pure decision from already-loaded persisted state.
 */
export function decidePostAuthDestination(state: PostAuthState): PostAuthDecisionOk {
  if (hasValidEntitlement(state)) {
    return { ok: true, destination: 'workspace' };
  }

  const status = state.onboarding?.status;

  if (status === 'subscribed' || status === 'complete') {
    return { ok: true, destination: 'workspace' };
  }

  const hasLegacyCompletion =
    Boolean(state.businessName?.trim()) || Boolean(state.brandSnapshotName?.trim());
  if (hasLegacyCompletion && !isInProgressOnboarding(state.onboarding)) {
    return { ok: true, destination: 'workspace' };
  }

  if (status && isInProgressOnboarding(state.onboarding)) {
    return {
      ok: true,
      destination: 'try',
      step: stepForStatus(status),
    };
  }

  return { ok: true, destination: 'try', step: 'brand' };
}

export function postAuthRedirectPath(decision: PostAuthDecisionOk): string {
  if (decision.destination === 'workspace') return POST_AUTH_WORKSPACE_PATH;
  return '/try';
}
