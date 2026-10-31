import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PageSeo from '@/components/seo/PageSeo';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import FreeTrialRequestDialog from '@/app/web/src/components/onboarding/FreeTrialRequestDialog';
import { supabase } from '@/auth/supabase/client';
import { authFetch } from '@/lib/utils';
import {
  MARKETING_SUBSCRIPTION_PLANS,
  isMarketingPlanId,
  type MarketingPlanId,
} from '@/lib/billing/marketing-plans';
import { BUY_CREDITS_PRICING } from '@/lib/billing/pricing';
import { PLAN_COMPARISON_ROWS, type ComparisonCell } from '@/lib/onboarding/plan-comparison';
import { WORKSPACE_PATH } from '@/lib/onboarding/try-onboarding';
import { auditPricingPath } from '@/lib/audit/analytics';
import MarketingLayout from '@/app/web/src/components/marketing/MarketingLayout';
import PlanCards from '@/app/web/src/components/marketing/PlanCards';
import { ButtonLink, Eyebrow } from '@/app/web/src/components/marketing/ui';
import { SIGNUP_HREF } from '@/lib/marketing/content';

function trackSafe(event: string, data?: Record<string, string>) {
  void import('@vercel/analytics')
    .then((m) => m.track(event, data))
    .catch(() => undefined);
}

/** Rows for features that are live; "coming soon" rows are never shown publicly. */
const LIVE_COMPARISON_ROWS = PLAN_COMPARISON_ROWS.filter(
  (row) => !Object.values(row.values).includes('coming_soon')
);

function Cell({ value }: { value: ComparisonCell }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-accent" aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-ink-mute" aria-label="Not included" />;
  return <span className="font-medium">{String(value)}</span>;
}

/**
 * Public pricing: monthly self-serve plans (light cards).
 * Session/claim/subscription checks and checkout hand-off are unchanged from the previous page.
 * Public marketing plans. A free audit does not stay here — `?from=audit` continues
 * into the onboarding pricing step. Nothing here grants access.
 */
export default function PricingPage() {
  const router = useRouter();
  const fromAudit = router.isReady && router.query.from === 'audit';
  const [selectedPlanId, setSelectedPlanId] = useState<MarketingPlanId | null>(null);
  const [activePlanName, setActivePlanName] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [trialDialogOpen, setTrialDialogOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!router.isReady || !fromAudit) return;
    void router.replace(auditPricingPath());
  }, [router, router.isReady, fromAudit]);

  useEffect(() => {
    if (!router.isReady || fromAudit) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || cancelled) return;
      setSignedIn(true);

      try {
        const res = await authFetch('/api/billing/subscriptions/current');
        const sub = await res.json();
        const status = sub?.subscription?.status;
        if (!cancelled && sub?.success && sub?.hasSubscription && (status === 'active' || status === 'trialing')) {
          setActivePlanName(sub.subscription?.plan?.name || 'SkalX');
        }
      } catch {
        /* treat as not subscribed */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, fromAudit]);

  useEffect(() => {
    trackSafe('pricing_viewed', { brand: 'unknown' });
  }, []);

  const continueToCheckout = (planId: MarketingPlanId) => {
    if (!isMarketingPlanId(planId)) return;
    setContinuing(true);
    try {
      sessionStorage.setItem('skalx_pending_plan', planId);
    } catch {
      /* ignore */
    }
    router.push(`/subscribe?plan=${encodeURIComponent(planId)}`);
  };

  const choosePlan = (planId: MarketingPlanId) => {
    if (!isMarketingPlanId(planId) || continuing) return;
    setSelectedPlanId(planId);
    trackSafe('plan_selected', { plan: planId });
    trackSafe('checkout_intent', { plan: planId });
    continueToCheckout(planId);
  };

  if (fromAudit) return null;

  return (
    <MarketingLayout>
      <PageSeo
        title="Pricing"
        description="SkalX plans from ₹3,999/month + GST: market research, strategy and ad creatives in one place. Monthly, cancel anytime."
        path="/pricing"
      />
      <section aria-labelledby="pricing-heading" className="relative isolate">
        <div aria-hidden className="sx-grid-bg pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-12 sm:px-6 md:pb-32 md:pt-20">
          <div className="max-w-3xl">
            <Eyebrow>Pricing</Eyebrow>
            <h1 id="pricing-heading" className="font-display text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.045em]">
              Simple monthly plans.
            </h1>
            <p className="mt-5 text-lg text-ink-soft sm:text-xl">
              Research, strategy and content in one place. Pick the credits you need; top up or cancel anytime.
            </p>
          </div>

          <div className="mt-14">
            {activePlanName ? (
              <div className="sx-crop max-w-xl rounded-[24px] border border-line bg-surface p-8">
                <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">You&apos;re already on the {activePlanName} plan.</h2>
                <p className="mt-2 text-ink-soft">Plan changes aren&apos;t available here. Continue into your workspace.</p>
                <ButtonLink href={WORKSPACE_PATH} className="mt-6" arrow>
                  Go to SkalX
                </ButtonLink>
              </div>
            ) : (
              <PlanCards
                headingLevel="h2"
                onChoosePlan={choosePlan}
                onRequestTrial={() => {
                  trackSafe('trial_request_opened', { source: 'pricing' });
                  setTrialDialogOpen(true);
                }}
                selectedPlanId={selectedPlanId}
                continuing={continuing}
              />
            )}
          </div>
          {!activePlanName ? (
            <div className="mt-8 text-lg">
              Not ready to pay?{' '}
              <button
                type="button"
                onClick={() => {
                  trackSafe('explore_clicked', { source: 'pricing', signed_in: signedIn ? 'yes' : 'no' });
                  trackSafe('trial_request_opened', { source: 'pricing_explore' });
                  setTrialDialogOpen(true);
                }}
                className="sx-link font-medium"
              >
                Explore SkalX first →
              </button>
            </div>
          ) : null}
          <p className="mt-3 text-sm text-ink-soft">All prices are + 18% GST. Plans are monthly; cancel anytime.</p>
        </div>
      </section>

      <FreeTrialRequestDialog
        open={trialDialogOpen}
        onOpenChange={setTrialDialogOpen}
        exploreHref={signedIn ? '/try' : SIGNUP_HREF}
      />

      <section aria-labelledby="compare-heading" className="sx-sheet bg-paper-deep">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <h2 id="compare-heading" className="font-display text-[clamp(2.1rem,4.6vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.03em]">
            Compare plans
          </h2>
          <div className="mt-10 overflow-x-auto rounded-[20px] border border-line bg-surface shadow-[0_30px_60px_-46px_rgba(23,20,15,0.6)]">
            <table className="w-full min-w-[520px] border-collapse text-left text-[15px]">
              <thead>
                <tr className="border-b border-line bg-paper/60">
                  <th scope="col" className="p-4 font-medium text-ink-soft">
                    Feature
                  </th>
                  {MARKETING_SUBSCRIPTION_PLANS.map((p) => (
                    <th key={p.id} scope="col" className="p-4 text-center font-semibold">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LIVE_COMPARISON_ROWS.map((row) => (
                  <tr key={row.id} className="border-b border-line transition-colors last:border-0 hover:bg-paper/70">
                    <th scope="row" className="p-4 font-normal">
                      {row.label}
                      {row.hint ? <span className="mt-0.5 block text-[13px] text-ink-mute">{row.hint}</span> : null}
                    </th>
                    {MARKETING_SUBSCRIPTION_PLANS.map((p) => (
                      <td key={p.id} className="p-4 text-center">
                        <Cell value={row.values[p.id]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="sx-lift rounded-[20px] border border-line bg-surface p-7">
              <h3 className="font-display text-xl font-semibold tracking-[-0.015em]">How credits work</h3>
              <p className="mt-3 text-ink-soft">
                <strong className="text-ink">Image Credits</strong> — one successful image generation uses one Image
                Credit.
              </p>
              <p className="mt-2 text-ink-soft">
                <strong className="text-ink">Video Credits</strong> — video generation uses Video Credits based on
                duration (for example, 15 seconds uses 300 Video Credits).
              </p>
            </div>
            <div className="sx-lift rounded-[20px] border border-line bg-surface p-7">
              <h3 className="font-display text-xl font-semibold tracking-[-0.015em]">Need more credits?</h3>
              <p className="mt-3 text-ink-soft">After you subscribe, top up anytime (pay-as-you-go):</p>
              <ul className="mt-2 space-y-1 text-ink-soft">
                <li>
                  Image: ₹{BUY_CREDITS_PRICING.imageCreditPriceInr} per Image Credit (minimum {BUY_CREDITS_PRICING.minQuantity})
                </li>
                <li>
                  Video: ₹{BUY_CREDITS_PRICING.videoCreditBlockPriceInr} per 100 Video Credits (minimum{' '}
                  {BUY_CREDITS_PRICING.minVideoQuantity}, in steps of {BUY_CREDITS_PRICING.videoQuantityStep})
                </li>
              </ul>
            </div>
          </div>

          <p className="mt-10 text-ink-soft">
            Not sure yet?{' '}
            <Link href="/#start" className="sx-link font-medium text-ink">
              Get a free ad for your brand
            </Link>{' '}
            first.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
