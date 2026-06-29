// pages/brand-studio/video/[sessionId].tsx
// Video Generation Session Page

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { showAlert, showError, showConfirm } from '@/app/web/src/components/ui/alert-modal-api';
import Link from 'next/link';
import Sidebar from '@/app/web/src/components/Sidebar';
import colors from '@/lib/ui/colors';
import { InsufficientCreditsAlert } from '@/app/web/src/components/billing';
import {
  type BrandSnapshot,
  type AdBuilderData,
  type SessionListItem,
  type CreativeStudioSession,
  type GeneratedVideo,
  BackButton,
  BrandOnboarding,
  BrandGuidelineModal,
  SessionNameModal,
  formatTimestamp,
  DEFAULT_AD_BUILDER_DATA,
  CREATIVE_FORMATS,
  HOOK_TYPES,
  CAMPAIGN_GOALS,
  normalizeAdSetup,
  VIDEO_DURATIONS,
  mapFullAnalyzeToBrandSnapshot,
} from '@/app/web/src/components/creative-studio';
import { authFetch, safeResponseJson } from '@/lib/utils';
import { supabase } from '@/auth/supabase/client';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const slotsForProducts = Math.max(
    0,
    MAX_VIDEO_API_REF_IMAGES - (hero_image ? 1 : 0) - (brand_logo ? 1 : 0)
  );
  const productSlice = product_images
    .filter((img) => img && img !== hero_image && img !== brand_logo)
    .slice(0, slotsForProducts);

  const [h, l, ...rest] = await Promise.all([
    hero_image ? compressDataUrlForVideoApi(hero_image) : Promise.resolve(null),
    brand_logo ? compressDataUrlForVideoApi(brand_logo) : Promise.resolve(null),
    ...productSlice.map((u) => compressDataUrlForVideoApi(u)),
  ]);

  return {
    hero_image: h,
    brand_logo: l,
    product_images: rest,
  };
}

// Aspect ratio options with orientation for video ad setup (9:16, 16:9 only)
const ASPECT_RATIO_OPTIONS: { ratio: '9:16' | '16:9'; orientation: string }[] = [
  { ratio: '9:16', orientation: 'Portrait' },
  { ratio: '16:9', orientation: 'Landscape' },
];

// Creative format & hook descriptions for ad configuration
const FORMAT_DESCRIPTIONS: Record<string, string> = {
  UGC: 'Real person filmed on phone. Casual, believable, native to Reels/Shorts. Trust over polish.',
  Commercial: 'Paid ad feel. High production value, product as hero, punchy pacing. Conversion-focused.',
  Lifestyle: 'Product in real-world use. Relatable scenarios, emotional connection, natural lighting.',
  'Product Showcase': 'Detail-driven product focus. Close-ups, texture, benefits demonstrated visually.',
  'Motion Graphics': 'Design-forward animated composition. Graphic elements and smooth visual flow.',
  Cinematic: 'Film-style polish when the story needs it. Emotion and message lead; cinematography supports.',
};

const HOOK_DESCRIPTIONS: Record<string, string> = {
  Auto: 'AI picks the strongest hook for your product and campaign goal.',
  'Curiosity Hook': 'Pattern interrupt that makes viewers need to know more.',
  'Before & After': 'Transformation contrast — problem state vs. result state.',
  'Social Proof': 'Reviews, results, and credibility to overcome skepticism.',
  Contrarian: 'Challenge a common belief to stop the scroll.',
  'Problem Agitation': 'Amplify the pain before presenting your solution.',
  'Founder Story': 'Authentic origin story that builds trust and differentiation.',
  Testimonial: 'Real customer voice — relatable proof that converts.',
  'Product Demonstration': 'Show the product working — clarity drives clicks.',
};

function getSelectedConcept(data: AdBuilderData) {
  if (!data.adConcepts?.length) return null;
  return data.adConcepts.find((c) => c.id === data.selectedConceptId) ?? data.adConcepts[0];
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

  // Session state
  const [session, setSession] = useState<CreativeStudioSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  // Auto-save ref
  const autoSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const variationsScrollRef = React.useRef<HTMLDivElement | null>(null);

  // ============== Wait for Auth ==============

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted && session) {
        setIsAuthReady(true);
      }
    });

    const checkSession = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      const { data } = await supabase.auth.getSession();
      if (mounted && data?.session) {
        setIsAuthReady(true);
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

  // Animate video generation steps while generating
  // Extended (16s) has 9 steps and takes ~3-4 min; standard has 5 steps and takes ~1-2 min
  const isExtendedDuration = (adBuilderData.adSetup.duration ?? 8) > 8;
  const maxGenerationSteps = isExtendedDuration ? 9 : 5;
  useEffect(() => {
    if (!isGeneratingVideo) {
      setGenerationStep(0);
      return;
    }
    setGenerationStep(0);
    const stepDuration = isExtendedDuration ? 25_000 : 3_000;
    const interval = setInterval(() => {
      setGenerationStep((prev) => {
        if (prev >= maxGenerationSteps) return maxGenerationSteps;
        return prev + 1;
      });
    }, stepDuration);
    return () => clearInterval(interval);
  }, [isGeneratingVideo, isExtendedDuration, maxGenerationSteps]);

  // ============== Load Session ==============

  // Track previous session ID for saving on switch
  const prevSessionIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!sessionId || typeof sessionId !== 'string') return;

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
        if (loadedSession.adBuilderData) {
          const savedAdBuilderData = loadedSession.adBuilderData as AdBuilderData;
          // Use brand guideline logo for product when session has brand logo but product has no logo
          const brandLogoUrl = loadedSession.brandSnapshot?.logo ?? loadedSession.brandSnapshot?.logoUrl;
          if (savedAdBuilderData.product && brandLogoUrl && !savedAdBuilderData.product.brand_logo) {
            savedAdBuilderData.product = {
              ...savedAdBuilderData.product,
              brand_logo: brandLogoUrl,
            };
          }
          savedAdBuilderData.adSetup = normalizeAdSetup(savedAdBuilderData.adSetup || {});
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
  }, [sessionId, isAuthReady]);

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
      const data = await response.json();
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

    const readers = files.slice(0, 3).map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then((dataUrls) => {
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
    if (!adBuilderData.userDescription?.trim()) return null;

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
            user_description: adBuilderData.userDescription,
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

  // Load 2 cinematic style variants when script is ready (step 3).
  useEffect(() => {
    if (step !== 3 || !adBuilderData.storyboard?.length || !adBuilderData.product) return;

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
    step,
    adBuilderData.storyboard,
    adBuilderData.product?.product_name,
    adBuilderData.adSetup.creativeFormat,
    adBuilderData.adSetup.duration,
  ]);

  async function handleGenerateVideo() {
    if (!adBuilderData.product) return;

    // Check for sufficient credits before generating
    if (hasInsufficientCredits || (videoCredits && videoCredits.total <= 0)) {
      showError('You have insufficient video credits. Please purchase more credits to generate videos.', 'Insufficient Credits');
      return;
    }

    setIsGeneratingVideo(true);
    try {
      let storyboard = adBuilderData.storyboard;
      let finalVideoPrompt = adBuilderData.finalVideoPrompt;
      let voiceoverScript = getCanonicalVoiceover(adBuilderData.voiceover.script, storyboard);

      if (!storyboard?.length || (adBuilderData.voiceover.enabled && !voiceoverScript)) {
        const scriptData = await handleGenerateScript();
        if (!scriptData?.storyboard?.length) {
          throw new Error("Script generation did not produce a storyboard. Please try again.");
        }
        storyboard = scriptData.storyboard;
        finalVideoPrompt = scriptData.final_video_prompt;
        voiceoverScript =
          scriptData.voiceover_script || getVoiceoverFromStoryboard(scriptData.storyboard) || "";
      }

      const finalPrompt =
        finalVideoPrompt ||
        voiceoverScript ||
        `Create a ${adBuilderData.adSetup.duration}-second ${adBuilderData.adSetup.creativeFormat.toLowerCase()} video ad for ${adBuilderData.product.product_name}.`;

      // Prefer brand guideline logo when available so the fetched/configured logo is used in the video
      const brandLogo = brand?.logo ?? brand?.logoUrl ?? adBuilderData.product.brand_logo ?? null;

      const preparedImages = await prepareVideoGenerateImages({
        hero_image: adBuilderData.product.hero_image,
        brand_logo: brandLogo,
        product_images: adBuilderData.product.product_images,
      });

      const videoBody = {
        product_name: adBuilderData.product.product_name,
        brand_name: adBuilderData.product.brand_name,
        category: adBuilderData.product.category,
        user_description: adBuilderData.userDescription,
        creative_format: adBuilderData.adSetup.creativeFormat,
        hook_type: getSelectedConcept(adBuilderData)?.hookType || adBuilderData.adSetup.hookType,
        campaign_goal: adBuilderData.adSetup.campaignGoal,
        creative_strategy: adBuilderData.creativeStrategy,
        style: adBuilderData.adSetup.creativeFormat,
        duration: adBuilderData.adSetup.duration,
        aspect_ratio: adBuilderData.adSetup.aspect_ratio,
        quality: adBuilderData.adSetup.quality || 'standard',
        final_video_prompt: finalPrompt,
        voiceover_script: voiceoverScript,
        key_message: adBuilderData.voiceover.key_message,
        cta: adBuilderData.voiceover.cta || adBuilderData.creativeStrategy?.cta,
        storyboard,
        product_images: preparedImages.product_images,
        hero_image: preparedImages.hero_image,
        brand_logo: preparedImages.brand_logo,
        brand_context: buildVideoBrandContext(),
        use_film_engine: true,
        film_style_id: selectedFilmStyleId || undefined,
        tone: adBuilderData.voiceover.tone,
      };
      const bodyString = JSON.stringify(videoBody);
      if (new Blob([bodyString]).size > VERCEL_SAFE_BODY_BYTES) {
        showError(
          'Reference images are too large for the server (about 4 MB max on production). Try smaller files or remove extra product photos from the gallery.',
          'file size too large'
        );
        return;
      }

      const durationSeconds = Number(adBuilderData.adSetup.duration) || 0;
      const videoEndpoint =
        durationSeconds > 8
          ? '/api/creative-studio/generate-video-stitched'
          : '/api/creative-studio/generate-video';

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
              'Extended video timed out on the server. 16s videos need Vercel Pro (300s limit) and ~3–5 minutes. Try again or use 8s.';
          }
        }
        throw new Error(errMsg);
      }

      const result = await safeResponseJson<{
        ok: boolean;
        error?: string;
        videoUrl?: string;
        delivery?: string;
      }>(response);
      if (!result.ok) throw new Error(result.error || 'Video generation failed');

      const videoUrl = result.videoUrl?.trim();
      if (!videoUrl || (!videoUrl.startsWith('data:') && !videoUrl.startsWith('http'))) {
        throw new Error(
          'Video generated but no playable URL was returned. Check SUPABASE_SERVICE_ROLE_KEY is set in production for 16s videos.'
        );
      }

      console.log('Video ready:', { delivery: result.delivery, urlPrefix: videoUrl.slice(0, 48) });

      const videoId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newVideo = {
        id: videoId,
        url: videoUrl,
        prompt: finalPrompt,
        timestamp: Date.now(),
      };
      setGeneratedVideos((prev) => [...prev, newVideo]);
      setSelectedVideoId(videoId);

      // Refresh credits after successful generation
      await loadCredits();
    } catch (error: any) {
      showError(`Failed to generate video: ${error.message}`);
      // Refresh credits in case they were deducted before the error
      await loadCredits();
    } finally {
      setIsGeneratingVideo(false);
    }
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
        setStep(2);
        await handleGenerateScript();
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-page">
        <div className="flex items-center gap-3" style={{ color: colors.mutedForeground }}>
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent" style={{ borderColor: colors.border, borderTopColor: colors.primary }} />
          <span>Loading session...</span>
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
      {/* Sidebar */}
      <div className="flex-shrink-0 h-full">
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
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ backgroundColor: colors.card, borderLeft: `1px solid ${colors.border}` }}>
        {/* Header */}
        <div className="border-b flex-shrink-0" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <BackButton />
                <div>
                  <h1 className="text-xl font-semibold" style={{ color: colors.foreground }}>
                    {session?.name || 'New Video Session'}
                  </h1>
                  <p className="text-sm" style={{ color: colors.mutedForeground }}>
                    {isSaving ? 'Saving...' : 'Create video-first ad concepts'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {videoCredits !== null && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'hsl(270 80% 55% / 0.15)', border: `1px solid hsl(270 80% 55% / 0.35)` }}>
                    <svg className="w-4 h-4" style={{ color: 'hsl(270 80% 65%)' }} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    </svg>
                    <span className="font-semibold text-sm" style={{ color: 'hsl(270 80% 70%)' }}>{videoCredits.total}</span>
                    <span className="text-xs" style={{ color: 'hsl(270 80% 65%)' }}>seconds</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="border-b px-6 py-4 flex-shrink-0" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {[1, 2, 3].map((s) => {
              const isStep3Blocked = s === 3 && (!adBuilderData.storyboard?.length || (adBuilderData.voiceover.enabled && !getCanonicalVoiceover(adBuilderData.voiceover.script, adBuilderData.storyboard)));
              return (
              <React.Fragment key={s}>
                <button
                  onClick={() => {
                    if (isStep3Blocked) return;
                    setStep(s as AdBuilderStep);
                  }}
                  disabled={isStep3Blocked}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'transparent',
                    color: step === s ? colors.primary : step > s ? colors.foreground : colors.mutedForeground,
                    fontWeight: step === s ? 600 : 400,
                  }}
                  title={isStep3Blocked ? 'Generate a script first' : undefined}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: step === s ? colors.primary : step > s ? colors.green600 : colors.muted,
                      color: step === s || step > s ? 'white' : colors.mutedForeground,
                    }}
                  >
                    {step > s ? '✓' : s}
                  </div>
                  <span className="hidden sm:inline">
                    {s === 1 && 'Ad Setup'}
                    {s === 2 && 'Script'}
                    {s === 3 && 'Generate'}
                  </span>
                </button>
                {s < 3 && <div className="flex-1 h-px mx-2" style={{ backgroundColor: colors.border }} />}
              </React.Fragment>
            );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: colors.background }}>
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Step 1: Ad Setup (Product + Style/Duration/Aspect Ratio) */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: colors.foreground }}>Ad Setup</h2>
                  <p style={{ color: colors.mutedForeground }}>Add your product, then configure style, duration, and aspect ratio</p>
                </div>

                {/* Product Input */}
                <div className="rounded-lg border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: colors.foreground }}>Product</h3>
                  <p className="text-xs mb-4" style={{ color: colors.mutedForeground }}>Add your product by URL or upload images to enable ad configuration</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium mb-2" style={{ color: colors.foreground }}>
                        Product URL (D2C, Shopify, Amazon, etc.)
                      </label>
                      <form onSubmit={handleProductUrlSubmit} className="flex gap-3">
                        <input
                          type="url"
                          value={productUrl}
                          onChange={(e) => setProductUrl(e.target.value)}
                          placeholder="https://example.com/product"
                          className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground }}
                          disabled={isScrapingProduct}
                        />
                        <button
                          type="submit"
                          disabled={!productUrl.trim() || isScrapingProduct}
                          className="px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: colors.primary }}
                        >
                          {isScrapingProduct ? 'Scraping...' : 'Scrape'}
                        </button>
                      </form>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-2" style={{ color: colors.foreground }}>
                        Or Upload Product Images (1-3 images)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold"
                        style={{ color: colors.mutedForeground }}
                      />
                    </div>
                  </div>
                </div>

                {/* Product Preview */}
                {adBuilderData.product && (
                  <div className="rounded-lg border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                    <h3 className="text-lg font-semibold mb-4" style={{ color: colors.foreground }}>Detected Product</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm mb-1" style={{ color: colors.mutedForeground }}>Product Name</p>
                        <p className="font-medium" style={{ color: colors.foreground }}>{adBuilderData.product.product_name}</p>
                        <p className="text-sm mt-2 mb-1" style={{ color: colors.mutedForeground }}>Brand</p>
                        <p className="font-medium" style={{ color: colors.foreground }}>{adBuilderData.product.brand_name}</p>
                      </div>
                      <div>
                        <p className="text-sm mb-2" style={{ color: colors.mutedForeground }}>Product Images</p>
                        <div className="grid grid-cols-3 gap-2">
                          {adBuilderData.product.product_images.map((img, idx) => {
                            const isSelected = selectedImageIndex === idx;
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  setSelectedImageIndex(idx);
                                  setAdBuilderData({
                                    ...adBuilderData,
                                    product: adBuilderData.product
                                      ? { ...adBuilderData.product, hero_image: img }
                                      : null,
                                  });
                                }}
                                className="relative aspect-square rounded-lg overflow-hidden border-2 transition-all"
                                style={{
                                  borderColor: isSelected ? colors.green600 : colors.border,
                                  borderWidth: isSelected ? 3 : 2,
                                  boxShadow: isSelected ? `0 0 0 2px ${colors.green600}40` : undefined,
                                }}
                                aria-pressed={isSelected}
                                aria-label={isSelected ? `Selected product image ${idx + 1}` : `Select product image ${idx + 1}`}
                              >
                                <img src={img} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                                {isSelected && (
                                  <div
                                    className="absolute inset-0 flex items-center justify-center"
                                    style={{ backgroundColor: 'rgba(34, 197, 94, 0.35)' }}
                                    aria-hidden
                                  >
                                    <div
                                      className="flex items-center justify-center w-10 h-10 rounded-full"
                                      style={{ backgroundColor: colors.green600, color: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
                                    >
                                      <Check size={24} strokeWidth={3} />
                                    </div>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ad Configuration - disabled until product exists */}
                <div
                  className="rounded-lg border p-6 space-y-6"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: adBuilderData.product ? 1 : 0.6,
                    pointerEvents: adBuilderData.product ? 'auto' : 'none',
                  }}
                >
                  {!adBuilderData.product && (
                    <p className="text-sm mb-4 p-3 rounded-lg" style={{ backgroundColor: colors.muted, color: colors.mutedForeground }}>
                      Add a product above (via URL or image upload) to configure format, hook, campaign goal, and aspect ratio.
                    </p>
                  )}
                  <h3 className="text-sm font-semibold" style={{ color: colors.foreground }}>Ad Configuration</h3>

                  {/* Campaign Goal */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>
                      What do you want this ad to achieve?
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {CAMPAIGN_GOALS.map((goal) => (
                        <button
                          key={goal}
                          onClick={() =>
                            setAdBuilderData({
                              ...adBuilderData,
                              adSetup: { ...adBuilderData.adSetup, campaignGoal: goal },
                            })
                          }
                          className="px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors text-left"
                          style={{
                            borderColor: adBuilderData.adSetup.campaignGoal === goal ? colors.primary : colors.border,
                            backgroundColor: adBuilderData.adSetup.campaignGoal === goal ? 'hsl(213 100% 55% / 0.2)' : 'transparent',
                            color: adBuilderData.adSetup.campaignGoal === goal ? colors.primary : colors.foreground,
                          }}
                        >
                          {goal}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Creative Format */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>Creative Format</label>
                    <p className="text-xs mb-3" style={{ color: colors.mutedForeground }}>How the ad looks — visual execution.</p>
                    {FORMAT_DESCRIPTIONS[adBuilderData.adSetup.creativeFormat] && (
                      <p className="text-xs mb-3 p-3 rounded-lg" style={{ backgroundColor: 'hsl(270 80% 55% / 0.12)', border: '1px solid hsl(270 80% 55% / 0.3)', color: colors.mutedForeground }}>
                        <strong style={{ color: colors.foreground }}>{adBuilderData.adSetup.creativeFormat}:</strong>{' '}
                        {FORMAT_DESCRIPTIONS[adBuilderData.adSetup.creativeFormat]}
                      </p>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {CREATIVE_FORMATS.map((format) => (
                        <button
                          key={format}
                          onClick={() =>
                            setAdBuilderData({
                              ...adBuilderData,
                              adSetup: { ...adBuilderData.adSetup, creativeFormat: format },
                            })
                          }
                          className="px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors"
                          style={{
                            borderColor: adBuilderData.adSetup.creativeFormat === format ? colors.primary : colors.border,
                            backgroundColor: adBuilderData.adSetup.creativeFormat === format ? 'hsl(213 100% 55% / 0.2)' : 'transparent',
                            color: adBuilderData.adSetup.creativeFormat === format ? colors.primary : colors.foreground,
                          }}
                        >
                          {format}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hook Type */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>Hook Type</label>
                    <p className="text-xs mb-3" style={{ color: colors.mutedForeground }}>Why people stop scrolling — marketing strategy.</p>
                    {HOOK_DESCRIPTIONS[adBuilderData.adSetup.hookType] && (
                      <p className="text-xs mb-3 p-3 rounded-lg" style={{ backgroundColor: 'hsl(213 100% 55% / 0.12)', border: '1px solid hsl(213 100% 55% / 0.35)', color: colors.mutedForeground }}>
                        <strong style={{ color: colors.foreground }}>{adBuilderData.adSetup.hookType}:</strong>{' '}
                        {HOOK_DESCRIPTIONS[adBuilderData.adSetup.hookType]}
                      </p>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {HOOK_TYPES.map((hook) => (
                        <button
                          key={hook}
                          onClick={() =>
                            setAdBuilderData({
                              ...adBuilderData,
                              adSetup: { ...adBuilderData.adSetup, hookType: hook },
                            })
                          }
                          className="px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors"
                          style={{
                            borderColor: adBuilderData.adSetup.hookType === hook ? colors.primary : colors.border,
                            backgroundColor: adBuilderData.adSetup.hookType === hook ? 'hsl(213 100% 55% / 0.2)' : 'transparent',
                            color: adBuilderData.adSetup.hookType === hook ? colors.primary : colors.foreground,
                          }}
                        >
                          {hook === 'Auto' ? 'Auto (Recommended)' : hook}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>Duration</label>
                    <div className="flex gap-3">
                      {VIDEO_DURATIONS.map((dur) => {
                        const isSelected = adBuilderData.adSetup.duration === dur;
                        const isExtended = dur > 8;
                        return (
                          <button
                            key={dur}
                            onClick={() =>
                              setAdBuilderData({
                                ...adBuilderData,
                                adSetup: { ...adBuilderData.adSetup, duration: dur },
                              })
                            }
                            className="relative px-6 py-3 rounded-lg border-2 font-medium transition-colors"
                            style={{
                              borderColor: isSelected ? colors.primary : colors.border,
                              backgroundColor: isSelected ? 'hsl(213 100% 55% / 0.2)' : 'transparent',
                              color: isSelected ? colors.primary : colors.foreground,
                            }}
                          >
                            {dur}s
                            {isExtended && (
                              <span
                                className="absolute -top-2 -right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                                style={{ backgroundColor: colors.primary, color: 'white' }}
                              >
                                2×8s
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {adBuilderData.adSetup.duration > 8 ? (
                      <p className="mt-2 text-xs" style={{ color: colors.primary }}>
                        Extended: generates 2 clips and stitches them into one seamless video. Takes ~3-4 min.
                      </p>
                    ) : (
                      <p className="mt-2 text-xs" style={{ color: colors.mutedForeground }}>
                        Standard length: 8s. Select 16s for an extended ad.
                      </p>
                    )}
                  </div>

                  {/* Aspect Ratio */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>Aspect Ratio</label>
                    <div className="grid grid-cols-2 gap-4">
                      {ASPECT_RATIO_OPTIONS.map(({ ratio, orientation }) => {
                        const isSelected = adBuilderData.adSetup.aspect_ratio === ratio;
                        const previewWidth = ratio === '9:16' ? 32 : 64;
                        return (
                          <button
                            key={ratio}
                            onClick={() => updateAspectRatio(ratio)}
                            className="flex flex-col items-center gap-3 px-4 py-4 rounded-lg border-2 text-sm font-medium transition-colors"
                            style={{
                              borderColor: isSelected ? colors.primary : colors.border,
                              backgroundColor: isSelected ? 'hsl(213 100% 55% / 0.2)' : 'transparent',
                              color: isSelected ? colors.primary : colors.foreground,
                            }}
                          >
                            {ratio}
                            <span className="text-xs" style={{ color: colors.mutedForeground }}>{orientation}</span>
                            <div
                              className="rounded border-2 flex-shrink-0"
                              style={{
                                borderColor: isSelected ? colors.primary : colors.border,
                                backgroundColor: colors.muted,
                                aspectRatio: ratio.replace(':', '/'),
                                width: previewWidth,
                              }}
                              aria-hidden
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => setStep(2)}
                      disabled={!adBuilderData.product}
                      className="px-6 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: colors.primary }}
                      title={!adBuilderData.product ? 'Add a product first' : undefined}
                    >
                      Continue to Strategy & Script
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Script */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: colors.foreground }}>Commercial Script</h2>
                  <p style={{ color: colors.mutedForeground }}>
                    Write your ad like a micro-script — tone, hook, pacing, emotion, and payoff (Envato commercial formula).
                  </p>
                </div>

                <div className="rounded-lg border p-6 space-y-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  {/* Envato formula — mapped from step 1 + tone */}
                  <div
                    className="p-4 rounded-lg text-xs space-y-2"
                    style={{
                      backgroundColor: 'hsl(213 100% 55% / 0.08)',
                      border: '1px solid hsl(213 100% 55% / 0.25)',
                      color: colors.mutedForeground,
                    }}
                  >
                    <p className="font-medium text-sm" style={{ color: colors.foreground }}>
                      Commercial prompt formula
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <p><span className="font-medium" style={{ color: colors.foreground }}>Tone:</span> {adBuilderData.voiceover.tone}</p>
                      <p><span className="font-medium" style={{ color: colors.foreground }}>Hook:</span> {adBuilderData.adSetup.hookType}</p>
                      <p><span className="font-medium" style={{ color: colors.foreground }}>Camera & pacing:</span> {adBuilderData.adSetup.creativeFormat}</p>
                      <p><span className="font-medium" style={{ color: colors.foreground }}>Payoff:</span> Product hero + CTA</p>
                    </div>
                  </div>

                  {/* Tone — Envato: define before visuals */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>Ad Tone</label>
                    <p className="text-xs mb-3" style={{ color: colors.mutedForeground }}>
                      Sets pacing, energy, and how the scene should feel.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {(['Energetic', 'Calm', 'Premium', 'Fun'] as const).map((tone) => (
                        <button
                          key={tone}
                          type="button"
                          onClick={() =>
                            setAdBuilderData({
                              ...adBuilderData,
                              voiceover: { ...adBuilderData.voiceover, tone },
                            })
                          }
                          className="px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors"
                          style={{
                            borderColor: adBuilderData.voiceover.tone === tone ? colors.primary : colors.border,
                            backgroundColor: adBuilderData.voiceover.tone === tone ? 'hsl(213 100% 55% / 0.2)' : 'transparent',
                            color: adBuilderData.voiceover.tone === tone ? colors.primary : colors.foreground,
                          }}
                        >
                          {tone}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* User Description — micro-script beats */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>
                      Your Commercial Brief <span style={{ color: colors.destructive }}>*</span>
                    </label>
                    <p className="text-xs mb-2" style={{ color: colors.mutedForeground }}>
                      Describe the story in beats: opening hook → product moment → emotional payoff. Be specific about what happens on screen.
                    </p>
                    <textarea
                      value={adBuilderData.userDescription || ''}
                      onChange={(e) =>
                        setAdBuilderData({
                          ...adBuilderData,
                          userDescription: e.target.value,
                        })
                      }
                      placeholder="E.g., Open on a tired morning — person reaches for Pintola Peanut Butter. Quick spoonful, energized smile. Close on jar hero with natural kitchen light. Feels motivating, relatable, premium."
                      className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2"
                      style={{ borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground }}
                      rows={5}
                    />
                  </div>

                  {/* Key Message & CTA — emotional direction + payoff */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>
                        Key Benefit (emotional direction)
                      </label>
                      <input
                        type="text"
                        value={adBuilderData.voiceover.key_message || ''}
                        onChange={(e) =>
                          setAdBuilderData({
                            ...adBuilderData,
                            voiceover: { ...adBuilderData.voiceover, key_message: e.target.value },
                          })
                        }
                        placeholder="e.g., All-day energy from real peanuts"
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2"
                        style={{ borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>
                        CTA (payoff)
                      </label>
                      <input
                        type="text"
                        value={adBuilderData.voiceover.cta || ''}
                        onChange={(e) =>
                          setAdBuilderData({
                            ...adBuilderData,
                            voiceover: { ...adBuilderData.voiceover, cta: e.target.value },
                          })
                        }
                        placeholder="e.g., Shop Now"
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2"
                        style={{ borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground }}
                      />
                    </div>
                  </div>

                  {/* Voiceover Toggle */}
                  <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: colors.border }}>
                    <div>
                      <label className="block text-sm font-medium" style={{ color: colors.foreground }}>Voiceover</label>
                      <p className="text-xs" style={{ color: colors.mutedForeground }}>Enable AI-generated voiceover narration</p>
                    </div>
                    <button
                      onClick={() =>
                        setAdBuilderData({
                          ...adBuilderData,
                          voiceover: { ...adBuilderData.voiceover, enabled: !adBuilderData.voiceover.enabled },
                        })
                      }
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                      style={{ backgroundColor: adBuilderData.voiceover.enabled ? colors.primary : colors.muted }}
                    >
                      <span
                        className="inline-block h-4 w-4 transform rounded-full transition-transform"
                        style={{
                          backgroundColor: colors.cardForeground,
                          transform: adBuilderData.voiceover.enabled ? 'translateX(1.5rem)' : 'translateX(0.25rem)',
                        }}
                      />
                    </button>
                  </div>

                  {adBuilderData.voiceover.enabled && (
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>Voiceover Language</label>
                      <div className="flex gap-3">
                        {(['english', 'tamil', 'hindi'] as const).map((lang) => (
                          <button
                            key={lang}
                            type="button"
                            onClick={() =>
                              setAdBuilderData({
                                ...adBuilderData,
                                voiceover: { ...adBuilderData.voiceover, language: lang },
                              })
                            }
                            className="px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors"
                            style={{
                              borderColor: (adBuilderData.voiceover.language ?? 'english') === lang ? colors.primary : colors.border,
                              backgroundColor: (adBuilderData.voiceover.language ?? 'english') === lang ? 'hsl(213 100% 55% / 0.2)' : 'transparent',
                              color: (adBuilderData.voiceover.language ?? 'english') === lang ? colors.primary : colors.foreground,
                            }}
                          >
                            {lang === 'english' ? 'English' : lang === 'tamil' ? 'Tamil' : 'Hindi'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Generate Script Button - Disabled until ad vision is entered */}
                  <button
                    onClick={handleGenerateScript}
                    disabled={
                      isGeneratingScript ||
                      isGeneratingStrategy ||
                      !adBuilderData.userDescription?.trim()
                    }
                    className="w-full px-6 py-3 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: colors.primary }}
                  >
                    {isGeneratingScript || isGeneratingStrategy ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                        {isGeneratingStrategy ? 'Developing Strategy...' : 'Generating Storyboard...'}
                      </span>
                    ) : (
                      'Generate Performance Storyboard'
                    )}
                  </button>
                  {!adBuilderData.userDescription?.trim() && !isGeneratingScript && (
                    <p className="text-xs mt-1" style={{ color: colors.mutedForeground }}>
                      Enter your commercial brief above to enable storyboard generation.
                    </p>
                  )}

                  {/* Loading Skeleton while generating */}
                  {isGeneratingScript && (
                    <div className="pt-4 border-t space-y-4" style={{ borderColor: colors.border }}>
                      <div className="p-4 rounded-lg border animate-pulse" style={{ backgroundColor: colors.muted, borderColor: colors.border }}>
                        <div className="h-4 rounded w-32 mb-3" style={{ backgroundColor: colors.border }} />
                        <div className="h-3 rounded w-full mb-2" style={{ backgroundColor: colors.border }} />
                        <div className="h-3 rounded w-3/4" style={{ backgroundColor: colors.border }} />
                      </div>
                      <div className="space-y-3">
                        <div className="h-5 rounded w-48 animate-pulse" style={{ backgroundColor: colors.border }} />
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="p-4 rounded-lg border animate-pulse" style={{ backgroundColor: colors.muted, borderColor: colors.border }}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="h-6 rounded-full w-20" style={{ backgroundColor: colors.border }} />
                              <div className="h-6 rounded-full w-16" style={{ backgroundColor: colors.border }} />
                            </div>
                            <div className="space-y-2">
                              <div className="h-3 rounded w-full" style={{ backgroundColor: colors.border }} />
                              <div className="h-3 rounded w-5/6" style={{ backgroundColor: colors.border }} />
                              <div className="h-3 rounded w-4/6" style={{ backgroundColor: colors.border }} />
                            </div>
                            <div className="flex gap-2 mt-3">
                              <div className="h-5 rounded w-24" style={{ backgroundColor: colors.border }} />
                              <div className="h-5 rounded w-28" style={{ backgroundColor: colors.border }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Creative Score */}
                  {!isGeneratingScript && adBuilderData.creativeScore && (
                    <div
                      className="p-4 rounded-lg border"
                      style={{
                        backgroundColor:
                          adBuilderData.creativeScore.overallScore >= 75
                            ? 'hsl(142 76% 36% / 0.12)'
                            : 'hsl(45 93% 47% / 0.12)',
                        borderColor:
                          adBuilderData.creativeScore.overallScore >= 75
                            ? 'hsl(142 76% 36% / 0.35)'
                            : 'hsl(45 93% 47% / 0.35)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold" style={{ color: colors.foreground }}>
                          Creative Score
                        </label>
                        <span
                          className="text-lg font-bold"
                          style={{
                            color:
                              adBuilderData.creativeScore.overallScore >= 75 ? colors.green600 : 'hsl(45 93% 40%)',
                          }}
                        >
                          {adBuilderData.creativeScore.overallScore}/100
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs" style={{ color: colors.mutedForeground }}>
                        <span>Hook: {adBuilderData.creativeScore.hookStrength}</span>
                        <span>Scroll-stop: {adBuilderData.creativeScore.scrollStopPotential}</span>
                        <span>Emotion: {adBuilderData.creativeScore.emotionalImpact}</span>
                        <span>Clarity: {adBuilderData.creativeScore.clarity}</span>
                        <span>Trust: {adBuilderData.creativeScore.trustFactor}</span>
                        <span>Conversion: {adBuilderData.creativeScore.conversionPotential}</span>
                      </div>
                      {adBuilderData.creativeScore.feedback?.length ? (
                        <ul className="mt-2 text-xs list-disc pl-4" style={{ color: colors.mutedForeground }}>
                          {adBuilderData.creativeScore.feedback.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  )}

                  {/* Ad Angle & Hook */}
                  {!isGeneratingScript && adBuilderData.adAngle && (
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: 'hsl(270 80% 55% / 0.15)', borderColor: 'hsl(270 80% 55% / 0.35)' }}>
                      <label className="block text-sm font-semibold mb-2" style={{ color: colors.foreground }}>
                        Ad Angle & Hook
                      </label>
                      <p className="text-sm" style={{ color: colors.mutedForeground }}>{adBuilderData.adAngle}</p>
                    </div>
                  )}

                  {/* Scene-by-Scene Storyboard - Editable */}
                  {!isGeneratingScript && adBuilderData.storyboard && adBuilderData.storyboard.length > 0 && (() => {
                    // Calculate total duration from scenes
                    const calculateTotalDuration = () => {
                      let total = 0;
                      for (const scene of adBuilderData.storyboard || []) {
                        const timeStr = scene.time_range || scene.duration || '';
                        // Parse formats like "0-3s", "3-7s", "2s", "2-3s"
                        const rangeMatch = timeStr.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*s?/);
                        const singleMatch = timeStr.match(/^(\d+(?:\.\d+)?)\s*s?$/);
                        
                        if (rangeMatch) {
                          // For "0-3s" format, use the end time minus start time
                          const start = parseFloat(rangeMatch[1]);
                          const end = parseFloat(rangeMatch[2]);
                          total += end - start;
                        } else if (singleMatch) {
                          // For "3s" format, use the number directly
                          total += parseFloat(singleMatch[1]);
                        } else {
                          // Default to 2 seconds if can't parse
                          total += 2;
                        }
                      }
                      return Math.round(total * 10) / 10; // Round to 1 decimal
                    };
                    
                    const totalSceneDuration = calculateTotalDuration();
                    const selectedDuration = adBuilderData.adSetup.duration;
                    const isOverDuration = totalSceneDuration > selectedDuration;
                    const isUnderDuration = totalSceneDuration < selectedDuration - 1; // Allow 1s buffer
                    
                    return (
                    <div className="pt-4 border-t" style={{ borderColor: colors.border }}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold" style={{ color: colors.foreground }}>
                          Performance Storyboard ({adBuilderData.storyboard.length} beats) — Editable
                        </h3>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-medium px-3 py-1 rounded-full"
                            style={{
                              backgroundColor: isOverDuration ? 'hsl(0 84% 55% / 0.2)' : isUnderDuration ? 'hsl(45 93% 47% / 0.2)' : 'hsl(142 76% 36% / 0.2)',
                              color: isOverDuration ? colors.destructive : isUnderDuration ? 'hsl(45 93% 40%)' : colors.green600,
                            }}
                          >
                            {totalSceneDuration}s / {selectedDuration}s
                          </span>
                        </div>
                      </div>
                      
                      {/* Duration Warning */}
                      {isOverDuration && (
                        <div className="mb-4 p-3 rounded-lg flex items-start gap-2" style={{ backgroundColor: 'hsl(0 84% 55% / 0.15)', border: `1px solid ${colors.destructive}` }}>
                          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: colors.destructive }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium" style={{ color: colors.destructive }}>
                              Total scene duration ({totalSceneDuration}s) exceeds selected video length ({selectedDuration}s)
                            </p>
                            <p className="text-xs mt-1" style={{ color: colors.destructive }}>
                              Consider removing scenes or reducing individual scene durations to fit within {selectedDuration} seconds.
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {isUnderDuration && !isOverDuration && (
                        <div className="mb-4 p-3 rounded-lg flex items-start gap-2" style={{ backgroundColor: 'hsl(45 93% 47% / 0.15)', border: '1px solid hsl(45 93% 47% / 0.3)' }}>
                          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'hsl(45 93% 40%)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'hsl(45 93% 30%)' }}>
                              Total scene duration ({totalSceneDuration}s) is shorter than selected video length ({selectedDuration}s)
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'hsl(45 93% 40%)' }}>
                              You may want to add more scenes or extend existing ones to fill the {selectedDuration}-second video.
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-4">
                        {adBuilderData.storyboard.map((scene, idx) => (
                          <div
                            key={idx}
                            className="p-4 rounded-lg shadow-sm"
                            style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}
                          >
                            {/* Scene Header */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: 'hsl(270 80% 55% / 0.2)', color: colors.primary }}>
                                  Beat {scene.scene}
                                </span>
                                {scene.beat && (
                                  <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: 'hsl(213 100% 55% / 0.15)', color: colors.primary }}>
                                    {scene.beat}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  const newStoryboard = adBuilderData.storyboard?.filter((_, i) => i !== idx) || [];
                                  const renumbered = newStoryboard.map((s, i) => ({ ...s, scene: i + 1 }));
                                  setAdBuilderData({ ...adBuilderData, storyboard: renumbered });
                                }}
                                className="text-xs px-2 py-1 rounded transition-colors"
                                style={{ color: colors.destructive }}
                              >
                                Remove Scene
                              </button>
                            </div>

                            {/* Duration / Time Range */}
                            <div className="mb-3">
                              <label className="block text-xs font-medium mb-1" style={{ color: colors.foreground }}>
                                Duration / Time Range
                              </label>
                              <input
                                type="text"
                                value={scene.time_range || scene.duration || ''}
                                onChange={(e) => {
                                  const newStoryboard = [...(adBuilderData.storyboard || [])];
                                  newStoryboard[idx] = { ...scene, time_range: e.target.value, duration: e.target.value };
                                  setAdBuilderData({ ...adBuilderData, storyboard: newStoryboard });
                                }}
                                placeholder="e.g., 0-3s or 2-3s"
                                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
                                style={{ borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground }}
                              />
                            </div>

                            {/* Marketing Message */}
                            <div className="mb-3">
                              <label className="block text-xs font-medium mb-1" style={{ color: colors.foreground }}>
                                Marketing Message
                              </label>
                              <textarea
                                value={scene.marketing_message || ''}
                                onChange={(e) => {
                                  const newStoryboard = [...(adBuilderData.storyboard || [])];
                                  newStoryboard[idx] = { ...scene, marketing_message: e.target.value };
                                  setAdBuilderData({ ...adBuilderData, storyboard: newStoryboard });
                                }}
                                placeholder="What this beat must communicate to sell the product..."
                                rows={2}
                                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
                                style={{ borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground }}
                              />
                            </div>

                            {/* Visual Description */}
                            <div className="mb-3">
                              <label className="block text-xs font-medium mb-1" style={{ color: colors.foreground }}>
                                Visual Description
                              </label>
                              <textarea
                                value={scene.visual_description || ''}
                                onChange={(e) => {
                                  const newStoryboard = [...(adBuilderData.storyboard || [])];
                                  newStoryboard[idx] = { ...scene, visual_description: e.target.value };
                                  setAdBuilderData({ ...adBuilderData, storyboard: newStoryboard });
                                }}
                                placeholder="Visuals that support the marketing message (not the other way around)..."
                                rows={3}
                                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
                                style={{ borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground }}
                              />
                            </div>

                            {/* Emotion & Motion Style (side by side) */}
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: colors.foreground }}>
                                  Emotion
                                </label>
                                <input
                                  type="text"
                                  value={scene.emotion || ''}
                                  onChange={(e) => {
                                    const newStoryboard = [...(adBuilderData.storyboard || [])];
                                    newStoryboard[idx] = { ...scene, emotion: e.target.value };
                                    setAdBuilderData({ ...adBuilderData, storyboard: newStoryboard });
                                  }}
                                  placeholder="e.g., Desire, Excitement"
                                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
                                  style={{ borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground }}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: colors.foreground }}>
                                  Motion / Camera Style
                                </label>
                                <input
                                  type="text"
                                  value={scene.motion_style || ''}
                                  onChange={(e) => {
                                    const newStoryboard = [...(adBuilderData.storyboard || [])];
                                    newStoryboard[idx] = { ...scene, motion_style: e.target.value };
                                    setAdBuilderData({ ...adBuilderData, storyboard: newStoryboard });
                                  }}
                                  placeholder="e.g., Slow zoom in, Pan left"
                                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
                                  style={{ borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground }}
                                />
                              </div>
                            </div>

                            {/* Voiceover for this scene — source of truth for voiceover when voiceover is enabled */}
                            <div>
                              <label className="block text-xs font-medium mb-1" style={{ color: colors.foreground }}>
                                Scene Voiceover
                              </label>
                              <textarea
                                value={scene.voiceover_line || scene.voiceover_script || ''}
                                onChange={(e) => {
                                  const newStoryboard = [...(adBuilderData.storyboard || [])];
                                  newStoryboard[idx] = { ...scene, voiceover_line: e.target.value, voiceover_script: e.target.value };
                                  setAdBuilderData({ ...adBuilderData, storyboard: newStoryboard });
                                }}
                                placeholder="Voiceover text for this specific scene..."
                                rows={2}
                                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
                                style={{ borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground }}
                              />
                            </div>
                          </div>
                        ))}

                        {/* Add New Scene Button */}
                        <button
                          onClick={() => {
                            const newScene = {
                              scene: (adBuilderData.storyboard?.length || 0) + 1,
                              duration: '2-3s',
                              time_range: '',
                              visual_description: '',
                              on_screen_text: '',
                              emotion: '',
                              motion_style: '',
                              voiceover_line: '',
                              voiceover_script: '',
                            };
                            const newStoryboard = [...(adBuilderData.storyboard || []), newScene];
                            setAdBuilderData({ ...adBuilderData, storyboard: newStoryboard });
                          }}
                          className="w-full px-4 py-3 text-sm border-2 border-dashed rounded-lg transition-colors font-medium"
                          style={{ borderColor: colors.primary, color: colors.primary }}
                        >
                          + Add New Scene
                        </button>
                      </div>
                    </div>
                    );
                  })()}

                  {/* Visual Style Guide */}
                  {!isGeneratingScript && adBuilderData.visualStyleGuide && (
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: 'hsl(270 80% 55% / 0.12)', borderColor: 'hsl(270 80% 55% / 0.35)' }}>
                      <label className="block text-sm font-semibold mb-3" style={{ color: colors.foreground }}>
                        Visual Style Guide
                      </label>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="font-medium" style={{ color: colors.foreground }}>Color Palette:</span>{' '}
                          <span style={{ color: colors.mutedForeground }}>{adBuilderData.visualStyleGuide.color_palette}</span>
                        </div>
                        <div>
                          <span className="font-medium" style={{ color: colors.foreground }}>Lighting:</span>{' '}
                          <span style={{ color: colors.mutedForeground }}>{adBuilderData.visualStyleGuide.lighting_mood}</span>
                        </div>
                        <div>
                          <span className="font-medium" style={{ color: colors.foreground }}>Typography:</span>{' '}
                          <span style={{ color: colors.mutedForeground }}>{adBuilderData.visualStyleGuide.typography}</span>
                        </div>
                        <div>
                          <span className="font-medium" style={{ color: colors.foreground }}>Motion:</span>{' '}
                          <span style={{ color: colors.mutedForeground }}>{adBuilderData.visualStyleGuide.motion_style}</span>
                        </div>
                      </div>
                      {adBuilderData.visualStyleGuide.brand_polish && (
                        <p className="text-xs mt-3" style={{ color: colors.mutedForeground }}>
                          Quality Level: {adBuilderData.visualStyleGuide.brand_polish}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between pt-4 border-t" style={{ borderColor: colors.border }}>
                    <button
                      onClick={() => setStep(1)}
                      className="px-6 py-2 border rounded-lg"
                      style={{ borderColor: colors.border, color: colors.foreground }}
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      disabled={!adBuilderData.storyboard?.length || (adBuilderData.voiceover.enabled && !getCanonicalVoiceover(adBuilderData.voiceover.script, adBuilderData.storyboard))}
                      className="px-6 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: colors.primary }}
                      title={!adBuilderData.storyboard?.length ? 'Generate a script first to continue' : adBuilderData.voiceover.enabled && !getCanonicalVoiceover(adBuilderData.voiceover.script, adBuilderData.storyboard) ? 'Add voiceover to at least one scene' : undefined}
                    >
                      Continue to Preview
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Generate – Final confirmation checkpoint */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: colors.foreground }}>Review &amp; Generate</h2>
                  <p style={{ color: colors.mutedForeground }}>Confirm your video settings before spending credits</p>
                </div>

                <div className="p-4 rounded-xl text-sm leading-relaxed relative z-10" style={{ backgroundColor: 'hsl(30 60% 22%)', border: '1px solid hsl(30 50% 40%)', color: '#FAFAFA' }}>
                  If a generation glitches or looks incorrect,{' '}
                  <Link href="/report" className="font-medium underline" style={{ color: 'hsl(38 92% 65%)' }}>send us a screenshot</Link>
                  {' '}and we&apos;ll refund the credit. We&apos;re constantly improving the system to make it better every day. Subject to Terms & Conditions.
                </div>

                <div className="rounded-lg border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  {/* Orientation preview */}
                  <div className="mb-6">
                    <p className="text-sm font-medium mb-2" style={{ color: colors.mutedForeground }}>Orientation</p>
                    <div
                      className="rounded-lg border-2 overflow-hidden flex items-center justify-center"
                      style={{
                        borderColor: colors.border,
                        backgroundColor: colors.muted,
                        aspectRatio: ['9:16', '4:5'].includes(adBuilderData.adSetup.aspect_ratio || '') ? '9/16' : '16/9',
                        maxWidth: 200,
                        maxHeight: 140,
                      }}
                    >
                      <span className="text-xs font-semibold" style={{ color: colors.mutedForeground }}>
                        {adBuilderData.adSetup.aspect_ratio === '9:16' ? 'Portrait' : adBuilderData.adSetup.aspect_ratio === '1:1' ? 'Square' : 'Landscape'}
                      </span>
                    </div>
                  </div>

                  {/* Summary grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-sm" style={{ color: colors.mutedForeground }}>Product</p>
                      <p className="font-medium" style={{ color: colors.foreground }}>{adBuilderData.product?.product_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: colors.mutedForeground }}>Format</p>
                      <p className="font-medium" style={{ color: colors.foreground }}>{adBuilderData.adSetup.creativeFormat}</p>
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: colors.mutedForeground }}>Hook Type</p>
                      <p className="font-medium" style={{ color: colors.foreground }}>
                        {adBuilderData.adSetup.hookType === 'Auto' ? 'Auto (AI picks best)' : adBuilderData.adSetup.hookType}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: colors.mutedForeground }}>Tone</p>
                      <p className="font-medium" style={{ color: colors.foreground }}>{adBuilderData.voiceover.tone}</p>
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: colors.mutedForeground }}>Campaign Goal</p>
                      <p className="font-medium" style={{ color: colors.foreground }}>{adBuilderData.adSetup.campaignGoal}</p>
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: colors.mutedForeground }}>Duration</p>
                      <p className="font-medium" style={{ color: colors.foreground }}>
                        {adBuilderData.adSetup.duration}s
                        {adBuilderData.adSetup.duration > 8 && (
                          <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full" style={{ backgroundColor: 'hsl(213 100% 55% / 0.15)', color: colors.primary }}>
                            2 clips stitched
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: colors.mutedForeground }}>Aspect Ratio</p>
                      <p className="font-medium" style={{ color: colors.foreground }}>{adBuilderData.adSetup.aspect_ratio} ({adBuilderData.adSetup.aspect_ratio === '9:16' ? 'Portrait' : 'Landscape'})</p>
                    </div>
                    <div>
                      <p className="text-sm mb-2" style={{ color: colors.mutedForeground }}>Selected product image</p>
                      {adBuilderData.product?.hero_image ? (
                        <img
                          src={adBuilderData.product.hero_image}
                          alt="Selected product"
                          className="w-16 h-16 rounded-lg object-cover border"
                          style={{ borderColor: colors.border }}
                        />
                      ) : (
                        <p className="text-sm" style={{ color: colors.mutedForeground }}>None</p>
                      )}
                    </div>
                  </div>

                  {/* Script (built from scene-by-scene voiceover) */}
                  {getCanonicalVoiceover(adBuilderData.voiceover?.script, adBuilderData.storyboard) && (
                    <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: colors.muted, border: `1px solid ${colors.border}` }}>
                      <p className="text-sm font-medium mb-2" style={{ color: colors.mutedForeground }}>Voiceover script (from scenes)</p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: colors.foreground }}>
                        {getCanonicalVoiceover(adBuilderData.voiceover?.script, adBuilderData.storyboard)}
                      </p>
                    </div>
                  )}

                  {/* Cinematic style variants */}
                  {(promptVariants.length > 0 || isLoadingVariants) && (
                    <div className="mb-6">
                      <p className="text-sm font-medium mb-2" style={{ color: colors.mutedForeground }}>
                        Cinematic style {isLoadingVariants ? '(loading…)' : '(pick one)'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {promptVariants.map((v) => {
                          const selected = selectedFilmStyleId === v.filmStyleId;
                          return (
                            <button
                              key={v.filmStyleId}
                              type="button"
                              onClick={() => setSelectedFilmStyleId(v.filmStyleId)}
                              className="text-left p-3 rounded-lg border transition-all"
                              style={{
                                borderColor: selected ? colors.primary : colors.border,
                                backgroundColor: selected ? 'hsl(213 100% 55% / 0.08)' : colors.muted,
                                boxShadow: selected ? colors.shadowGlow : undefined,
                              }}
                            >
                              <p className="font-medium text-sm" style={{ color: colors.foreground }}>
                                {v.label}
                              </p>
                              <p className="text-xs mt-1 line-clamp-2" style={{ color: colors.mutedForeground }}>
                                {v.summary}
                              </p>
                              <p className="text-xs mt-1 opacity-70" style={{ color: colors.mutedForeground }}>
                                ~{v.estimatedTokens} tokens
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Insufficient Credits Warning */}
                  {hasInsufficientCredits && (
                    <InsufficientCreditsAlert type="video" />
                  )}

                  {/* Generate CTA */}
                  <button
                    onClick={handleGenerateVideo}
                    disabled={isGeneratingVideo || hasInsufficientCredits}
                    className="w-full px-6 py-4 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold transition-all hover:opacity-95"
                    style={{ backgroundColor: colors.primary, boxShadow: colors.shadowGlow }}
                  >
                    {isGeneratingVideo ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                        {adBuilderData.adSetup.duration > 8 ? 'Generating Extended Video...' : 'Generating Video...'}
                      </span>
                    ) : adBuilderData.adSetup.duration > 8 ? (
                      <span className="flex items-center justify-center gap-2">
                        Generate Extended Video
                        <span className="text-xs opacity-80 font-normal">(16s &middot; 2 clips stitched)</span>
                      </span>
                    ) : (
                      'Generate Video'
                    )}
                  </button>

                  {/* Video Generation Progress */}
                  {isGeneratingVideo && (() => {
                    const isExtended = adBuilderData.adSetup.duration > 8;
                    const steps = isExtended
                      ? [
                          'Analyzing your prompt',
                          'Building campaign strategy',
                          'Writing script',
                          'Generating clip 1 of 2',
                          'Rendering clip 1',
                          'Extracting continuity frame',
                          'Generating clip 2 of 2',
                          'Rendering clip 2',
                          'Stitching clips into final video',
                        ]
                      : [
                          'Analyzing your prompt',
                          'Building campaign strategy',
                          'Writing script',
                          'Generating scenes',
                          'Rendering final video',
                        ];
                    const totalSteps = steps.length;
                    const cappedStep = Math.min(generationStep, totalSteps);
                    return (
                      <div className="mt-4 p-6 rounded-xl border" style={{ backgroundColor: colors.muted, borderColor: colors.border }}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full border-3 border-t-transparent animate-spin" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
                            <div className="absolute inset-0 w-10 h-10 rounded-full border-3 border-t-transparent animate-spin" style={{ borderColor: 'transparent', borderBottomColor: colors.primary, animationDirection: 'reverse', animationDuration: '1.5s' }} />
                          </div>
                          <div>
                            <p className="font-semibold" style={{ color: colors.foreground }}>
                              {isExtended ? 'AI is generating your extended video' : 'AI is generating your video'}
                            </p>
                            <p className="text-sm" style={{ color: colors.mutedForeground }}>
                              {isExtended
                                ? 'Generating 2 clips & stitching — this takes 3-4 minutes. Please don\u2019t close this page.'
                                : 'This may take 1-2 minutes. Please don\u2019t close this page.'}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {steps.map((label, i) => {
                            const isCompleted = i < cappedStep || (cappedStep >= totalSteps && i <= totalSteps - 1);
                            const shouldFadeIn = i === cappedStep && cappedStep < totalSteps;
                            if (i > cappedStep && cappedStep < totalSteps) return null;
                            return (
                              <div
                                key={label}
                                className="flex items-center gap-2"
                                style={{
                                  opacity: shouldFadeIn ? 0 : 1,
                                  animation: shouldFadeIn ? 'videoStepFadeIn 0.5s ease-out forwards' : undefined,
                                }}
                              >
                                {isCompleted ? (
                                  <Check className="w-4 h-4 flex-shrink-0" style={{ color: colors.primary }} />
                                ) : (
                                  <div className="w-4 h-4 flex-shrink-0 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
                                )}
                                <span className="text-sm" style={{ color: isCompleted ? colors.foreground : colors.mutedForeground }}>{label}{!isCompleted && '...'}</span>
                              </div>
                            );
                          })}
                        </div>
                        <style jsx global>{`
                          @keyframes videoStepFadeIn {
                            from { opacity: 0; transform: translateY(-4px); }
                            to { opacity: 1; transform: translateY(0); }
                          }
                        `}</style>
                        <div className="mt-4 w-full rounded-full h-1.5 overflow-hidden" style={{ backgroundColor: colors.border }}>
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{
                              backgroundColor: colors.primary,
                              width: `${Math.min(100, (cappedStep / totalSteps) * 80 + 20)}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Generated Videos - Primary + Variations */}
                {generatedVideos.length > 0 && (
                  <div className="rounded-lg border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                    <h3 className="text-lg font-semibold mb-4" style={{ color: colors.foreground }}>Generated Videos</h3>

                    {/* Primary: Large preview of best version */}
                    {(() => {
                      const primary = generatedVideos.find((v) => v.id === selectedVideoId) ?? generatedVideos[0];
                      return (
                        <div className="mb-6">
                          <p className="text-sm font-medium mb-2" style={{ color: colors.mutedForeground }}>Best Version</p>
                          <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${colors.border}` }}>
                            <video
                              key={primary.id}
                              src={primary.url}
                              controls
                              crossOrigin="anonymous"
                              playsInline
                              className="w-full rounded-lg"
                              style={{ maxHeight: '420px' }}
                              onError={() => {
                                showError(
                                  'Video file could not be played. If this is a 16s video, confirm SUPABASE_SERVICE_ROLE_KEY is set in production and the campaign-assets bucket allows video/mp4.'
                                );
                              }}
                            />
                          </div>
                          <div className="mt-3 flex justify-between items-center">
                            <span className="text-sm" style={{ color: colors.mutedForeground }}>
                              {new Date(primary.timestamp).toLocaleString()}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDownloadVideo(primary)}
                              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                              style={{ backgroundColor: colors.primary, color: 'white' }}
                            >
                              Download
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Variations: Horizontal scroll thumbnails */}
                    {generatedVideos.length > 1 && (
                      <div>
                        <p className="text-sm font-medium mb-3" style={{ color: colors.mutedForeground }}>Variations</p>
                        <div className="relative flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const el = variationsScrollRef.current;
                              if (el) el.scrollBy({ left: -152, behavior: 'smooth' });
                            }}
                            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-100 opacity-80 disabled:opacity-40 disabled:pointer-events-none"
                            style={{ backgroundColor: colors.muted, color: colors.foreground }}
                            aria-label="Previous variations"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <div
                            ref={variationsScrollRef}
                            className="flex gap-3 overflow-x-auto pb-2 flex-1 min-w-0 scroll-smooth"
                            style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
                          >
                            {generatedVideos.map((video) => {
                              const isSelected = video.id === selectedVideoId;
                              return (
                                <button
                                  key={video.id}
                                  type="button"
                                  onClick={() => setSelectedVideoId(video.id)}
                                  className="flex-shrink-0 rounded-lg overflow-hidden transition-all focus:outline-none focus:ring-2 focus:ring-offset-2"
                                  style={{
                                    border: `2px solid ${isSelected ? colors.primary : colors.border}`,
                                    width: '140px',
                                    boxShadow: isSelected ? `0 0 0 1px ${colors.primary}` : undefined,
                                  }}
                                >
                                  <video
                                    src={video.url}
                                    muted
                                    playsInline
                                    className="w-full aspect-video object-cover"
                                  />
                                  <span className="block py-1.5 text-xs font-medium truncate px-2" style={{ color: colors.foreground }}>
                                    v{generatedVideos.indexOf(video) + 1}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const el = variationsScrollRef.current;
                              if (el) el.scrollBy({ left: 152, behavior: 'smooth' });
                            }}
                            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-100 opacity-80 disabled:opacity-40 disabled:pointer-events-none"
                            style={{ backgroundColor: colors.muted, color: colors.foreground }}
                            aria-label="Next variations"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-start">
                  <button
                    onClick={() => setStep(2)}
                    className="px-6 py-2 border rounded-lg"
                    style={{ borderColor: colors.border, color: colors.foreground }}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Brand Onboarding Modal */}
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

        {/* Brand Guideline Modal */}
        {showBrandGuidelineModal && brand && (
          <BrandGuidelineModal
            brand={brand}
            onUpdate={updateBrandGuideline}
            onClose={() => setShowBrandGuidelineModal(false)}
            onWebsiteAnalyze={handleWebsiteReanalyze}
          />
        )}

        {/* New Session Modal */}
        <SessionNameModal
          isOpen={showNewSessionModal}
          sessionType="video"
          isLoading={isCreatingSession}
          onSubmit={handleCreateNewSession}
          onClose={() => setShowNewSessionModal(false)}
        />

        {/* Delete Confirmation Modal */}
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
