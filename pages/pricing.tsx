import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PageSeo from '@/components/seo/PageSeo';
import TryPricingExperience from '@/app/web/src/components/onboarding/TryPricingExperience';
import { supabase } from '@/auth/supabase/client';
import { authFetch } from '@/lib/utils';
import { isMarketingPlanId, type MarketingPlanId } from '@/lib/billing/marketing-plans';
import { trackAuditEvent } from '@/lib/audit/analytics';

import MarketingLayout from '@/app/web/src/components/marketing/MarketingLayout';
import SprintCard from '@/app/web/src/components/marketing/SprintCard';
import { Eyebrow } from '@/app/web/src/components/marketing/ui';

/**
 * Public pricing: done-for-you Launch Creative Sprint first, self-serve plans below.
 * Self-serve selection/checkout logic below is unchanged.
 * After a free audit: auth → /pricing?from=audit → home (or checkout).
 * Selection hands off to /subscribe; nothing here grants access.
 */
export default function PricingPage() {
  const router = useRouter();
  const fromAudit = router.isReady && router.query.from === 'audit';
  const [selectedPlanId, setSelectedPlanId] = useState<MarketingPlanId | null>(null);
  const [activePlanName, setActivePlanName] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || cancelled) return;

      if (fromAudit && !claimed) {
        try {
          const claimRes = await authFetch('/api/onboarding/claim', { method: 'POST' });
          const claimBody = await claimRes.json().catch(() => null);
          if (!cancelled && claimBody?.claimed) {
            trackAuditEvent('audit_claimed', { via: 'pricing' });
            setClaimed(true);
          }
        } catch {
          /* guest cookie may already be cleared */
        }
      }

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
  }, [router.isReady, fromAudit, claimed]);

  useEffect(() => {
    if (fromAudit) document.getElementById('self-serve')?.scrollIntoView();
  }, [fromAudit]);

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

  return (
    <MarketingLayout>
      <PageSeo
        title="Pricing"
        description="Launch Creative Sprint: 12 ad creatives + 2 video ads in 7 days for ₹9,999 + GST (founding price). Or make creatives yourself from ₹3,999/month + GST."
        path="/pricing"
      />
      <section aria-labelledby="pricing-heading" className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 md:pb-28 md:pt-16">
        <div className="max-w-2xl">
          <Eyebrow>Pricing</Eyebrow>
          <h1 id="pricing-heading" className="font-display text-[clamp(2.5rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.02em]">
            Done for you, at a fixed price.
          </h1>
          <p className="mt-5 text-lg text-ink-soft sm:text-xl">
            The Launch Creative Sprint is our main offer. Prefer to make creatives yourself? The self-serve plans
            are below.
          </p>
        </div>
        <div className="mt-12">
          <SprintCard variant="full" />
        </div>
        <p className="mt-6 text-sm text-ink-soft">All prices are + 18% GST.</p>
      </section>

      <section id="self-serve" aria-label="Self-serve plans" className="scroll-mt-16 bg-ink px-4 py-16 text-paper sm:px-6 md:py-24">
        <TryPricingExperience
          brandName=""
          selectedPlanId={selectedPlanId}
          hasActiveSubscription={Boolean(activePlanName)}
          activePlanName={activePlanName}
          onSelectPlan={setSelectedPlanId}
          onContinue={continueToCheckout}
          onBack={() => router.push('/')}
          continuing={continuing}
          backLabel="← Back to home"
          hideComingSoonRows
          headingLevel="h2"
          title="Prefer to do it yourself?"
          subtitle="Self-serve plans for teams who want to make creatives with SkalX."
          introCopy={
            fromAudit
              ? 'Your free audit is saved to your account. Choose a plan to create campaigns — or head home anytime.'
              : 'Prices are per month + 18% GST.'
          }
        />
      </section>
    </MarketingLayout>
  );
}
