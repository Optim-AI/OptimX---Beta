// pages/creative-studio/poster/[sessionId].tsx
// Poster Generation Session Page

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { showAlert, showError, showSuccess } from '@/app/web/src/components/ui/AlertModal';
import { supabase } from '@/auth/supabase/client';
import Sidebar from '@/app/web/src/components/Sidebar';
import colors from '@/lib/ui/colors';
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
import { authFetch, safeResponseJson } from '@/lib/utils';

/** Download image to user's device - works for data URLs and remote URLs (blob-based for reliable download) */
async function downloadImageToLocal(url: string, filename: string): Promise<void> {
  let blob: Blob;
  if (url.startsWith('data:')) {
    const [header, base64Data] = url.split(',');
    const mimeMatch = header.match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    blob = new Blob([bytes], { type: mimeType });
  } else {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('Failed to fetch image');
    blob = await response.blob();
  }
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(blobUrl);
}

/** Pick a random message from options for conversational variety */
function pickMessage<T>(options: T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

/** Safely trim - handles non-string values (e.g. from session, API) to prevent "trim is not a function" */
function safeTrim(value: unknown): string {
  return (typeof value === 'string' ? value : '').trim();
}

// ============== Page Component ==============

export default function PosterSessionPage() {
  const router = useRouter();
  const { id: sessionId } = router.query; // Get id from query params (e.g., ?id=xxx)
  
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
  const [pendingUseAsReference, setPendingUseAsReference] = useState<{ url: string; index: number } | null>(null);
  const [regeneratePrompt, setRegeneratePrompt] = useState('');
  
  // New session modal state
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  
  // Delete confirmation modal state
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // Image preview state (for chat history images)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Initial greeting - picked once per session for conversational variety
  const [initialGreeting] = useState(() =>
    pickMessage([
      "Hi! Paste your website link, upload a product image, or describe what you want to create.",
      "Hey! What would you like to create? Share a link, upload images, or describe your idea.",
      "Ready to create? Add a website URL, product images, or tell me about your poster.",
    ])
  );

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
        const response = await authFetch(`/api/creative-studio/sessions?id=${sessionId}`);
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
            imageStoragePaths: m.imageStoragePaths, // Restore storage paths
            expiredImageCount: m.expiredImageCount, // Restore expired image count
            imageThumbnail: m.imageThumbnail, // Restore thumbnail display flag
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

  const loadCredits = useCallback(async () => {
    try {
      const response = await authFetch('/api/credits/balance');
      const data = await response.json();
      if (data.success) {
        setCredits(data.credits);
        if ((data.imageCredits?.total ?? data.credits ?? 0) <= 0) {
          setHasInsufficientCredits(true);
        }
      }
    } catch (err) {
      console.error('Error loading credits:', err);
    }
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    loadCredits();
  }, [isAuthReady, loadCredits]);

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
        imageStoragePaths: m.imageStoragePaths, // Preserve storage paths for cleanup
        expiredImageCount: m.expiredImageCount, // Preserve expired image count
        imageThumbnail: m.imageThumbnail, // Preserve thumbnail display flag
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

  /** Upload data URLs to Supabase storage via save-poster API, return public URLs */
  async function uploadDataUrlsToStorage(dataUrls: string[]): Promise<string[]> {
    const publicUrls: string[] = [];
    for (const dataUrl of dataUrls) {
      try {
        const resp = await authFetch('/api/creative-studio/save-poster', {
          method: 'POST',
          body: JSON.stringify({
            imageUrl: dataUrl,
            name: 'product',
          }),
        });
        const data = await resp.json();
        if (data.ok && data.imageUrl) {
          publicUrls.push(data.imageUrl);
        } else {
          publicUrls.push(dataUrl); // fallback
        }
      } catch {
        publicUrls.push(dataUrl); // fallback
      }
    }
    return publicUrls;
  }

  function addMessage(role: 'user' | 'system', content: string, images?: File[], imageUrls?: string[], imageStoragePaths?: string[], imageThumbnail?: boolean) {
    const newMessage: Message = {
      id: generateId(),
      role,
      content,
      images,
      imageUrls,
      imageStoragePaths,
      imageThumbnail,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }

  // ============== Input Handlers ==============
  
  const GEMINI_UNSUPPORTED_IMAGE_TYPES = ['image/svg+xml', 'image/vnd.microsoft.icon', 'image/x-icon', 'image/ico'];

  function handleImageSelect(files: FileList | null) {
    if (files) {
      const newImages = Array.from(files).filter(f => {
        if (!f.type.startsWith('image/')) return false;
        if (GEMINI_UNSUPPORTED_IMAGE_TYPES.some(t => f.type.toLowerCase().includes(t))) {
          showError('SVG and ICO images are not supported for poster generation. Please use JPEG, PNG, GIF, or WebP.');
          return false;
        }
        return true;
      });
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
    if (phase === 'input') {
      handleImageSelect(e.dataTransfer.files);
    } else {
      handleProductImageSelect(e.dataTransfer.files);
    }
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
      const result = data.result;
      return {
        name: result.facts?.company_name || 'Unknown Brand',
        description: result.positioning?.primary_value_proposition || '',
        audience: Array.isArray(result.facts?.who_it_is_for)
          ? result.facts.who_it_is_for.join(', ')
          : (result.facts?.who_it_is_for as string) || '',
        offering: Array.isArray(result.facts?.what_they_sell)
          ? result.facts.what_they_sell.join(', ')
          : (result.facts?.what_they_sell as string) || '',
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
          ? { primary: result.colors.primary ?? undefined, secondary: result.colors.secondary ?? undefined, accent: result.colors.accent ?? undefined }
          : undefined,
      };
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
        };
        
        setBrand(brandSnapshot);
        saveBrandSnapshot(brandSnapshot);
        setShowBrandOnboarding(false);
        setPhase('brand-review');
        addMessage('system', pickMessage([
          "I've pulled your brand info from the site — take a look and tweak anything you'd like.",
          "Got it! I've analyzed your website. Review the details below and adjust as needed.",
          "Here's what I found from your site. Let me know if anything needs updating.",
        ]));
      } else {
        console.error('Brand analysis failed:', data.error || 'Unknown error');
        addMessage('system', pickMessage([
          `That URL didn't work — ${data.error || 'Unknown error'}. Try a different link or set up your brand manually.`,
          `I couldn't analyze that site: ${data.error || 'Unknown error'}. Want to try another URL or enter details manually?`,
        ]));
        // Keep modal open on error
      }
    } catch (err: any) {
      console.error('Brand analysis error:', err);
      addMessage('system', pickMessage([
        `Something went wrong: ${err.message || 'Unknown error'}. Try again or set up your brand manually.`,
        `Couldn't analyze that — ${err.message || 'Unknown error'}. Want to try a different URL or add your brand manually?`,
      ]));
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
    addMessage('system', pickMessage([
      "Your brand profile is ready — take a look and adjust anything you'd like.",
      "All set! Review the details below and let me know if you want to change anything.",
      "Here's your brand profile. Tweak it as needed, then we'll get creating.",
    ]));
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
    addMessage('system', pickMessage([
      "No worries — you can add brand details later. What do you want to promote?",
      "All good! We can set up brand guidelines anytime. What are you creating today?",
      "Sure thing! Tell me about what you want to create.",
    ]));
  }

  function handleBrandConfirm() {
    if (brand) {
      saveBrandSnapshot(brand);
    }
    setPhase('product-input');
    addMessage('system', pickMessage([
      "Brand's set! What are we promoting? Describe it or drop in some product images.",
      "Nice — we're ready. Tell me about your product or upload a few images.",
      "All set! What's the product or service? You can describe it or add images.",
    ]));
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
        setPhase('brand-review');
        addMessage('system', `I've re-analyzed your website and updated your brand information.`);
        return brandSnapshot;
      } else {
        addMessage('system', `I had trouble analyzing that website: ${data.error || 'Unknown error'}. Please try a different URL or edit manually.`);
        return null;
      }
    } catch (err: any) {
      console.error('Brand re-analyze error:', err);
      addMessage('system', `There was an error analyzing your website: ${err?.message || 'Unknown error'}. Please try again or edit manually.`);
      return null;
    } finally {
      setIsAnalyzingBrand(false);
    }
  }

  // ============== Product Handlers ==============
  
  function handleProductImageSelect(files: FileList | null) {
    if (files) {
      const newImages = Array.from(files).filter(f => {
        if (!f.type.startsWith('image/')) return false;
        if (GEMINI_UNSUPPORTED_IMAGE_TYPES.some(t => f.type.toLowerCase().includes(t))) {
          showError('SVG and ICO images are not supported for poster generation. Please use JPEG, PNG, GIF, or WebP.');
          return false;
        }
        return true;
      });
      setProductImages(prev => [...prev, ...newImages]);
    }
  }

  function removeProductImage(index: number) {
    setProductImages(prev => prev.filter((_, i) => i !== index));
  }

  async function handleProductSubmit(e?: React.FormEvent) {
    e?.preventDefault();

    if (!safeTrim(productPrompt) && productImages.length === 0) return;

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

    // Upload to storage so we store URLs, not data URLs in the DB
    const storageUrls = productImageDataUrls.length > 0
      ? await uploadDataUrlsToStorage(productImageDataUrls)
      : [];

    addMessage('user', productPrompt || 'Product images uploaded', productImages.length > 0 ? [...productImages] : undefined, storageUrls.length > 0 ? storageUrls : undefined);

    // If user wrote a direct prompt only (no images) → skip poster-prompt, go to theme/aspect selection
    const trimmedProductPrompt = safeTrim(productPrompt);
    if (productImages.length === 0 && trimmedProductPrompt) {
      setPosterPrompt(trimmedProductPrompt);
      const echo = trimmedProductPrompt.length > 60 ? trimmedProductPrompt.slice(0, 60) + '...' : trimmedProductPrompt;
      addMessage('system', pickMessage([
        `${echo} — nice! Pick a vibe and format below.`,
        `Got it! "${echo}" — what theme and aspect ratio work for you?`,
        `Love it. Pick a theme and format for your poster.`,
      ]));
      setPhase('config');
    } else {
      // User attached images → show poster-prompt to describe what they want
      addMessage('system', pickMessage([
        "Love these images! What style are you going for — bold, minimal, playful?",
        "Got it! Describe the poster you want — mood, vibe, any text?",
        "Nice. What kind of poster? Tell me the style and feel you're after.",
      ]));
      setPhase('poster-prompt');
    }
  }

  // ============== Poster Generation Handlers ==============
  
  function handlePosterPromptSubmit() {
    const trimmedPosterPrompt = safeTrim(posterPrompt);
    if (!trimmedPosterPrompt) return;
    
    addMessage('user', posterPrompt);
    const echo = trimmedPosterPrompt.length > 50 ? trimmedPosterPrompt.slice(0, 50) + '...' : trimmedPosterPrompt;
    addMessage('system', pickMessage([
      `${echo} — perfect! Pick a theme and format below.`,
      "Great prompt! What vibe and aspect ratio?",
      "Love it. Choose a theme and format — we're almost there.",
    ]));
    
    setPhase('config');
  }

  async function handleConfigSubmit(promptOverride?: string) {
    if (hasInsufficientCredits) {
      addMessage('system', pickMessage([
        "You're out of credits — grab more to keep creating.",
        "No credits left. Purchase more to generate posters.",
      ]));
      return;
    }

    if (!config.theme) {
      showAlert('Please select a theme before generating.', 'Theme Required');
      return;
    }
    
    setPhase('generating');
    setIsGenerating(true);
    setThinkingMessages(['Generating your poster variants...']);
    
    try {
      const hasProductImage = savedProductData?.images && savedProductData.images.length > 0;
      
      // Build base user request - use promptOverride when provided (e.g. from edited form), else posterPrompt or product data
      let userRequest = safeTrim(promptOverride) || safeTrim(posterPrompt) || safeTrim(savedProductData?.prompt) || '';
      if (!userRequest) {
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
      
      // Prepare logo data URL from brand guideline (check both logo and logoUrl)
      const logoSource = brand?.logo ?? brand?.logoUrl;
      let logoDataUrl: string | undefined;
      if (logoSource) {
        if (logoSource.startsWith('data:')) {
          logoDataUrl = logoSource;
        } else if (logoSource.startsWith('http')) {
          // Fetch logo via proxy (works for direct image URLs)
          try {
            const logoResponse = await fetch('/api/creative-studio/fetch-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: logoSource, directFetch: true }),
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
        // Pass logo placement for proper positioning (default: bottom-right when logo exists)
        ...(logoDataUrl && { logoPlacement: (brand as any)?.logoPlacement ?? 'bottom-right' }),
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
      const storagePaths: string[] = [];
      let creditError = false;
      let lastError = '';
      let latestCredits: number | undefined;
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { variantNum, response, data } = result.value;
          
          if (data.ok && data.image) {
            posters.push(data.image);
            storagePaths.push(data.imageStoragePath || '');
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
          pickMessage(
            posters.length === 1
              ? ["Here's your poster! Click to preview, save, or use in a campaign.", "Done! Preview, save, or add to a campaign.", "Your poster is ready. Click to preview or save."]
              : [`Here are your ${posters.length} variants! Click any to preview, save, or use in a campaign.`, `Done! ${posters.length} options for you. Preview, save, or add to a campaign.`, `Your posters are ready. Pick your favorite and go from there.`]
          ),
          undefined,
          posters,
          storagePaths.length > 0 ? storagePaths : undefined
        );
      } else if (creditError) {
        throw new Error('You have no credits remaining. Please purchase more credits to generate posters.');
      } else {
        throw new Error(lastError || 'No posters were generated. Please check if your API key is valid and try again.');
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      const errorMessage = err?.message || 'Sorry, there was an error generating your posters. Please try again.';
      addMessage('system', pickMessage([
        errorMessage,
        `Something went wrong. ${errorMessage}`,
      ]));
      // Don't go back to config if it's a credit error - user can't generate anyway
      if (!hasInsufficientCredits) {
        setPhase('config');
      }
    } finally {
      setIsGenerating(false);
      setThinkingMessages([]);
      // Full credits refresh to ensure accuracy
      await loadCredits();
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
            originalChatUrl: url,
          },
        }),
      });
      
      const data = await response.json();
      
      if (data.ok) {
        showSuccess('Poster saved to your library!');
      } else {
        showError('Failed to save poster: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Save poster error:', err);
      showError('Failed to save poster');
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
        showError('Failed to create campaign: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Create campaign error:', err);
      showError('Failed to create campaign');
    } finally {
      setCreatingCampaign(null);
    }
  }

  function handleRegenerateClick() {
    setShowRegeneratePrompt(true);
    setRegeneratePrompt(posterPrompt);
  }

  function handleUseAsReferenceRequest(url: string, index: number) {
    setPendingUseAsReference({ url, index });
    setRegeneratePrompt(posterPrompt);
  }

  function handleRegenerateSubmit() {
    const editedPrompt = safeTrim(regeneratePrompt);
    if (editedPrompt) {
      setPosterPrompt(editedPrompt);
    }
    setShowRegeneratePrompt(false);
    setRegeneratePrompt('');
    // Pass edited prompt directly - React setState is async, so handleConfigSubmit would read stale posterPrompt otherwise
    handleConfigSubmit(editedPrompt || undefined);
  }

  function handleUseAsReferenceConfirm(url: string, index: number) {
    const promptToUse = safeTrim(regeneratePrompt) || safeTrim(posterPrompt);
    if (safeTrim(regeneratePrompt)) {
      setPosterPrompt(safeTrim(regeneratePrompt));
    }
    setPendingUseAsReference(null);
    setRegeneratePrompt('');
    handleUseAsReference(url, index, promptToUse);
  }

  async function handleUseAsReference(url: string, index: number, promptOverride?: string) {
    // Block if no credits
    if (hasInsufficientCredits) {
      addMessage('system', pickMessage([
        "You're out of credits — grab more to keep creating.",
        "No credits left. Purchase more to generate posters.",
      ]));
      return;
    }

    // Prevent double-clicks or multiple rapid calls
    if (isAddingReferenceRef.current) {
      console.log('Already adding reference, skipping...');
      return;
    }
    isAddingReferenceRef.current = true;
    
    try {
      addMessage('system', pickMessage([
        "Using this as your reference — tweak the theme, format, or add a prompt for variations.",
        "Got it! I'll use this poster as reference. Adjust the settings below and hit Generate.",
        "Nice pick! Tweak the theme or format, add a prompt if you'd like, then generate.",
      ]));

      // Fetch the image and convert to File
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], `reference-poster-${Date.now()}-${index}.png`, { type: 'image/png' });

      // Convert file to data URL
      const dataUrl = await fileToDataUrl(file);
      
      // Set ONLY this poster as the reference (replace, don't accumulate)
      // User can add more references by clicking "Use as Reference" on additional posters
      // Use promptOverride when user edited the prompt in the form - otherwise fall back to posterPrompt/product data
      const promptToUse = promptOverride ?? posterPrompt ?? savedProductData?.prompt ?? '';
      setSavedProductData({
        prompt: promptToUse || savedProductData?.prompt || '',
        images: [file],
        imageDataUrls: [dataUrl],
      });

      // Go to config phase so user can edit theme, format, and add prompt
      setPhase('config');
      
      addMessage('system', pickMessage([
        "Reference set! Change the theme or format, add a prompt if you want, then hit Generate.",
        "All set. Tweak the vibe, pick a format, and describe any changes — then we'll create variations.",
        "Using this as reference. Adjust settings below and click Generate when you're ready.",
      ]));
    } catch (error: any) {
      console.error('Error using poster as reference:', error);
      addMessage('system', pickMessage([
        `Couldn't use that as reference — ${error.message || 'Unknown error'}. Try again?`,
        `Something went wrong: ${error.message || 'Unknown error'}. Want to try another poster?`,
      ]));
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
    
    const hasInput = safeTrim(inputValue) || inputImages.length > 0;
    if (!hasInput) return;
    
    // Capture input values before clearing
    const currentInput = safeTrim(inputValue);
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
              addMessage('system', pickMessage([
                `That link didn't work — ${result.error || 'Unknown error'}. Try uploading the image directly.`,
                `Couldn't fetch the image: ${result.error || 'Unknown error'}. Upload it instead?`,
              ]));
              return;
            }
            
            // Convert data URL to File object
            const dataUrl = result.dataUrl;
            const publicUrl = result.publicUrl;
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

            // Use public storage URL if available, fall back to data URL
            const displayUrl = publicUrl || dataUrl;

            setProductPrompt(currentInput);
            setProductImages([file]);
            setSavedProductData({
              prompt: currentInput,
              images: [file],
              imageDataUrls: [dataUrl],
            });

            // Show the fetched image (use Supabase storage URL so DB stays small)
            addMessage('system', pickMessage([
              "Got the image! What style are you going for?",
              "Image fetched. Describe the poster — mood, vibe, any text?",
              "Nice. What kind of poster do you want? Tell me the style and feel.",
            ]), undefined, [displayUrl], undefined, true);
            setPhase('poster-prompt');
          } catch (err: any) {
            setThinkingMessages([]);
            console.error('Error fetching image:', err);
            addMessage('system', pickMessage([
              `Couldn't fetch that — ${err.message || 'Unknown error'}. Try uploading the image directly.`,
              `Something went wrong: ${err.message || 'Unknown error'}. Upload the image instead?`,
            ]));
          }
        }, 0);
      } else {
        // Regular text input and/or uploaded images (no URL to fetch)
        setProductPrompt(currentInput);
        setProductImages(currentImages);

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

          // Upload to storage so we store URLs, not data URLs in the DB
          const storageUrls = currentImages.length > 0
            ? await uploadDataUrlsToStorage(productImageDataUrls)
            : [];

          // Add user message with File objects for live display and storage URLs for persistence
          addMessage('user', currentInput || 'Product images uploaded', currentImages.length > 0 ? currentImages : undefined, storageUrls.length > 0 ? storageUrls : undefined);

          // If user wrote a direct prompt (no link, no images) → skip poster-prompt, go to theme/aspect selection
          if (currentImages.length === 0 && currentInput) {
            setPosterPrompt(currentInput);
            const echo = currentInput.length > 60 ? currentInput.slice(0, 60) + '...' : currentInput;
            addMessage('system', pickMessage([
              `${echo} — nice! Pick a vibe and format below.`,
              `Got it! "${echo}" — what theme and aspect ratio work for you?`,
              `Love it. Pick a theme and format for your poster.`,
            ]));
            setPhase('config');
          } else {
            // User attached images → show poster-prompt to describe what they want
            addMessage('system', pickMessage([
              "Love these images! What style are you going for — bold, minimal, playful?",
              "Got it! Describe the poster you want — mood, vibe, any text?",
              "Nice. What kind of poster? Tell me the style and feel you're after.",
            ]));
            setPhase('poster-prompt');
          }
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
      
      router.push(`/creative-studio/poster?id=${selectedSessionId}`);
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
    const isDuplicate = posterSessions.some(
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
        router.push(`/creative-studio/poster?id=${data.session.id}`);
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
        setPosterSessions(prev => prev.filter(s => s.id !== deleteSessionId));
        
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
    <div className="h-screen flex overflow-hidden app-page">
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
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ backgroundColor: colors.card, borderLeft: `1px solid ${colors.border}` }}>
        {/* Header */}
        <div className="border-b flex-shrink-0" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <BackButton />
                <div>
                  <h1 className="text-xl font-semibold" style={{ color: colors.foreground }}>
                    {session?.name || 'New Poster Session'}
                  </h1>
                  <p className="text-sm" style={{ color: colors.mutedForeground }}>
                    {isSaving ? 'Saving...' : 'Create poster-ready creatives by talking to AI'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {credits !== null && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ backgroundColor: 'hsl(213 30% 18%)', border: `1px solid ${colors.primary}`, boxShadow: `0 0 12px ${colors.primary}20` }}>
                    <svg className="w-5 h-5" style={{ color: colors.primary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-semibold text-sm" style={{ color: colors.primary }}>{credits}</span>
                    <span className="text-sm" style={{ color: 'hsl(213 100% 70%)' }}>images</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-4xl mx-auto px-6 py-8 overflow-hidden">
            <div className="space-y-6">
              {/* Initial AI message - conversational prompt */}
              {messages.length === 0 && (phase === 'input' || phase === 'product-input') && (
                <SystemBubble>
                  {initialGreeting}
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
                        expiredImageCount={msg.expiredImageCount}
                        imageThumbnail={msg.imageThumbnail}
                        onImageClick={(url) => setPreviewImageUrl(url)}
                        onUseAsReference={hasInsufficientCredits ? undefined : (url) => handleUseAsReference(url, 0)}
                        onDownload={(url) => downloadImageToLocal(url, `poster-${Date.now()}.png`)}
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
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent" style={{ borderColor: colors.border, borderTopColor: colors.primary }} />
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
                  config={config}
                  onConfigChange={setConfig}
                  onSavePoster={savePoster}
                  onCreateCampaign={createCampaignFromPoster}
                  onRegenerate={hasInsufficientCredits ? undefined : handleRegenerateClick}
                  onUseAsReference={hasInsufficientCredits ? undefined : handleUseAsReference}
                  onUseAsReferenceRequest={hasInsufficientCredits ? undefined : handleUseAsReferenceRequest}
                  onUseAsReferenceConfirm={handleUseAsReferenceConfirm}
                  pendingUseAsReference={pendingUseAsReference}
                  savingPoster={savingPoster}
                  creatingCampaign={creatingCampaign}
                  showRegeneratePrompt={showRegeneratePrompt}
                  regeneratePrompt={regeneratePrompt}
                  onRegeneratePromptChange={setRegeneratePrompt}
                  onRegenerateSubmit={handleRegenerateSubmit}
                  onRegenerateCancel={() => {
                    setShowRegeneratePrompt(false);
                    setPendingUseAsReference(null);
                    setRegeneratePrompt('');
                  }}
                  canCreateCampaigns={canCreateCampaigns}
                />
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input Area - persistent conversational input for input and product-input phases */}
        {(phase === 'input' || phase === 'product-input') && (
          <div className="border-t flex-shrink-0 w-full" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
            <div className="max-w-4xl w-full mx-auto px-6 py-4">
              <ChatInput
                value={phase === 'input' ? inputValue : productPrompt}
                images={phase === 'input' ? inputImages : productImages}
                onChange={phase === 'input' ? setInputValue : setProductPrompt}
                onImageSelect={phase === 'input' ? handleImageSelect : handleProductImageSelect}
                onRemoveImage={phase === 'input' ? removeImage : removeProductImage}
                onSubmit={phase === 'input' ? handleSubmit : (e) => { e?.preventDefault(); handleProductSubmit(e); }}
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
            onWebsiteAnalyze={handleWebsiteReanalyze}
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
                  Are you sure you want to delete this session? All data including generated posters will be permanently removed.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteSessionId(null)}
                    disabled={isDeletingSession}
                    className="flex-1 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                    style={{ color: colors.foreground, backgroundColor: colors.muted }}
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
                  downloadImageToLocal(previewImageUrl, `poster-${Date.now()}.png`);
                }}
                className="px-5 py-2.5 rounded-lg text-sm font-medium shadow-lg transition-colors flex items-center gap-2"
                style={{ backgroundColor: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}
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
                className="px-5 py-2.5 rounded-lg text-sm font-medium shadow-lg transition-colors flex items-center gap-2"
                style={{ backgroundColor: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in New Tab
              </button>
              {!hasInsufficientCredits && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUseAsReferenceRequest(previewImageUrl, 0);
                  setPreviewImageUrl(null);
                }}
                className="px-5 py-2.5 rounded-lg text-sm font-medium shadow-lg transition-colors flex items-center gap-2"
                style={{ backgroundColor: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Use as Reference
              </button>
              )}
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  return (
    <form onSubmit={onSubmit}>
      <div
        className="border-2 rounded-xl p-4 transition-all duration-200"
        style={isDragging ? { borderColor: colors.primary, backgroundColor: 'hsl(213 100% 55% / 0.1)' } : { borderColor: colors.border, backgroundColor: colors.card }}
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
                  className="w-16 h-16 object-cover rounded-lg shadow-sm"
                  style={{ border: `1px solid ${colors.border}` }}
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
              ref={textareaRef}
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
              className="w-full resize-none border-0 focus:outline-none text-sm bg-transparent"
              style={{ minHeight: '24px', maxHeight: '200px', color: colors.foreground }}
            />
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg transition-all duration-200"
              style={{ color: colors.mutedForeground }}
              title="Upload images"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>

            <button
              type="submit"
              disabled={!safeTrim(value) && images.length === 0}
              className="px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              style={{ backgroundColor: colors.primary }}
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [prompt]);

  return (
    <div className="flex gap-4 max-w-4xl">
      <div className="flex-shrink-0 w-8" />
      <form onSubmit={onSubmit} className="flex-1">
        <div
          className="border-2 rounded-xl p-4 transition-all duration-200 flex flex-col gap-3"
          style={isDragging ? { borderColor: colors.primary, backgroundColor: 'hsl(213 100% 55% / 0.1)' } : { borderColor: colors.border, backgroundColor: colors.card }}
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
                    className="w-16 h-16 object-cover rounded-lg shadow-sm"
                    style={{ border: `1px solid ${colors.border}` }}
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
              ref={textareaRef}
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
              placeholder="Describe what you want to promote or upload product images..."
              rows={1}
              className="flex-1 resize-none border-0 focus:outline-none text-sm bg-transparent"
              style={{ minHeight: '24px', maxHeight: '200px', color: colors.foreground }}
            />

            <div className="flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg transition-all"
                style={{ color: colors.mutedForeground }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>

              <button
                type="submit"
                disabled={!safeTrim(prompt) && images.length === 0}
                className="px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{ backgroundColor: colors.primary }}
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [prompt]);

  return (
    <div className="flex gap-4 max-w-4xl">
      <div className="flex-shrink-0 w-8" />
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex-1">
        <div className="border-2 rounded-xl p-6 shadow-sm" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
          <label className="block text-sm font-medium mb-3" style={{ color: colors.foreground }}>
            Describe the poster you want
          </label>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="e.g., A vibrant poster highlighting the product with bold text and modern design..."
            className="w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 resize-none placeholder:opacity-70"
            style={{ minHeight: '60px', maxHeight: '200px', borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground }}
            rows={1}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { onSubmit(); } }}
          />
          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={!safeTrim(prompt)}
              className="px-6 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ backgroundColor: colors.primary }}
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
    <div className="flex gap-4 max-w-4xl">
      <div className="flex-shrink-0 w-8" />
      <div className="flex-1">
        <div className="border-2 rounded-xl p-6 space-y-6 shadow-sm" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
          {/* Reference Images Display */}
          {referenceImages.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: colors.foreground }}>
                Reference Images ({referenceImages.length})
              </label>
              <div className="flex flex-wrap gap-3">
                {referenceImages.map((imageUrl, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={imageUrl}
                      alt={`Reference ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded-lg shadow-sm"
                      style={{ border: `1px solid ${colors.border}` }}
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
              <p className="text-xs mt-2" style={{ color: colors.mutedForeground }}>
                These images will be used as style references for your new posters
              </p>
            </div>
          )}

          {/* Theme Selection */}
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: colors.foreground }}>
              Theme Selection
            </label>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onConfigChange({ ...config, theme: theme.id })}
                  title={theme.note}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                  style={config.theme === theme.id ? { backgroundColor: colors.primary, color: 'white' } : { backgroundColor: colors.muted, color: colors.foreground }}
                >
                  {theme.exampleImage ? (
                    <img src={theme.exampleImage} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  ) : theme.previewStyle ? (
                    <span className="w-8 h-8 rounded flex-shrink-0" style={{ background: theme.previewStyle, border: '1px solid rgba(0,0,0,0.1)' }} aria-hidden />
                  ) : null}
                  {theme.label}
                </button>
              ))}
            </div>
            {config.theme && (() => {
              const selected = themes.find((t) => t.id === config.theme);
              if (!selected?.note) return null;
              return (
                <div className="mt-3 p-3 rounded-lg flex gap-3" style={{ backgroundColor: colors.muted, border: `1px solid ${colors.border}` }}>
                  {selected.exampleImage ? (
                    <img src={selected.exampleImage} alt={`${selected.label} example`} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" style={{ border: `1px solid ${colors.border}` }} />
                  ) : selected.previewStyle ? (
                    <div className="w-20 h-20 rounded-lg flex-shrink-0" style={{ background: selected.previewStyle, border: `1px solid ${colors.border}` }} />
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium mb-1" style={{ color: colors.foreground }}>{selected.label} — what to expect</p>
                    <p className="text-xs" style={{ color: colors.mutedForeground }}>{selected.note}</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: colors.foreground }}>
              Aspect Ratio
            </label>
            <div className="flex gap-4 flex-wrap">
              {aspectRatios.map((ar) => (
                <button
                  key={ar.id}
                  type="button"
                  title={ar.description}
                  onClick={() => onConfigChange({ ...config, aspectRatio: ar.id as PosterConfig['aspectRatio'] })}
                  className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all"
                  style={config.aspectRatio === ar.id ? { backgroundColor: colors.primary, color: 'white' } : { backgroundColor: colors.muted, color: colors.foreground }}
                >
                  <span
                    className="rounded-sm border-2 flex-shrink-0"
                    style={{
                      width: ar.width >= ar.height ? 36 : (36 * ar.width) / ar.height,
                      height: ar.width >= ar.height ? (36 * ar.height) / ar.width : 36,
                      borderColor: 'currentColor',
                      opacity: 0.9,
                    }}
                  />
                  <span>{ar.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Variant Count */}
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: colors.foreground }}>
              Number of Variants
            </label>
            <div className="flex gap-2">
              {[1, 2, 3].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => onConfigChange({ ...config, variantCount: count as PosterConfig['variantCount'] })}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={config.variantCount === count ? { backgroundColor: colors.primary, color: 'white' } : { backgroundColor: colors.muted, color: colors.foreground }}
                >
                  {count} {count === 1 ? 'Variant' : 'Variants'}
                </button>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: colors.mutedForeground }}>
              Generate {config.variantCount} different {config.variantCount === 1 ? 'version' : 'versions'} of your poster ({config.variantCount} {config.variantCount === 1 ? 'credit' : 'credits'} will be deducted)
            </p>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!config.theme}
              className="px-6 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ backgroundColor: colors.primary }}
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
  config,
  onConfigChange,
  onSavePoster,
  onCreateCampaign,
  onRegenerate,
  onUseAsReference,
  onUseAsReferenceRequest,
  onUseAsReferenceConfirm,
  pendingUseAsReference,
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
  config: PosterConfig;
  onConfigChange: (config: PosterConfig) => void;
  onSavePoster: (url: string, index: number) => Promise<void>;
  onCreateCampaign: (url: string, index: number) => Promise<void>;
  onRegenerate?: () => void;
  onUseAsReference?: (url: string, index: number) => void;
  onUseAsReferenceRequest?: (url: string, index: number) => void;
  onUseAsReferenceConfirm?: (url: string, index: number) => void;
  pendingUseAsReference: { url: string; index: number } | null;
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
  const regenerateTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = regenerateTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [regeneratePrompt]);

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

  // Handle download - use blob-based approach so data URLs and remote URLs actually download
  const handleDownload = async (poster: string, idx: number) => {
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
    } catch (e) {
      console.warn('Could not save to download history:', e);
    }
    try {
      await downloadImageToLocal(poster, `poster-${idx + 1}.png`);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: try simple anchor (may open in tab for data URLs)
      const link = document.createElement('a');
      link.href = poster;
      link.download = `poster-${idx + 1}.png`;
      link.click();
    }
    setOpenMenuIndex(null);
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
              className="px-5 py-2.5 rounded-lg text-sm font-medium shadow-lg transition-colors flex items-center gap-2"
              style={{ backgroundColor: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}
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
              className="px-5 py-2.5 rounded-lg text-sm font-medium shadow-lg transition-colors flex items-center gap-2"
              style={{ backgroundColor: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}
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
          {/* Regeneration / Use as Reference Config Form - theme, prompt, aspect ratio, variants */}
          {(showRegeneratePrompt || pendingUseAsReference) && (
            <div className="rounded-lg p-6 space-y-6" style={{ border: `2px solid ${colors.border}`, backgroundColor: colors.card }}>
              <h3 className="text-base font-semibold" style={{ color: colors.foreground }}>
                {pendingUseAsReference ? 'Edit settings before using as reference' : 'Edit settings for new variants'}
              </h3>

              {/* Theme */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {POSTER_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  title={theme.note}
                  onClick={() => onConfigChange({ ...config, theme: theme.id })}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                  style={config.theme === theme.id ? { backgroundColor: colors.primary, color: 'white' } : { backgroundColor: colors.muted, color: colors.foreground }}
                >
                  {theme.exampleImage ? (
                    <img src={theme.exampleImage} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  ) : theme.previewStyle ? (
                    <span className="w-8 h-8 rounded flex-shrink-0" style={{ background: theme.previewStyle, border: '1px solid rgba(0,0,0,0.1)' }} aria-hidden />
                  ) : null}
                  {theme.label}
                </button>
                  ))}
                </div>
                {config.theme && (() => {
                  const selected = POSTER_THEMES.find((t) => t.id === config.theme);
                  if (!selected?.note) return null;
                  return (
                    <div className="mt-3 p-3 rounded-lg flex gap-3" style={{ backgroundColor: colors.muted, border: `1px solid ${colors.border}` }}>
                      {selected.exampleImage ? (
                        <img src={selected.exampleImage} alt={`${selected.label} example`} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" style={{ border: `1px solid ${colors.border}` }} />
                      ) : selected.previewStyle ? (
                        <div className="w-16 h-16 rounded-lg flex-shrink-0" style={{ background: selected.previewStyle, border: `1px solid ${colors.border}` }} />
                      ) : null}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium mb-0.5" style={{ color: colors.foreground }}>{selected.label} — what to expect</p>
                        <p className="text-xs" style={{ color: colors.mutedForeground }}>{selected.note}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>Prompt</label>
                <textarea
                  ref={regenerateTextareaRef}
                  value={regeneratePrompt}
                  onChange={(e) => onRegeneratePromptChange(e.target.value)}
                  placeholder="e.g., Make it more colorful, Add more text, Change the background to dark..."
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 resize-none"
                  style={{ minHeight: '60px', maxHeight: '200px', border: `1px solid ${colors.border}`, backgroundColor: colors.input, color: colors.foreground }}
                  rows={1}
                />
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>Aspect Ratio</label>
                <div className="flex gap-4 flex-wrap">
                  {ASPECT_RATIOS.map((ar) => (
                    <button
                      key={ar.id}
                      type="button"
                      title={ar.description}
                      onClick={() => onConfigChange({ ...config, aspectRatio: ar.id as PosterConfig['aspectRatio'] })}
                      className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all"
                      style={config.aspectRatio === ar.id ? { backgroundColor: colors.primary, color: 'white' } : { backgroundColor: colors.muted, color: colors.foreground }}
                    >
                      <span
                        className="rounded-sm border-2 flex-shrink-0"
                        style={{
                          width: ar.width >= ar.height ? 32 : (32 * ar.width) / ar.height,
                          height: ar.width >= ar.height ? (32 * ar.height) / ar.width : 32,
                          borderColor: 'currentColor',
                          opacity: 0.9,
                        }}
                      />
                      <span>{ar.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Variant Count */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>Number of Variants</label>
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => onConfigChange({ ...config, variantCount: count })}
                      className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                      style={config.variantCount === count ? { backgroundColor: colors.primary, color: 'white' } : { backgroundColor: colors.muted, color: colors.foreground }}
                    >
                      {count} {count === 1 ? 'Variant' : 'Variants'}
                    </button>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: colors.mutedForeground }}>
                  {config.variantCount} {config.variantCount === 1 ? 'credit' : 'credits'} will be deducted
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                {pendingUseAsReference ? (
                  <button
                    onClick={() => pendingUseAsReference && onUseAsReferenceConfirm?.(pendingUseAsReference.url, pendingUseAsReference.index)}
                    disabled={!config.theme}
                    className="px-5 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Use as Reference
                  </button>
                ) : (
                  <button
                    onClick={onRegenerateSubmit}
                    disabled={!config.theme}
                    className="px-5 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    style={{ backgroundColor: colors.primary }}
                  >
                    Generate {config.variantCount} {config.variantCount === 1 ? 'Variant' : 'Variants'}
                  </button>
                )}
                <button
                  onClick={onRegenerateCancel}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ border: `1px solid ${colors.border}`, color: colors.foreground, backgroundColor: colors.muted }}
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
                {/* Poster - Clickable for preview, with menu overlay */}
                <div
                  className="rounded-lg overflow-visible cursor-pointer relative"
                  style={{ backgroundColor: colors.muted, border: `1px solid ${colors.border}` }}
                >
                  <div onClick={() => setPreviewImage(poster)}>
                    <img
                      src={poster}
                      alt={`Generated poster ${idx + 1}`}
                      className="w-full h-auto block rounded-lg transition-transform duration-200 group-hover:scale-[1.02]"
                      style={{ imageRendering: 'auto' }}
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center rounded-lg pointer-events-none">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white bg-black/50 px-3 py-1.5 rounded-lg text-sm font-medium">
                        Click to preview
                      </span>
                    </div>
                  </div>

                  {/* Three-dots menu - overlaid on image bottom-right */}
                  <div
                    className="absolute bottom-2 right-2"
                    ref={openMenuIndex === idx ? menuRef : null}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuIndex(openMenuIndex === idx ? null : idx);
                      }}
                      className="p-2 rounded-lg transition-colors shadow-md"
                      style={{
                        backgroundColor: openMenuIndex === idx ? colors.primary : 'rgba(0,0,0,0.6)',
                        color: 'white',
                        backdropFilter: 'blur(8px)',
                      }}
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

                    {/* Dropdown Menu */}
                    {openMenuIndex === idx && (
                      <div
                        className="absolute right-0 bottom-full mb-1 w-48 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto"
                        style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="py-1">
                          <button
                            onClick={() => handleDownload(poster, idx)}
                            className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2"
                            style={{ color: colors.foreground }}
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
                            className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2"
                            style={{ color: colors.foreground }}
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
                            className="w-full text-left px-4 py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            style={{ color: colors.foreground }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            {savingPoster === idx ? 'Saving...' : 'Save to Library'}
                          </button>
                          {onUseAsReference && (
                          <>
                          <div className="my-1" style={{ borderTop: `1px solid ${colors.border}` }} />
                          <button
                            onClick={() => {
                              (onUseAsReferenceRequest ?? onUseAsReference)(poster, idx);
                              setOpenMenuIndex(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2"
                            style={{ color: colors.foreground }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Use as Reference
                          </button>
                          </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Button below image */}
                {canCreateCampaigns && (
                  <div className="mt-3">
                    <button
                      onClick={() => onCreateCampaign(poster, idx)}
                      disabled={creatingCampaign === idx}
                      className="w-full px-4 py-2.5 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: colors.primary }}
                    >
                      {creatingCampaign === idx ? 'Creating...' : 'Use in Campaign'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Regenerate Button - Improved UX */}
          {!showRegeneratePrompt && !pendingUseAsReference && (
            <div className="pt-4 border-t flex justify-center" style={{ borderColor: colors.border }}>
              <button
                onClick={onRegenerate}
                className="px-6 py-2.5 border-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.muted,
                  color: colors.foreground,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.primary;
                  e.currentTarget.style.backgroundColor = 'hsl(213 100% 55% / 0.15)';
                  e.currentTarget.style.color = colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.backgroundColor = colors.muted;
                  e.currentTarget.style.color = colors.foreground;
                }}
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
