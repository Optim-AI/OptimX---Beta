// pages/creative-studio/video/[sessionId].tsx
// Video Generation Session Page

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Sidebar from '@/app/web/src/components/Sidebar';
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
  const { sessionId } = router.query;

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
        const response = await authFetch(`/api/creative-studio/sessions/${sessionId}`);
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

  useEffect(() => {
    if (!isAuthReady) return;

    async function loadCredits() {
      try {
        const response = await authFetch('/api/credits/balance');
        const data = await response.json();
        if (data.success) {
          setCredits(data.credits);
        }
      } catch (err) {
        console.error('Error loading credits:', err);
      }
    }
    loadCredits();
  }, [isAuthReady]);

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

      const response = await authFetch(`/api/creative-studio/sessions/${sessionId}`, {
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
        alert(`Could not analyze website: ${data.error || 'Unknown error'}. Please try manual setup.`);
        // Keep modal open on error
      }
    } catch (err: any) {
      console.error('Brand analysis error:', err);
      alert(`Error analyzing website: ${err.message || 'Unknown error'}. Please try manual setup.`);
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
      alert(`Failed to scrape product: ${error.message}`);
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
      alert(`Failed to generate script: ${error.message}`);
    } finally {
      setIsGeneratingScript(false);
    }
  }

  // ============== Video Generation ==============

  async function handleGenerateVideo() {
    if (!adBuilderData.product) return;

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

      // Use brand logo from product first, then from brand guideline so the logo is always used when available
      const brandLogo = adBuilderData.product.brand_logo ?? brand?.logo ?? brand?.logoUrl ?? null;

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
          headline: adBuilderData.onScreenText.headline,
          subtext: adBuilderData.onScreenText.subtext,
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
    } catch (error: any) {
      alert(`Failed to generate video: ${error.message}`);
    } finally {
      setIsGeneratingVideo(false);
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

          const response = await authFetch(`/api/creative-studio/sessions/${sessionId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          
          const result = await response.json();
          console.log('[DEBUG] Save response:', result.ok ? 'success' : result.error);
        } catch (err) {
          console.error('Error saving session before switch:', err);
        }
      }
      
      router.push(`/creative-studio/video/${selectedSessionId}`);
    }
  }

  function handleNewSession() {
    setShowNewSessionModal(true);
  }

  async function handleCreateNewSession(name: string) {
    if (!brand) {
      alert('Please set up brand guidelines first');
      return;
    }

    // Check for duplicate session name
    const isDuplicate = videoSessions.some(
      s => s.name.toLowerCase() === name.toLowerCase()
    );
    if (isDuplicate) {
      alert('A session with this name already exists. Please choose a different name.');
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
        router.push(`/creative-studio/video/${data.session.id}`);
      } else {
        alert('Failed to create session: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Create session error:', err);
      alert('Failed to create session');
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
      const response = await authFetch(`/api/creative-studio/sessions/${deleteSessionId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.ok) {
        setVideoSessions((prev) => prev.filter((s) => s.id !== deleteSessionId));

        if (deleteSessionId === sessionId) {
          router.push('/creative-studio');
        }
      } else {
        alert('Failed to delete session: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Delete session error:', err);
      alert('Failed to delete session');
    } finally {
      setIsDeletingSession(false);
      setDeleteSessionId(null);
    }
  }

  // ============== Render ==============

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-purple-600" />
          <span>Loading session...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/creative-studio')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Creative Studio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
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
      <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white flex-shrink-0">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {session?.name || 'New Video Session'}
                </h1>
                <p className="text-gray-500 text-sm">
                  {isSaving ? 'Saving...' : 'Create video-first ad concepts'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {credits !== null && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg">
                    <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95c-.285.475-.507 1-.67 1.55H6a1 1 0 000 2h.013a9.358 9.358 0 000 1H6a1 1 0 100 2h.351c.163.55.385 1.075.67 1.55C7.721 15.216 8.768 16 10 16s2.279-.784 2.979-1.95a1 1 0 10-1.715-1.029c-.472.786-.96.979-1.264.979-.304 0-.792-.193-1.264-.979a4.265 4.265 0 01-.264-.521H10a1 1 0 100-2H8.017a7.36 7.36 0 010-1H10a1 1 0 100-2H8.472c.08-.185.167-.36.264-.521z" />
                    </svg>
                    <span className="font-semibold text-amber-700 text-sm">{credits}</span>
                    <span className="text-amber-600 text-xs">credits</span>
                  </div>
                )}
                <BackButton />
              </div>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {[1, 2, 3, 4].map((s) => (
              <React.Fragment key={s}>
                <button
                  onClick={() => setStep(s as AdBuilderStep)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    step === s
                      ? 'bg-purple-100 text-purple-700 font-semibold'
                      : step > s
                      ? 'text-gray-600 hover:text-gray-900'
                      : 'text-gray-400'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      step === s
                        ? 'bg-purple-600 text-white'
                        : step > s
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
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
                {s < 4 && <div className="flex-1 h-px bg-gray-200 mx-2" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Step 1: Product Input */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Input</h2>
                  <p className="text-gray-600">Add your product by URL or upload images</p>
                </div>

                {/* URL Input */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product URL (D2C, Shopify, Amazon, etc.)
                  </label>
                  <form onSubmit={handleProductUrlSubmit} className="flex gap-3">
                    <input
                      type="url"
                      value={productUrl}
                      onChange={(e) => setProductUrl(e.target.value)}
                      placeholder="https://example.com/product"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={isScrapingProduct}
                    />
                    <button
                      type="submit"
                      disabled={!productUrl.trim() || isScrapingProduct}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isScrapingProduct ? 'Scraping...' : 'Scrape'}
                    </button>
                  </form>
                </div>

                {/* Image Upload */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Or Upload Product Images (1-3 images)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                  />
                </div>

                {/* Product Preview */}
                {adBuilderData.product && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Detected Product</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Product Name</p>
                        <p className="font-medium">{adBuilderData.product.product_name}</p>
                        <p className="text-sm text-gray-600 mt-2 mb-1">Brand</p>
                        <p className="font-medium">{adBuilderData.product.brand_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Product Images</p>
                        <div className="grid grid-cols-3 gap-2">
                          {adBuilderData.product.product_images.map((img, idx) => (
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
                              className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
                                selectedImageIndex === idx ? 'border-purple-600' : 'border-gray-200'
                              }`}
                            >
                              <img src={img} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={() => setStep(2)}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
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
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Ad Setup</h2>
                  <p className="text-gray-600">Configure your ad style, duration, and platform</p>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
                  {/* Style */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ad Style</label>
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
                          className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                            adBuilderData.adSetup.style === style
                              ? 'border-purple-600 bg-purple-50 text-purple-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
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
                          className={`px-6 py-3 rounded-lg border-2 font-medium transition-colors ${
                            adBuilderData.adSetup.duration === dur
                              ? 'border-purple-600 bg-purple-50 text-purple-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {dur}s
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Platform */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                    <div className="grid grid-cols-2 gap-3">
                      {VIDEO_PLATFORMS.map((platform) => (
                        <button
                          key={platform}
                          onClick={() => updatePlatform(platform)}
                          className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                            adBuilderData.adSetup.platform === platform
                              ? 'border-purple-600 bg-purple-50 text-purple-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {platform}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Aspect Ratio: {adBuilderData.adSetup.aspect_ratio}
                    </p>
                  </div>

                  <div className="flex justify-between pt-4">
                    <button
                      onClick={() => setStep(1)}
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
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
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Voiceover & Script</h2>
                  <p className="text-gray-600">Configure voiceover and generate your video script</p>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
                  {/* User Description Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Describe Your Video Ad Vision
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Tell us what you want in your video ad. Our AI will analyze your product and enhance your vision into a premium commercial script.
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows={4}
                    />
                  </div>

                  {/* Voiceover Toggle */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Voiceover</label>
                      <p className="text-xs text-gray-500">Enable AI-generated voiceover narration</p>
                    </div>
                    <button
                      onClick={() =>
                        setAdBuilderData({
                          ...adBuilderData,
                          voiceover: { ...adBuilderData.voiceover, enabled: !adBuilderData.voiceover.enabled },
                        })
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        adBuilderData.voiceover.enabled ? 'bg-purple-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          adBuilderData.voiceover.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {adBuilderData.voiceover.enabled && (
                    <>
                      {/* Tone Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
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
                              className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                                adBuilderData.voiceover.tone === tone
                                  ? 'border-purple-600 bg-purple-50 text-purple-700'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              {tone}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Key Message & CTA */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* On-Screen Text Toggle */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">On-Screen Text</label>
                      <p className="text-xs text-gray-500">Show text overlays on video</p>
                    </div>
                    <button
                      onClick={() =>
                        setAdBuilderData({
                          ...adBuilderData,
                          onScreenText: { ...adBuilderData.onScreenText, enabled: !adBuilderData.onScreenText.enabled },
                        })
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        adBuilderData.onScreenText.enabled ? 'bg-purple-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          adBuilderData.onScreenText.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Generate Script Button */}
                  <button
                    onClick={handleGenerateScript}
                    disabled={isGeneratingScript}
                    className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

                  {/* Loading Skeleton while generating */}
                  {isGeneratingScript && (
                    <div className="pt-4 border-t border-gray-200 space-y-4">
                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 animate-pulse">
                        <div className="h-4 bg-purple-200 rounded w-32 mb-3" />
                        <div className="h-3 bg-purple-100 rounded w-full mb-2" />
                        <div className="h-3 bg-purple-100 rounded w-3/4" />
                      </div>
                      <div className="space-y-3">
                        <div className="h-5 bg-gray-200 rounded w-48 animate-pulse" />
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-200 animate-pulse">
                            <div className="flex items-center justify-between mb-3">
                              <div className="h-6 bg-purple-100 rounded-full w-20" />
                              <div className="h-6 bg-gray-100 rounded-full w-16" />
                            </div>
                            <div className="space-y-2">
                              <div className="h-3 bg-gray-200 rounded w-full" />
                              <div className="h-3 bg-gray-200 rounded w-5/6" />
                              <div className="h-3 bg-gray-200 rounded w-4/6" />
                            </div>
                            <div className="flex gap-2 mt-3">
                              <div className="h-5 bg-amber-100 rounded w-24" />
                              <div className="h-5 bg-blue-100 rounded w-28" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ad Angle & Hook */}
                  {!isGeneratingScript && adBuilderData.adAngle && (
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <label className="block text-sm font-semibold text-purple-900 mb-2">
                        Ad Angle & Hook
                      </label>
                      <p className="text-sm text-purple-800">{adBuilderData.adAngle}</p>
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
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Scene-by-Scene Storyboard ({adBuilderData.storyboard.length} scenes) - Editable
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                            isOverDuration 
                              ? 'bg-red-100 text-red-700' 
                              : isUnderDuration 
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-green-100 text-green-700'
                          }`}>
                            {totalSceneDuration}s / {selectedDuration}s
                          </span>
                        </div>
                      </div>
                      
                      {/* Duration Warning */}
                      {isOverDuration && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-red-800">
                              Total scene duration ({totalSceneDuration}s) exceeds selected video length ({selectedDuration}s)
                            </p>
                            <p className="text-xs text-red-600 mt-1">
                              Consider removing scenes or reducing individual scene durations to fit within {selectedDuration} seconds.
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {isUnderDuration && !isOverDuration && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-amber-800">
                              Total scene duration ({totalSceneDuration}s) is shorter than selected video length ({selectedDuration}s)
                            </p>
                            <p className="text-xs text-amber-600 mt-1">
                              You may want to add more scenes or extend existing ones to fill the {selectedDuration}-second video.
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-4">
                        {adBuilderData.storyboard.map((scene, idx) => (
                          <div
                            key={idx}
                            className="p-4 bg-white rounded-lg border border-purple-100 shadow-sm"
                          >
                            {/* Scene Header */}
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-sm font-semibold text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
                                Scene {scene.scene}
                              </span>
                              <button
                                onClick={() => {
                                  const newStoryboard = adBuilderData.storyboard?.filter((_, i) => i !== idx) || [];
                                  // Renumber scenes
                                  const renumbered = newStoryboard.map((s, i) => ({ ...s, scene: i + 1 }));
                                  setAdBuilderData({ ...adBuilderData, storyboard: renumbered });
                                }}
                                className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                              >
                                Remove Scene
                              </button>
                            </div>

                            {/* Duration / Time Range */}
                            <div className="mb-3">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
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
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                            </div>

                            {/* Visual Description */}
                            <div className="mb-3">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
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
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                            </div>

                            {/* On-Screen Text */}
                            <div className="mb-3">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                On-Screen Text (max 6 words)
                              </label>
                              <input
                                type="text"
                                value={scene.on_screen_text || ''}
                                onChange={(e) => {
                                  const newStoryboard = [...(adBuilderData.storyboard || [])];
                                  newStoryboard[idx] = { ...scene, on_screen_text: e.target.value };
                                  setAdBuilderData({ ...adBuilderData, storyboard: newStoryboard });
                                }}
                                placeholder="e.g., Discover Premium Quality"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                            </div>

                            {/* Emotion & Motion Style (side by side) */}
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
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
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
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
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                              </div>
                            </div>

                            {/* Voiceover for this scene */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
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
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                          className="w-full px-4 py-3 text-sm text-purple-600 border-2 border-dashed border-purple-300 rounded-lg hover:bg-purple-50 hover:border-purple-400 transition-colors font-medium"
                        >
                          + Add New Scene
                        </button>
                      </div>
                    </div>
                    );
                  })()}

                  {/* Visual Style Guide */}
                  {!isGeneratingScript && adBuilderData.visualStyleGuide && (
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
                      <label className="block text-sm font-semibold text-purple-900 mb-3">
                        Visual Style Guide
                      </label>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="font-medium text-purple-800">Color Palette:</span>{' '}
                          <span className="text-purple-700">{adBuilderData.visualStyleGuide.color_palette}</span>
                        </div>
                        <div>
                          <span className="font-medium text-purple-800">Lighting:</span>{' '}
                          <span className="text-purple-700">{adBuilderData.visualStyleGuide.lighting_mood}</span>
                        </div>
                        <div>
                          <span className="font-medium text-purple-800">Typography:</span>{' '}
                          <span className="text-purple-700">{adBuilderData.visualStyleGuide.typography}</span>
                        </div>
                        <div>
                          <span className="font-medium text-purple-800">Motion:</span>{' '}
                          <span className="text-purple-700">{adBuilderData.visualStyleGuide.motion_style}</span>
                        </div>
                      </div>
                      {adBuilderData.visualStyleGuide.brand_polish && (
                        <p className="text-xs text-purple-600 mt-3">
                          Quality Level: {adBuilderData.visualStyleGuide.brand_polish}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Generated Voiceover Script */}
                  {!isGeneratingScript && adBuilderData.voiceover.script && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        rows={4}
                      />
                    </div>
                  )}

                  {/* Headline & Subtext (editable) */}
                  {!isGeneratingScript && adBuilderData.onScreenText.enabled && adBuilderData.voiceover.script && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Headline</label>
                        <input
                          type="text"
                          value={adBuilderData.onScreenText.headline || ''}
                          onChange={(e) =>
                            setAdBuilderData({
                              ...adBuilderData,
                              onScreenText: { ...adBuilderData.onScreenText, headline: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Subtext</label>
                        <input
                          type="text"
                          value={adBuilderData.onScreenText.subtext || ''}
                          onChange={(e) =>
                            setAdBuilderData({
                              ...adBuilderData,
                              onScreenText: { ...adBuilderData.onScreenText, subtext: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between pt-4 border-t border-gray-200">
                    <button
                      onClick={() => setStep(2)}
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setStep(4)}
                      disabled={!adBuilderData.voiceover.script}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continue to Preview
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Generate */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Generate Video</h2>
                  <p className="text-gray-600">Generate your video ad</p>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-gray-600">Product</p>
                      <p className="font-medium">{adBuilderData.product?.product_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Style</p>
                      <p className="font-medium">{adBuilderData.adSetup.style}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Duration</p>
                      <p className="font-medium">{adBuilderData.adSetup.duration}s</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Platform</p>
                      <p className="font-medium">{adBuilderData.adSetup.platform}</p>
                    </div>
                  </div>

                  {/* Generate Button */}
                  <button
                    onClick={handleGenerateVideo}
                    disabled={isGeneratingVideo}
                    className="w-full px-6 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold"
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
                </div>

                {/* Generated Videos */}
                {generatedVideos.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Generated Videos</h3>
                    <div className="space-y-4">
                      {generatedVideos.map((video) => (
                        <div key={video.id} className="border border-gray-200 rounded-lg p-4">
                          <video
                            src={video.url}
                            controls
                            className="w-full rounded-lg"
                            style={{ maxHeight: '400px' }}
                          />
                          <div className="mt-2 flex justify-between items-center">
                            <span className="text-sm text-gray-500">
                              {new Date(video.timestamp).toLocaleString()}
                            </span>
                            <a
                              href={video.url}
                              download={`video-${video.id}.mp4`}
                              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                            >
                              Download
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-start">
                  <button
                    onClick={() => setStep(3)}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
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
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Delete Session</h3>
                    <p className="text-sm text-gray-500">This action cannot be undone</p>
                  </div>
                </div>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete this session? All data including generated videos will be permanently removed.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteSessionId(null)}
                    disabled={isDeletingSession}
                    className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteSession}
                    disabled={isDeletingSession}
                    className="flex-1 px-4 py-3 text-white bg-red-600 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
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
