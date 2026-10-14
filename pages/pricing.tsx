import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import PageSeo from '@/components/seo/PageSeo';
import { HeaderSkeleton } from '@/app/web/src/components/landing-skeletons';
import TryPricingExperience from '@/app/web/src/components/onboarding/TryPricingExperience';
import { supabase } from '@/auth/supabase/client';
import { authFetch } from '@/lib/utils';
import { isMarketingPlanId, type MarketingPlanId } from '@/lib/billing/marketing-plans';
import { trackAuditEvent } from '@/lib/audit/analytics';

const Header = dynamic(() => import('../app/web/src/components/Header'), { ssr: true, loading: HeaderSkeleton });
const Footer = dynamic(() => import('../app/web/src/components/Footer'), { ssr: true });

/**
 * Public plans page.
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
    <div className="min-h-screen relative" style={{ backgroundColor: '#121212' }}>
      <PageSeo
        title="Pricing"
        description="Plans for creating posters, videos, and campaigns with SkalX AI."
        path="/pricing"
      />
      <Header />
      <main className="relative z-10 px-4 sm:px-6 pt-28 pb-16 text-white">
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
          introCopy={
            fromAudit
              ? 'Your free audit is saved to your account. Choose a plan to create campaigns — or head home anytime.'
              : 'Have a website? Start with a free marketing audit on the homepage — no card needed.'
          }
        />
      </main>
      <Footer />
    </div>
  );
}
