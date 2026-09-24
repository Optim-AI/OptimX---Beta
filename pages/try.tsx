'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeft, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/auth/supabase/client';
import { authFetch } from '@/lib/utils';
import colors from '@/lib/ui/colors';
import {
  mapFullAnalyzeToBrandSnapshot,
  saveBrandSnapshot,
} from '@/app/web/src/components/creative-studio/utils';
import type { BrandSnapshot, Product } from '@/app/web/src/components/creative-studio/types';
import {
  buildTryOnboardingPatch,
  getOnboardingDemoCreatives,
  isOnboardingDemoComplete,
  parseTryOnboarding,
  resolveTryEntry,
  WORKSPACE_PATH,
  type OnboardingDemoState,
  type TryOnboardingState,
  type TryOnboardingStatus,
} from '@/lib/onboarding/try-onboarding';
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

  const bootstrap = useCallback(async () => {
    setError(null);
    const { data } = await supabase.auth.getUser();
    const user = data?.user ?? null;

    if (!user) {
      router.replace('/auth/signin?next=/try');
      return;
    }

    let hasActiveSubscriptionLocal = false;
    let activePlanNameLocal: string | null = null;
    try {
      const subRes = await authFetch('/api/billing/subscriptions/current');
      const subData = await subRes.json();
      hasActiveSubscriptionLocal = Boolean(
        subData?.success &&
          subData?.hasSubscription &&
          (subData?.subscription?.status === 'active' ||
            subData?.subscription?.status === 'trialing')
      );
      activePlanNameLocal = subData?.subscription?.plan?.name || null;
    } catch {
      /* ignore — treat as no subscription */
    }
    setHasActiveSubscription(hasActiveSubscriptionLocal);
    setActivePlanName(activePlanNameLocal);

    let snapshot: BrandSnapshot | null = null;
    try {
      const snapRes = await authFetch('/api/brand/snapshot');
      const snapData = await snapRes.json();
      if (snapData?.ok && snapData.brandSnapshot) {
        snapshot = snapData.brandSnapshot as BrandSnapshot;
        setBrandSnapshot(snapshot);
      }
    } catch {
      /* ignore */
    }

    let onboarding: TryOnboardingState | null = null;
    let businessName: string | null = null;
    try {
      const prefRes = await authFetch('/api/user/preferences');
      const prefData = await prefRes.json();
      if (prefData?.ok) {
        onboarding = parseTryOnboarding(prefData.preferences);
      }
    } catch {
      /* ignore */
    }

    try {
      const profileRes = await authFetch('/api/profile/get');
      const profileData = await profileRes.json();
      if (profileData?.success && profileData.data) {
        businessName =
          profileData.data.businessName ?? profileData.data.business_name ?? null;
      }
    } catch {
      /* ignore */
    }

    const destination = resolveTryEntry({
      authenticated: true,
      hasActiveSubscription: hasActiveSubscriptionLocal,
      brandSnapshot: snapshot,
      onboarding,
      businessName,
    });

    if (destination.kind === 'workspace') {
      router.replace(WORKSPACE_PATH);
      return;
    }

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
    }

    const status = onboarding?.status;
    const demoStatus = onboarding?.demo?.status;

    if (isOnboardingDemoComplete(onboarding?.demo)) {
      if (status === 'pricing_seen' || status === 'complete' || status === 'subscribed') {
        setScreen('pricing');
        return;
      }
      setScreen('demo_result');
      return;
    }
    if (status === 'demo_complete' && isOnboardingDemoComplete(onboarding?.demo)) {
      setScreen('demo_result');
      return;
    }
    if (status === 'pricing_seen' || status === 'complete') {
      setScreen('pricing');
      return;
    }
    if (status === 'brand_analyzed') {
      setScreen('reveal');
      return;
    }
    if (status === 'demo_ready' || demoStatus === 'failed') {
      setScreen('demo');
      return;
    }
    if (status === 'demo_pending' || demoStatus === 'generating') {
      // Do not auto-fire generation on refresh — show choice / recover UI
      setScreen('demo');
      return;
    }
    if (status === 'analyzing') {
      setScreen('brand');
      return;
    }

    setScreen('brand');
  }, [router]);

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
      setError(e?.message || 'Something went wrong analyzing your website.');
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
      await saveBrandSnapshot(nextSnapshot);
      setBrandSnapshot(nextSnapshot);
    }

    await persistOnboarding({
      status: 'demo_ready',
      brandName: nextSnapshot?.name || brandName,
      websiteUrl: websiteUrl || undefined,
      source: useImageFallback ? 'image' : 'website',
      demo: demoState || { status: 'not_started', type: 'poster_set' },
      catalogProducts: catalogProducts.slice(0, 24),
      selectedProduct: selectedProduct || null,
    });
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
    await persistOnboarding({
      status: 'pricing_seen',
      brandName: brandSnapshot?.name || brandName,
      demo: demoState || undefined,
      selectedPlanId: selectedPlanId || null,
    });
    setScreen('pricing');
  };

  const selectPlan = async (planId: MarketingPlanId) => {
    setSelectedPlanId(planId);
    await persistOnboarding({
      status: 'pricing_seen',
      brandName: brandSnapshot?.name || brandName,
      demo: demoState || undefined,
      selectedPlanId: planId,
    });
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
      await persistOnboarding({
        status: 'pricing_seen',
        brandName: brandSnapshot?.name || brandName,
        demo: demoState || undefined,
        selectedPlanId: planId,
      });
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

  const glass = {
    background: 'hsl(0 0% 12% / 0.75)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
  } as const;

  if (screen === 'loading') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#121212' }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.primary }} />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#121212', color: colors.foreground }}>
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-5">
        <Link href="/">
          <img src="/images/SkalX_Logo.png" alt="SkalX AI" className="h-5 w-auto" />
        </Link>
        {(screen === 'reveal' ||
          screen === 'demo' ||
          screen === 'demo_generating' ||
          screen === 'demo_result' ||
          screen === 'pricing') && (
          <button
            type="button"
            onClick={() => {
              if (screen === 'demo' || screen === 'demo_generating') setScreen('reveal');
              else if (screen === 'demo_result') setScreen('demo');
              else if (screen === 'pricing') setScreen('demo_result');
              else setScreen('brand');
            }}
            className="inline-flex items-center gap-2 text-sm"
            style={{ color: colors.mutedForeground, background: 'transparent', border: 'none' }}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        )}
      </header>

      <main className="relative z-10 px-4 sm:px-6 pb-16">
        {screen === 'brand' && (
          <div className="max-w-xl mx-auto mt-8 sm:mt-16">
            <h1 className="text-3xl sm:text-4xl font-normal leading-tight mb-3">
              Let&apos;s get to know your brand.
            </h1>
            <p className="text-base mb-10 font-light" style={{ color: colors.mutedForeground }}>
              A few details — then SkalX does the rest.
            </p>

            <form
              onSubmit={onContinueFromBrand}
              className="rounded-2xl p-6 sm:p-8 space-y-6"
              style={glass}
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
                  required
                  className="w-full h-12 rounded-xl px-4 outline-none"
                  style={{
                    background: 'hsl(0 0% 8%)',
                    border: `1px solid ${colors.border}`,
                    color: colors.foreground,
                  }}
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
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="Paste your website URL"
                    className="w-full h-12 rounded-xl px-4 outline-none"
                    style={{
                      background: 'hsl(0 0% 8%)',
                      border: `1px solid ${colors.border}`,
                      color: colors.foreground,
                    }}
                  />
                  <button
                    type="button"
                    className="mt-3 text-sm"
                    style={{
                      color: colors.primary,
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                    }}
                    onClick={() => setUseImageFallback(true)}
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
                    className="flex flex-col items-center justify-center gap-2 rounded-xl py-10 cursor-pointer"
                    style={{
                      border: '1px dashed rgba(255,255,255,0.18)',
                      background: 'hsl(0 0% 8%)',
                    }}
                  >
                    <Upload className="h-6 w-6" style={{ color: colors.primary }} />
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
                      className="mt-4 max-h-40 rounded-lg object-contain mx-auto"
                    />
                  )}
                  <button
                    type="button"
                    className="mt-3 text-sm"
                    style={{
                      color: colors.primary,
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
                <p className="text-sm" role="alert" style={{ color: 'hsl(0 84% 60%)' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full h-12 rounded-xl font-medium disabled:opacity-60"
                style={{
                  background: colors.gradientPrimary,
                  color: colors.primaryForeground,
                  border: 'none',
                }}
              >
                {saving ? 'Working…' : 'Continue'}
              </button>
            </form>
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
          />
        )}

        {screen === 'demo' && (
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
          />
        )}
      </main>
    </div>
  );
}
