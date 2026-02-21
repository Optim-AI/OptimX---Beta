// pages/creative-studio/video/[sessionId].tsx
// Video Generation Session Page

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { showAlert, showError, showConfirm } from '@/app/web/src/components/ui/AlertModal';
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
  VIDEO_STYLES,
  VIDEO_DURATIONS,
  VIDEO_PLATFORMS,
  VIDEO_ASPECT_RATIOS,
} from '@/app/web/src/components/creative-studio';
import { authFetch } from '@/lib/utils';
import { supabase } from '@/auth/supabase/client';
import { Check } from 'lucide-react';

// ============== Types ==============

type AdBuilderStep = 1 | 2 | 3 | 4;

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
  const { id: sessionId } = router.query; // Get id from query params (e.g., ?id=xxx)

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

  // Loading states
  const [isScrapingProduct, setIsScrapingProduct] = useState(false);
  const [isFetchingLogo, setIsFetchingLogo] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

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
      if (mounted) {
        setIsAuthReady(true);
      }
    };

    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
          setAdBuilderData(savedAdBuilderData);
          setStep((savedAdBuilderData as any).step || 1);
          
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
          setGeneratedVideos(loadedSession.generatedVideos);
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

  async function handleWebsiteBrandSetup(website: string) {
    setIsAnalyzingBrand(true);

    try {
      const response = await authFetch('/api/brand/fullAnalyze', {
        method: 'POST',
        body: JSON.stringify({ url: website }),
      });

      const data = await response.json();

      // API returns { result: {...} } on success, { error: string } on failure
      if (data.result) {
        const result = data.result;
        const brandSnapshot: BrandSnapshot = {
          name: result.facts?.company_name || 'Unknown Brand',
          description: result.positioning?.primary_value_proposition || '',
          audience: result.facts?.who_it_is_for?.join(', ') || '',
          offering: result.facts?.what_they_sell?.join(', ') || '',
          tone: result.brandVoice || result.personality || 'professional',
          logo: result.logo,
        };

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

  // ============== Script Generation ==============

  async function handleGenerateScript() {
    if (!adBuilderData.product) return;
    if (!adBuilderData.userDescription?.trim()) return;

    setIsGeneratingScript(true);
    try {
      const response = await authFetch('/api/creative-studio/generate-script', {
        method: 'POST',
        body: JSON.stringify({
          product_name: adBuilderData.product.product_name,
          brand_name: adBuilderData.product.brand_name,
          category: adBuilderData.product.category,
          style: adBuilderData.adSetup.style,
          duration: adBuilderData.adSetup.duration,
          platform: adBuilderData.adSetup.platform,
          aspect_ratio: adBuilderData.adSetup.aspect_ratio,
          voiceover: adBuilderData.voiceover.enabled,
          language: adBuilderData.voiceover.language ?? 'english',
          tone: adBuilderData.voiceover.tone,
          key_message: adBuilderData.voiceover.key_message,
          cta: adBuilderData.voiceover.cta,
          on_screen_text: adBuilderData.onScreenText.enabled,
          user_description: adBuilderData.userDescription,
          product_images: adBuilderData.product.product_images,
        }),
      });

      const result = await response.json();
      if (!result.ok) throw new Error(result.error);

      const scriptData = result.script;

      setAdBuilderData({
        ...adBuilderData,
        voiceover: {
          ...adBuilderData.voiceover,
          script: scriptData.voiceover_script,
        },
        onScreenText: {
          ...adBuilderData.onScreenText,
          headline: scriptData.headline,
          subtext: scriptData.subtext,
        },
        finalVideoPrompt: scriptData.final_video_prompt,
        storyboard: scriptData.storyboard,
        visualStyleGuide: scriptData.visual_style_guide,
        adAngle: scriptData.ad_angle,
      });
    } catch (error: any) {
      showError(`Failed to generate script: ${error.message}`);
    } finally {
      setIsGeneratingScript(false);
    }
  }

  // ============== Video Generation ==============

  async function handleGenerateVideo() {
    if (!adBuilderData.product) return;

    // Check for sufficient credits before generating
    if (hasInsufficientCredits || (videoCredits && videoCredits.total <= 0)) {
      showError('You have insufficient video credits. Please purchase more credits to generate videos.', 'Insufficient Credits');
      return;
    }

    setIsGeneratingVideo(true);
    try {
      if (!adBuilderData.voiceover.script) {
        await handleGenerateScript();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const finalPrompt =
        adBuilderData.finalVideoPrompt ||
        adBuilderData.voiceover.script ||
        `Create a ${adBuilderData.adSetup.duration}-second ${adBuilderData.adSetup.style.toLowerCase()} video ad for ${adBuilderData.product.product_name}.`;

      // Prefer brand guideline logo when available so the fetched/configured logo is used in the video
      const brandLogo = brand?.logo ?? brand?.logoUrl ?? adBuilderData.product.brand_logo ?? null;

      const response = await authFetch('/api/creative-studio/generate-video', {
        method: 'POST',
        body: JSON.stringify({
          product_name: adBuilderData.product.product_name,
          brand_name: adBuilderData.product.brand_name,
          style: adBuilderData.adSetup.style,
          duration: adBuilderData.adSetup.duration,
          aspect_ratio: adBuilderData.adSetup.aspect_ratio,
          quality: adBuilderData.adSetup.quality || 'standard',
          final_video_prompt: finalPrompt,
          voiceover_script: adBuilderData.voiceover.script,
          product_images: adBuilderData.product.product_images,
          hero_image: adBuilderData.product.hero_image,
          brand_logo: brandLogo,
        }),
      });

      const result = await response.json();
      if (!result.ok) throw new Error(result.error);

      const videoId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setGeneratedVideos([
        ...generatedVideos,
        {
          id: videoId,
          url: result.videoUrl,
          prompt: finalPrompt,
          timestamp: Date.now(),
        },
      ]);

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

  // ============== Platform/Aspect Ratio ==============

  function updatePlatform(platform: typeof VIDEO_PLATFORMS[number]) {
    const aspectRatioMap: Record<string, '9:16' | '1:1' | '16:9' | '4:5'> = {
      'Instagram Reels / TikTok': '9:16',
      'YouTube Shorts': '9:16',
      'Instagram Feed': '4:5',
      'YouTube Ad': '16:9',
    };

    setAdBuilderData({
      ...adBuilderData,
      adSetup: {
        ...adBuilderData.adSetup,
        platform,
        aspect_ratio: aspectRatioMap[platform],
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
      
      router.push(`/creative-studio/video?id=${selectedSessionId}`);
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

    // Check for duplicate session name
    const isDuplicate = videoSessions.some(
      s => s.name.toLowerCase() === name.toLowerCase()
    );
    if (isDuplicate) {
      showAlert('A session with this name already exists. Please choose a different name.', 'Duplicate Name');
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
        router.push(`/creative-studio/video?id=${data.session.id}`);
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
          router.push('/creative-studio');
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
            onClick={() => router.push('/creative-studio')}
            className="px-4 py-2 text-white rounded-lg"
            style={{ backgroundColor: colors.primary }}
          >
            Back to Creative Studio
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
            {[1, 2, 3, 4].map((s) => {
              const isStep4Blocked = s === 4 && !adBuilderData.voiceover?.script;
              return (
              <React.Fragment key={s}>
                <button
                  onClick={() => {
                    if (isStep4Blocked) return;
                    setStep(s as AdBuilderStep);
                  }}
                  disabled={isStep4Blocked}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'transparent',
                    color: step === s ? colors.primary : step > s ? colors.foreground : colors.mutedForeground,
                    fontWeight: step === s ? 600 : 400,
                  }}
                  title={isStep4Blocked ? 'Generate a script first' : undefined}
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
                    {s === 1 && 'Product'}
                    {s === 2 && 'Ad Setup'}
                    {s === 3 && 'Script'}
                    {s === 4 && 'Generate'}
                  </span>
                </button>
                {s < 4 && <div className="flex-1 h-px mx-2" style={{ backgroundColor: colors.border }} />}
              </React.Fragment>
            );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: colors.background }}>
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Step 1: Product Input */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: colors.foreground }}>Product Input</h2>
                  <p style={{ color: colors.mutedForeground }}>Add your product by URL or upload images</p>
                </div>

                {/* URL Input */}
                <div className="rounded-lg border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>
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

                {/* Image Upload */}
                <div className="rounded-lg border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>
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

                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={() => setStep(2)}
                        className="px-6 py-2 text-white rounded-lg"
                        style={{ backgroundColor: colors.primary }}
                      >
                        Continue to Ad Setup
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Ad Setup */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: colors.foreground }}>Ad Setup</h2>
                  <p style={{ color: colors.mutedForeground }}>Configure your ad style, duration, and platform</p>
                </div>

                <div className="rounded-lg border p-6 space-y-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  {/* Style */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>Ad Style</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {VIDEO_STYLES.map((style) => (
                        <button
                          key={style}
                          onClick={() =>
                            setAdBuilderData({
                              ...adBuilderData,
                              adSetup: { ...adBuilderData.adSetup, style: style as any },
                            })
                          }
                          className="px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors"
                          style={{
                            borderColor: adBuilderData.adSetup.style === style ? colors.primary : colors.border,
                            backgroundColor: adBuilderData.adSetup.style === style ? 'hsl(213 100% 55% / 0.2)' : 'transparent',
                            color: adBuilderData.adSetup.style === style ? colors.primary : colors.foreground,
                          }}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>Duration</label>
                    <div className="flex gap-3">
                      {VIDEO_DURATIONS.map((dur) => (
                        <button
                          key={dur}
                          onClick={() =>
                            setAdBuilderData({
                              ...adBuilderData,
                              adSetup: { ...adBuilderData.adSetup, duration: dur },
                            })
                          }
                          className="px-6 py-3 rounded-lg border-2 font-medium transition-colors"
                          style={{
                            borderColor: adBuilderData.adSetup.duration === dur ? colors.primary : colors.border,
                            backgroundColor: adBuilderData.adSetup.duration === dur ? 'hsl(213 100% 55% / 0.2)' : 'transparent',
                            color: adBuilderData.adSetup.duration === dur ? colors.primary : colors.foreground,
                          }}
                        >
                          {dur}s
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs" style={{ color: colors.mutedForeground }}>
                      Standard length: 8 s.
                    </p>
                  </div>

                  {/* Platform */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>Platform</label>
                    <div className="grid grid-cols-2 gap-3">
                      {VIDEO_PLATFORMS.map((platform) => (
                        <button
                          key={platform}
                          onClick={() => updatePlatform(platform)}
                          className="px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors"
                          style={{
                            borderColor: adBuilderData.adSetup.platform === platform ? colors.primary : colors.border,
                            backgroundColor: adBuilderData.adSetup.platform === platform ? 'hsl(213 100% 55% / 0.2)' : 'transparent',
                            color: adBuilderData.adSetup.platform === platform ? colors.primary : colors.foreground,
                          }}
                        >
                          {platform}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs" style={{ color: colors.mutedForeground }}>
                      Aspect Ratio: {adBuilderData.adSetup.aspect_ratio}
                    </p>
                  </div>

                  <div className="flex justify-between pt-4">
                    <button
                      onClick={() => setStep(1)}
                      className="px-6 py-2 border rounded-lg"
                      style={{ borderColor: colors.border, color: colors.foreground }}
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      className="px-6 py-2 text-white rounded-lg"
                      style={{ backgroundColor: colors.primary }}
                    >
                      Continue to Script
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Script */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: colors.foreground }}>Voiceover & Script</h2>
                  <p style={{ color: colors.mutedForeground }}>Configure voiceover and generate your video script</p>
                </div>

                <div className="rounded-lg border p-6 space-y-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                  {/* User Description Input - Required to enable Generate Script */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>
                      Describe Your Video Ad Vision <span style={{ color: colors.destructive }}>*</span>
                    </label>
                    <p className="text-xs mb-2" style={{ color: colors.mutedForeground }}>
                      Tell us what you want in your video ad. You must enter this to generate a script and proceed to preview.
                    </p>
                    <textarea
                      value={adBuilderData.userDescription || ''}
                      onChange={(e) =>
                        setAdBuilderData({
                          ...adBuilderData,
                          userDescription: e.target.value,
                        })
                      }
                      placeholder="E.g., Show the product in action, highlight the key benefits, create an emotional connection with the audience, showcase the premium quality..."
                      className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2"
                      style={{ borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground }}
                      rows={4}
                    />
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
                    <>
                      {/* Language Selection */}
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>Voiceover Language</label>
                        <div className="flex gap-3">
                          {(['english', 'tamil', 'hindi'] as const).map((lang) => (
                            <button
                              key={lang}
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

                      {/* Tone Selection */}
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>Tone</label>
                        <div className="flex gap-3">
                          {(['Energetic', 'Calm', 'Premium', 'Fun'] as const).map((tone) => (
                            <button
                              key={tone}
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

                      {/* Key Message & CTA */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>
                            Key Message (optional)
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
                            placeholder="e.g., 50% off sale"
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2"
                            style={{ borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground }}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>
                            CTA (optional)
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
                    </>
                  )}

                  {/* Generate Script Button - Disabled until ad vision is entered */}
                  <button
                    onClick={handleGenerateScript}
                    disabled={isGeneratingScript || !adBuilderData.userDescription?.trim()}
                    className="w-full px-6 py-3 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: colors.primary }}
                  >
                    {isGeneratingScript ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                        Generating Script...
                      </span>
                    ) : (
                      'Generate Script with AI'
                    )}
                  </button>
                  {!adBuilderData.userDescription?.trim() && !isGeneratingScript && (
                    <p className="text-xs mt-1" style={{ color: colors.mutedForeground }}>
                      Enter your ad vision above to enable script generation.
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
                          Scene-by-Scene Storyboard ({adBuilderData.storyboard.length} scenes) - Editable
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
                              <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: 'hsl(270 80% 55% / 0.2)', color: colors.primary }}>
                                Scene {scene.scene}
                              </span>
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
                                placeholder="Describe the visual scene with camera angles, lighting, composition..."
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

                            {/* Voiceover for this scene */}
                            <div>
                              <label className="block text-xs font-medium mb-1" style={{ color: colors.foreground }}>
                                Scene Voiceover (optional)
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

                  {/* Generated Voiceover Script */}
                  {!isGeneratingScript && adBuilderData.voiceover.enabled && (
                    <div className="p-4 rounded-lg" style={{ backgroundColor: colors.muted }}>
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>
                        Full Voiceover Script
                      </label>
                      <textarea
                        value={adBuilderData.voiceover.script}
                        onChange={(e) =>
                          setAdBuilderData({
                            ...adBuilderData,
                            voiceover: { ...adBuilderData.voiceover, script: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2"
                        style={{ borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground }}
                        rows={4}
                      />
                    </div>
                  )}

                  <div className="flex justify-between pt-4 border-t" style={{ borderColor: colors.border }}>
                    <button
                      onClick={() => setStep(2)}
                      className="px-6 py-2 border rounded-lg"
                      style={{ borderColor: colors.border, color: colors.foreground }}
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setStep(4)}
                      disabled={!adBuilderData.voiceover.script}
                      className="px-6 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: colors.primary }}
                      title={!adBuilderData.voiceover.script ? 'Generate a script first to continue' : undefined}
                    >
                      Continue to Preview
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Generate – Final confirmation checkpoint */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: colors.foreground }}>Review &amp; Generate</h2>
                  <p style={{ color: colors.mutedForeground }}>Confirm your video settings before spending credits</p>
                </div>

                <div className="p-4 rounded-xl text-sm leading-relaxed relative z-10" style={{ backgroundColor: 'hsl(30 60% 22%)', border: '1px solid hsl(30 50% 40%)', color: '#FAFAFA' }}>
                  If a generation glitches or looks incorrect,{' '}
                  <Link href="/report" className="font-medium underline" style={{ color: 'hsl(38 92% 65%)' }}>send us a screenshot</Link>
                  {' '}and we&apos;ll refund the credit. We&apos;re constantly improving the system to make it better every day.
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
                        {['9:16', '4:5'].includes(adBuilderData.adSetup.aspect_ratio || '') ? 'Portrait' : adBuilderData.adSetup.aspect_ratio === '1:1' ? 'Square' : 'Landscape'}
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
                      <p className="text-sm" style={{ color: colors.mutedForeground }}>Style</p>
                      <p className="font-medium" style={{ color: colors.foreground }}>{adBuilderData.adSetup.style}</p>
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: colors.mutedForeground }}>Theme</p>
                      <p className="font-medium" style={{ color: colors.foreground }}>{adBuilderData.adSetup.style}</p>
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: colors.mutedForeground }}>Duration</p>
                      <p className="font-medium" style={{ color: colors.foreground }}>{adBuilderData.adSetup.duration}s</p>
                    </div>
                    <div>
                      <p className="text-sm" style={{ color: colors.mutedForeground }}>Platform</p>
                      <p className="font-medium" style={{ color: colors.foreground }}>{adBuilderData.adSetup.platform}</p>
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

                  {/* Generated script */}
                  {adBuilderData.voiceover?.script && (
                    <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: colors.muted, border: `1px solid ${colors.border}` }}>
                      <p className="text-sm font-medium mb-2" style={{ color: colors.mutedForeground }}>Generated script</p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: colors.foreground }}>
                        {adBuilderData.voiceover.script}
                      </p>
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
                        Generating Video...
                      </span>
                    ) : (
                      'Generate Video'
                    )}
                  </button>

                  {/* Video Generation Progress */}
                  {isGeneratingVideo && (
                    <div className="mt-4 p-6 rounded-xl border" style={{ backgroundColor: colors.muted, borderColor: colors.border }}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full border-3 border-t-transparent animate-spin" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
                          <div className="absolute inset-0 w-10 h-10 rounded-full border-3 border-t-transparent animate-spin" style={{ borderColor: 'transparent', borderBottomColor: colors.primary, animationDirection: 'reverse', animationDuration: '1.5s' }} />
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: colors.foreground }}>AI is generating your video</p>
                          <p className="text-sm" style={{ color: colors.mutedForeground }}>This may take 1-2 minutes. Please don't close this page.</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4" style={{ color: colors.primary }} />
                          <span className="text-sm" style={{ color: colors.foreground }}>Preparing your video assets...</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
                          <span className="text-sm" style={{ color: colors.mutedForeground }}>AI is composing scenes and visuals...</span>
                        </div>
                      </div>
                      <div className="mt-4 w-full rounded-full h-1.5 overflow-hidden" style={{ backgroundColor: colors.border }}>
                        <div className="h-full rounded-full animate-pulse" style={{ backgroundColor: colors.primary, width: '60%', transition: 'width 2s ease' }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Generated Videos */}
                {generatedVideos.length > 0 && (
                  <div className="rounded-lg border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                    <h3 className="text-lg font-semibold mb-4" style={{ color: colors.foreground }}>Generated Videos</h3>
                    <div className="space-y-4">
                      {generatedVideos.map((video) => (
                        <div key={video.id} className="rounded-lg p-4" style={{ border: `1px solid ${colors.border}` }}>
                          <video
                            src={video.url}
                            controls
                            className="w-full rounded-lg"
                            style={{ maxHeight: '400px' }}
                          />
                          <div className="mt-2 flex justify-between items-center">
                            <span className="text-sm" style={{ color: colors.mutedForeground }}>
                              {new Date(video.timestamp).toLocaleString()}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDownloadVideo(video)}
                              className="px-4 py-2 rounded-lg text-sm"
                              style={{ backgroundColor: colors.muted, color: colors.foreground }}
                            >
                              Download
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-start">
                  <button
                    onClick={() => setStep(3)}
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
