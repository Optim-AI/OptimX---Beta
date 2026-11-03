'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeft, Upload } from 'lucide-react';
import { ArcSpinner } from '@/app/web/src/components/ui/loaders';
import { supabase } from '@/auth/supabase/client';
import { authFetch } from '@/lib/utils';
import colors from '@/lib/ui/colors';
import {
  mapFullAnalyzeToBrandSnapshot,
  saveBrandSnapshot,
} from '@/app/web/src/components/creative-studio/utils';
import type { BrandSnapshot, Product } from '@/app/web/src/components/creative-studio/types';
import type { BrandResearch } from '@/lib/research/brand-research';
import {
  buildTryOnboardingPatch,
  getOnboardingDemoCreatives,
  isOnboardingDemoComplete,
  parseTryOnboarding,
  WORKSPACE_PATH,
  type OnboardingDemoState,
  type TryOnboardingState,
  type TryOnboardingStatus,
} from '@/lib/onboarding/try-onboarding';
import { fetchPostAuthDestination } from '@/lib/auth/client-post-auth';
import { trackAuditEvent } from '@/lib/audit/analytics';
import type { PostAuthTryStep } from '@/lib/auth/post-auth-decision';
import { productFromImageUrl } from '@/lib/onboarding/product-scene-guidance';
import {
  getMarketingPlan,
  isMarketingPlanId,
  type MarketingPlanId,
} from '@/lib/billing/marketing-plans';
import TryPricingExperience from '@/app/web/src/components/onboarding/TryPricingExperience';
import BrandAnalysisProgress from '@/app/web/src/components/onboarding/BrandAnalysisProgress';
import BrandIntelligenceReveal from '@/app/web/src/components/onboarding/BrandIntelligenceReveal';
import DemoChoicePanel from '@/app/web/src/components/onboarding/DemoChoicePanel';
import DemoGeneratingProgress from '@/app/web/src/components/onboarding/DemoGeneratingProgress';
import DemoCreativeGallery from '@/app/web/src/components/onboarding/DemoCreativeGallery';
import TryStepper from '@/app/web/src/components/onboarding/TryStepper';
import { Enter, OnboardingStage } from '@/app/web/src/components/onboarding/ob-ui';

type Screen =
  | 'loading'
  | 'brand'
  | 'analyzing'
  | 'reveal'
  | 'demo'
  | 'demo_generating'
  | 'demo_result'
  | 'pricing';

type AnalysisPhase = 'idle' | 'started' | 'processing' | 'complete' | 'error';

function normalizeWebsiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isLikelyUrl(raw: string): boolean {
  const t = raw.trim();
  return /^https?:\/\//i.test(t) || /^[a-z0-9.-]+\.[a-z]{2,}/i.test(t);
}

/** Step index for TryStepper (Your brand → Brand profile → Free demo → Choose a plan). */
const SCREEN_STEP: Record<Screen, number> = {
  loading: 0,
  brand: 0,
  analyzing: 0,
  reveal: 1,
  demo: 2,
  demo_generating: 2,
  demo_result: 2,
  pricing: 3,
};

/** Live brand tile that fills in as the name and website are typed. Decorative. */
function BrandMonogram({ name, url }: { name: string; url: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || null;
  const host = url.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  return (
    <div aria-hidden className="mb-7 flex items-center gap-3">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-2xl font-display text-lg font-bold transition-all duration-500 ${
          initials
            ? 'bg-paper text-ink'
            : 'ob-shimmer bg-paper/[0.06] text-paper/30 ring-1 ring-paper/10'
        }`}
      >
        {initials ?? '?'}
      </span>
      <span className="min-w-0">
        <span className={`block truncate text-sm font-medium transition-colors ${name.trim() ? 'text-paper' : 'text-paper/30'}`}>
          {name.trim() || '—'}
        </span>
        <span className="block truncate text-xs text-paper/45">{host || '·'}</span>
      </span>
    </div>
  );
}

/**
 * Canonical Try Now acquisition flow.
 * Phase 8: brand → analysis → reveal → isolated poster demo (no billing credits).
 */
export default function TryPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('loading');
  const [brandName, setBrandName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [productImage, setProductImage] = useState<string | null>(null);
  const [useImageFallback, setUseImageFallback] = useState(false);
  const [brandSnapshot, setBrandSnapshot] = useState<BrandSnapshot | null>(null);
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [demoState, setDemoState] = useState<OnboardingDemoState | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [research, setResearch] = useState<BrandResearch | null>(null);
  const [researchPending, setResearchPending] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<MarketingPlanId | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [activePlanName, setActivePlanName] = useState<string | null>(null);
  const [checkoutContinuing, setCheckoutContinuing] = useState(false);
  const demoRequestInFlight = React.useRef(false);

  const queryPrefillDone = React.useRef(false);

  const persistOnboarding = useCallback(async (partial: Partial<TryOnboardingState> & { status: TryOnboardingStatus }) => {
    const onboarding = buildTryOnboardingPatch(partial);
    await authFetch('/api/user/preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences: { onboarding } }),
    });
    return onboarding;
  }, []);

  const applyTryStep = useCallback(
    (step: PostAuthTryStep | string | null | undefined, onboarding: TryOnboardingState | null) => {
      const demoStatus = onboarding?.demo?.status;

      if (step === 'pricing' || step === 'pricing_seen' || step === 'skipped') {
        setScreen('pricing');
        return;
      }
      if (step === 'demo_complete') {
        setScreen(isOnboardingDemoComplete(onboarding?.demo) ? 'demo_result' : 'demo');
        return;
      }
      if (step === 'brand_analyzed') {
        setScreen('reveal');
        return;
      }
      if (step === 'demo_ready' || step === 'demo_pending') {
        setScreen('demo');
        return;
      }
      if (demoStatus === 'failed') {
        setScreen('demo');
        return;
      }
      if (demoStatus === 'generating') {
        setScreen('demo');
        return;
      }
      // brand | brand_started | analyzing | default
      setScreen('brand');
    },
    []
  );

  const bootstrap = useCallback(async () => {
    setError(null);
    const { data } = await supabase.auth.getUser();
    const user = data?.user ?? null;

    if (!user) {
      const next = router.asPath.split('#')[0] || '/try';
      router.replace(`/auth/signin?next=${encodeURIComponent(next)}`);
      return;
    }

    // Canonical post-auth decision (same as Google callback / email login).
    // Never treat a failed lookup as a new/empty account.
    const decision = await fetchPostAuthDestination();
    if (!decision.ok) {
      setError(decision.error);
      return;
    }

    const fromAudit = router.query.from === 'audit';
    const exploring = router.query.explore === '1';
    // A paid account goes to the product. A free audit stays in this onboarding UI
    // even if the audit already saved a brand name.
    if (decision.destination === 'workspace' && !fromAudit && !exploring) {
      router.replace(WORKSPACE_PATH);
      return;
    }

    // Independent lookups — run together so the first screen appears sooner.
    const [subData, snapData, prefData] = await Promise.all(
      ['/api/billing/subscriptions/current', '/api/brand/snapshot', '/api/user/preferences'].map(
        (path) =>
          authFetch(path)
            .then((r) => r.json())
            .catch(() => null)
      )
    );

    // UI-only; routing already decided
    const hasActiveSubscriptionLocal = Boolean(
      subData?.success &&
        subData?.hasSubscription &&
        (subData?.subscription?.status === 'active' ||
          subData?.subscription?.status === 'trialing')
    );
    setHasActiveSubscription(hasActiveSubscriptionLocal);
    setActivePlanName(subData?.subscription?.plan?.name || null);
    if (hasActiveSubscriptionLocal && (decision.destination === 'workspace' || fromAudit)) {
      router.replace(WORKSPACE_PATH);
      return;
    }

    const snapshot: BrandSnapshot | null =
      snapData?.ok && snapData.brandSnapshot ? (snapData.brandSnapshot as BrandSnapshot) : null;
    if (snapshot) setBrandSnapshot(snapshot);

    // Failed lookup → screen still resumes from resolver step
    const onboarding: TryOnboardingState | null = prefData?.ok
      ? parseTryOnboarding(prefData.preferences)
      : null;

    if (onboarding?.brandName) setBrandName(onboarding.brandName);
    if (onboarding?.websiteUrl) setWebsiteUrl(onboarding.websiteUrl);
    if (onboarding?.productImagePreview) {
      setProductImage(onboarding.productImagePreview);
      setUseImageFallback(true);
    }
    if (onboarding?.demo) setDemoState(onboarding.demo);
    if (onboarding?.catalogProducts?.length) {
      setCatalogProducts(onboarding.catalogProducts);
    }
    if (onboarding?.selectedProduct) {
      setSelectedProduct(onboarding.selectedProduct);
    }
    if (onboarding?.selectedPlanId && isMarketingPlanId(onboarding.selectedPlanId)) {
      setSelectedPlanId(onboarding.selectedPlanId);
    } else {
      // Plan picked on /pricing before signing up — keep it highlighted on the plan step.
      try {
        const pending = sessionStorage.getItem('skalx_pending_plan');
        if (pending && isMarketingPlanId(pending)) setSelectedPlanId(pending);
      } catch {
        /* ignore */
      }
    }

    // Trial "Explore SkalX" (and ?explore=1): leave onboarding and enter the product.
    // Status complete so the next login does not resume /try pricing.
    if (exploring) {
      try {
        await persistOnboarding({
          status: 'complete',
          brandName: snapshot?.name || onboarding?.brandName,
          websiteUrl: onboarding?.websiteUrl,
          demo: onboarding?.demo,
          selectedPlanId:
            onboarding?.selectedPlanId && isMarketingPlanId(onboarding.selectedPlanId)
              ? onboarding.selectedPlanId
              : null,
        });
      } catch {
        /* still enter the product */
      }
      router.replace(WORKSPACE_PATH);
      return;
    }

    // Free audit already produced the research. Stay in this onboarding UI and open its pricing step.
    if (fromAudit) {
      try {
        const claimRes = await authFetch('/api/onboarding/claim', { method: 'POST' });
        const claimBody = await claimRes.json().catch(() => null);
        if (claimBody?.claimed) trackAuditEvent('audit_claimed', { via: 'try' });
      } catch {
        /* guest cookie may already be cleared */
      }
      try {
        await persistOnboarding({
          status: 'pricing_seen',
          brandName: snapshot?.name || onboarding?.brandName,
          websiteUrl: onboarding?.websiteUrl,
          demo: onboarding?.demo,
          selectedPlanId:
            onboarding?.selectedPlanId && isMarketingPlanId(onboarding.selectedPlanId)
              ? onboarding.selectedPlanId
              : null,
        });
      } catch {
        /* still show pricing */
      }
      setScreen('pricing');
      return;
    }

    applyTryStep(decision.step ?? onboarding?.status ?? 'brand', onboarding);
  }, [router, applyTryStep, persistOnboarding]);

  useEffect(() => {
    if (!router.isReady) return;
    bootstrap();
  }, [router.isReady, bootstrap]);

  // Prefill from hero query params once
  useEffect(() => {
    if (!router.isReady || queryPrefillDone.current) return;
    const website =
      typeof router.query.website === 'string' ? router.query.website.trim() : '';
    const brand =
      typeof router.query.brand === 'string' ? router.query.brand.trim() : '';
    if (website) {
      setWebsiteUrl(website);
      queryPrefillDone.current = true;
    } else if (brand) {
      if (isLikelyUrl(brand)) setWebsiteUrl(normalizeWebsiteUrl(brand));
      else setBrandName(brand);
      queryPrefillDone.current = true;
    }
  }, [router.isReady, router.query.website, router.query.brand]);

  const onFileChange = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Image must be under 4MB for onboarding.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      setProductImage(result);
      setUseImageFallback(true);
    };
    reader.readAsDataURL(file);
  };

  const runWebsiteAnalysis = async () => {
    const name = brandName.trim();
    const url = normalizeWebsiteUrl(websiteUrl);
    if (!name) {
      setError('Enter your brand or company name.');
      return;
    }
    if (!url) {
      setError('Paste a website URL, or upload a product image instead.');
      return;
    }
    if (/\s/.test(websiteUrl.trim()) || !isLikelyUrl(websiteUrl.replace(/^https?:\/\//i, ''))) {
      setError('That doesn\'t look like a website address. Try something like yourbrand.com.');
      return;
    }

    setError(null);
    setSaving(true);
    setCatalogLoading(true);
    setRevealError(null);
    setScreen('analyzing');
    setAnalysisPhase('started');

    try {
      await authFetch('/api/profile/upsert', {
        method: 'POST',
        body: JSON.stringify({ businessName: name }),
      });

      await persistOnboarding({
        status: 'analyzing',
        brandName: name,
        websiteUrl: url,
        source: 'website',
        productImagePreview: null,
      });

      setAnalysisPhase('processing');

      // Deep market research (~1 min) runs alongside and is saved server-side;
      // the reveal shows it when it lands. Never blocks onboarding.
      setResearch(null);
      setResearchPending(true);
      authFetch('/api/brand/research', { method: 'POST', body: JSON.stringify({ url }) })
        .then((r) => r.json())
        .then((j) => {
          if (j?.ok && j.research) setResearch(j.research as BrandResearch);
        })
        .catch(() => null)
        .finally(() => setResearchPending(false));

      const analyzePromise = authFetch('/api/brand/fullAnalyze', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      // Same catalogue path as Ad Studio / Content Studio
      const scanPromise = authFetch('/api/content-studio/scan', {
        method: 'POST',
        body: JSON.stringify({ url }),
      }).catch(() => null);

      const [analyzeResponse, scanResponse] = await Promise.all([
        analyzePromise,
        scanPromise,
      ]);

      const data = await analyzeResponse.json();
      if (!analyzeResponse.ok || !data?.result) {
        throw new Error(data?.error || data?.details || 'Brand analysis failed');
      }

      const mapped = mapFullAnalyzeToBrandSnapshot(data.result);
      if (!mapped.name || mapped.name === 'Unknown Brand') {
        mapped.name = name;
      }

      let products: Product[] = [];
      if (scanResponse) {
        try {
          const scanData = await scanResponse.json();
          if (scanData?.ok && Array.isArray(scanData.products) && scanData.products.length > 0) {
            products = scanData.products as Product[];
          }
        } catch {
          /* fall through to image fallback */
        }
      }
      if (!products.length && mapped.productImages?.length) {
        products = mapped.productImages
          .slice(0, 12)
          .map((imgUrl, i) => productFromImageUrl(imgUrl, i));
      }

      if (products[0]?.product_images?.length) {
        mapped.productImages = products[0].product_images.slice(0, 4);
        if (products[0].product_name && !products[0].product_name.startsWith('Product ')) {
          mapped.offering = products[0].product_name;
        }
        if (products[0].category) {
          mapped.productCategory = products[0].category;
        }
      }

      await saveBrandSnapshot(mapped);
      setBrandSnapshot(mapped);
      setCatalogProducts(products);
      setSelectedProduct(products[0] || null);
      setCatalogLoading(false);

      await persistOnboarding({
        status: 'brand_analyzed',
        brandName: mapped.name || name,
        websiteUrl: url,
        source: 'website',
        catalogProducts: products.slice(0, 24),
        selectedProduct: products[0] || null,
      });

      setAnalysisPhase('complete');
      setScreen('reveal');
    } catch (e: any) {
      setAnalysisPhase('error');
      setError(
        `${e?.message || 'Something went wrong analyzing your website.'} Check the address and try again, or upload a product image instead.`
      );
      setScreen('brand');
    } finally {
      setSaving(false);
      setCatalogLoading(false);
    }
  };

  const runImageFallback = async () => {
    const name = brandName.trim();
    if (!name) {
      setError('Enter your brand or company name.');
      return;
    }
    if (!productImage) {
      setError('Upload a product image to continue.');
      return;
    }

    setError(null);
    setSaving(true);
    setScreen('analyzing');
    setAnalysisPhase('started');

    try {
      await authFetch('/api/profile/upsert', {
        method: 'POST',
        body: JSON.stringify({ businessName: name }),
      });

      await persistOnboarding({
        status: 'analyzing',
        brandName: name,
        source: 'image',
      });

      setAnalysisPhase('processing');

      const minimal: BrandSnapshot = {
        name,
        description: '',
        audience: '',
        offering: '',
        tone: 'professional',
        logo: productImage,
        productImages: productImage ? [productImage] : [],
      };
      await saveBrandSnapshot(minimal);
      setBrandSnapshot(minimal);

      const singleProduct: Product | null = productImage
        ? {
            product_name: name,
            price: null,
            description: '',
            key_benefits: [],
            product_images: [productImage],
            target_audience: '',
            emotional_angles: [],
            use_cases: [],
            short_benefit: '',
          }
        : null;
      setCatalogProducts(singleProduct ? [singleProduct] : []);
      setSelectedProduct(singleProduct);

      await persistOnboarding({
        status: 'brand_analyzed',
        brandName: name,
        source: 'image',
        productImagePreview: productImage,
        catalogProducts: singleProduct ? [singleProduct] : [],
        selectedProduct: singleProduct,
      });

      setAnalysisPhase('complete');
      setScreen('reveal');
    } catch (e: any) {
      setAnalysisPhase('error');
      setError(e?.message || 'Could not save your brand. Please try again.');
      setScreen('brand');
    } finally {
      setSaving(false);
    }
  };

  const onContinueFromBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (useImageFallback || (!websiteUrl.trim() && productImage)) {
      runImageFallback();
    } else {
      runWebsiteAnalysis();
    }
  };

  const goToDemo = async () => {
    setRevealError(null);
    if (catalogProducts.length > 0 && !selectedProduct) {
      setRevealError('Select a product to continue.');
      return;
    }

    let nextSnapshot = brandSnapshot;
    if (selectedProduct && brandSnapshot) {
      const images = (selectedProduct.product_images || []).slice(0, 4);
      nextSnapshot = {
        ...brandSnapshot,
        offering: selectedProduct.product_name || brandSnapshot.offering,
        productCategory:
          selectedProduct.category || brandSnapshot.productCategory,
        productImages: images.length ? images : brandSnapshot.productImages,
        audience:
          selectedProduct.target_audience || brandSnapshot.audience,
        coreValueProp:
          selectedProduct.short_benefit || brandSnapshot.coreValueProp,
        description:
          selectedProduct.description || brandSnapshot.description,
      };
      try {
        await saveBrandSnapshot(nextSnapshot);
      } catch {
        setRevealError('Could not save your product choice. Check your connection and try again.');
        return;
      }
      setBrandSnapshot(nextSnapshot);
    }

    try {
      await persistOnboarding({
        status: 'demo_ready',
        brandName: nextSnapshot?.name || brandName,
        websiteUrl: websiteUrl || undefined,
        source: useImageFallback ? 'image' : 'website',
        demo: demoState || { status: 'not_started', type: 'poster_set' },
        catalogProducts: catalogProducts.slice(0, 24),
        selectedProduct: selectedProduct || null,
      });
    } catch {
      /* progress save is best-effort; the demo step itself still works */
    }
    setError(null);
    setScreen('demo');
  };

  const requestPosterDemo = async () => {
    if (demoRequestInFlight.current) return;
    if (isOnboardingDemoComplete(demoState)) {
      setScreen('demo_result');
      return;
    }

    demoRequestInFlight.current = true;
    setError(null);
    setScreen('demo_generating');
    setDemoState((prev) => ({
      status: 'generating',
      type: 'poster_set',
      creatives: prev?.creatives || [],
      progressStage: 'planning',
    }));

    // Poll preferences while the long POST runs — progress stages are real server writes
    const pollId = window.setInterval(async () => {
      try {
        const prefRes = await authFetch('/api/user/preferences');
        const prefData = await prefRes.json();
        if (prefData?.ok) {
          const onboarding = parseTryOnboarding(prefData.preferences);
          if (onboarding?.demo) setDemoState(onboarding.demo);
        }
      } catch {
        /* ignore poll errors */
      }
    }, 2500);

    try {
      const res = await authFetch('/api/onboarding/demo', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        if (data?.code === 'ALREADY_COMPLETED' && isOnboardingDemoComplete(data?.demo)) {
          setDemoState(data.demo);
          setScreen('demo_result');
          return;
        }
        if (data?.code === 'IN_PROGRESS') {
          setError(
            data.error ||
              'Your demo is already being created. Please wait a moment and try again.'
          );
          setDemoState(
            data.demo || { status: 'generating', type: 'poster_set', progressStage: 'building' }
          );
          setScreen('demo');
          return;
        }
        setDemoState(
          data?.demo || {
            status: 'failed',
            type: 'poster_set',
            errorMessage: data?.error,
          }
        );
        setError(data?.error || 'Could not create your creatives. Please try again.');
        setScreen('demo');
        return;
      }

      setDemoState(data.demo);
      if (data.brandName) setBrandName(data.brandName);
      setScreen('demo_result');
    } catch (e: any) {
      setError(e?.message || 'Could not create your creatives. Please try again.');
      setDemoState({
        status: 'failed',
        type: 'poster_set',
        errorMessage: e?.message,
      });
      setScreen('demo');
    } finally {
      window.clearInterval(pollId);
      demoRequestInFlight.current = false;
    }
  };

  const goToNextAfterDemo = async () => {
    try {
      await persistOnboarding({
        status: 'pricing_seen',
        brandName: brandSnapshot?.name || brandName,
        demo: demoState || undefined,
        selectedPlanId: selectedPlanId || null,
      });
    } catch {
      /* best-effort; pricing still renders */
    }
    setScreen('pricing');
    window.scrollTo({ top: 0 });
  };

  const selectPlan = async (planId: MarketingPlanId) => {
    setSelectedPlanId(planId);
    try {
      await persistOnboarding({
        status: 'pricing_seen',
        brandName: brandSnapshot?.name || brandName,
        demo: demoState || undefined,
        selectedPlanId: planId,
      });
    } catch {
      /* best-effort */
    }
  };

  /** Phase 10 handoff only — does not open Razorpay or create a subscription. */
  const continueToCheckoutHandoff = async (planId: MarketingPlanId) => {
    if (!isMarketingPlanId(planId) || !getMarketingPlan(planId)) {
      setError('Invalid plan selection.');
      return;
    }
    if (hasActiveSubscription) {
      router.push(WORKSPACE_PATH);
      return;
    }
    setCheckoutContinuing(true);
    try {
      try {
        await persistOnboarding({
          status: 'pricing_seen',
          brandName: brandSnapshot?.name || brandName,
          demo: demoState || undefined,
          selectedPlanId: planId,
        });
      } catch {
        /* never block checkout on a progress save */
      }
      try {
        sessionStorage.setItem('skalx_pending_plan', planId);
      } catch {
        /* ignore */
      }
      // Phase 11 will own checkout; this only hands off the selected plan.
      router.push(`/subscribe?plan=${encodeURIComponent(planId)}`);
    } finally {
      setCheckoutContinuing(false);
    }
  };

  const demoCreatives = useMemo(
    () => getOnboardingDemoCreatives(demoState),
    [demoState]
  );

  if (screen === 'loading') {
    return (
      <div
        className="ob-root relative min-h-screen flex flex-col items-center justify-center gap-4 px-6"
        style={{ backgroundColor: 'var(--color-ink)', color: colors.foreground }}
      >
        <OnboardingStage step={0} />
        {error ? (
          <>
            <p className="relative z-10" style={{ color: 'hsl(0 84% 70%)', textAlign: 'center' }}>{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                void bootstrap();
              }}
              className="ob-btn relative z-10 rounded-full px-5 py-2.5 font-semibold"
            >
              Retry
            </button>
          </>
        ) : (
          <>
            <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl ob-glass">
              <ArcSpinner className="h-7 w-7 animate-spin" style={{ color: 'var(--color-accent-on-ink)' }} />
            </span>
            <span className="sr-only">Loading</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="ob-root min-h-screen relative" style={{ backgroundColor: 'var(--color-ink)', color: colors.foreground }}>
      <OnboardingStage
        step={SCREEN_STEP[screen]}
        busy={screen === 'analyzing' || screen === 'demo_generating'}
      />

      <header className="sticky top-0 z-20 grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-ink/85 backdrop-blur-sm border-b border-paper/[0.06] px-4 py-4 sm:px-8 sm:py-5">
        <Link href="/" className="justify-self-start">
          <img src="/images/SkalX_Logo.png" alt="SkalX AI" className="h-5 w-auto" />
        </Link>
        <TryStepper current={SCREEN_STEP[screen]} />
        <div className="justify-self-end">
          {router.query.from !== 'audit' &&
            (screen === 'reveal' ||
              screen === 'demo' ||
              screen === 'demo_result' ||
              screen === 'pricing') && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  if (screen === 'demo') setScreen('reveal');
                  else if (screen === 'demo_result') setScreen('demo');
                  else if (screen === 'pricing')
                    setScreen(demoCreatives.length > 0 ? 'demo_result' : 'demo');
                  else setScreen('brand');
                }}
                className="group inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-paper/65 transition-colors hover:bg-paper/[0.06] hover:text-paper"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Back
              </button>
            )}
        </div>
      </header>

      {/* Keyed by screen so each step plays its entrance when it appears. */}
      <main key={screen} className="relative z-10 px-4 sm:px-6 pb-16">
        {screen === 'brand' && (
          <div className="max-w-xl mx-auto mt-6 sm:mt-14">
            <Enter>
              <BrandMonogram name={brandName} url={websiteUrl} />
            </Enter>
            <Enter delay={80}>
              <h1 className="mb-3 font-display text-[2rem] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-5xl">
                Let&apos;s get to know <span className="ob-gradient-text">your brand.</span>
              </h1>
            </Enter>
            <Enter delay={160}>
              <p className="mb-8 text-base text-paper/65 sm:mb-10">
                Tell us your brand and website. SkalX reads it, builds your brand profile and makes
                free sample ads — about two minutes, no card needed.
              </p>
            </Enter>

            <Enter delay={240}>
            <form
              onSubmit={onContinueFromBrand}
              className="ob-glass rounded-3xl p-6 sm:p-8 space-y-6"
            >
              <div>
                <label
                  htmlFor="brand-name"
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.foreground }}
                >
                  What&apos;s your brand or company called?
                </label>
                <input
                  id="brand-name"
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Brand name"
                  autoComplete="organization"
                  autoFocus={!brandName}
                  required
                  className="ob-input w-full h-12 rounded-2xl px-4 text-paper"
                />
              </div>

              {!useImageFallback ? (
                <div>
                  <label
                    htmlFor="brand-url"
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.foreground }}
                  >
                    Where can we learn about your brand?
                  </label>
                  <input
                    id="brand-url"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    aria-describedby="brand-url-hint"
                    placeholder="yourbrand.com"
                    className="ob-input w-full h-12 rounded-2xl px-4 text-paper"
                  />
                  <p id="brand-url-hint" className="mt-2 text-xs" style={{ color: colors.mutedForeground }}>
                    Your homepage or Shopify store works best. We only read public pages.
                  </p>
                  <button
                    type="button"
                    className="mt-3 text-sm py-1"
                    style={{
                      color: 'var(--color-accent-on-ink)',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                    }}
                    onClick={() => {
                      setError(null);
                      setUseImageFallback(true);
                    }}
                  >
                    Don&apos;t have a website? Upload a product image.
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: colors.foreground }}>
                    No website? No problem.
                  </p>
                  <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                    Upload a product image so we can still personalize your experience.
                  </p>
                  <label
                    htmlFor="product-image"
                    className="group flex flex-col items-center justify-center gap-3 rounded-2xl py-10 cursor-pointer border border-dashed border-paper/20 bg-black/30 transition-colors hover:border-paper/40 hover:bg-paper/[0.03] focus-within:border-accent-on-ink"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-paper/[0.06] ring-1 ring-paper/15 transition-transform duration-300 group-hover:-translate-y-1">
                      <Upload className="h-5 w-5" style={{ color: 'var(--color-accent-on-ink)' }} />
                    </span>
                    <span className="text-sm" style={{ color: colors.mutedForeground }}>
                      {productImage ? 'Replace product image' : 'Upload product image'}
                    </span>
                    <input
                      id="product-image"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {productImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={productImage}
                      alt="Product preview"
                      className="ob-develop mt-4 max-h-40 rounded-xl object-contain mx-auto"
                    />
                  )}
                  <button
                    type="button"
                    className="mt-3 text-sm"
                    style={{
                      color: 'var(--color-accent-on-ink)',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                    }}
                    onClick={() => {
                      setUseImageFallback(false);
                      setProductImage(null);
                    }}
                  >
                    Use a website URL instead
                  </button>
                </div>
              )}

              {error && (
                <p
                  className="ob-enter text-sm rounded-xl px-3 py-2"
                  role="alert"
                  style={{ color: 'hsl(0 84% 72%)', background: 'hsl(0 84% 55% / 0.1)' }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="ob-btn w-full h-12 rounded-full font-medium disabled:opacity-60"
              >
                {saving ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <ArcSpinner className="h-4 w-4 animate-spin" /> Working…
                  </span>
                ) : useImageFallback ? (
                  'Continue with this image'
                ) : (
                  'Analyze my brand'
                )}
              </button>
            </form>
            </Enter>
          </div>
        )}

        {screen === 'analyzing' && (
          <BrandAnalysisProgress
            brandName={brandName}
            analysisPhase={analysisPhase}
          />
        )}

        {screen === 'reveal' && (
          <BrandIntelligenceReveal
            brand={brandSnapshot}
            brandName={brandName}
            products={catalogProducts}
            selectedProduct={selectedProduct}
            onSelectProduct={(p) => {
              setSelectedProduct(p);
              setRevealError(null);
            }}
            onContinue={goToDemo}
            continueError={revealError}
            catalogLoading={catalogLoading}
            research={research ?? brandSnapshot?.research ?? null}
            researchPending={researchPending}
          />
        )}

        {(screen === 'demo' || (screen === 'demo_result' && demoCreatives.length === 0)) && (
          <DemoChoicePanel
            error={error}
            failedMessage={
              demoState?.status === 'failed' ? demoState.errorMessage : null
            }
            onCreate={requestPosterDemo}
            disabled={demoRequestInFlight.current}
          />
        )}

        {screen === 'demo_generating' && (
          <DemoGeneratingProgress
            progressStage={demoState?.progressStage}
            creativeCount={demoState?.creatives?.length || 0}
          />
        )}

        {screen === 'demo_result' && demoCreatives.length > 0 && (
          <DemoCreativeGallery
            brandName={brandSnapshot?.name || brandName || 'your brand'}
            creatives={demoCreatives}
            onContinue={goToNextAfterDemo}
          />
        )}

        {screen === 'pricing' && (
          <TryPricingExperience
            brandName={brandSnapshot?.name || brandName}
            selectedPlanId={selectedPlanId}
            hasActiveSubscription={hasActiveSubscription}
            activePlanName={activePlanName}
            onSelectPlan={selectPlan}
            onContinue={continueToCheckoutHandoff}
            onBack={() => setScreen('demo_result')}
            continuing={checkoutContinuing}
            showBack={router.query.from !== 'audit'}
            exploreHref={WORKSPACE_PATH}
            introCopy={
              router.query.from === 'audit'
                ? 'Your free audit is saved. Choose a plan to create this, or request a trial and keep exploring.'
                : undefined
            }
          />
        )}
      </main>
    </div>
  );
}
