// pages/creative-studio/video/[sessionId].tsx
// Video Generation Session Page

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Sidebar from '@/app/web/src/components/Sidebar';
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

  // Auto-save ref
  const autoSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // ============== Load Session ==============

  // Track previous session ID for saving on switch
  const prevSessionIdRef = React.useRef<string | null>(null);

  useEffect(() => {
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
        // Handle 'new' session
        if (sessionId === 'new') {
          const storedBrand = localStorage.getItem('brand:snapshot');
          if (storedBrand) {
            setBrand(JSON.parse(storedBrand));
          } else {
            setShowBrandOnboarding(true);
          }
          setIsLoading(false);
          prevSessionIdRef.current = sessionId;
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
        
        prevSessionIdRef.current = sessionId;
      } catch (err: any) {
        console.error('Error loading session:', err);
        setError(err.message || 'Failed to load session');
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();
  }, [sessionId]);

  // ============== Load Video Sessions for Sidebar ==============

  useEffect(() => {
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
  }, []);

  // ============== Load Credits ==============

  useEffect(() => {
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
  }, []);

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

  async function handleWebsiteBrandSetup(website: string) {
    setShowBrandOnboarding(false);

    try {
      const response = await authFetch('/api/brand/fullAnalyze', {
        method: 'POST',
        body: JSON.stringify({ url: website }),
      });

      const data = await response.json();

      if (data.ok && data.brand) {
        const brandSnapshot: BrandSnapshot = {
          name: data.brand.name || 'Unknown Brand',
          description: data.brand.description || '',
          audience: data.brand.audience || '',
          offering: data.brand.offering || '',
          tone: data.brand.tone || '',
          logo: data.brand.logo,
        };

        setBrand(brandSnapshot);
        localStorage.setItem('brand:snapshot', JSON.stringify(brandSnapshot));
      } else {
        alert('Could not analyze website. Please try manual setup.');
        setShowBrandOnboarding(true);
      }
    } catch (err) {
      console.error('Brand analysis error:', err);
      alert('Error analyzing website. Please try manual setup.');
      setShowBrandOnboarding(true);
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
    localStorage.setItem('brand:snapshot', JSON.stringify(brandSnapshot));
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
  }

  function updateBrandGuideline(updated: BrandSnapshot) {
    setBrand(updated);
    localStorage.setItem('brand:snapshot', JSON.stringify(updated));
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
          brand_logo: adBuilderData.product.brand_logo,
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
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Script Generation</h2>
                  <p className="text-gray-600">Generate your video script and messaging</p>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
                  {/* User Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Describe your vision (optional)
                    </label>
                    <textarea
                      value={adBuilderData.userDescription || ''}
                      onChange={(e) =>
                        setAdBuilderData({
                          ...adBuilderData,
                          userDescription: e.target.value,
                        })
                      }
                      placeholder="e.g., Focus on the product's premium quality and elegance..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows={3}
                    />
                  </div>

                  {/* Generate Button */}
                  <button
                    onClick={handleGenerateScript}
                    disabled={isGeneratingScript}
                    className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingScript ? 'Generating Script...' : 'Generate Script'}
                  </button>

                  {/* Generated Script */}
                  {adBuilderData.voiceover.script && (
                    <div className="pt-4 border-t border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Generated Script</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {adBuilderData.voiceover.script}
                        </p>
                      </div>

                      {adBuilderData.onScreenText.headline && (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-gray-700">Headline:</p>
                          <p className="text-gray-900">{adBuilderData.onScreenText.headline}</p>
                        </div>
                      )}

                      {adBuilderData.onScreenText.subtext && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-gray-700">Subtext:</p>
                          <p className="text-gray-900">{adBuilderData.onScreenText.subtext}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between pt-4">
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
                      Continue to Generate
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
