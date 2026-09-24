'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/auth/supabase/client';
import { authFetch } from '@/lib/utils';
import colors from '@/lib/ui/colors';
import {
  getMarketingPlan,
  formatInr,
  formatPricePlusGst,
  subscriptionTotalsInr,
} from '@/lib/billing/marketing-plans';
import { useSubscription } from '@/app/web/src/hooks/use-subscription';
import {
  buildTryOnboardingPatch,
  parseTryOnboarding,
  type TryOnboardingState,
} from '@/lib/onboarding/try-onboarding';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

type PagePhase = 'loading' | 'checkout' | 'already_subscribed';

const WORKSPACE_PATH = '/content-studio';

/** Clear any leftover activation flags from earlier checkout builds. */
function clearCheckoutSessionFlags() {
  try {
    sessionStorage.removeItem('skalx_pending_plan');
    sessionStorage.removeItem('skalx_checkout_activating');
  } catch {
    /* ignore */
  }
}

/**
 * Subscription checkout.
 * /subscribe?plan=skalx_* → Razorpay Checkout → /content-studio
 */
export default function SubscribePage() {
  const router = useRouter();
  const fetchSubscription = useSubscription((s) => s.fetchSubscription);

  const [authChecked, setAuthChecked] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [phase, setPhase] = useState<PagePhase>('loading');
  const [existingPlanName, setExistingPlanName] = useState<string | null>(null);

  const createInFlightRef = useRef(false);

  useEffect(() => {
    if (!router.isReady) return;
    const fromQuery =
      typeof router.query.plan === 'string' ? router.query.plan.trim() : '';
    if (fromQuery) {
      setSelectedPlanId(fromQuery);
      return;
    }
    try {
      const stored = sessionStorage.getItem('skalx_pending_plan');
      if (stored) setSelectedPlanId(stored);
    } catch {
      /* ignore */
    }
  }, [router.isReady, router.query.plan]);

  const plan = useMemo(
    () => (selectedPlanId ? getMarketingPlan(selectedPlanId) : null),
    [selectedPlanId]
  );

  const totals = useMemo(
    () => (plan ? subscriptionTotalsInr(plan.priceInr) : null),
    [plan]
  );

  const markOnboardingSubscribed = useCallback(async (planId: string) => {
    let existing: TryOnboardingState | null = null;
    try {
      const res = await authFetch('/api/user/preferences');
      const data = await res.json();
      if (data?.ok) {
        existing = parseTryOnboarding(data.preferences);
      }
    } catch {
      /* ignore */
    }
    const patch = buildTryOnboardingPatch({
      ...(existing || {}),
      status: 'subscribed',
      selectedPlanId: planId,
    });
    try {
      await authFetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: { onboarding: patch } }),
      });
    } catch {
      /* non-blocking */
    }
  }, []);

  /** Payment done → product home. Webhooks provision credits in the background. */
  const enterProduct = useCallback(
    (planId: string) => {
      clearCheckoutSessionFlags();
      void markOnboardingSubscribed(planId);
      void fetchSubscription({ force: true });
      window.location.href = WORKSPACE_PATH;
    },
    [fetchSubscription, markOnboardingSubscribed]
  );

  useEffect(() => {
    if (!router.isReady) return;

    (async () => {
      // Drop stale activation UI flags from older builds
      try {
        sessionStorage.removeItem('skalx_checkout_activating');
      } catch {
        /* ignore */
      }

      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        const planForNext =
          (typeof router.query.plan === 'string' && router.query.plan.trim()) ||
          selectedPlanId ||
          'skalx_growth';
        try {
          sessionStorage.setItem('skalx_pending_plan', planForNext);
        } catch {
          /* ignore */
        }
        const next = `/subscribe?plan=${encodeURIComponent(planForNext)}`;
        router.replace(`/auth/signin?next=${encodeURIComponent(next)}`);
        return;
      }
      setUserEmail(data.user.email ?? null);
      setAuthChecked(true);

      try {
        const res = await authFetch('/api/billing/subscriptions/current');
        const subData = await res.json();
        const status = subData?.subscription?.status;
        const entitled =
          subData?.success &&
          subData?.hasSubscription &&
          (status === 'active' || status === 'trialing');
        if (entitled) {
          setExistingPlanName(subData.subscription?.plan?.name || 'current');
          setPhase('already_subscribed');
          return;
        }
      } catch {
        /* proceed to checkout */
      }

      setPhase('checkout');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  function waitForRazorpay(timeoutMs = 10000): Promise<NonNullable<Window['Razorpay']>> {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (window.Razorpay) {
          resolve(window.Razorpay);
          return;
        }
        if (Date.now() - started > timeoutMs) {
          reject(new Error('Razorpay Checkout failed to load. Please refresh and try again.'));
          return;
        }
        window.setTimeout(tick, 50);
      };
      tick();
    });
  }

  async function continueToRazorpay() {
    const planId = selectedPlanId || plan?.id;
    if (!planId || !plan) {
      setError('Plan ID is required. Go back and choose a plan.');
      return;
    }
    if (!userEmail) {
      setError('Email is required. Please sign in again.');
      return;
    }
    if (createInFlightRef.current || submitting) return;

    createInFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    setPaymentMessage(null);

    try {
      const res = await authFetch('/api/billing/subscriptions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          email: userEmail,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        if (
          typeof data.error === 'string' &&
          data.error.toLowerCase().includes('already has an active')
        ) {
          setExistingPlanName(plan.name);
          setPhase('already_subscribed');
          return;
        }
        throw new Error(data.error || 'Could not start checkout');
      }

      if (!data.razorpaySubscriptionId || !data.key) {
        throw new Error('Checkout session incomplete. Please try again.');
      }

      const RazorpayCtor = await waitForRazorpay();
      const totalsLabel = totals ? formatInr(totals.totalInr) : formatPricePlusGst(plan.priceInr);

      const options = {
        key: data.key,
        subscription_id: data.razorpaySubscriptionId,
        name: 'SkalX AI',
        description: `${plan.name} · ${totalsLabel}/month (incl. GST)`,
        prefill: {
          email: userEmail,
        },
        theme: {
          color: colors.primary || '#0088FF',
        },
        handler: function () {
          setSubmitting(false);
          createInFlightRef.current = false;
          enterProduct(planId);
        },
        modal: {
          ondismiss: function () {
            setSubmitting(false);
            createInFlightRef.current = false;
            setPaymentMessage(
              'Checkout closed before payment completed. No charges were applied for this attempt.'
            );
          },
        },
      };

      const rzp = new RazorpayCtor(options);
      rzp.on('payment.failed', () => {
        setSubmitting(false);
        createInFlightRef.current = false;
        setError('Payment failed. You can try again.');
      });
      rzp.open();
    } catch (e: any) {
      setError(e.message || 'Checkout failed');
      setSubmitting(false);
      createInFlightRef.current = false;
    }
  }

  if (!router.isReady || !authChecked || phase === 'loading') {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: colors.background, color: colors.foreground }}
      >
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: colors.primary }} />
      </main>
    );
  }

  if (phase === 'already_subscribed') {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center gap-6 px-4"
        style={{ background: colors.background, color: colors.foreground }}
      >
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-3xl font-bold">You&apos;re already on the {existingPlanName} plan.</h1>
          <p style={{ color: colors.mutedForeground }}>
            No second subscription is needed.
          </p>
          <Link
            href={WORKSPACE_PATH}
            className="inline-flex items-center justify-center rounded-xl px-6 py-3.5 font-semibold"
            style={{
              background: colors.gradientPrimary,
              color: colors.primaryForeground,
              boxShadow: colors.shadowGlow,
            }}
          >
            Go to SkalX
          </Link>
        </div>
      </main>
    );
  }

  if (!plan) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center gap-4 px-4"
        style={{ background: colors.background, color: colors.foreground }}
      >
        <p style={{ color: colors.mutedForeground }}>Choose a plan to continue.</p>
        <Link href="/try" style={{ color: colors.primary }}>
          View pricing
        </Link>
      </main>
    );
  }

  return (
    <>
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <main
        className="min-h-screen px-4 py-12"
        style={{ background: colors.background, color: colors.foreground }}
      >
        <div className="max-w-md mx-auto">
          <Link
            href="/try"
            className="inline-flex items-center gap-2 text-sm mb-8"
            style={{ color: colors.mutedForeground }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div
            className="rounded-[20px] p-8 border"
            style={{
              background: 'hsl(0 0% 15% / 0.75)',
              borderColor: 'hsl(213 100% 55% / 0.35)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
            }}
          >
            <p className="text-sm mb-1" style={{ color: colors.mutedForeground }}>
              Selected plan
            </p>
            <h1 className="text-3xl font-bold mb-4">{plan.name}</h1>

            <div className="mb-2">
              <span className="text-sm" style={{ color: colors.mutedForeground }}>
                Plan price:{' '}
              </span>
              <span className="text-2xl font-bold">
                {formatPricePlusGst(plan.priceInr)}
              </span>
              <span className="text-base ml-1" style={{ color: colors.mutedForeground }}>
                / month
              </span>
            </div>

            {totals && (
              <div
                className="mb-6 rounded-xl px-4 py-3 text-sm space-y-2"
                style={{
                  background: 'hsl(0 0% 100% / 0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex justify-between gap-4">
                  <span style={{ color: colors.mutedForeground }}>Subtotal</span>
                  <span>{formatInr(totals.subtotalInr)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span style={{ color: colors.mutedForeground }}>
                    GST ({Math.round(totals.gstRate * 100)}%)
                  </span>
                  <span>{formatInr(totals.gstAmountInr)}</span>
                </div>
                <div
                  className="flex justify-between gap-4 pt-2 font-semibold"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <span>Due today</span>
                  <span>
                    {formatInr(totals.totalInr)} including{' '}
                    {Math.round(totals.gstRate * 100)}% GST
                  </span>
                </div>
              </div>
            )}

            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-3">
                <Check className="h-4 w-4" style={{ color: colors.primary }} />
                <span>
                  <strong>{plan.imageCredits.toLocaleString('en-IN')}</strong> Image Credits
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-4 w-4" style={{ color: colors.primary }} />
                <span>
                  <strong>{plan.videoCredits.toLocaleString('en-IN')}</strong> Video Credits
                </span>
              </li>
            </ul>

            <p className="text-sm mb-6" style={{ color: colors.mutedForeground }}>
              You&apos;ll be billed {totals ? formatInr(totals.totalInr) : ''} monthly
              (incl. GST).
            </p>

            {paymentMessage && (
              <p
                className="text-sm mb-4 px-3 py-2 rounded-lg"
                style={{
                  background: 'hsl(213 100% 55% / 0.12)',
                  color: colors.foreground,
                }}
              >
                {paymentMessage}
              </p>
            )}

            {error && (
              <p
                className="text-sm mb-4 px-3 py-2 rounded-lg"
                style={{
                  background: 'hsl(0 84% 55% / 0.12)',
                  color: 'hsl(0 84% 70%)',
                }}
              >
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={continueToRazorpay}
              disabled={submitting || !selectedPlanId}
              className="w-full rounded-xl py-3.5 font-semibold text-base transition-opacity disabled:opacity-60"
              style={{
                background: colors.gradientPrimary,
                color: colors.primaryForeground,
                boxShadow: colors.shadowGlow,
              }}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening checkout…
                </span>
              ) : error ? (
                'Try Payment Again'
              ) : (
                'Continue to secure payment'
              )}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
