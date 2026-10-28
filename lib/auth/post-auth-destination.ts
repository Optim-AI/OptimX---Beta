/**
 * Canonical post-authentication routing (DB-backed).
 * Google OAuth and email/password must both use this decision.
 *
 * Read-only with respect to billing/credits.
 */

import { db } from '@/database/client';
import { brandKits, payments, profiles, subscriptions } from '@/database/schema';
import { and, eq, gt, inArray, or } from 'drizzle-orm';
import { parseTryOnboarding } from '@/lib/onboarding/try-onboarding';
import {
  decidePostAuthDestination,
  postAuthRedirectPath,
  type PostAuthDecision,
  type PostAuthState,
  POST_AUTH_WORKSPACE_PATH,
} from '@/lib/auth/post-auth-decision';

export type {
  PostAuthDecision,
  PostAuthDecisionErr,
  PostAuthDecisionOk,
  PostAuthState,
  PostAuthTryStep,
} from '@/lib/auth/post-auth-decision';

export {
  decidePostAuthDestination,
  hasValidEntitlement,
  postAuthRedirectPath,
  POST_AUTH_WORKSPACE_PATH,
} from '@/lib/auth/post-auth-decision';

export type PostAuthStateLoader = (userId: string) => Promise<PostAuthState>;

async function loadPostAuthState(userId: string): Promise<PostAuthState> {
  const nowIso = new Date().toISOString();

  const [profileRows, paymentRows, subscriptionRows, kitRows] = await Promise.all([
    db
      .select({
        businessName: profiles.businessName,
        uiPreferences: profiles.uiPreferences,
        brandSnapshot: profiles.brandSnapshot,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1),
    db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.userId, userId), eq(payments.status, 'captured')))
      .limit(1),
    db
      .select({
        status: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          or(
            inArray(subscriptions.status, ['active', 'trialing', 'pending']),
            and(
              inArray(subscriptions.status, ['cancelled', 'past_due']),
              gt(subscriptions.currentPeriodEnd, nowIso)
            )
          )
        )
      )
      .limit(10),
    // A Brand Kit means the user has already set up their brand. Never block sign-in on it.
    db
      .select({ name: brandKits.name })
      .from(brandKits)
      .where(eq(brandKits.userId, userId))
      .limit(1)
      .catch((e: unknown) => {
        console.error('[postAuth] brand kit lookup failed', { userId, error: (e as Error)?.message });
        return [] as Array<{ name: string }>;
      }),
  ]);

  const profile = profileRows[0] ?? null;
  const preferences =
    (profile?.uiPreferences as Record<string, unknown> | null) ?? null;
  const onboarding = parseTryOnboarding(preferences);
  const brandSnapshot = profile?.brandSnapshot as { name?: string } | null;
  const brandSnapshotName =
    kitRows[0]?.name ?? (typeof brandSnapshot?.name === 'string' ? brandSnapshot.name : null);

  let subscriptionStatus: string | null = null;
  let subscriptionCurrentPeriodEnd: string | null = null;
  const rank = (s: string) => {
    const v = s.toLowerCase();
    if (v === 'active') return 4;
    if (v === 'trialing') return 3;
    if (v === 'cancelled' || v === 'past_due') return 2;
    if (v === 'pending') return 1;
    return 0;
  };
  for (const row of subscriptionRows) {
    if (!subscriptionStatus || rank(row.status) > rank(subscriptionStatus)) {
      subscriptionStatus = row.status;
      subscriptionCurrentPeriodEnd = row.currentPeriodEnd;
    }
  }

  return {
    hasCapturedPayment: paymentRows.length > 0,
    subscriptionStatus,
    subscriptionCurrentPeriodEnd,
    onboarding,
    businessName: profile?.businessName ?? null,
    brandSnapshotName,
  };
}

/**
 * Load persisted account state and resolve post-auth destination.
 * On any query failure returns `{ ok: false }` — never invents a new-user path.
 */
export async function resolvePostAuthDestination(
  userId: string,
  loadState: PostAuthStateLoader = loadPostAuthState
): Promise<PostAuthDecision> {
  if (!userId) {
    return { ok: false, error: 'Missing user id' };
  }

  try {
    const state = await loadState(userId);
    return decidePostAuthDestination(state);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to resolve post-auth destination';
    console.error('[resolvePostAuthDestination]', message);
    return {
      ok: false,
      error: 'Could not determine where to send you. Please try again.',
    };
  }
}
