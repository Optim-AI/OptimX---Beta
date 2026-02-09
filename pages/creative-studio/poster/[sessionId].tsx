// pages/creative-studio/poster/[sessionId].tsx
// Poster Generation Session Page

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/auth/supabase/client';
import Sidebar from '@/app/web/src/components/Sidebar';
import { InsufficientCreditsAlert } from '@/app/web/src/components/billing';
import {
  type BrandSnapshot,
  type Phase,
  type Message,
  type SerializedMessage,
  type PosterConfig,
  type CreativeStudioSession,
  type SessionListItem,
  BackButton,
  BrandCard,
  BrandOnboarding,
  BrandGuidelineModal,
  SessionNameModal,
  SystemBubble,
  UserBubble,
  buildPosterPrompt,
  formatTimestamp,
  fileToDataUrl,
  dataUrlToFile,
  generateId,
  DEFAULT_POSTER_CONFIG,
  POSTER_THEMES,
  ASPECT_RATIOS,
} from '@/app/web/src/components/creative-studio';
import { authFetch } from '@/lib/utils';

// ============== Page Component ==============

export default function PosterSessionPage() {
  const router = useRouter();
  const { sessionId } = router.query;
  
  // Session state
  const [session, setSession] = useState<CreativeStudioSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Session list for sidebar
  const [posterSessions, setPosterSessions] = useState<SessionListItem[]>([]);
  
  // Chat/Generation state
  const [phase, setPhase] = useState<Phase>('input');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [inputImages, setInputImages] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [thinkingMessages, setThinkingMessages] = useState<string[]>([]);
  
  // Brand state
  const [brand, setBrand] = useState<BrandSnapshot | null>(null);
  const [editing, setEditing] = useState(false);
  const [showBrandOnboarding, setShowBrandOnboarding] = useState(false);
  const [showBrandGuidelineModal, setShowBrandGuidelineModal] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<'website' | 'manual'>('website');
  const [isAnalyzingBrand, setIsAnalyzingBrand] = useState(false);
  
  // Product state
  const [productPrompt, setProductPrompt] = useState('');
  const [productImages, setProductImages] = useState<File[]>([]);
  const [savedProductData, setSavedProductData] = useState<{
    prompt: string;
    images: File[];
    imageDataUrls?: string[];
  } | null>(null);
  
  // Poster generation state
  const [posterPrompt, setPosterPrompt] = useState('');
  const [config, setConfig] = useState<PosterConfig>(DEFAULT_POSTER_CONFIG);
  const [generatedPosters, setGeneratedPosters] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savingPoster, setSavingPoster] = useState<number | null>(null);
  const [creatingCampaign, setCreatingCampaign] = useState<number | null>(null);
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);
  const [regeneratePrompt, setRegeneratePrompt] = useState('');
  
  // New session modal state
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  
  // Delete confirmation modal state
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // Image preview state (for chat history images)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Credits state
  const [credits, setCredits] = useState<number | null>(null);
  const [hasInsufficientCredits, setHasInsufficientCredits] = useState(false);

  // Feature access state
  const [canCreateCampaigns, setCanCreateCampaigns] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageIdCounter = useRef<number>(0);
  const isAddingReferenceRef = useRef<boolean>(false);

  // Auth state
  const [isAuthReady, setIsAuthReady] = useState(false);

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
  
  useEffect(() => {
    if (!isAuthReady) return;
    if (!sessionId || typeof sessionId !== 'string') return;
    
    async function loadSession() {
      setIsLoading(true);
      setError(null);
      
      // Reset state before loading new session to avoid data overlap
      setSession(null);
      setPhase('input');
      setMessages([]);
      setInputValue('');
      setInputImages([]);
      setThinkingMessages([]);
      setProductPrompt('');
      setProductImages([]);
      setSavedProductData(null);
      setPosterPrompt('');
      setConfig(DEFAULT_POSTER_CONFIG);
      setGeneratedPosters([]);
      setHasInsufficientCredits(false);
      
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
          return;
        }
        
        // Fetch existing session
        const response = await authFetch(`/api/creative-studio/sessions/${sessionId}`);
        const data = await response.json();
        
        if (!data.ok) {
          throw new Error(data.error || 'Failed to load session');
        }
        
        const loadedSession = data.session as CreativeStudioSession;
        setSession(loadedSession);
        
        // Restore state from session
        setBrand(loadedSession.brandSnapshot);
        setPhase((loadedSession.phase as Phase) || 'input');
        setPosterPrompt(loadedSession.posterPrompt || '');
        setConfig(loadedSession.config || DEFAULT_POSTER_CONFIG);
        setGeneratedPosters(loadedSession.generatedPosters || []);
        
        // Restore messages (including imageUrls for poster history)
        if (loadedSession.messages) {
          const restoredMessages: Message[] = loadedSession.messages.map((m: SerializedMessage) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            imageUrls: m.imageUrls, // Restore poster URLs for chat history
            images: undefined, // File objects aren't stored in serialized messages
          }));
          setMessages(restoredMessages);
        }
        
        // Restore product data
        if (loadedSession.productData) {
          const productData = loadedSession.productData;
          setProductPrompt(productData.prompt || '');
          
          // Restore images from data URLs
          if (productData.imageDataUrls && productData.imageDataUrls.length > 0) {
            const restoredImages = productData.imageDataUrls.map((dataUrl, idx) => 
              dataUrlToFile(dataUrl, `product-${idx}.jpg`)
            );
            setProductImages(restoredImages);
            setSavedProductData({
              prompt: productData.prompt || '',
              images: restoredImages,
              imageDataUrls: productData.imageDataUrls,
            });
          }
        }
        
      } catch (err: any) {
        console.error('Error loading session:', err);
        setError(err.message || 'Failed to load session');
      } finally {
        setIsLoading(false);
      }
    }
    
    loadSession();
  }, [sessionId, isAuthReady]);

  // ============== Load Poster Sessions for Sidebar ==============
  
  useEffect(() => {
    if (!isAuthReady) return;

    async function loadPosterSessions() {
      try {
        const response = await authFetch('/api/creative-studio/sessions?type=poster');
        const data = await response.json();
        
        if (data.ok) {
          setPosterSessions(data.sessions.map((s: any) => ({
            id: s.id,
            name: s.name,
            sessionType: s.sessionType,
            updatedAt: s.updatedAt,
            createdAt: s.createdAt,
          })));
        }
      } catch (err) {
        console.error('Error loading poster sessions:', err);
      }
    }
    
    loadPosterSessions();
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

  // ============== Load Feature Access ==============

  useEffect(() => {
    if (!isAuthReady) return;

    async function loadFeatureAccess() {
      try {
        const response = await authFetch('/api/features/access');
        const data = await response.json();
        if (data.success && data.features) {
          setCanCreateCampaigns(data.features['create_campaigns']?.enabled || false);
        }
      } catch (err) {
        console.error('Error loading feature access:', err);
        // Default to false on error
        setCanCreateCampaigns(false);
      }
    }
    loadFeatureAccess();
  }, [isAuthReady]);

  // ============== Auto-save Session ==============
  
  const saveSession = useCallback(async () => {
    if (!sessionId || sessionId === 'new' || !brand) return;
    
    setIsSaving(true);
    
    try {
      // Convert product images to data URLs for persistence
      const productImageDataUrls: string[] = [];
      if (savedProductData?.images) {
        for (const img of savedProductData.images.slice(0, 3)) {
          const dataUrl = await fileToDataUrl(img);
          productImageDataUrls.push(dataUrl);
        }
      }
      
      // Serialize messages (remove File objects, but keep imageUrls for poster history)
      const serializedMessages: SerializedMessage[] = messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        imageUrls: m.imageUrls, // Preserve poster URLs in chat history
      }));
      
      const payload = {
        brandSnapshot: brand,
        phase,
        messages: serializedMessages,
        productData: savedProductData ? {
          prompt: savedProductData.prompt,
          imageDataUrls: productImageDataUrls,
        } : undefined,
        posterPrompt,
        config,
        generatedPosters: generatedPosters.slice(0, 10),
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
  }, [sessionId, brand, phase, messages, savedProductData, posterPrompt, config, generatedPosters]);

  // Auto-save on state changes (debounced)
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
  }, [phase, messages, savedProductData, posterPrompt, config, generatedPosters, saveSession]);

  // ============== Message Handlers ==============
  
  function addMessage(role: 'user' | 'system', content: string, images?: File[], imageUrls?: string[]) {
    const newMessage: Message = {
      id: generateId(),
      role,
      content,
      images,
      imageUrls,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }

  // ============== Input Handlers ==============
  
  function handleImageSelect(files: FileList | null) {
    if (files) {
      const newImages = Array.from(files).filter(f => f.type.startsWith('image/'));
      setInputImages(prev => [...prev, ...newImages]);
    }
  }

  function removeImage(index: number) {
    setInputImages(prev => prev.filter((_, i) => i !== index));
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleImageSelect(e.dataTransfer.files);
  }

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
          logoUrl: result.logoUrl,
          primaryColors: result.primaryColors,
          fontStyles: result.fontStyles,
          brandVoice: result.brandVoice,
          coreValueProp: result.coreValueProp,
        };
        
        setBrand(brandSnapshot);
        saveBrandSnapshot(brandSnapshot);
        setShowBrandOnboarding(false);
        setPhase('brand-review');
        addMessage('system', `I've analyzed your website and extracted your brand information. Please review it below.`);
      } else {
        console.error('Brand analysis failed:', data.error || 'Unknown error');
        addMessage('system', `I had trouble analyzing that website: ${data.error || 'Unknown error'}. Please try a different URL or set up your brand manually.`);
        // Keep modal open on error
      }
    } catch (err: any) {
      console.error('Brand analysis error:', err);
      addMessage('system', `There was an error analyzing your website: ${err.message || 'Unknown error'}. Please try again or set up your brand manually.`);
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
    setPhase('brand-review');
    addMessage('system', `Great! I've set up your brand profile. Please review it below.`);
  }

  function handleSkipBrandSetup() {
    setShowBrandOnboarding(false);
    // Create a minimal brand
    const minimalBrand: BrandSnapshot = {
      name: 'My Brand',
      description: '',
      audience: '',
      offering: '',
      tone: 'professional',
    };
    setBrand(minimalBrand);
    saveBrandSnapshot(minimalBrand);
    setPhase('product-input');
    addMessage('system', `No problem! You can set up your brand guidelines later. Let's start creating - tell me about what you want to promote.`);
  }

  function handleBrandConfirm() {
    if (brand) {
      saveBrandSnapshot(brand);
    }
    setPhase('product-input');
    addMessage('system', `Great! Your brand is set. Now tell me about the product or service you want to promote, or upload some product images.`);
  }

  function updateBrandGuideline(updated: BrandSnapshot) {
    setBrand(updated);
    saveBrandSnapshot(updated);
    setShowBrandGuidelineModal(false);
  }

  // ============== Product Handlers ==============
  
  function handleProductImageSelect(files: FileList | null) {
    if (files) {
      const newImages = Array.from(files).filter(f => f.type.startsWith('image/'));
      setProductImages(prev => [...prev, ...newImages]);
    }
  }

  function removeProductImage(index: number) {
    setProductImages(prev => prev.filter((_, i) => i !== index));
  }

  async function handleProductSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    
    if (!productPrompt.trim() && productImages.length === 0) return;
    
    // Save product data
    const productImageDataUrls: string[] = [];
    for (const img of productImages) {
      const dataUrl = await fileToDataUrl(img);
      productImageDataUrls.push(dataUrl);
    }
    
    setSavedProductData({
      prompt: productPrompt,
      images: [...productImages],
      imageDataUrls: productImageDataUrls,
    });
    
    addMessage('user', productPrompt || 'Product images uploaded', productImages.length > 0 ? [...productImages] : undefined);
    addMessage('system', `Got it! Now describe the poster you want to create.`);
    
    setPhase('poster-prompt');
  }

  // ============== Poster Generation Handlers ==============
  
  function handlePosterPromptSubmit() {
    if (!posterPrompt.trim()) return;
    
    addMessage('user', posterPrompt);
    addMessage('system', `Great prompt! Now select a theme and aspect ratio for your poster.`);
    
    setPhase('config');
  }

  async function handleConfigSubmit() {
    if (!config.theme) {
      alert('Please select a theme before generating.');
      return;
    }
    
    setPhase('generating');
    setIsGenerating(true);
    setThinkingMessages(['Generating your poster variants...']);
    
    try {
      const hasProductImage = savedProductData?.images && savedProductData.images.length > 0;
      
      // Build base user request from poster prompt or product data
      let userRequest = posterPrompt || savedProductData?.prompt || '';
      if (!userRequest.trim()) {
        // Fallback: build from brand
        const promptParts: string[] = [];
        if (brand?.name) promptParts.push(`Create a marketing poster for ${brand.name}`);
        if (brand?.description) promptParts.push(brand.description);
        if (config.theme) promptParts.push(`Theme: ${config.theme}`);
        userRequest = promptParts.length > 0 ? promptParts.join('. ') : 'Create a professional marketing poster';
      }
      
      // CRITICAL: Enhance prompt with comprehensive brand context (from revised branch)
      let finalPrompt = userRequest;
      if (brand) {
        const brandContext: string[] = [];
        
        // Core brand info
        if (brand.name) brandContext.push(`Brand: ${brand.name}`);
        if (brand.description) brandContext.push(brand.description);
        if (brand.audience) brandContext.push(`Target audience: ${brand.audience}`);
        if (brand.brandVoice) brandContext.push(`Brand tone: ${brand.brandVoice}`);
        if (brand.personality) brandContext.push(`Brand personality: ${brand.personality}`);
        if (brand.coreValueProp) brandContext.push(`Value proposition: ${brand.coreValueProp}`);
        
        // Brand Colors - CRITICAL for visual consistency (STRONG ENFORCEMENT)
        if (brand.primaryColors && brand.primaryColors.length > 0) {
          brandContext.push(`CRITICAL BRAND COLORS (MANDATORY - MUST DOMINATE DESIGN): ${brand.primaryColors.join(', ')}. These colors must be the primary visual elements. Do NOT use random colors.`);
        } else if (brand.colors) {
          const colorParts: string[] = [];
          if (brand.colors.primary) colorParts.push(`PRIMARY COLOR: ${brand.colors.primary} (use as dominant color)`);
          if (brand.colors.secondary) colorParts.push(`SECONDARY COLOR: ${brand.colors.secondary} (use for accents)`);
          if (brand.colors.accent) colorParts.push(`ACCENT COLOR: ${brand.colors.accent} (use for CTAs)`);
          if (colorParts.length > 0) {
            brandContext.push(`CRITICAL BRAND COLORS (MANDATORY): ${colorParts.join('. ')}. Do NOT deviate from these brand colors.`);
          }
        }
        
        // CTA Patterns
        if (brand.ctaPatterns && brand.ctaPatterns.length > 0) {
          brandContext.push(`Preferred CTAs: ${brand.ctaPatterns.join(', ')}`);
        }
        
        // Product Category & Price Positioning
        if (brand.productCategory) brandContext.push(`Product category: ${brand.productCategory}`);
        if (brand.pricePositioning) brandContext.push(`Price positioning: ${brand.pricePositioning}`);
        
        // Inject brand context into prompt
        if (brandContext.length > 0) {
          finalPrompt = `${finalPrompt}. CRITICAL BRAND GUIDELINES (MUST FOLLOW): ${brandContext.join('. ')}. All visual elements, logo, typography, and copy must strictly adhere to these brand guidelines.`;
        }
      }
      
      // Map aspect ratio to dimensions
      const aspectDimensions: Record<string, { width: number; height: number }> = {
        '1:1': { width: 1080, height: 1080 },
        '4:5': { width: 1080, height: 1350 },
        '9:16': { width: 1080, height: 1920 },
        '1.91:1': { width: 1910, height: 1000 },
      };
      const target = aspectDimensions[config.aspectRatio] || { width: 1080, height: 1080 };
      
      // Prepare logo data URL if brand has logo
      let logoDataUrl: string | undefined;
      if (brand?.logo) {
        if (brand.logo.startsWith('data:')) {
          logoDataUrl = brand.logo;
        } else if (brand.logo.startsWith('http')) {
          // Fetch logo via proxy
          try {
            const logoResponse = await fetch('/api/creative-studio/fetch-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: brand.logo }),
            });
            const logoData = await logoResponse.json();
            if (logoData.ok && logoData.dataUrl) {
              logoDataUrl = logoData.dataUrl;
            }
          } catch (e) {
            console.warn('Failed to fetch logo:', e);
          }
        }
      }
      
      // Prepare product images - first image as productDataUrl, rest as refDataUrls
      const allImageUrls = savedProductData?.imageDataUrls || [];
      const productDataUrl = allImageUrls.length > 0 ? allImageUrls[0] : undefined;
      const refDataUrls = allImageUrls.length > 1 ? allImageUrls.slice(1) : [];
      
      // Build base payload (same for all variants)
      const basePayload = {
        mode: 'generate',
        theme: config.theme,
        target,
        aspectLabel: config.aspectRatio,
        brandName: brand?.name || '',
        brandSnapshot: brand,
        tone: brand?.brandVoice || config.theme,
        productDataUrl,
        productProvided: !!productDataUrl,
        refDataUrls,
        logoDataUrl,
        logoProvided: !!logoDataUrl,
      };

      // Generate variants in parallel for faster results
      const variantCount = config.variantCount || 3;
      setThinkingMessages([`Generating ${variantCount} poster ${variantCount === 1 ? 'variant' : 'variants'} in parallel...`]);

      // Use PosterGenerator utility to create professional, theme-aware variant prompts
      const variantPrompts = Array.from({ length: variantCount }, (_, i) => i + 1).map(variantNum =>
        buildPosterPrompt({
          userRequest: finalPrompt,
          theme: config.theme,
          aspectRatio: config.aspectRatio,
          brand,
          hasProductImage: !!hasProductImage,
          variant: variantNum,
        })
      );

      // Create promises for all variants
      const variantPromises = variantPrompts.map(async (variantPrompt, idx) => {
        const variantNum = idx + 1;

        const response = await authFetch('/api/generate-campaign', {
          method: 'POST',
          body: JSON.stringify({
            ...basePayload,
            prompt: variantPrompt,
            description: variantPrompt,
          }),
        });

        const data = await response.json();
        return { variantNum, response, data };
      });
      
      // Wait for all to complete (don't fail fast - collect all results)
      const results = await Promise.allSettled(variantPromises);
      
      // Process results
      const posters: string[] = [];
      let creditError = false;
      let lastError = '';
      let latestCredits: number | undefined;
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { variantNum, response, data } = result.value;
          
          if (data.ok && data.image) {
            posters.push(data.image);
            // Track latest credits value
            if (data.creditsRemaining !== undefined) {
              latestCredits = data.creditsRemaining;
            }
          } else if (data.error) {
            console.error(`Poster variant ${variantNum} failed:`, data.error);
            lastError = data.error;
            // Check for credit-related errors
            if (data.error.toLowerCase().includes('credit') || response.status === 402) {
              creditError = true;
              latestCredits = 0;
            }
          }
        } else {
          console.error('Variant generation promise rejected:', result.reason);
          lastError = result.reason?.message || 'Unknown error';
        }
      }
      
      // Update credits once with the latest value
      if (latestCredits !== undefined) {
        setCredits(latestCredits);
        if (latestCredits <= 0) {
          setHasInsufficientCredits(true);
        }
      }
      
      if (posters.length > 0) {
        setGeneratedPosters(posters);
        setPhase('ready');
        // Add message with poster images in chat history
        addMessage(
          'system', 
          `Here ${posters.length === 1 ? 'is your poster' : `are your ${posters.length} poster variants`}! Click on any to preview, save, or use in a campaign.`,
          undefined,
          posters
        );
      } else if (creditError) {
        throw new Error('You have no credits remaining. Please purchase more credits to generate posters.');
      } else {
        throw new Error(lastError || 'No posters were generated. Please check if your API key is valid and try again.');
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      const errorMessage = err?.message || 'Sorry, there was an error generating your posters. Please try again.';
      addMessage('system', errorMessage);
      // Don't go back to config if it's a credit error - user can't generate anyway
      if (!hasInsufficientCredits) {
        setPhase('config');
      }
    } finally {
      setIsGenerating(false);
      setThinkingMessages([]);
    }
  }

  // ============== Poster Action Handlers ==============
  
  async function savePoster(url: string, index: number) {
    setSavingPoster(index);
    
    try {
      const response = await authFetch('/api/creative-studio/save-poster', {
        method: 'POST',
        body: JSON.stringify({
          imageUrl: url,
          metadata: {
            prompt: posterPrompt,
            theme: config.theme,
            aspectRatio: config.aspectRatio,
            brandName: brand?.name,
          },
        }),
      });
      
      const data = await response.json();
      
      if (data.ok) {
        alert('Poster saved to your library!');
      } else {
        alert('Failed to save poster: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Save poster error:', err);
      alert('Failed to save poster');
    } finally {
      setSavingPoster(null);
    }
  }

  async function createCampaignFromPoster(url: string, index: number) {
    setCreatingCampaign(index);
    
    try {
      const response = await authFetch('/api/creative-studio/create-campaign', {
        method: 'POST',
        body: JSON.stringify({
          imageUrl: url,
          name: `${brand?.name || 'Campaign'} - ${new Date().toLocaleDateString()}`,
          brandVoice: brand?.tone || 'professional',
        }),
      });
      
      const data = await response.json();
      
      if (data.ok && data.campaignId) {
        router.push(`/create-campaign?id=${data.campaignId}`);
      } else {
        alert('Failed to create campaign: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Create campaign error:', err);
      alert('Failed to create campaign');
    } finally {
      setCreatingCampaign(null);
    }
  }

  function handleRegenerateClick() {
    setShowRegeneratePrompt(true);
    setRegeneratePrompt(posterPrompt);
  }

  function handleRegenerateSubmit() {
    if (regeneratePrompt.trim()) {
      setPosterPrompt(regeneratePrompt);
    }
    setShowRegeneratePrompt(false);
    setRegeneratePrompt('');
    handleConfigSubmit();
  }

  async function handleUseAsReference(url: string, index: number) {
    // Prevent double-clicks or multiple rapid calls
    if (isAddingReferenceRef.current) {
      console.log('Already adding reference, skipping...');
      return;
    }
    isAddingReferenceRef.current = true;
    
    try {
      addMessage('system', "Great! I'll use this poster as a reference. You can adjust the theme, format, and add a prompt to create variations.");

      // Fetch the image and convert to File
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], `reference-poster-${Date.now()}-${index}.png`, { type: 'image/png' });

      // Convert file to data URL
      const dataUrl = await fileToDataUrl(file);
      
      // Set ONLY this poster as the reference (replace, don't accumulate)
      // User can add more references by clicking "Use as Reference" on additional posters
      setSavedProductData({
        prompt: posterPrompt || savedProductData?.prompt || '',
        images: [file],
        imageDataUrls: [dataUrl],
      });

      // Go to config phase so user can edit theme, format, and add prompt
      setPhase('config');
      
      addMessage('system', "I've set this poster as your reference image. Now you can:\n• Select a different theme\n• Choose a different format\n• Add a prompt describing the changes you want\n\nThen click 'Generate 3 Variants' to create new variations inspired by this poster!");
    } catch (error: any) {
      console.error('Error using poster as reference:', error);
      addMessage('system', `Sorry, I couldn't use this poster as a reference: ${error.message || 'Unknown error'}.`);
    } finally {
      // Reset the flag after a short delay
      setTimeout(() => {
        isAddingReferenceRef.current = false;
      }, 500);
    }
  }

  // ============== Initial Submit Handler ==============
  
  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    
    const hasInput = inputValue.trim() || inputImages.length > 0;
    if (!hasInput) return;
    
    // Capture input values before clearing
    const currentInput = inputValue.trim();
    const currentImages = [...inputImages];
    
    // Clear inputs immediately
    setInputValue('');
    setInputImages([]);
    
    // Check if input is a website URL
    const urlRegex = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/;
    const isUrl = urlRegex.test(currentInput);
    
    if (isUrl && !brand) {
      // Add user message first
      addMessage('user', currentInput);
      
      // Use setTimeout to allow React to render the message before starting analysis
      setTimeout(() => {
        handleWebsiteBrandSetup(currentInput);
      }, 0);
    } else if (!brand) {
      // Show brand onboarding
      setShowBrandOnboarding(true);
    } else {
      // We have a brand, treat as product input
      
      // Check if input contains a URL (could be image URL or product page URL)
      const urlRegex = /https?:\/\/[^\s]+/gi;
      const urls = currentInput.match(urlRegex) || [];
      
      if (urls.length > 0 && currentImages.length === 0) {
        // User pasted URL(s) - fetch image via API (handles both direct images and product pages)
        const url = urls[0]; // Use first URL
        console.log('Fetching image from URL:', url);
        addMessage('user', currentInput);
        setThinkingMessages(['Fetching image from URL...']);
        
        setTimeout(async () => {
          try {
            const response = await fetch('/api/creative-studio/fetch-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url }),
            });
            
            const result = await response.json();
            
            setThinkingMessages([]);
            
            if (!response.ok || !result.ok) {
              addMessage('system', `I couldn't fetch the image: ${result.error || 'Unknown error'}. Please try uploading the image directly.`);
              return;
            }
            
            // Convert data URL to File object
            const dataUrl = result.dataUrl;
            const contentType = result.contentType || 'image/jpeg';
            
            // Extract base64 data and convert to File
            const base64Data = dataUrl.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: contentType });
            
            // Determine file extension
            let extension = 'jpg';
            if (contentType.includes('png')) extension = 'png';
            else if (contentType.includes('gif')) extension = 'gif';
            else if (contentType.includes('webp')) extension = 'webp';
            
            const file = new File([blob], `fetched_${Date.now()}.${extension}`, { type: contentType });
            
            setProductPrompt(currentInput);
            setProductImages([file]);
            setSavedProductData({
              prompt: currentInput,
              images: [file],
              imageDataUrls: [dataUrl],
            });
            
            // Show the fetched image
            addMessage('system', `Got it! I've fetched the image from the URL. Now describe the poster you want to create.`, [file]);
            setPhase('poster-prompt');
          } catch (err: any) {
            setThinkingMessages([]);
            console.error('Error fetching image:', err);
            addMessage('system', `There was an error fetching the image: ${err.message || 'Unknown error'}. Please try uploading it directly.`);
          }
        }, 0);
      } else {
        // Regular text input and/or uploaded images (no URL to fetch)
        setProductPrompt(currentInput);
        setProductImages(currentImages);
        
        // Add user message
        addMessage('user', currentInput || 'Product images uploaded', currentImages.length > 0 ? currentImages : undefined);
        
        // Process product and move to next phase
        setTimeout(async () => {
          // Save product data
          const productImageDataUrls: string[] = [];
          for (const img of currentImages) {
            const dataUrl = await fileToDataUrl(img);
            productImageDataUrls.push(dataUrl);
          }
          
          setSavedProductData({
            prompt: currentInput,
            images: currentImages,
            imageDataUrls: productImageDataUrls,
          });
          
          addMessage('system', `Got it! Now describe the poster you want to create.`);
          setPhase('poster-prompt');
        }, 0);
      }
    }
  }

  // ============== Scroll to Bottom ==============
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinkingMessages]);

  // ============== Sidebar Session Handlers ==============
  
  async function handleSessionSelect(selectedSessionId: string) {
    if (selectedSessionId !== sessionId) {
      // Save current session immediately before switching
      if (sessionId && sessionId !== 'new' && brand) {
        await saveSession();
      }
      
      router.push(`/creative-studio/poster/${selectedSessionId}`);
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
    const isDuplicate = posterSessions.some(
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
          sessionType: 'poster',
          brandSnapshot: brand,
        }),
      });
      
      const data = await response.json();
      
      if (data.ok && data.session?.id) {
        // Add new session to the list
        const newSession: SessionListItem = {
          id: data.session.id,
          name: data.session.name,
          sessionType: 'poster',
          createdAt: data.session.createdAt || new Date().toISOString(),
          updatedAt: data.session.updatedAt || new Date().toISOString(),
        };
        setPosterSessions(prev => [newSession, ...prev]);
        
        setShowNewSessionModal(false);
        router.push(`/creative-studio/poster/${data.session.id}`);
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
        setPosterSessions(prev => prev.filter(s => s.id !== deleteSessionId));
        
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
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600" />
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
          chatHistory={posterSessions.map(s => ({
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
                  {session?.name || 'New Poster Session'}
                </h1>
                <p className="text-gray-500 text-sm">
                  {isSaving ? 'Saving...' : 'Create poster-ready creatives by talking to AI'}
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

        {/* Chat Container */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="space-y-6">
              {/* Initial system message */}
              {messages.length === 0 && phase === 'input' && (
                <SystemBubble>
                  Paste your website link, upload product images, or describe what you want to create. At least one input is required.
                </SystemBubble>
              )}

              {/* Message history */}
              {messages.map((msg, msgIndex) => {
                // Check if this is the latest message with generated posters
                // If so, and we're in 'ready' phase, don't show imageUrls (PosterGrid shows them)
                const isLatestPosterMessage = msg.imageUrls && msg.imageUrls.length > 0 && 
                  msgIndex === messages.findLastIndex(m => m.imageUrls && m.imageUrls.length > 0);
                const hideImageUrls = isLatestPosterMessage && phase === 'ready';
                
                return (
                  <div key={msg.id}>
                    {msg.role === 'user' ? (
                      <UserBubble message={msg} />
                    ) : (
                      <SystemBubble 
                        images={msg.images}
                        imageUrls={hideImageUrls ? undefined : msg.imageUrls}
                        onImageClick={(url) => setPreviewImageUrl(url)}
                        onUseAsReference={(url) => handleUseAsReference(url, 0)}
                        onDownload={(url) => {
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `poster-${Date.now()}.png`;
                          link.click();
                        }}
                      >
                        {msg.content}
                      </SystemBubble>
                    )}
                  </div>
                );
              })}

              {/* Thinking messages */}
              {thinkingMessages.length > 0 && (
                <div className="space-y-2">
                  {thinkingMessages.map((msg, idx) => (
                    <SystemBubble key={idx}>
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600" />
                        <span>{msg}</span>
                      </div>
                    </SystemBubble>
                  ))}
                </div>
              )}

              {/* Insufficient Credits Alert */}
              {hasInsufficientCredits && (
                <InsufficientCreditsAlert
                  type="image"
                  onClose={() => setHasInsufficientCredits(false)}
                />
              )}

              {/* Brand Review Card */}
              {phase === 'brand-review' && brand && (
                <BrandCard
                  brand={brand}
                  editing={editing}
                  onEdit={() => setEditing(true)}
                  onChange={setBrand}
                  onDone={() => setEditing(false)}
                  onConfirm={handleBrandConfirm}
                />
              )}

              {/* Product Input */}
              {phase === 'product-input' && (
                <ProductInput
                  prompt={productPrompt}
                  images={productImages}
                  onPromptChange={setProductPrompt}
                  onImageSelect={handleProductImageSelect}
                  onRemoveImage={removeProductImage}
                  onSubmit={handleProductSubmit}
                  fileInputRef={fileInputRef}
                />
              )}

              {/* Poster Prompt Input */}
              {phase === 'poster-prompt' && (
                <PosterPromptInput
                  prompt={posterPrompt}
                  onPromptChange={setPosterPrompt}
                  onSubmit={handlePosterPromptSubmit}
                />
              )}

              {/* Configuration Input - hide when insufficient credits */}
              {phase === 'config' && !hasInsufficientCredits && (
                <ConfigInput
                  config={config}
                  onConfigChange={setConfig}
                  onSubmit={handleConfigSubmit}
                  referenceImages={savedProductData?.imageDataUrls || []}
                  onRemoveReferenceImage={(index) => {
                    if (savedProductData) {
                      const newImages = savedProductData.images.filter((_, i) => i !== index);
                      const newDataUrls = savedProductData.imageDataUrls?.filter((_, i) => i !== index) || [];
                      setSavedProductData({
                        ...savedProductData,
                        images: newImages,
                        imageDataUrls: newDataUrls,
                      });
                    }
                  }}
                />
              )}

              {/* Generated Posters */}
              {phase === 'ready' && generatedPosters.length > 0 && (
                <PosterGrid
                  posters={generatedPosters}
                  posterPrompt={posterPrompt}
                  onSavePoster={savePoster}
                  onCreateCampaign={createCampaignFromPoster}
                  onRegenerate={handleRegenerateClick}
                  onUseAsReference={handleUseAsReference}
                  savingPoster={savingPoster}
                  creatingCampaign={creatingCampaign}
                  showRegeneratePrompt={showRegeneratePrompt}
                  regeneratePrompt={regeneratePrompt}
                  onRegeneratePromptChange={setRegeneratePrompt}
                  onRegenerateSubmit={handleRegenerateSubmit}
                  onRegenerateCancel={() => {
                    setShowRegeneratePrompt(false);
                    setRegeneratePrompt('');
                  }}
                  canCreateCampaigns={canCreateCampaigns}
                />
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input Area */}
        {phase === 'input' && (
          <div className="border-t border-gray-200 bg-white flex-shrink-0">
            <div className="max-w-4xl mx-auto px-6 py-4">
              <ChatInput
                value={inputValue}
                images={inputImages}
                onChange={setInputValue}
                onImageSelect={handleImageSelect}
                onRemoveImage={removeImage}
                onSubmit={handleSubmit}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                isDragging={isDragging}
                fileInputRef={fileInputRef}
              />
            </div>
          </div>
        )}

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
          sessionType="poster"
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
                  Are you sure you want to delete this session? All data including generated posters will be permanently removed.
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

        {/* Image Preview Modal (for chat history images) */}
        {previewImageUrl && (
          <div
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
            onClick={() => setPreviewImageUrl(null)}
          >
            {/* Close button */}
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="fixed top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Image container */}
            <div 
              className="relative w-full h-full flex items-center justify-center p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewImageUrl}
                alt="Preview"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                style={{ imageRendering: 'auto' }}
              />
            </div>
            
            {/* Action buttons */}
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex gap-3 z-50">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Download the image
                  const link = document.createElement('a');
                  link.href = previewImageUrl;
                  link.download = `poster-${Date.now()}.png`;
                  link.click();
                }}
                className="px-5 py-2.5 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-100 shadow-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // For data URLs, create a blob and open it
                  if (previewImageUrl.startsWith('data:')) {
                    try {
                      const [header, base64Data] = previewImageUrl.split(',');
                      const mimeMatch = header.match(/data:([^;]+)/);
                      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
                      const binaryString = atob(base64Data);
                      const bytes = new Uint8Array(binaryString.length);
                      for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                      }
                      const blob = new Blob([bytes], { type: mimeType });
                      const blobUrl = URL.createObjectURL(blob);
                      window.open(blobUrl, '_blank');
                    } catch (err) {
                      console.error('Error opening image:', err);
                      window.open(previewImageUrl, '_blank');
                    }
                  } else {
                    window.open(previewImageUrl, '_blank');
                  }
                }}
                className="px-5 py-2.5 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-100 shadow-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in New Tab
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUseAsReference(previewImageUrl, 0);
                  setPreviewImageUrl(null);
                }}
                className="px-5 py-2.5 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-100 shadow-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Use as Reference
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============== Sub-components (simplified versions for this page) ==============

function ChatInput({
  value,
  images,
  onChange,
  onImageSelect,
  onRemoveImage,
  onSubmit,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragging,
  fileInputRef,
}: {
  value: string;
  images: File[];
  onChange: (value: string) => void;
  onImageSelect: (files: FileList | null) => void;
  onRemoveImage: (index: number) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <form onSubmit={onSubmit}>
      <div
        className={`border-2 rounded-xl p-4 transition-all duration-200 ${
          isDragging
            ? 'border-blue-400 bg-blue-50 shadow-md'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {images.map((img, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={URL.createObjectURL(img)}
                  alt={`Preview ${idx + 1}`}
                  className="w-16 h-16 object-cover rounded-lg border border-gray-200 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => onRemoveImage(idx)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600 shadow-sm"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              placeholder="Paste website URL, describe what you want, or drag images here..."
              rows={1}
              className="w-full resize-none border-0 focus:outline-none text-sm text-gray-900 placeholder-gray-400 bg-transparent"
              style={{ minHeight: '24px', maxHeight: '200px' }}
            />
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
              title="Upload images"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>

            <button
              type="submit"
              disabled={!value.trim() && images.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Send
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => onImageSelect(e.target.files)}
          className="hidden"
        />
      </div>
    </form>
  );
}

function ProductInput({
  prompt,
  images,
  onPromptChange,
  onImageSelect,
  onRemoveImage,
  onSubmit,
  fileInputRef,
}: {
  prompt: string;
  images: File[];
  onPromptChange: (value: string) => void;
  onImageSelect: (files: FileList | null) => void;
  onRemoveImage: (index: number) => void;
  onSubmit: (e?: React.FormEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="flex gap-4 max-w-3xl ml-auto">
      <div className="flex-shrink-0 w-8" />
      <form onSubmit={onSubmit} className="flex-1">
        <div
          className={`border-2 rounded-xl p-4 transition-all duration-200 flex flex-col gap-3 ${
            isDragging ? 'border-blue-400 bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); onImageSelect(e.dataTransfer.files); }}
        >
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-1">
              {images.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={URL.createObjectURL(img)}
                    alt={`Preview ${idx + 1}`}
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveImage(idx)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 items-end">
            <textarea
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
              placeholder="Describe what you want to promote or upload product images..."
              rows={1}
              className="flex-1 resize-none border-0 focus:outline-none text-sm text-gray-900 placeholder-gray-400 bg-transparent"
            />

            <div className="flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>

              <button
                type="submit"
                disabled={!prompt.trim() && images.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Continue
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => onImageSelect(e.target.files)}
            className="hidden"
          />
        </div>
      </form>
      <div className="flex-shrink-0 w-8" />
    </div>
  );
}

function PosterPromptInput({
  prompt,
  onPromptChange,
  onSubmit,
}: {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex gap-4 max-w-3xl ml-auto">
      <div className="flex-shrink-0 w-8" />
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex-1">
        <div className="border-2 border-gray-200 rounded-xl p-6 bg-white hover:border-gray-300 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Describe the poster you want
          </label>
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="e.g., A vibrant poster highlighting the product with bold text and modern design..."
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { onSubmit(); } }}
          />
          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={!prompt.trim()}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Continue →
            </button>
          </div>
        </div>
      </form>
      <div className="flex-shrink-0 w-8" />
    </div>
  );
}

function ConfigInput({
  config,
  onConfigChange,
  onSubmit,
  referenceImages = [],
  onRemoveReferenceImage,
}: {
  config: PosterConfig;
  onConfigChange: (config: PosterConfig) => void;
  onSubmit: () => void;
  referenceImages?: string[];
  onRemoveReferenceImage?: (index: number) => void;
}) {
  const themes = POSTER_THEMES;
  const aspectRatios = ASPECT_RATIOS;

  return (
    <div className="flex gap-4 max-w-3xl ml-auto">
      <div className="flex-shrink-0 w-8" />
      <div className="flex-1">
        <div className="border-2 border-gray-200 rounded-xl p-6 bg-white space-y-6 hover:border-gray-300 shadow-sm">
          {/* Reference Images Display */}
          {referenceImages.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Reference Images ({referenceImages.length})
              </label>
              <div className="flex flex-wrap gap-3">
                {referenceImages.map((imageUrl, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={imageUrl}
                      alt={`Reference ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border border-gray-200 shadow-sm"
                    />
                    {onRemoveReferenceImage && (
                      <button
                        type="button"
                        onClick={() => onRemoveReferenceImage(idx)}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600 shadow-sm"
                        title="Remove reference"
                      >
                        ×
                      </button>
                    )}
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                      {idx + 1}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                These images will be used as style references for your new posters
              </p>
            </div>
          )}

          {/* Theme Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Theme Selection
            </label>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onConfigChange({ ...config, theme: theme.id })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    config.theme === theme.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Aspect Ratio
            </label>
            <div className="flex gap-2">
              {aspectRatios.map((ar) => (
                <button
                  key={ar.id}
                  type="button"
                  onClick={() => onConfigChange({ ...config, aspectRatio: ar.id as PosterConfig['aspectRatio'] })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    config.aspectRatio === ar.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {ar.label}
                </button>
              ))}
            </div>
          </div>

          {/* Variant Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Number of Variants
            </label>
            <div className="flex gap-2">
              {[1, 2, 3].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => onConfigChange({ ...config, variantCount: count as PosterConfig['variantCount'] })}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    config.variantCount === count
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {count} {count === 1 ? 'Variant' : 'Variants'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Generate {config.variantCount} different {config.variantCount === 1 ? 'version' : 'versions'} of your poster ({config.variantCount} {config.variantCount === 1 ? 'credit' : 'credits'} will be deducted)
            </p>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!config.theme}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Generate {config.variantCount} {config.variantCount === 1 ? 'Variant' : 'Variants'}
            </button>
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 w-8" />
    </div>
  );
}

function PosterGrid({
  posters,
  posterPrompt,
  onSavePoster,
  onCreateCampaign,
  onRegenerate,
  onUseAsReference,
  savingPoster,
  creatingCampaign,
  showRegeneratePrompt,
  regeneratePrompt,
  onRegeneratePromptChange,
  onRegenerateSubmit,
  onRegenerateCancel,
  canCreateCampaigns,
}: {
  posters: string[];
  posterPrompt: string;
  onSavePoster: (url: string, index: number) => Promise<void>;
  onCreateCampaign: (url: string, index: number) => Promise<void>;
  onRegenerate: () => void;
  onUseAsReference: (url: string, index: number) => void;
  savingPoster: number | null;
  creatingCampaign: number | null;
  showRegeneratePrompt: boolean;
  regeneratePrompt: string;
  onRegeneratePromptChange: (value: string) => void;
  onRegenerateSubmit: () => void;
  onRegenerateCancel: () => void;
  canCreateCampaigns: boolean;
}) {
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuIndex(null);
      }
    }

    if (openMenuIndex !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openMenuIndex]);

  // Handle download
  const handleDownload = (poster: string, idx: number) => {
    try {
      // Save to local storage for history
      const storageKey = 'creative_studio_downloaded_posters';
      const existingPosters = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      const posterEntry = {
        id: `poster_${Date.now()}_${idx}`,
        url: poster,
        downloadedAt: Date.now(),
        index: idx,
        prompt: posterPrompt || '',
      };
      
      existingPosters.push(posterEntry);
      const trimmedPosters = existingPosters.slice(-50);
      localStorage.setItem(storageKey, JSON.stringify(trimmedPosters));
      
      // Trigger browser download
      const link = document.createElement('a');
      link.href = poster;
      link.download = `poster-${idx + 1}.png`;
      link.click();
      
      setOpenMenuIndex(null);
    } catch (error) {
      console.error('Error saving poster to local storage:', error);
      // Still trigger download even if storage fails
      const link = document.createElement('a');
      link.href = poster;
      link.download = `poster-${idx + 1}.png`;
      link.click();
      setOpenMenuIndex(null);
    }
  };

  return (
    <>
      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          onClick={() => setPreviewImage(null)}
        >
          {/* Close button - fixed position in viewport */}
          <button
            onClick={() => setPreviewImage(null)}
            className="fixed top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Image container with proper aspect ratio */}
          <div 
            className="relative w-full h-full flex items-center justify-center p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              style={{ imageRendering: 'auto' }}
            />
          </div>
          
          {/* Action buttons - fixed position at bottom */}
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex gap-3 z-50">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const idx = posters.findIndex(p => p === previewImage);
                if (idx >= 0) handleDownload(previewImage, idx);
              }}
              className="px-5 py-2.5 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-100 shadow-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                // For data URLs, create a blob and open it
                if (previewImage.startsWith('data:')) {
                  try {
                    const [header, base64Data] = previewImage.split(',');
                    const mimeMatch = header.match(/data:([^;]+)/);
                    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                      bytes[i] = binaryString.charCodeAt(i);
                    }
                    const blob = new Blob([bytes], { type: mimeType });
                    const blobUrl = URL.createObjectURL(blob);
                    window.open(blobUrl, '_blank');
                  } catch (err) {
                    console.error('Error opening image:', err);
                    // Fallback: try direct open
                    window.open(previewImage, '_blank');
                  }
                } else {
                  window.open(previewImage, '_blank');
                }
              }}
              className="px-5 py-2.5 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-100 shadow-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open in New Tab
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-4 max-w-4xl ml-auto">
        <div className="flex-shrink-0 w-8" />
        <div className="flex-1 space-y-8">
          {/* Regeneration Prompt Input */}
          {showRegeneratePrompt && (
            <div className="border border-gray-200 rounded-lg p-4 bg-white">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Edit your prompt or add changes
              </label>
              <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Current prompt:</p>
                <p className="text-sm text-gray-700">{posterPrompt || 'No prompt set'}</p>
              </div>
              <textarea
                value={regeneratePrompt}
                onChange={(e) => onRegeneratePromptChange(e.target.value)}
                placeholder="e.g., Make it more colorful, Add more text, Change the background to dark..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
                rows={3}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={onRegenerateSubmit}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  Generate
                </button>
                <button
                  onClick={onRegenerateCancel}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Gallery-style poster grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {posters.map((poster, idx) => (
              <div
                key={idx}
                className="group"
              >
                {/* Poster - Clickable for preview */}
                <div 
                  className="mb-4 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 cursor-pointer relative"
                  onClick={() => setPreviewImage(poster)}
                >
                  <img
                    src={poster}
                    alt={`Generated poster ${idx + 1}`}
                    className="w-full h-auto block transition-transform duration-200 group-hover:scale-[1.02]"
                    style={{ imageRendering: 'auto' }}
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white bg-black/50 px-3 py-1.5 rounded-lg text-sm font-medium">
                      Click to preview
                    </span>
                  </div>
                </div>

                {/* Subtle Divider */}
                <div className="h-px bg-gray-100 mb-4" />

                {/* Action Area */}
                <div className="flex items-center gap-2">
                  {/* Primary CTA - Use in Campaign (only show if feature enabled) */}
                  {canCreateCampaigns && (
                    <button
                      onClick={() => onCreateCampaign(poster, idx)}
                      disabled={creatingCampaign === idx}
                      className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingCampaign === idx ? 'Creating...' : 'Use in Campaign'}
                    </button>
                  )}

                  {/* More Actions Menu - Click based, not hover */}
                  <div 
                    className="relative"
                    ref={openMenuIndex === idx ? menuRef : null}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuIndex(openMenuIndex === idx ? null : idx);
                      }}
                      className={`p-2.5 border rounded-lg transition-colors ${
                        openMenuIndex === idx 
                          ? 'border-gray-400 bg-gray-100 text-gray-900' 
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                      aria-label="More actions"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                        />
                      </svg>
                    </button>

                    {/* Dropdown Menu - with seamless connection to button */}
                    {openMenuIndex === idx && (
                      <div 
                        className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="py-1">
                          <button
                            onClick={() => handleDownload(poster, idx)}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </button>
                          <button
                            onClick={() => {
                              // For data URLs, create a blob and open it
                              if (poster.startsWith('data:')) {
                                try {
                                  const [header, base64Data] = poster.split(',');
                                  const mimeMatch = header.match(/data:([^;]+)/);
                                  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
                                  const binaryString = atob(base64Data);
                                  const bytes = new Uint8Array(binaryString.length);
                                  for (let i = 0; i < binaryString.length; i++) {
                                    bytes[i] = binaryString.charCodeAt(i);
                                  }
                                  const blob = new Blob([bytes], { type: mimeType });
                                  const blobUrl = URL.createObjectURL(blob);
                                  window.open(blobUrl, '_blank');
                                } catch (err) {
                                  console.error('Error opening image:', err);
                                  window.open(poster, '_blank');
                                }
                              } else {
                                window.open(poster, '_blank');
                              }
                              setOpenMenuIndex(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            View Full Size
                          </button>
                          <button
                            onClick={() => {
                              onSavePoster(poster, idx);
                              setOpenMenuIndex(null);
                            }}
                            disabled={savingPoster === idx}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            {savingPoster === idx ? 'Saving...' : 'Save to Library'}
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                          <button
                            onClick={() => {
                              onUseAsReference(poster, idx);
                              setOpenMenuIndex(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Use as Reference
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Regenerate Button - Improved UX */}
          {!showRegeneratePrompt && (
            <div className="pt-4 border-t border-gray-100 flex justify-center">
              <button
                onClick={onRegenerate}
                className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Generate New Variants
              </button>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 w-8" />
      </div>
    </>
  );
}
