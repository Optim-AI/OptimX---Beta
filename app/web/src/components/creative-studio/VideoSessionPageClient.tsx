// pages/brand-studio/video/[sessionId].tsx
// Video Generation Session Page

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { showAlert, showError } from '@/app/web/src/components/ui/alert-modal-api';
import dynamic from 'next/dynamic';
import colors from '@/lib/ui/colors';
import {
  type BrandSnapshot,
  type AdBuilderData,
  type SessionListItem,
  type CreativeStudioSession,
  type GeneratedVideo,
  type CommercialProductionStatus,
  type GeneratedVideoQcSummary,
  BrandOnboarding,
  BrandGuidelineModal,
  SessionNameModal,
  formatTimestamp,
  DEFAULT_AD_BUILDER_DATA,
  normalizeAdSetup,
  mapFullAnalyzeToBrandSnapshot,
} from '@/app/web/src/components/creative-studio';
import { authFetch, safeResponseJson } from '@/lib/utils';
import { supabase } from '@/auth/supabase/client';
import StudioErrorBoundary from '@/app/web/src/components/creative-studio/StudioErrorBoundary';
import {
  assertNativeDurationInvariant,
  buildStudioAvailableAssets,
  mapStudioFormToCampaignBrief,
  type CreativePlanSummary,
} from '@/lib/creative-studio/commercial-production/studio-mapper';
import { isCampaignDurationSeconds } from '@/lib/creative-studio/commercial-production/campaign/campaign-duration';

const Sidebar = dynamic(() => import('@/app/web/src/components/Sidebar'), { ssr: false });
const VideoStudioWorkspace = dynamic(
  () => import('@/app/web/src/components/creative-studio/VideoStudioWorkspace'),
  { ssr: false }
);

// NOTE: Do not patch console.error / add window listeners at module scope.
// That breaks Fast Refresh (re-wraps on every HMR) and can trigger reload loops.

/** Build full voiceover script from scene-by-scene storyboard lines. */
function getVoiceoverFromStoryboard(storyboard: Array<{ voiceover_line?: string; voiceover_script?: string }> | null | undefined): string {
  if (!storyboard?.length) return '';
  return storyboard
    .map((s) => (s.voiceover_line || s.voiceover_script || '').trim())
    .filter(Boolean)
    .join(' ');
}

/** Prefer the canonical full script; fall back to joining per-scene lines. */
function getCanonicalVoiceover(
  voiceoverScript: string | undefined,
  storyboard: Array<{ voiceover_line?: string; voiceover_script?: string }> | null | undefined
): string {
  const canonical = voiceoverScript?.trim();
  if (canonical) return canonical;
  return getVoiceoverFromStoryboard(storyboard);
}

/** Vercel caps request bodies at ~4.5MB; large base64 galleries exceed this before the API runs. */
const MAX_VIDEO_API_REF_IMAGES = 3;
const VERCEL_SAFE_BODY_BYTES = 4 * 1024 * 1024;

async function compressDataUrlForVideoApi(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:') || dataUrl.length < 600_000) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1600;
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (w <= 0 || h <= 0) {
        resolve(dataUrl);
        return;
      }
      if (w > maxDim || h > maxDim) {
        const r = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        let q = 0.86;
        let out = canvas.toDataURL('image/jpeg', q);
        while (out.length > 1_100_000 && q > 0.52) {
          q -= 0.07;
          out = canvas.toDataURL('image/jpeg', q);
        }
        resolve(out);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function prepareVideoGenerateImages(args: {
  hero_image: string | null;
  brand_logo: string | null;
  product_images: string[];
}): Promise<{ hero_image: string | null; brand_logo: string | null; product_images: string[] }> {
  const { hero_image, brand_logo, product_images } = args;
  const max = MAX_VIDEO_API_REF_IMAGES;
  const slotsForProducts = Math.max(
    0,
    max - (hero_image ? 1 : 0) - (brand_logo ? 1 : 0)
  );
  const productSlice = product_images
    .filter((img) => img && img !== hero_image && img !== brand_logo)
    .slice(0, slotsForProducts);

  // Fetched product photos are sent unchanged — server passes JPEG/PNG bytes through to Veo.
  const compressedLogo = brand_logo ? await compressDataUrlForVideoApi(brand_logo) : null;

  return {
    hero_image: hero_image,
    brand_logo: compressedLogo,
    product_images: productSlice,
  };
}

function getSelectedConcept(data: AdBuilderData) {
  if (!data.adConcepts?.length) return null;
  return data.adConcepts.find((c) => c.id === data.selectedConceptId) ?? data.adConcepts[0];
}

function getCommercialBrief(data: AdBuilderData): string {
  const written = data.userDescription?.trim();
  if (written) return written;
  const product = data.product?.product_name || 'the product';
  return `Cinematic ${data.adSetup.creativeFormat.toLowerCase()} commercial for ${product}.`;
}

// ============== Types ==============

type AdBuilderStep = 1 | 2 | 3;

type ProductData = {
  product_name: string;
  brand_name: string;
  product_images: string[];
  hero_image: string | null;
  brand_logo: string | null;
  category: string;
  product_url?: string;
};

// ============== Page Component ==============

export default function VideoSessionPage() {
  const router = useRouter();
  const { id: sessionId, autoGenerate } = router.query;

  // Session state — start unlocked so the studio chrome is visible immediately
  const [session, setSession] = useState<CreativeStudioSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session list for sidebar
  const [videoSessions, setVideoSessions] = useState<SessionListItem[]>([]);

  // Brand state
  const [brand, setBrand] = useState<BrandSnapshot | null>(null);
  const [showBrandOnboarding, setShowBrandOnboarding] = useState(false);
  const [showBrandGuidelineModal, setShowBrandGuidelineModal] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<'website' | 'manual'>('website');
  const [isAnalyzingBrand, setIsAnalyzingBrand] = useState(false);

  // Ad Builder state
  const [step, setStep] = useState<AdBuilderStep>(1);
  const [adBuilderData, setAdBuilderData] = useState<AdBuilderData>(DEFAULT_AD_BUILDER_DATA);
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  // Loading states
  const [isScrapingProduct, setIsScrapingProduct] = useState(false);
  const [isFetchingLogo, setIsFetchingLogo] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

  /** Film style variants from preview API (InVideo: generate multiple options). */
  type PromptVariantPreview = {
    filmStyleId: string;
    label: string;
    summary: string;
    promptPreview: string;
    estimatedTokens: number;
  };
  const [promptVariants, setPromptVariants] = useState<PromptVariantPreview[]>([]);
  const [selectedFilmStyleId, setSelectedFilmStyleId] = useState<string | null>(null);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);

  // Video generation progress steps (0–5: each step completes, then next animates)
  const [generationStep, setGenerationStep] = useState(0);
  const [productionStatus, setProductionStatus] = useState<CommercialProductionStatus>('idle');
  const [pendingRegeneration, setPendingRegeneration] = useState<{
    nextVersion: string;
    reason: string;
    requiredChanges: string[];
    preservedRequirements: string[];
  } | null>(null);

  // Product input state
  const [productUrl, setProductUrl] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  // New session modal state
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Delete confirmation modal state
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // Credits state
  const [credits, setCredits] = useState<number | null>(null);
  const [videoCredits, setVideoCredits] = useState<{
    subscription: number;
    addon: number;
    total: number;
  } | null>(null);
  const [hasInsufficientCredits, setHasInsufficientCredits] = useState(false);

  // Auth state
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  // Auto-save ref
  const autoSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // ============== Wait for Auth ==============

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted && session) {
        setIsAuthReady(true);
      }
    });

    const checkSession = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data?.session) {
        setIsAuthReady(true);
      } else {
        // Don't hang on Loading session forever when unauthenticated.
        setIsLoading(false);
        setError('Please sign in to open Brand Studio video sessions.');
      }
    };

    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Keep selectedVideoId in sync with generatedVideos
  useEffect(() => {
    if (generatedVideos.length === 0) {
      setSelectedVideoId(null);
      return;
    }
    const ids = new Set(generatedVideos.map((v) => v.id));
    if (!selectedVideoId || !ids.has(selectedVideoId)) {
      setSelectedVideoId(generatedVideos[generatedVideos.length - 1].id);
    }
  }, [generatedVideos, selectedVideoId]);

  // Stage-based progress while awaiting the commercial API (no fake %).
  const isExtendedDuration = (adBuilderData.adSetup?.duration ?? 15) === 30;
  useEffect(() => {
    if (!isGeneratingVideo) {
      setGenerationStep(0);
      return;
    }
    setGenerationStep(0);
    setProductionStatus((prev) =>
      prev === 'regenerating' ? 'regenerating' : 'planning'
    );
    // Stages: planning(0) → preparing(1) → generating(2) → evaluating(3)
    const stepDuration = isExtendedDuration ? 25_000 : 12_000;
    const interval = setInterval(() => {
      setGenerationStep((prev) => {
        const next = Math.min(prev + 1, 3);
        const stages: CommercialProductionStatus[] = [
          'planning',
          'preparing',
          'generating',
          'evaluating',
        ];
        setProductionStatus((cur) =>
          cur === 'regenerating' && next < 2 ? 'regenerating' : stages[next]
        );
        return next;
      });
    }, stepDuration);
    return () => clearInterval(interval);
  }, [isGeneratingVideo, isExtendedDuration]);

  // ============== Load Session ==============

  // Track previous session ID for saving on switch
  const prevSessionIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    if (!isAuthReady) return;
    if (!sessionId || typeof sessionId !== 'string') {
      setIsLoading(false);
      setError('Missing session id');
      return;
    }

    async function loadSession() {
      setIsLoading(true);
      setError(null);

      // Reset state before loading new session
      setSession(null);
      setStep(1);
      setAdBuilderData(DEFAULT_AD_BUILDER_DATA);
      setGeneratedVideos([]);
      setSelectedVideoId(null);
      setProductUrl('');
      setUploadedImages([]);
      setSelectedImageIndex(null);

      try {
        // Handle 'new' session - load brand from database
        if (sessionId === 'new') {
          try {
            const brandResponse = await authFetch('/api/brand/snapshot');
            const brandData = await brandResponse.json();
            if (brandData.ok && brandData.brandSnapshot) {
              setBrand(brandData.brandSnapshot);
            } else {
              setShowBrandOnboarding(true);
            }
          } catch (err) {
            console.error('Error loading brand snapshot:', err);
            setShowBrandOnboarding(true);
          }
          setIsLoading(false);
          prevSessionIdRef.current = typeof sessionId === 'string' ? sessionId : null;
          return;
        }

        // Fetch existing session
        const response = await authFetch(`/api/creative-studio/sessions?id=${sessionId}`);
        const data = await response.json();

        if (!data.ok) {
          throw new Error(data.error || 'Failed to load session');
        }

        const loadedSession = data.session as CreativeStudioSession;
        
        console.log('[DEBUG] Loading session:', {
          sessionId,
          hasAdBuilderData: !!loadedSession.adBuilderData,
          savedStep: (loadedSession.adBuilderData as any)?.step,
          hasProduct: !!(loadedSession.adBuilderData as any)?.product,
          productName: (loadedSession.adBuilderData as any)?.product?.product_name,
          productUrl: (loadedSession.adBuilderData as any)?.product?.product_url,
        });
        
        setSession(loadedSession);
        setBrand(loadedSession.brandSnapshot);

        // Restore Ad Builder data
        if (loadedSession.adBuilderData && typeof loadedSession.adBuilderData === 'object') {
          const savedAdBuilderData = {
            ...DEFAULT_AD_BUILDER_DATA,
            ...(loadedSession.adBuilderData as AdBuilderData),
          } as AdBuilderData;
          // Use brand guideline logo for product when session has brand logo but product has no logo
          const brandLogoUrl = loadedSession.brandSnapshot?.logo ?? loadedSession.brandSnapshot?.logoUrl;
          if (savedAdBuilderData.product && brandLogoUrl && !savedAdBuilderData.product.brand_logo) {
            savedAdBuilderData.product = {
              ...savedAdBuilderData.product,
              brand_logo: brandLogoUrl,
            };
          }
          savedAdBuilderData.adSetup = normalizeAdSetup(savedAdBuilderData.adSetup || {});
          savedAdBuilderData.voiceover = {
            ...DEFAULT_AD_BUILDER_DATA.voiceover,
            ...(savedAdBuilderData.voiceover || {}),
          };
          savedAdBuilderData.onScreenText = {
            ...DEFAULT_AD_BUILDER_DATA.onScreenText,
            ...(savedAdBuilderData.onScreenText || {}),
          };
          setAdBuilderData(savedAdBuilderData);
          const savedStep = (savedAdBuilderData as any).step;
          const stepMap: Record<number, AdBuilderStep> = { 1: 1, 2: 1, 3: 2, 4: 3 };
          setStep(stepMap[savedStep] ?? 1);
          
          // Restore product-related state from adBuilderData.product
          if (savedAdBuilderData.product) {
            // Restore productUrl if saved
            if (savedAdBuilderData.product.product_url) {
              setProductUrl(savedAdBuilderData.product.product_url);
            }
            // Restore uploadedImages from product_images
            if (savedAdBuilderData.product.product_images && savedAdBuilderData.product.product_images.length > 0) {
              setUploadedImages(savedAdBuilderData.product.product_images);
              // Find selected image index based on hero_image
              const heroIndex = savedAdBuilderData.product.product_images.findIndex(
                img => img === savedAdBuilderData.product?.hero_image
              );
              setSelectedImageIndex(heroIndex >= 0 ? heroIndex : 0);
            }
          }
        }

        // Restore generated videos
        if (loadedSession.generatedVideos) {
          const videos = loadedSession.generatedVideos as GeneratedVideo[];
          setGeneratedVideos(videos);
          if (videos.length > 0) {
            setSelectedVideoId(videos[videos.length - 1].id);
          }
        }

        prevSessionIdRef.current = typeof sessionId === 'string' ? sessionId : null;
      } catch (err: any) {
        console.error('Error loading session:', err);
        setError(err.message || 'Failed to load session');
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();
  }, [sessionId, isAuthReady, router.isReady]);

  // ============== Load Video Sessions for Sidebar ==============

  useEffect(() => {
    if (!isAuthReady) return;

    async function loadVideoSessions() {
      try {
        const response = await authFetch('/api/creative-studio/sessions?type=video');
        const data = await response.json();

        if (data.ok) {
          setVideoSessions(
            data.sessions.map((s: any) => ({
              id: s.id,
              name: s.name,
              sessionType: s.sessionType,
              updatedAt: s.updatedAt,
              createdAt: s.createdAt,
            }))
          );
        }
      } catch (err) {
        console.error('Error loading video sessions:', err);
      }
    }

    loadVideoSessions();
  }, [isAuthReady]);

  // ============== Load Credits ==============

  const loadCredits = useCallback(async () => {
    try {
      const response = await authFetch('/api/credits/balance');
      const data = await response.json();
      if (data.success) {
        setCredits(data.credits);
        setVideoCredits(data.videoCredits);
        setHasInsufficientCredits((data.videoCredits?.total ?? 0) <= 0);
      }
    } catch (err) {
      console.error('Error loading credits:', err);
    }
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    loadCredits();
  }, [isAuthReady, loadCredits]);

  // ============== Navigation Warning During Video Generation ==============

  useEffect(() => {
    if (!isGeneratingVideo) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Video generation is in progress. Are you sure you want to leave?';
      return e.returnValue;
    };

    const handleRouteChange = () => {
      if (isGeneratingVideo) {
        const confirmed = window.confirm('Video generation is in progress. Are you sure you want to leave? Your video may be lost.');
        if (!confirmed) {
          router.events.emit('routeChangeError');
          throw 'Route change aborted due to video generation in progress';
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    router.events.on('routeChangeStart', handleRouteChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [isGeneratingVideo, router.events]);

  // ============== Auto-save Session ==============

  const saveSession = useCallback(async () => {
    if (!sessionId || sessionId === 'new' || !brand) return;

    setIsSaving(true);

    try {
      const payload = {
        brandSnapshot: brand,
        adBuilderData: { ...adBuilderData, step },
        generatedVideos,
      };

      const response = await authFetch(`/api/creative-studio/sessions?id=${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.ok) {
        console.error('Failed to save session:', data.error);
      }
    } catch (err) {
      console.error('Error saving session:', err);
    } finally {
      setIsSaving(false);
    }
  }, [sessionId, brand, adBuilderData, step, generatedVideos]);

  useEffect(() => {
    if (!sessionId || sessionId === 'new') return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      saveSession();
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [step, adBuilderData, generatedVideos, saveSession]);

  // ============== Brand Handlers ==============

  async function saveBrandSnapshot(brandData: BrandSnapshot) {
    try {
      await authFetch('/api/brand/snapshot', {
        method: 'PUT',
        body: JSON.stringify({ brandSnapshot: brandData }),
      });
    } catch (err) {
      console.error('Error saving brand snapshot:', err);
    }
  }

  async function handleWebsiteAnalyzeForEdit(website: string): Promise<BrandSnapshot | null> {
    try {
      const response = await authFetch('/api/brand/fullAnalyze', {
        method: 'POST',
        body: JSON.stringify({ url: website }),
      });
      const data = await safeResponseJson<{ result?: unknown; error?: string }>(response);
      if (!data.result) {
        showError(data.error || 'Could not analyze website. Please try manual setup.');
        return null;
      }
      return mapFullAnalyzeToBrandSnapshot(data.result);
    } catch (err: any) {
      showError(`Error analyzing website: ${err?.message || 'Unknown error'}. Please try manual setup.`);
      return null;
    }
  }

  async function handleWebsiteBrandSetup(website: string) {
    setIsAnalyzingBrand(true);

    try {
      const response = await authFetch('/api/brand/fullAnalyze', {
        method: 'POST',
        body: JSON.stringify({ url: website }),
      });

      const data = await safeResponseJson<{ result?: unknown; error?: string }>(response);

      // API returns { result: {...} } on success, { error: string } on failure
      if (data.result) {
        const brandSnapshot = mapFullAnalyzeToBrandSnapshot(data.result);
        setBrand(brandSnapshot);
        saveBrandSnapshot(brandSnapshot);
        setShowBrandOnboarding(false);
      } else {
        console.error('Brand analysis failed:', data.error || 'Unknown error');
        showError(`Could not analyze website: ${data.error || 'Unknown error'}. Please try manual setup.`);
        // Keep modal open on error
      }
    } catch (err: any) {
      console.error('Brand analysis error:', err);
      showError(`Error analyzing website: ${err.message || 'Unknown error'}. Please try manual setup.`);
      // Keep modal open on error
    } finally {
      setIsAnalyzingBrand(false);
    }
  }

  function handleManualBrandSetup(data: {
    name: string;
    offering: string;
    audience: string;
    personality?: string;
    colors?: { primary?: string; secondary?: string; accent?: string };
    tagline?: string;
  }) {
    const brandSnapshot: BrandSnapshot = {
      name: data.name,
      description: `${data.name} offers ${data.offering} to ${data.audience}.`,
      audience: data.audience,
      offering: data.offering,
      tone: data.personality || 'professional',
      colors: data.colors,
      tagline: data.tagline,
      personality: data.personality,
    };

    setBrand(brandSnapshot);
    saveBrandSnapshot(brandSnapshot);
    setShowBrandOnboarding(false);
  }

  function handleSkipBrandSetup() {
    setShowBrandOnboarding(false);
    const minimalBrand: BrandSnapshot = {
      name: 'My Brand',
      description: '',
      audience: '',
      offering: '',
      tone: 'professional',
    };
    setBrand(minimalBrand);
    saveBrandSnapshot(minimalBrand);
  }

  function updateBrandGuideline(updated: BrandSnapshot) {
    setBrand(updated);
    saveBrandSnapshot(updated);
    setShowBrandGuidelineModal(false);
  }

  async function handleWebsiteReanalyze(website: string): Promise<BrandSnapshot | null> {
    setIsAnalyzingBrand(true);
    try {
      const response = await authFetch('/api/brand/fullAnalyze', {
        method: 'POST',
        body: JSON.stringify({ url: website }),
      });
      const data = await safeResponseJson<{ result?: unknown; error?: string }>(response);
      if (data.result) {
        const result = data.result as Record<string, any>;
        const brandSnapshot: BrandSnapshot = {
          name: result.facts?.company_name || 'Unknown Brand',
          description: result.positioning?.primary_value_proposition || '',
          audience: result.facts?.who_it_is_for?.join(', ') || '',
          offering: result.facts?.what_they_sell?.join(', ') || '',
          tone: result.brandVoice || result.personality || 'professional',
          logo: result.logo,
          logoUrl: result.logoUrl,
          primaryColors: result.primaryColors,
          fontStyles: result.fontStyles,
          brandVoice: result.brandVoice,
          coreValueProp: result.coreValueProp,
          ctaPatterns: result.ctaPatterns,
          productCategory: result.productCategory,
          pricePositioning: result.pricePositioning,
          personality: result.personality,
          colors: result.colors
            ? {
                primary: result.colors.primary ?? undefined,
                secondary: result.colors.secondary ?? undefined,
                accent: result.colors.accent ?? undefined,
              }
            : undefined,
        };
        setBrand(brandSnapshot);
        saveBrandSnapshot(brandSnapshot);
        setShowBrandGuidelineModal(false);
        return brandSnapshot;
      } else {
        showError(data.error || 'Could not analyze website. Please try again.');
        return null;
      }
    } catch (err: any) {
      console.error('Brand re-analyze error:', err);
      showError(`Error analyzing website: ${err?.message || 'Unknown error'}. Please try again.`);
      return null;
    } finally {
      setIsAnalyzingBrand(false);
    }
  }

  // ============== Product Handlers ==============

  async function handleProductUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productUrl.trim()) return;

    setIsScrapingProduct(true);
    try {
      const response = await authFetch('/api/creative-studio/scrape-product', {
        method: 'POST',
        body: JSON.stringify({ url: productUrl }),
      });

      const result = await response.json();
      if (!result.ok) throw new Error(result.error);

      // Fetch logo
      setIsFetchingLogo(true);
      try {
        const domain = new URL(productUrl).hostname.replace('www.', '');
        const logoResponse = await authFetch('/api/creative-studio/fetch-logo', {
          method: 'POST',
          body: JSON.stringify({ domain }),
        });

        const logoResult = await logoResponse.json();
        const logoUrl = logoResult.ok ? logoResult.logo_url : null;

        const imageDataUrls = result.product.product_images || [];

        setAdBuilderData({
          ...adBuilderData,
          product: {
            product_name: result.product.product_name,
            brand_name: result.product.brand_name,
            product_images: imageDataUrls,
            hero_image: imageDataUrls[0] || null,
            brand_logo: logoUrl,
            category: result.product.category,
            product_url: productUrl,
          },
        });

        setUploadedImages(imageDataUrls);
        setSelectedImageIndex(0);
      } finally {
        setIsFetchingLogo(false);
      }
    } catch (error: any) {
      showError(`Failed to scrape product: ${error.message}`);
    } finally {
      setIsScrapingProduct(false);
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';

    const existing = adBuilderData.product?.product_images || [];
    const remaining = Math.max(0, 3 - existing.length);
    if (remaining === 0) {
      showError('You can add up to 3 reference images.');
      return;
    }

    const readers = files.slice(0, remaining).map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then((dataUrls) => {
      if (adBuilderData.product) {
        const merged = [...adBuilderData.product.product_images, ...dataUrls].slice(0, 3);
        setUploadedImages(merged);
        const nextIndex = selectedImageIndex ?? 0;
        setAdBuilderData({
          ...adBuilderData,
          product: {
            ...adBuilderData.product,
            product_images: merged,
            hero_image: adBuilderData.product.hero_image || merged[0] || null,
          },
        });
        if (selectedImageIndex === null) setSelectedImageIndex(nextIndex);
        return;
      }

      setUploadedImages(dataUrls);
      setSelectedImageIndex(0);
      setAdBuilderData({
        ...adBuilderData,
        product: {
          product_name: 'Uploaded Product',
          brand_name: brand?.name || 'Brand',
          product_images: dataUrls,
          hero_image: dataUrls[0] || null,
          brand_logo: brand?.logo || null,
          category: 'general',
        },
      });
    });
  }

  // ============== Creative Strategy ==============

  async function handleGenerateStrategy(): Promise<{
    strategy: AdBuilderData['creativeStrategy'];
    concepts: NonNullable<AdBuilderData['adConcepts']>;
    selectedConcept: NonNullable<AdBuilderData['adConcepts']>[number] | null;
  } | null> {
    if (!adBuilderData.product) return null;

    setIsGeneratingStrategy(true);
    try {
      const response = await authFetch('/api/creative-studio/generate-strategy', {
        method: 'POST',
        body: JSON.stringify({
          product_name: adBuilderData.product.product_name,
          brand_name: adBuilderData.product.brand_name,
          category: adBuilderData.product.category,
          product_description: adBuilderData.userDescription,
          product_url: adBuilderData.product.product_url,
          user_description: adBuilderData.userDescription,
          campaign_goal: adBuilderData.adSetup.campaignGoal,
          audience: adBuilderData.adSetup.audience,
          creative_format: adBuilderData.adSetup.creativeFormat,
          hook_type: adBuilderData.adSetup.hookType,
        }),
      });

      const result = await safeResponseJson<{
        ok: boolean;
        error?: string;
        strategy?: AdBuilderData['creativeStrategy'];
        concepts?: AdBuilderData['adConcepts'];
      }>(response);
      if (!result.ok) throw new Error(result.error);

      const concepts = result.concepts || [];
      const firstId = concepts[0]?.id;
      const selectedId =
        adBuilderData.selectedConceptId && concepts.some((c) => c.id === adBuilderData.selectedConceptId)
          ? adBuilderData.selectedConceptId
          : firstId;
      const selectedConcept = concepts.find((c) => c.id === selectedId) ?? concepts[0] ?? null;

      setAdBuilderData((prev) => ({
        ...prev,
        creativeStrategy: result.strategy,
        adConcepts: concepts,
        selectedConceptId: selectedId,
        voiceover: result.strategy?.cta
          ? { ...prev.voiceover, cta: result.strategy.cta }
          : prev.voiceover,
      }));

      if (!result.strategy) return null;
      return {
        strategy: result.strategy,
        concepts,
        selectedConcept: selectedConcept ?? null,
      };
    } catch (error: any) {
      showError(`Failed to generate strategy: ${error.message}`);
      return null;
    } finally {
      setIsGeneratingStrategy(false);
    }
  }

  // ============== Script Generation ==============

  async function handleGenerateScript(): Promise<Record<string, any> | null> {
    if (!adBuilderData.product) return null;

    let strategy = adBuilderData.creativeStrategy;

    if (!strategy) {
      const strategyResult = await handleGenerateStrategy();
      if (!strategyResult?.strategy) return null;
      strategy = strategyResult.strategy;
    }

    setIsGeneratingScript(true);
    const MAX_SCORE_ATTEMPTS = 3;
    try {
      let lastScriptData: Record<string, any> | null = null;
      let lastScore: AdBuilderData['creativeScore'];

      for (let attempt = 0; attempt < MAX_SCORE_ATTEMPTS; attempt++) {
        const currentStrategy = strategy || adBuilderData.creativeStrategy;
        const hookType =
          getSelectedConcept(adBuilderData)?.hookType || adBuilderData.adSetup.hookType;

        const response = await authFetch('/api/creative-studio/generate-script', {
          method: 'POST',
          body: JSON.stringify({
            product_name: adBuilderData.product.product_name,
            brand_name: adBuilderData.product.brand_name,
            category: adBuilderData.product.category,
            creative_format: adBuilderData.adSetup.creativeFormat,
            hook_type: hookType,
            campaign_goal: adBuilderData.adSetup.campaignGoal,
            creative_strategy: currentStrategy,
            style: adBuilderData.adSetup.creativeFormat,
            duration: adBuilderData.adSetup.duration,
            platform: adBuilderData.adSetup.platform,
            aspect_ratio: adBuilderData.adSetup.aspect_ratio,
            voiceover: adBuilderData.voiceover.enabled,
            language: adBuilderData.voiceover.language ?? 'english',
            tone: adBuilderData.voiceover.tone,
            key_message: adBuilderData.voiceover.key_message,
            cta: adBuilderData.voiceover.cta || currentStrategy?.cta,
            on_screen_text: adBuilderData.onScreenText.enabled,
            user_description: getCommercialBrief(adBuilderData),
            product_images: adBuilderData.product.product_images,
          }),
        });

        const result = await safeResponseJson<{
          ok: boolean;
          error?: string;
          script?: unknown;
          creative_score?: AdBuilderData['creativeScore'];
          score_passed?: boolean;
        }>(response);
        if (!result.ok) throw new Error(result.error);

        const scriptData = result.script as Record<string, any>;
        lastScriptData = scriptData;
        lastScore = result.creative_score;

        if (result.score_passed !== false || attempt === MAX_SCORE_ATTEMPTS - 1) {
          setAdBuilderData((prev) => ({
            ...prev,
            voiceover: {
              ...prev.voiceover,
              script: scriptData.voiceover_script || getVoiceoverFromStoryboard(scriptData.storyboard) || '',
              cta: prev.voiceover.cta || currentStrategy?.cta,
            },
            onScreenText: {
              ...prev.onScreenText,
              headline: scriptData.headline,
              subtext: scriptData.subtext,
            },
            finalVideoPrompt: scriptData.final_video_prompt,
            storyboard: scriptData.storyboard,
            visualStyleGuide: scriptData.visual_style_guide,
            adAngle: scriptData.ad_angle || currentStrategy?.creativeAngle,
            creativeScore: result.creative_score,
          }));
          return scriptData;
        }
      }

      if (lastScriptData) {
        setAdBuilderData((prev) => ({
          ...prev,
          voiceover: {
            ...prev.voiceover,
            script: lastScriptData!.voiceover_script || getVoiceoverFromStoryboard(lastScriptData!.storyboard) || '',
          },
          finalVideoPrompt: lastScriptData!.final_video_prompt,
          storyboard: lastScriptData!.storyboard,
          creativeScore: lastScore,
        }));
      }
      return lastScriptData;
    } catch (error: any) {
      showError(`Failed to generate script: ${error.message}`);
      return null;
    } finally {
      setIsGeneratingScript(false);
    }
  }

  // ============== Video Generation ==============

  function buildVideoBrandContext() {
    if (!brand && !adBuilderData.visualStyleGuide && !adBuilderData.product?.product_url) {
      return undefined;
    }
    return {
      primaryColors: brand?.primaryColors,
      websiteUrl: brand?.website_url || adBuilderData.product?.product_url,
      brandVoice: brand?.brandVoice,
      tone: brand?.tone,
      tagline: brand?.tagline,
      visualStyleGuide: adBuilderData.visualStyleGuide,
    };
  }

  // Load cinematic style variants once a storyboard exists.
  useEffect(() => {
    if (!adBuilderData.storyboard?.length || !adBuilderData.product) return;

    let cancelled = false;
    (async () => {
      setIsLoadingVariants(true);
      try {
        const response = await authFetch('/api/creative-studio/preview-video-prompts', {
          method: 'POST',
          body: JSON.stringify({
            product_name: adBuilderData.product!.product_name,
            brand_name: adBuilderData.product!.brand_name,
            category: adBuilderData.product!.category,
            user_description: adBuilderData.userDescription,
            creative_format: adBuilderData.adSetup.creativeFormat,
            hook_type: adBuilderData.adSetup.hookType,
            campaign_goal: adBuilderData.adSetup.campaignGoal,
            creative_strategy: adBuilderData.creativeStrategy,
            duration: adBuilderData.adSetup.duration,
            aspect_ratio: adBuilderData.adSetup.aspect_ratio,
            voiceover_script: getCanonicalVoiceover(adBuilderData.voiceover.script, adBuilderData.storyboard),
            storyboard: adBuilderData.storyboard,
            key_message: adBuilderData.voiceover.key_message,
            cta: adBuilderData.voiceover.cta || adBuilderData.creativeStrategy?.cta,
            variant_count: 2,
          }),
        });
        const result = await safeResponseJson<{
          ok: boolean;
          variants?: PromptVariantPreview[];
        }>(response);
        if (!cancelled && result.ok && result.variants?.length) {
          setPromptVariants(result.variants);
          setSelectedFilmStyleId((prev) => prev ?? result.variants![0].filmStyleId);
        }
      } catch {
        if (!cancelled) setPromptVariants([]);
      } finally {
        if (!cancelled) setIsLoadingVariants(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    adBuilderData.storyboard,
    adBuilderData.product?.product_name,
    adBuilderData.adSetup.creativeFormat,
    adBuilderData.adSetup.duration,
  ]);

  async function handleGenerateVideo(options?: {
    forceRegenerate?: boolean;
    generationVersion?: string;
  }) {
    if (!adBuilderData.product) {
      showError('Add a product before generating your commercial.');
      return;
    }

    if (hasInsufficientCredits || (videoCredits && videoCredits.total <= 0)) {
      showError(
        'You have insufficient video credits. Please purchase more credits to generate videos.',
        'Insufficient Credits'
      );
      return;
    }

    const duration = adBuilderData.adSetup.duration;
    if (!isCampaignDurationSeconds(duration)) {
      showError('Choose a 15s or 30s duration for your commercial.');
      return;
    }

    const aspect = adBuilderData.adSetup.aspect_ratio;
    if (aspect !== '9:16' && aspect !== '16:9') {
      showError('Choose a 9:16 or 16:9 frame for your commercial.');
      return;
    }

    const hasProductRef =
      Boolean(adBuilderData.product.hero_image?.trim()) ||
      (adBuilderData.product.product_images || []).some((u) => u?.trim());
    if (!hasProductRef) {
      showError(
        'Upload or import a product image so the commercial can preserve packaging and branding.',
        'Product reference needed'
      );
      return;
    }

    const campaignId = session?.id;
    if (!campaignId) {
      showError('Session is not ready yet. Please wait a moment and try again.');
      return;
    }

    setIsGeneratingVideo(true);
    setPendingRegeneration(null);
    if (options?.forceRegenerate) {
      setProductionStatus('regenerating');
    } else {
      setProductionStatus('planning');
    }

    try {
      const brief = mapStudioFormToCampaignBrief({
        campaignId,
        product: adBuilderData.product,
        adSetup: adBuilderData.adSetup,
        brand,
        userDescription: getCommercialBrief(adBuilderData),
        voiceoverCta: adBuilderData.voiceover.cta || adBuilderData.creativeStrategy?.cta,
        voiceoverKeyMessage: adBuilderData.voiceover.key_message,
        creativeStrategy: adBuilderData.creativeStrategy as never,
        selectedConcept: (() => {
          const c =
            adBuilderData.adConcepts?.find((x) => x.id === adBuilderData.selectedConceptId) ||
            adBuilderData.adConcepts?.[0];
          if (!c) return undefined;
          return {
            id: c.id,
            title: c.title,
            hookType: c.hookType,
            creativeAngle: c.creativeAngle,
            frameworkId: c.frameworkId as never,
            rationale: c.rationale,
            predictedStrength: (c.predictedStrength as 'high' | 'medium' | 'experimental') || 'medium',
            cta: c.cta,
            oneLinePitch: c.oneLinePitch,
          };
        })(),
      });

      // Hard invariant: UI duration === brief duration === ONE native generation
      const invariant = assertNativeDurationInvariant(duration, brief.campaignDuration);
      if (invariant.generationMode !== 'native_continuous') {
        throw new Error('Internal error: generation mode must be native_continuous');
      }

      const availableAssets = buildStudioAvailableAssets(adBuilderData.product);
      const generationVersion =
        options?.generationVersion ||
        pendingRegeneration?.nextVersion ||
        `v${generatedVideos.length + 1}`;

      const requestBody = {
        campaign: brief,
        generationVersion,
        forceRegenerate: Boolean(options?.forceRegenerate) || generatedVideos.length > 0,
        generationMode: 'native_continuous' as const,
        availableAssets,
        runCommercialQc: true,
        produceFinal: true,
        // Never send shot_based_fallback from the normal Studio UI
      };

      // Safety: never accidentally split duration
      if (requestBody.campaign.campaignDuration !== duration) {
        throw new Error('Duration was altered before send — aborting');
      }

      const bodyString = JSON.stringify(requestBody);
      if (new Blob([bodyString]).size > VERCEL_SAFE_BODY_BYTES) {
        showError(
          'Reference images are too large for the server (about 4 MB max on production). Try smaller files or remove extra product photos from the gallery.',
          'file size too large'
        );
        return;
      }

      // ONE call — never /api/commercial/generate-shot
      const videoEndpoint = '/api/commercial/generate';
      setProductionStatus(options?.forceRegenerate ? 'regenerating' : 'generating');

      const response = await authFetch(videoEndpoint, {
        method: 'POST',
        body: bodyString,
      });

      if (!response.ok) {
        let errMsg = `Server error (${response.status})`;
        try {
          const errBody = await safeResponseJson<{ error?: string }>(response);
          if (errBody?.error) errMsg = errBody.error;
        } catch {
          if (response.status === 504) {
            errMsg =
              'Video generation timed out on the server. 15s and 30s commercials can take several minutes. Please try again.';
          }
        }
        throw new Error(errMsg);
      }

      setProductionStatus('evaluating');

      const result = await safeResponseJson<{
        ok: boolean;
        error?: string;
        generationMode?: string;
        finalCommercial?: {
          campaignId: string;
          generationVersion: string;
          duration: number;
          aspectRatio: string;
          videoUrl: string;
          videoAssetId: string;
          model?: string;
          productionMode?: string;
          creativePlan?: CreativePlanSummary;
          commercialQC?: {
            decision: 'accept' | 'regenerate' | 'manual_review';
            visual?: { available?: boolean };
            categories?: GeneratedVideoQcSummary['categories'];
            regeneration?: {
              generationVersion: string;
              reason: string;
              requiredChanges: string[];
              preservedRequirements: string[];
            };
          };
        };
        commercialQC?: {
          decision: 'accept' | 'regenerate' | 'manual_review';
          visual?: { available?: boolean };
          categories?: GeneratedVideoQcSummary['categories'];
          regeneration?: {
            generationVersion: string;
            reason: string;
            requiredChanges: string[];
            preservedRequirements: string[];
          };
        };
      }>(response);

      if (!result.ok || !result.finalCommercial) {
        throw new Error(result.error || 'Commercial generation failed');
      }

      const fc = result.finalCommercial;
      const videoUrl = fc.videoUrl?.trim();
      if (!videoUrl || (!videoUrl.startsWith('data:') && !videoUrl.startsWith('http'))) {
        throw new Error(
          "We couldn't generate this commercial. No playable video was returned. Please try again."
        );
      }

      // Confirm native continuous — never accept a silent multi-shot response as "one commercial"
      if (
        result.generationMode &&
        result.generationMode !== 'native_continuous' &&
        fc.productionMode !== 'native_continuous'
      ) {
        throw new Error('Unexpected production mode. Please try again.');
      }

      if (fc.duration !== duration) {
        console.warn('Duration mismatch from API', { expected: duration, got: fc.duration });
      }

      const qc = result.commercialQC || fc.commercialQC;
      const decision = qc?.decision;
      const regen = qc?.regeneration;

      if (decision === 'regenerate' && regen) {
        setPendingRegeneration({
          nextVersion: regen.generationVersion,
          reason: regen.reason,
          requiredChanges: regen.requiredChanges || [],
          preservedRequirements: regen.preservedRequirements || [],
        });
      }

      if (decision === 'manual_review') {
        setProductionStatus('manual_review');
      } else if (decision === 'accept' || !decision) {
        setProductionStatus('completed');
      } else {
        setProductionStatus('completed');
      }

      const videoId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newVideo: GeneratedVideo = {
        id: videoId,
        url: videoUrl,
        prompt: getCommercialBrief(adBuilderData),
        timestamp: Date.now(),
        generationVersion: fc.generationVersion,
        duration: isCampaignDurationSeconds(fc.duration) ? fc.duration : duration,
        aspectRatio: String(fc.aspectRatio || aspect),
        productionMode: fc.productionMode || 'native_continuous',
        model: fc.model,
        qcDecision: decision,
        qcSummary: qc
          ? {
              decision: qc.decision,
              visualAvailable: Boolean(qc.visual?.available),
              categories: qc.categories,
              reason: regen?.reason,
              requiredChanges: regen?.requiredChanges,
              preservedRequirements: regen?.preservedRequirements,
              nextGenerationVersion: regen?.generationVersion,
            }
          : undefined,
        creativePlan: fc.creativePlan,
      };
      setGeneratedVideos((prev) => [...prev, newVideo]);
      setSelectedVideoId(videoId);

      await loadCredits();
    } catch (error: unknown) {
      setProductionStatus('failed');
      const message =
        error instanceof Error ? error.message : 'Something went wrong';
      showError(
        message.includes('Failed to generate')
          ? message
          : `We couldn't generate this commercial. ${message}`
      );
      await loadCredits();
    } finally {
      setIsGeneratingVideo(false);
    }
  }

  async function handleConfirmRegenerate() {
    const next =
      pendingRegeneration?.nextVersion ||
      generatedVideos[generatedVideos.length - 1]?.qcSummary?.nextGenerationVersion ||
      `v${generatedVideos.length + 1}`;
    await handleGenerateVideo({
      forceRegenerate: true,
      generationVersion: next,
    });
  }

  const autoGenerateTriggeredRef = React.useRef(false);

  // Auto-generate script + video when arriving from Creative Intelligence ranked hooks
  useEffect(() => {
    if (autoGenerate !== "1") return;
    if (isLoading || !session || autoGenerateTriggeredRef.current) return;
    if (!adBuilderData.userDescription?.trim() || !adBuilderData.product?.product_name) return;

    autoGenerateTriggeredRef.current = true;
    (async () => {
      try {
        setStep(3);
        await handleGenerateVideo();
      } catch {
        // Errors surfaced inside handlers
      }
    })();
  }, [
    autoGenerate,
    isLoading,
    session,
    adBuilderData.userDescription,
    adBuilderData.product?.product_name,
  ]);

  // ============== Download Video ==============

  async function handleDownloadVideo(video: GeneratedVideo) {
    try {
      let blob: Blob;
      if (video.url.startsWith('data:')) {
        const res = await fetch(video.url);
        blob = await res.blob();
      } else {
        const res = await fetch(video.url, { mode: 'cors' });
        if (!res.ok) throw new Error('Failed to fetch video');
        blob = await res.blob();
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `optimx-video-${video.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showError(err?.message || 'Failed to download video. Try opening the link in a new tab.');
    }
  }

  // ============== Aspect Ratio ==============

  function updateAspectRatio(ratio: '9:16' | '16:9') {
    const platformMap: Record<string, 'Instagram Reels / TikTok' | 'YouTube Shorts' | 'Instagram Feed' | 'YouTube Ad'> = {
      '9:16': 'Instagram Reels / TikTok',
      '16:9': 'YouTube Ad',
    };

    setAdBuilderData({
      ...adBuilderData,
      adSetup: {
        ...adBuilderData.adSetup,
        aspect_ratio: ratio,
        platform: platformMap[ratio],
      },
    });
  }

  // ============== Sidebar Handlers ==============

  async function handleSessionSelect(selectedSessionId: string) {
    if (selectedSessionId !== sessionId) {
      // Save current session immediately before switching
      if (sessionId && sessionId !== 'new' && brand) {
        try {
          const payload = {
            brandSnapshot: brand,
            adBuilderData: { ...adBuilderData, step },
            generatedVideos,
          };

          console.log('[DEBUG] Saving session before switch:', {
            sessionId,
            step,
            hasProduct: !!adBuilderData.product,
            productName: adBuilderData.product?.product_name,
            productUrl: adBuilderData.product?.product_url,
          });

          const response = await authFetch(`/api/creative-studio/sessions?id=${sessionId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          
          const result = await response.json();
          console.log('[DEBUG] Save response:', result.ok ? 'success' : result.error);
        } catch (err) {
          console.error('Error saving session before switch:', err);
        }
      }
      
      router.push(`/brand-studio/video?id=${selectedSessionId}`);
    }
  }

  function handleNewSession() {
    setShowNewSessionModal(true);
  }

  async function handleCreateNewSession(name: string) {
    if (!brand) {
      showAlert('Please set up brand guidelines first', 'Brand Required');
      return;
    }

    setIsCreatingSession(true);
    try {
      const response = await authFetch('/api/creative-studio/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name,
          sessionType: 'video',
          brandSnapshot: brand,
        }),
      });

      const data = await response.json();

      if (data.ok && data.session?.id) {
        // Add new session to the list
        const newSession: SessionListItem = {
          id: data.session.id,
          name: data.session.name,
          sessionType: 'video',
          createdAt: data.session.createdAt || new Date().toISOString(),
          updatedAt: data.session.updatedAt || new Date().toISOString(),
        };
        setVideoSessions(prev => [newSession, ...prev]);

        setShowNewSessionModal(false);
        router.push(`/brand-studio/video?id=${data.session.id}`);
      } else {
        showError('Failed to create session: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Create session error:', err);
      showError('Failed to create session');
    } finally {
      setIsCreatingSession(false);
    }
  }

  function handleSessionDelete(id: string) {
    setDeleteSessionId(id);
  }

  async function confirmDeleteSession() {
    if (!deleteSessionId) return;

    setIsDeletingSession(true);
    try {
      const response = await authFetch(`/api/creative-studio/sessions?id=${deleteSessionId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.ok) {
        setVideoSessions((prev) => prev.filter((s) => s.id !== deleteSessionId));

        if (deleteSessionId === sessionId) {
          router.push('/brand-studio');
        }
      } else {
        showError('Failed to delete session: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Delete session error:', err);
      showError('Failed to delete session');
    } finally {
      setIsDeletingSession(false);
      setDeleteSessionId(null);
    }
  }

  // ============== Render ==============

  // Client-only shell: avoids Sidebar/zustand persist hydration mismatch (was looping Fast Refresh).
  if (!hasMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center app-page" style={{ background: '#0B0B0F' }}>
        <div className="flex items-center gap-3" style={{ color: '#8B8B98' }}>
          <div
            className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent"
            style={{ borderColor: '#333', borderTopColor: '#A855F7' }}
          />
          <span>Loading studio...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center app-page">
        <div className="text-center">
          <p className="mb-4" style={{ color: colors.destructive }}>{error}</p>
          <button
            onClick={() => router.push('/brand-studio')}
            className="px-4 py-2 text-white rounded-lg"
            style={{ backgroundColor: colors.primary }}
          >
            Back to Brand Studio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden app-page">
      <div className="flex-shrink-0 h-full">
        <StudioErrorBoundary label="Sidebar">
          <Sidebar
            showChatHistory={true}
            chatHistory={videoSessions.map((s) => ({
              id: s.id,
              title: s.name,
              timestamp: formatTimestamp(s.updatedAt),
            }))}
            activeChatId={sessionId as string}
            onNewChat={handleNewSession}
            onChatSelect={handleSessionSelect}
            onChatDelete={handleSessionDelete}
            onBrandGuideline={() => setShowBrandGuidelineModal(true)}
          />
        </StudioErrorBoundary>
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {isLoading && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full text-[11px] pointer-events-none"
            style={{ background: 'rgba(168,85,247,0.2)', color: '#E9D5FF', border: '1px solid rgba(168,85,247,0.35)' }}
          >
            Loading session…
          </div>
        )}
        <StudioErrorBoundary label="Video studio">
          <VideoStudioWorkspace
            sessionName={session?.name}
            isSaving={isSaving}
            brand={brand}
            adBuilderData={adBuilderData}
            onAdBuilderChange={setAdBuilderData}
            generatedVideos={generatedVideos}
            selectedVideoId={selectedVideoId}
            onSelectVideo={setSelectedVideoId}
            productUrl={productUrl}
            onProductUrlChange={setProductUrl}
            onProductUrlSubmit={handleProductUrlSubmit}
            isScrapingProduct={isScrapingProduct}
            isFetchingLogo={isFetchingLogo}
            selectedImageIndex={selectedImageIndex}
            onSelectImage={(index, img) => {
              setSelectedImageIndex(index);
              if (!adBuilderData.product) return;
              setAdBuilderData({
                ...adBuilderData,
                product: { ...adBuilderData.product, hero_image: img },
              });
            }}
            onImageUpload={handleImageUpload}
            isGeneratingScript={isGeneratingScript}
            isGeneratingVideo={isGeneratingVideo}
            generationStep={generationStep}
            productionStatus={productionStatus}
            pendingRegeneration={pendingRegeneration}
            hasInsufficientCredits={hasInsufficientCredits}
            videoCredits={videoCredits}
            promptVariants={promptVariants}
            selectedFilmStyleId={selectedFilmStyleId}
            onSelectFilmStyle={setSelectedFilmStyleId}
            isLoadingVariants={isLoadingVariants}
            onGenerateVideo={() => handleGenerateVideo()}
            onConfirmRegenerate={handleConfirmRegenerate}
            onKeepVersion={() => {
              setPendingRegeneration(null);
              setProductionStatus('completed');
            }}
            onSaveDraft={saveSession}
            onDownload={handleDownloadVideo}
            onUpdateAspectRatio={updateAspectRatio}
          />
        </StudioErrorBoundary>
        {showBrandOnboarding && !brand && (
          <BrandOnboarding
            mode={onboardingMode}
            onModeChange={setOnboardingMode}
            onWebsiteSubmit={handleWebsiteBrandSetup}
            onManualSubmit={handleManualBrandSetup}
            onSkip={handleSkipBrandSetup}
            isLoading={isAnalyzingBrand}
          />
        )}

        {showBrandGuidelineModal && brand && (
          <BrandGuidelineModal
            brand={brand}
            onUpdate={updateBrandGuideline}
            onClose={() => setShowBrandGuidelineModal(false)}
            onWebsiteAnalyze={handleWebsiteReanalyze}
          />
        )}

        <SessionNameModal
          isOpen={showNewSessionModal}
          sessionType="video"
          isLoading={isCreatingSession}
          onSubmit={handleCreateNewSession}
          onClose={() => setShowNewSessionModal(false)}
        />

        {deleteSessionId && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isDeletingSession) {
                setDeleteSessionId(null);
              }
            }}
          >
            <div className="rounded-xl shadow-xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full" style={{ backgroundColor: 'hsl(0 84% 55% / 0.2)' }}>
                    <svg className="w-6 h-6" style={{ color: colors.destructive }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold" style={{ color: colors.foreground }}>Delete Session</h3>
                    <p className="text-sm" style={{ color: colors.mutedForeground }}>This action cannot be undone</p>
                  </div>
                </div>
                <p className="mb-6" style={{ color: colors.mutedForeground }}>
                  Are you sure you want to delete this session? All data including generated videos will be permanently removed.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteSessionId(null)}
                    disabled={isDeletingSession}
                    className="flex-1 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                    style={{ backgroundColor: colors.muted, color: colors.foreground }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteSession}
                    disabled={isDeletingSession}
                    className="flex-1 px-4 py-3 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    style={{ backgroundColor: colors.destructive }}
                  >
                    {isDeletingSession ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
