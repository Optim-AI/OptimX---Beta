// pages/brand-studio/poster/[sessionId].tsx
// Poster Generation Session Page

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { showAlert, showError, showSuccess } from '@/app/web/src/components/ui/alert-modal-api';
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
  BrandCard,
  BrandOnboarding,
  BrandGuidelineModal,
  SessionNameModal,
  buildPosterPrompt,
  fetchPosterCreativeDirectorVariants,
  formatTimestamp,
  fileToDataUrl,
  dataUrlToFile,
  generateId,
  DEFAULT_POSTER_CONFIG,
  POSTER_THEMES,
  ASPECT_RATIOS,
  mapFullAnalyzeToBrandSnapshot,
} from '@/app/web/src/components/creative-studio';
import PosterCreativeWorkspace from '@/app/web/src/components/creative-studio/PosterCreativeWorkspace';
import type { Product } from '@/app/web/src/components/creative-studio/types';
import { authFetch, safeResponseJson } from '@/lib/utils';
import PosterEditModal from '@/app/web/src/components/content-studio/PosterEditModal';

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
  const { id: sessionId, autoGenerate } = router.query;
  
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
    productName?: string;
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
  const referencePosterInputRef = useRef<HTMLInputElement>(null);
  
  // New session modal state
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  
  // Delete confirmation modal state
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // Poster edit modal state
  const [editingPosterIndex, setEditingPosterIndex] = useState<number | null>(null);

  // Image preview state (for chat history images)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Fetched products state (from website scan, like Ad Studio)
  const [fetchedProducts, setFetchedProducts] = useState<Product[]>([]);
  const [productsCollapsed, setProductsCollapsed] = useState(false);
  const [scannedUrl, setScannedUrl] = useState<string>('');
  const [isScanningProducts, setIsScanningProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);

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
      setFetchedProducts([]);
      setScannedUrl('');
      setProductsCollapsed(false);
      
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
          
          // Restore images — only decode base64 data URLs; http URLs stay as URLs
          if (productData.imageDataUrls && productData.imageDataUrls.length > 0) {
            const urls = productData.imageDataUrls;
            const restoredImages = urls
              .map((url, idx) => {
                if (!url.startsWith("data:")) return null;
                try {
                  return dataUrlToFile(url, `product-${idx}.jpg`);
                } catch {
                  return null;
                }
              })
              .filter((f): f is File => f != null);
            setProductImages(restoredImages);
            setSavedProductData({
              prompt: productData.prompt || '',
              images: restoredImages,
              imageDataUrls: urls,
              productName: (productData as { productName?: string }).productName,
            });
          } else if (productData.prompt) {
            setSavedProductData({
              prompt: productData.prompt,
              images: [],
              imageDataUrls: [],
              productName: (productData as { productName?: string }).productName,
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
        setPhase('brand-review');
        addMessage('system', pickMessage([
          "I've pulled your brand info from the site — take a look and tweak anything you'd like.",
          "Got it! I've analyzed your website. Review the details below and adjust as needed.",
          "Here's what I found from your site. Let me know if anything needs updating.",
        ]));
        // Products scan happens in parallel from handleSubmit
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

  // ============== Product Scan / Selection Handlers ==============

  async function scanWebsiteForProducts(
    websiteUrl: string,
    opts?: { silent?: boolean }
  ): Promise<Product[]> {
    if (!opts?.silent) setIsScanningProducts(true);
    setScannedUrl(websiteUrl);
    try {
      const res = await authFetch('/api/content-studio/scan', {
        method: 'POST',
        body: JSON.stringify({ url: websiteUrl }),
      });
      const data = await res.json();
      if (data.ok && data.products && data.products.length > 0) {
        setFetchedProducts(data.products);
        setProductsCollapsed(false);
        addMessage('system', pickMessage([
          `Found ${data.products.length} products from the website! Select one below or describe what you want.`,
          `Fetched ${data.products.length} products. Pick one to use, or describe your poster idea.`,
          `${data.products.length} products detected. Click any product to use it, or type your own description.`,
        ]));
        return data.products as Product[];
      } else {
        setFetchedProducts([]);
        return [];
      }
    } catch (err: any) {
      console.error('Product scan error:', err);
      return [];
    } finally {
      if (!opts?.silent) setIsScanningProducts(false);
    }
  }

  async function handleFetchedProductSelect(product: Product) {
    const firstImage = product.product_images?.[0];
    let productImageFile: File | undefined;
    let productImageDataUrl: string | undefined;

    if (firstImage) {
      try {
        const res = await authFetch('/api/creative-studio/fetch-image', {
          method: 'POST',
          body: JSON.stringify({ url: firstImage, directFetch: true }),
        });
        const data = await res.json();
        if (data.ok && data.dataUrl) {
          productImageDataUrl = data.dataUrl;
          const base64Data = data.dataUrl.split(',')[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'image/jpeg' });
          productImageFile = new File([blob], `${product.product_name}.jpg`, { type: 'image/jpeg' });
        }
      } catch {
        // Image fetch failed, proceed without it
      }
    }

    const promptText = `${product.product_name}${product.short_benefit ? ' - ' + product.short_benefit : ''}${product.description ? '. ' + product.description : ''}`;
    setProductPrompt(promptText);
    setSelectedProduct(product);

    if (productImageFile && productImageDataUrl) {
      setProductImages([productImageFile]);
      setSavedProductData({
        prompt: promptText,
        images: [productImageFile],
        imageDataUrls: [productImageDataUrl],
        productName: product.product_name,
      });

      const storageUrls = await uploadDataUrlsToStorage([productImageDataUrl]);
      addMessage('user', `Selected: ${product.product_name}`, [productImageFile], storageUrls.length > 0 ? storageUrls : undefined);

      addMessage('system', pickMessage([
        `Great choice! "${product.product_name}" — describe the poster you want on the right.`,
        `${product.product_name} selected! Add creative direction and generate when ready.`,
        `Using ${product.product_name}. What should this poster communicate?`,
      ]));
      setPhase('config');
    } else {
      setSavedProductData({
        prompt: promptText,
        images: [],
        imageDataUrls: [],
        productName: product.product_name,
      });
      addMessage('user', `Selected: ${product.product_name}`);
      const echo = product.product_name.length > 50 ? product.product_name.slice(0, 50) + '...' : product.product_name;
      addMessage('system', pickMessage([
        `${echo} — describe your creative direction and generate when ready.`,
        `Got it! "${echo}" — add a prompt on the right to continue.`,
        `Love it. Describe the poster idea, then generate.`,
      ]));
      setPhase('config');
    }

    setProductsCollapsed(true);
  }

  // ============== Product Image Handlers ==============
  
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

  function handleWorkspaceProductImagesChange(files: File[]) {
    setSelectedProduct(null);
    setProductImages(files);
    // Persist asynchronously so Generate can run without Continue
    void (async () => {
      if (files.length === 0) {
        setSavedProductData(null);
        return;
      }
      const imageDataUrls: string[] = [];
      for (const img of files) {
        imageDataUrls.push(await fileToDataUrl(img));
      }
      setSavedProductData({
        prompt: productPrompt || files[0]?.name || 'Uploaded product',
        images: files,
        imageDataUrls,
      });
      setPhase('config');
    })();
  }

  function handleClearProduct() {
    setSelectedProduct(null);
    setProductImages([]);
    setSavedProductData(null);
    setProductPrompt('');
  }

  function handleBrowseCatalog() {
    const website =
      brand?.website_url ||
      scannedUrl ||
      '';
    if (website) {
      void scanWebsiteForProducts(website);
      return;
    }
    // No known website — open empty catalog; user can Import URL
    setProductsCollapsed(false);
  }

  async function handleImportProductUrl(url: string) {
    let trimmed = safeTrim(url);
    if (!trimmed) {
      showError('Paste a product URL first.');
      return;
    }
    // Match scan API — accept URLs without protocol
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    try {
      // Validate early so we never hit the API with an empty/invalid URL
      // eslint-disable-next-line no-new
      new URL(trimmed);
    } catch {
      showError('That does not look like a valid URL.');
      return;
    }

    addMessage('user', trimmed);
    setThinkingMessages(['Fetching product from URL…']);
    setIsScanningProducts(true);

    // Catalog scan in parallel — product pages often yield selectable products
    const scanPromise = scanWebsiteForProducts(trimmed, { silent: true });

    try {
      const response = await authFetch('/api/creative-studio/fetch-image', {
        method: 'POST',
        body: JSON.stringify({ url: trimmed }),
      });
      const result = await response.json();

      if (response.ok && result.ok && result.dataUrl) {
        const dataUrl = result.dataUrl as string;
        const contentType = result.contentType || 'image/jpeg';
        const base64Data = dataUrl.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: contentType });
        let extension = 'jpg';
        if (contentType.includes('png')) extension = 'png';
        else if (contentType.includes('webp')) extension = 'webp';
        const file = new File([blob], `product_${Date.now()}.${extension}`, { type: contentType });

        setSelectedProduct(null);
        setProductImages([file]);
        setSavedProductData({
          prompt: trimmed,
          images: [file],
          imageDataUrls: [dataUrl],
        });
        setPhase('config');
        setThinkingMessages([]);
        addMessage('system', 'Product imported. Add creative direction on the right, then generate.');
        return;
      }

      // Image scrape failed — fall back to catalog results when available
      const products = await scanPromise;
      setThinkingMessages([]);
      if (products.length > 0) {
        setProductsCollapsed(false);
        addMessage(
          'system',
          'Opened the catalog from that URL. Select a product to continue.'
        );
      } else {
        showError(
          result?.error ||
            'Could not import that URL. Try uploading a product image instead.'
        );
      }
    } catch (err: any) {
      console.error('Import product URL error:', err);
      setThinkingMessages([]);
      showError(err?.message || 'Failed to import product URL');
    } finally {
      setIsScanningProducts(false);
    }
  }

  async function handleEnhancePrompt() {
    const current = safeTrim(posterPrompt);
    if (!current) return;
    setIsEnhancingPrompt(true);
    try {
      const resp = await authFetch('/api/enhancePrompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: current, mode: 'poster' }),
      });
      const data = await resp.json();
      if (data?.caption || data?.enhanced || data?.prompt || data?.text) {
        setPosterPrompt(data.caption || data.enhanced || data.prompt || data.text);
      } else if (typeof data === 'string') {
        setPosterPrompt(data);
      } else {
        showError(data?.error || 'Could not enhance the idea. Try again.');
      }
    } catch (err: any) {
      console.error('enhancePrompt error', err);
      showError(err?.message || 'Could not enhance the idea.');
    } finally {
      setIsEnhancingPrompt(false);
    }
  }

  async function handleWorkspaceGenerate() {
    if (hasInsufficientCredits) {
      showError('You have no credits remaining. Purchase more to generate posters.');
      return;
    }

    const hasSavedProduct =
      (savedProductData?.imageDataUrls && savedProductData.imageDataUrls.length > 0) ||
      (savedProductData?.images && savedProductData.images.length > 0) ||
      productImages.length > 0;

    if (!hasSavedProduct) {
      showError('Add a product to generate');
      return;
    }

    if (!safeTrim(posterPrompt)) {
      showError('Describe what you want to create');
      return;
    }

    let productOverride = savedProductData;
    if (
      (!(savedProductData?.imageDataUrls && savedProductData.imageDataUrls.length > 0) ||
        !(savedProductData?.images && savedProductData.images.length > 0)) &&
      productImages.length > 0
    ) {
      const imageDataUrls: string[] = [];
      for (const img of productImages) {
        imageDataUrls.push(await fileToDataUrl(img));
      }
      productOverride = {
        prompt: selectedProduct?.product_name || productPrompt || 'Selected product',
        images: [...productImages],
        imageDataUrls,
        productName: selectedProduct?.product_name,
      };
      setSavedProductData(productOverride);
    }

    if (!config.theme) {
      setConfig((c) => ({ ...c, theme: 'commercial' }));
    }

    setPhase('config');
    await handleConfigSubmit(undefined, productOverride);
  }

  // ============== Reference Poster (Design Inspiration) ==============

  async function handleReferencePosterSelect(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError("Please upload an image (PNG, JPG, or WEBP).");
      return;
    }
    if (GEMINI_UNSUPPORTED_IMAGE_TYPES.some((t) => file.type.toLowerCase().includes(t))) {
      showError("SVG and ICO are not supported. Please use JPEG, PNG, GIF, or WebP.");
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setConfig((c) => ({
        ...c,
        referencePoster: {
          dataUrl,
          imageUrl: dataUrl,
          source: "upload",
          analyzing: true,
          analysis: null,
          influence: "balanced",
        },
      }));

      const res = await authFetch("/api/creative-studio/analyze-reference-poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json();
      if (data?.ok && data.analysis) {
        setConfig((c) => ({
          ...c,
          referencePoster: {
            ...(c.referencePoster || {}),
            dataUrl,
            imageUrl: dataUrl,
            source: "upload",
            analyzing: false,
            analysis: data.analysis,
            contentHash: data.contentHash,
            analyzedAt: new Date().toISOString(),
            influence: "balanced",
          },
        }));
      } else {
        setConfig((c) => ({
          ...c,
          referencePoster: {
            ...(c.referencePoster || { dataUrl, imageUrl: dataUrl, source: "upload" }),
            analyzing: false,
            analysis: null,
          },
        }));
        showError(data?.error || "Could not analyze design inspiration. You can still generate.");
      }
    } catch (err) {
      console.error("Reference poster upload failed", err);
      setConfig((c) => ({
        ...c,
        referencePoster: c.referencePoster
          ? { ...c.referencePoster, analyzing: false }
          : null,
      }));
      showError("Failed to add design inspiration");
    } finally {
      if (referencePosterInputRef.current) referencePosterInputRef.current.value = "";
    }
  }

  function handleRemoveReferencePoster() {
    setConfig((c) => ({ ...c, referencePoster: null }));
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

  async function handleConfigSubmit(
    promptOverride?: string,
    productOverride?: {
      prompt: string;
      images: File[];
      imageDataUrls?: string[];
      productName?: string;
    } | null
  ) {
    if (hasInsufficientCredits) {
      addMessage('system', pickMessage([
        "You're out of credits — grab more to keep creating.",
        "No credits left. Purchase more to generate posters.",
      ]));
      return;
    }

    const effectiveTheme = config.theme || 'commercial';
    if (!config.theme) {
      setConfig((c) => ({ ...c, theme: 'commercial' }));
    }

    const effectiveProduct = productOverride ?? savedProductData;
    
    setPhase('generating');
    setIsGenerating(true);
    setThinkingMessages(['Understanding your campaign…']);
    
    try {
      const hasProductImage =
        (effectiveProduct?.imageDataUrls && effectiveProduct.imageDataUrls.length > 0) ||
        (effectiveProduct?.images && effectiveProduct.images.length > 0);
      
      // Build base user request - use promptOverride when provided (e.g. from edited form), else posterPrompt or product data
      // Keep this CLEAN — do not pollute with brand guidelines (those go separately to the API).
      let userRequest = safeTrim(promptOverride) || safeTrim(posterPrompt) || safeTrim(effectiveProduct?.prompt) || '';
      if (!userRequest) {
        // Fallback: build from brand
        const promptParts: string[] = [];
        if (brand?.name) promptParts.push(`Create a marketing poster for ${brand.name}`);
        if (brand?.description) promptParts.push(brand.description);
        promptParts.push(`Theme: ${effectiveTheme}`);
        userRequest = promptParts.length > 0 ? promptParts.join('. ') : 'Create a professional marketing poster';
      }

      // Brand context is appended only for legacy / generate-campaign — NOT as the director's userRequest
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
      // Skip when brand name conflicts with product name (e.g. boAt brand + Yoga Bar pack)
      const productName =
        effectiveProduct?.productName ||
        selectedProduct?.product_name ||
        (() => {
          // Infer from user prompt when catalog name missing (e.g. "Yoga Bar 26g High Protein Oats…")
          const m = userRequest.match(
            /\b((?:Yoga\s+Bar|[\w&]+)(?:\s+[\w&%/]+){0,6}?(?:\s+(?:Oats|Bar|Serum|Cream|Drink|Bottle|Pouch))?)\b/i
          );
          return m?.[1]?.trim() || undefined;
        })();
      const brandProductConflict = (() => {
        const b = (brand?.name || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
        const p = (productName || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
        if (!b || !p) return false;
        if (p.includes(b) || b.includes(p)) return false;
        const bTokens = b.split(/\s+/).filter((t) => t.length > 2);
        const pTokens = p.split(/\s+/).filter((t) => t.length > 2);
        if (bTokens.some((t) => pTokens.includes(t))) return false;
        // Also conflict if user prompt names a different brand than brand snapshot
        const promptLower = userRequest.toLowerCase();
        if (b.length >= 3 && !promptLower.includes(b) && /yoga\s*bar|protein\s*oats/i.test(userRequest)) {
          return true;
        }
        return true;
      })();

      const logoSource = brandProductConflict ? null : (brand?.logo ?? brand?.logoUrl);
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
      if (brandProductConflict) {
        console.warn(
          '[poster] Skipping brand logo — brand name conflicts with product identity',
          { brand: brand?.name, product: productName }
        );
      }
      
      // Prepare product images — must be data URLs for generate-campaign API
      const resolveImageForApi = async (url: string): Promise<string | undefined> => {
        if (!url) return undefined;
        if (url.startsWith('data:')) return url;
        if (!url.startsWith('http')) return undefined;
        try {
          const imgRes = await authFetch('/api/creative-studio/fetch-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, directFetch: true }),
          });
          const imgData = await imgRes.json();
          if (imgData.ok && imgData.dataUrl?.startsWith('data:')) return imgData.dataUrl;
        } catch (e) {
          console.warn('Failed to resolve product image URL:', e);
        }
        return undefined;
      };

      const allImageUrls = effectiveProduct?.imageDataUrls || [];
      let productDataUrl = allImageUrls.length > 0 ? allImageUrls[0] : undefined;
      if (productDataUrl && !productDataUrl.startsWith('data:')) {
        productDataUrl = await resolveImageForApi(productDataUrl);
      }
      const refDataUrls: string[] = [];
      for (const ref of allImageUrls.slice(1)) {
        const resolved = ref.startsWith('data:') ? ref : await resolveImageForApi(ref);
        if (resolved) refDataUrls.push(resolved);
      }

      // Design inspiration — separate role from product refs
      let referencePosterDataUrl: string | undefined;
      const rp = config.referencePoster;
      if (rp?.dataUrl || rp?.imageUrl) {
        const raw = rp.dataUrl || rp.imageUrl || '';
        referencePosterDataUrl = raw.startsWith('data:')
          ? raw
          : await resolveImageForApi(raw);
      }

      if (hasProductImage && !productDataUrl) {
        throw new Error(
          'Could not load the product image from Ad Studio. Please re-open this session or scan your product again in Ad Studio.'
        );
      }
      
      // Build base payload (same for all variants)
      const basePayload = {
        mode: 'generate',
        theme: effectiveTheme,
        target,
        aspectLabel: config.aspectRatio,
        brandName: brandProductConflict
          ? productName || brand?.name || ''
          : brand?.name || '',
        brandSnapshot: brandProductConflict
          ? {
              ...(brand || {}),
              name: productName || brand?.name,
              // Avoid forcing mismatched brand colors/logo when product is clearly different
            }
          : brand,
        tone: brand?.brandVoice || effectiveTheme,
        productName: productName || undefined,
        productDataUrl,
        productProvided: !!productDataUrl,
        refDataUrls,
        referencePosterDataUrl,
        referencePosterProvided: !!referencePosterDataUrl,
        logoDataUrl,
        logoProvided: !!logoDataUrl,
        // Pass logo placement for proper positioning (default: bottom-right when logo exists)
        ...(logoDataUrl && { logoPlacement: (brand as any)?.logoPlacement ?? 'bottom-right' }),
      };

      // Generate variants in parallel for faster results
      const variantCount = (config.variantCount || 3) as 1 | 2 | 3;
      setThinkingMessages([`Building creative direction for ${variantCount} ${variantCount === 1 ? 'variant' : 'variants'}…`]);

      // Poster Engine V1 — plan + compile (engine fallback if plan API unreachable)
      // Pass CLEAN userRequest so the planner executes the written brief — not brand boilerplate.
      const directorResult = await fetchPosterCreativeDirectorVariants({
        authFetch,
        userRequest,
        theme: effectiveTheme,
        aspectRatio: config.aspectRatio,
        brand: brandProductConflict
          ? ({ ...(brand || {}), name: productName || brand?.name } as BrandSnapshot)
          : brand,
        variantCount,
        hasProductImage: !!hasProductImage,
        hasLogo: !!logoDataUrl,
        productName,
        productDescription:
          selectedProduct?.description ||
          effectiveProduct?.prompt ||
          undefined,
        productBenefits: selectedProduct?.key_benefits || undefined,
        audience: brand?.audience,
        campaignObjective: 'Drive engagement and conversion',
        creativeBrief: userRequest,
        platform:
          config.aspectRatio === '9:16'
            ? 'Instagram story / Reels'
            : config.aspectRatio === '4:5'
              ? 'Instagram / Meta feed'
              : config.aspectRatio === '1.91:1'
                ? 'Landscape social'
                : 'Square social poster',
        hasReferencePoster: !!referencePosterDataUrl,
        referencePosterAnalysis: (config.referencePoster?.analysis as any) || null,
        referenceInfluence: config.referencePoster?.influence || 'balanced',
      });

      let variantPrompts: string[];

      if (directorResult.usedDirector && directorResult.prompts.length > 0) {
        variantPrompts = directorResult.prompts.slice(0, variantCount);
        while (variantPrompts.length < variantCount) {
          const n = variantPrompts.length + 1;
          variantPrompts.push(
            buildPosterPrompt({
              userRequest: finalPrompt,
              theme: effectiveTheme,
              aspectRatio: config.aspectRatio,
              brand,
              hasProductImage: !!hasProductImage,
              variant: n,
            })
          );
        }
        setThinkingMessages([
          directorResult.selectedConcept
            ? `Concept: ${String(directorResult.selectedConcept).slice(0, 80)}… Designing composition…`
            : `Designing the composition for ${variantCount} ${variantCount === 1 ? 'variant' : 'variants'}…`,
        ]);
      } else {
        variantPrompts = Array.from({ length: variantCount }, (_, i) => i + 1).map((variantNum) =>
          buildPosterPrompt({
            userRequest: finalPrompt,
            theme: effectiveTheme,
            aspectRatio: config.aspectRatio,
            brand,
            hasProductImage: !!hasProductImage,
            variant: variantNum,
          })
        );
        setThinkingMessages([`Generating artwork for ${variantCount} ${variantCount === 1 ? 'variant' : 'variants'}…`]);
      }

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
        return { variantNum, response, data, variantPrompt };
      });
      
      // Wait for all to complete (don't fail fast - collect all results)
      const results = await Promise.allSettled(variantPromises);
      
      // Process results — no automatic QC / correction loops (Poster Engine V1)
      const posters: string[] = [];
      const storagePaths: string[] = [];
      let creditError = false;
      let lastError = '';
      let latestCredits: number | undefined;
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { variantNum, response, data } = result.value;
          
          if (data.ok && data.image) {
            posters.push(data.image as string);
            storagePaths.push(data.imageStoragePath || '');
            if (data.creditsRemaining !== undefined) {
              latestCredits = data.creditsRemaining;
            }
          } else if (data.error) {
            console.error(`Poster variant ${variantNum} failed:`, data.error);
            lastError = data.error;
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

      setThinkingMessages(['Reviewing the result…']);
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

  const autoGenerateTriggeredRef = React.useRef(false);

  // Auto-generate when arriving from Creative Intelligence ranked hooks
  useEffect(() => {
    if (autoGenerate !== "1") return;
    if (isLoading || !session || autoGenerateTriggeredRef.current) return;
    if (phase !== "config") return;

    const prompt = posterPrompt?.trim() || savedProductData?.prompt?.trim();
    const hasProductRef =
      (savedProductData?.imageDataUrls?.length ?? 0) > 0 ||
      (session.productData as { imageDataUrls?: string[] } | undefined)?.imageDataUrls?.length;
    if (!prompt || !hasProductRef) return;

    autoGenerateTriggeredRef.current = true;
    if (!config.theme) {
      setConfig((c) => ({ ...c, theme: c.theme || "commercial", aspectRatio: c.aspectRatio || "9:16" }));
    }
    const timer = setTimeout(() => {
      handleConfigSubmit(prompt);
    }, 800);
    return () => clearTimeout(timer);
  }, [autoGenerate, isLoading, session, phase, posterPrompt, savedProductData, config.theme]);

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

  async function handleRegenerateWithEdit(
    posterUrl: string,
    posterIndex: number,
    editPrompt: string
  ) {
    let posterDataUrl = posterUrl;
    if (posterUrl.startsWith("http")) {
      try {
        const res = await authFetch("/api/creative-studio/fetch-image", {
          method: "POST",
          body: JSON.stringify({ url: posterUrl, directFetch: true }),
        });
        const data = await res.json();
        if (data.ok && data.dataUrl) posterDataUrl = data.dataUrl;
      } catch {
        showError("Could not load poster for editing");
        return;
      }
    }

    const editDescription = `EDIT MODE: The image provided below is the current marketing poster. Make ONLY this exact change: "${editPrompt}". Keep everything else identical—same layout, product, colors, branding, and all other text. Only apply the requested modification. Output the modified poster. ${config.aspectRatio || '4:5'} aspect ratio, high quality. Never use asterisks (*) in any text. Plain text only.`;

    try {
      const res = await authFetch("/api/generate-campaign", {
        method: "POST",
        body: JSON.stringify({
          mode: "edit",
          editMode: true,
          description: editDescription,
          prompt: editDescription,
          refDataUrls: [posterDataUrl],
          target: { width: 1080, height: 1350 },
          aspectLabel: config.aspectRatio || "4:5",
          theme: config.theme || "commercial",
          brandName: brand?.name || "",
          brandSnapshot: brand,
        }),
      });
      const data = await res.json();
      if (data.ok && data.image) {
        setGeneratedPosters((prev) =>
          prev.map((url, i) => (i === posterIndex ? data.image : url))
        );
      } else {
        showError(data.error || "Failed to regenerate poster");
      }
    } catch (err: any) {
      showError(err.message || "Failed to regenerate poster");
    }
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
        // Also scan for products in the background
        scanWebsiteForProducts(currentInput);
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
        
        // Also scan for products in background so user can pick from the grid
        if (url) scanWebsiteForProducts(url);
        
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
      
      router.push(`/brand-studio/poster?id=${selectedSessionId}`);
    }
  }

  function handleNewSession() {
    void handleCreateNewSession("Untitled Poster");
  }

  async function handleRenameSession(name: string) {
    if (!sessionId || sessionId === "new") return;
    const trimmed = name.trim() || "Untitled Poster";
    try {
      const response = await authFetch(`/api/creative-studio/sessions?id=${sessionId}`, {
        method: "PUT",
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await response.json();
      if (data.ok) {
        setSession((prev) => (prev ? { ...prev, name: trimmed } : prev));
        setPosterSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, name: trimmed } : s))
        );
      }
    } catch (err) {
      console.error("Rename session failed", err);
    }
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
          name: name.trim() || 'Untitled Poster',
          sessionType: 'poster',
          brandSnapshot: brand,
          phase: 'input',
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
        router.push(`/brand-studio/poster?id=${data.session.id}`);
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
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/brand-studio')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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

      {/* Main Content — Creative Workspace V2 */}
      <PosterCreativeWorkspace
        brand={brand}
        sessionName={session?.name || 'Untitled Poster'}
        creditsAvailable={credits}
        onOpenBrandGuidelines={() => setShowBrandGuidelineModal(true)}
        onBackToBrandStudio={() => router.push('/brand-studio')}
        selectedProduct={selectedProduct}
        productImages={productImages}
        productImageUrls={savedProductData?.imageDataUrls || []}
        onProductImagesChange={handleWorkspaceProductImagesChange}
        onClearProduct={handleClearProduct}
        fetchedProducts={fetchedProducts}
        isScanningProducts={isScanningProducts}
        onSelectCatalogProduct={handleFetchedProductSelect}
        onBrowseCatalog={handleBrowseCatalog}
        onImportProductUrl={handleImportProductUrl}
        creativePrompt={posterPrompt}
        onCreativePromptChange={setPosterPrompt}
        onEnhancePrompt={() => void handleEnhancePrompt()}
        isEnhancingPrompt={isEnhancingPrompt}
        referencePosterPreviewUrl={
          config.referencePoster?.dataUrl ||
          config.referencePoster?.imageUrl ||
          null
        }
        isAnalyzingReferencePoster={!!config.referencePoster?.analyzing}
        onReferencePosterFile={(file) => {
          if (!file) return;
          const dt = new DataTransfer();
          dt.items.add(file);
          void handleReferencePosterSelect(dt.files);
        }}
        onClearReferencePoster={handleRemoveReferencePoster}
        theme={config.theme || ''}
        onThemeChange={(t) => setConfig((c) => ({ ...c, theme: t }))}
        aspectRatio={config.aspectRatio}
        onAspectRatioChange={(r) => setConfig((c) => ({ ...c, aspectRatio: r }))}
        numVariants={(config.variantCount || 3) as 1 | 2 | 3}
        onNumVariantsChange={(n) => setConfig((c) => ({ ...c, variantCount: n }))}
        canGenerate={
          !hasInsufficientCredits &&
          !!safeTrim(posterPrompt) &&
          (!!selectedProduct ||
            productImages.length > 0 ||
            (savedProductData?.imageDataUrls?.length ?? 0) > 0 ||
            (savedProductData?.images?.length ?? 0) > 0)
        }
        generateBlockedReason={
          hasInsufficientCredits
            ? 'Purchase credits to generate posters'
            : !(
                  selectedProduct ||
                  productImages.length > 0 ||
                  (savedProductData?.imageDataUrls?.length ?? 0) > 0 ||
                  (savedProductData?.images?.length ?? 0) > 0
                )
              ? 'Add a product to generate'
              : !safeTrim(posterPrompt)
                ? 'Describe what you want to create'
                : null
        }
        onGenerate={() => void handleWorkspaceGenerate()}
        isGenerating={isGenerating || phase === 'generating'}
        thinkingMessages={thinkingMessages}
        creditsAlertSlot={
          hasInsufficientCredits ? <InsufficientCreditsAlert type="image" /> : null
        }
        brandReviewSlot={
          phase === 'brand-review' && brand ? (
            <div className="mb-8">
              <BrandCard
                brand={brand}
                editing={editing}
                onEdit={() => setEditing(true)}
                onChange={setBrand}
                onDone={() => setEditing(false)}
                onConfirm={handleBrandConfirm}
              />
            </div>
          ) : null
        }
        resultsSlot={
          phase === 'ready' && generatedPosters.length > 0 ? (
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
              onEditPoster={(idx) => setEditingPosterIndex(idx)}
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
          ) : null
        }
        onBackToCompose={() => setPhase('config')}
      />

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

        {/* New Session Modal (fallback — primary path auto-creates Untitled Poster) */}
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
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="fixed top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div 
              className="relative w-full h-full flex items-center justify-center p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewImageUrl}
                alt="Preview"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>
        )}

        {/* Poster Edit Modal */}
        {editingPosterIndex !== null && generatedPosters[editingPosterIndex] && (
          <PosterEditModal
            imageUrl={generatedPosters[editingPosterIndex]}
            posterIndex={editingPosterIndex}
            onClose={() => setEditingPosterIndex(null)}
            onRegenerate={(editPrompt) =>
              handleRegenerateWithEdit(
                generatedPosters[editingPosterIndex],
                editingPosterIndex,
                editPrompt
              )
            }
          />
        )}
    </div>
  );
}
// ============== Results gallery ==============

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
  onEditPoster,
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
  onEditPoster?: (index: number) => void;
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
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
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

  useEffect(() => {
    if (previewIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPreviewIndex(null);
      if (e.key === 'ArrowLeft') {
        setPreviewIndex((i) => (i === null ? i : (i - 1 + posters.length) % posters.length));
      }
      if (e.key === 'ArrowRight') {
        setPreviewIndex((i) => (i === null ? i : (i + 1) % posters.length));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewIndex, posters.length]);

  // Handle download - use blob-based approach so data URLs and remote URLs actually download
  const handleDownload = async (poster: string, idx: number) => {
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

  const previewImage = previewIndex !== null ? posters[previewIndex] : null;

  return (
    <>
      {/* Image Preview Modal */}
      {previewImage && previewIndex !== null && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          onClick={() => setPreviewIndex(null)}
        >
          <button
            onClick={() => setPreviewIndex(null)}
            className="fixed top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            aria-label="Close preview"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {posters.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous poster"
                className="fixed left-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewIndex((previewIndex - 1 + posters.length) % posters.length);
                }}
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Next poster"
                className="fixed right-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewIndex((previewIndex + 1) % posters.length);
                }}
              >
                →
              </button>
            </>
          )}
          
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
          
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex flex-wrap justify-center gap-2 z-50 px-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                void handleDownload(previewImage, previewIndex);
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-colors"
              style={{ backgroundColor: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}
            >
              Download
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void onSavePoster(previewImage, previewIndex);
              }}
              disabled={savingPoster === previewIndex}
              className="px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}
            >
              {savingPoster === previewIndex ? 'Saving…' : 'Save'}
            </button>
            {onEditPoster && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditPoster(previewIndex);
                  setPreviewIndex(null);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-colors"
                style={{ backgroundColor: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}
              >
                Edit
              </button>
            )}
            {onUseAsReferenceRequest && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUseAsReferenceRequest(previewImage, previewIndex);
                  setPreviewIndex(null);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-colors"
                style={{ backgroundColor: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}
              >
                Use as reference
              </button>
            )}
            {canCreateCampaigns && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void onCreateCampaign(previewImage, previewIndex);
                }}
                disabled={creatingCampaign === previewIndex}
                className="px-4 py-2 rounded-lg text-sm font-medium shadow-lg text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: colors.primary }}
              >
                {creatingCampaign === previewIndex ? 'Creating…' : 'Create campaign'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="w-full space-y-8">
          {/* Regeneration / Use as Reference Config Form - theme, prompt, aspect ratio, variants */}
          {(showRegeneratePrompt || pendingUseAsReference) && (
            <div className="rounded-2xl p-5 sm:p-6 space-y-5" style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.background }}>
              <h3 className="text-base font-semibold" style={{ color: colors.foreground }}>
                {pendingUseAsReference ? 'Use as design reference' : 'Regenerate'}
              </h3>
              {!pendingUseAsReference && (
                <p className="text-sm -mt-3" style={{ color: colors.mutedForeground }}>
                  Create a new creative direction / variant. To change this specific poster, use Edit instead.
                </p>
              )}

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
                <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>
                  {pendingUseAsReference ? 'Prompt' : 'What should we change?'}
                </label>
                <textarea
                  ref={regenerateTextareaRef}
                  value={regeneratePrompt}
                  onChange={(e) => onRegeneratePromptChange(e.target.value)}
                  placeholder="Make the headline more premium and give the product more visual focus…"
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
                    Refine · {config.variantCount} {config.variantCount === 1 ? 'poster' : 'posters'}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {posters.map((poster, idx) => (
              <div
                key={idx}
                className="group"
              >
                <p className="text-[11px] tracking-[0.14em] uppercase mb-2" style={{ color: colors.mutedForeground }}>
                  Poster {String(idx + 1).padStart(2, '0')}
                </p>
                {/* Poster - Clickable for preview, with menu overlay */}
                <div
                  className="rounded-xl overflow-visible cursor-pointer relative"
                  style={{ backgroundColor: 'hsl(0 0% 12%)', border: `1px solid hsl(0 0% 22%)` }}
                >
                  <div onClick={() => setPreviewIndex(idx)}>
                    <img
                      src={poster}
                      alt={`Generated poster ${idx + 1}`}
                      className="w-full h-auto block rounded-lg transition-transform duration-200 group-hover:scale-[1.02]"
                      style={{ imageRendering: 'auto' }}
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center rounded-lg pointer-events-none">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white bg-black/50 px-3 py-1.5 rounded-lg text-sm font-medium">
                        Preview
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
                          {onEditPoster && (
                          <button
                            onClick={() => {
                              onEditPoster(idx);
                              setOpenMenuIndex(null);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2"
                            style={{ color: colors.foreground }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit Poster
                          </button>
                          )}
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
                  <div className="mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onCreateCampaign(poster, idx)}
                      disabled={creatingCampaign === idx}
                      className="w-full px-3 py-2 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: 'transparent',
                        color: colors.primary,
                        border: `1px solid hsl(213 100% 55% / 0.35)`,
                      }}
                    >
                      {creatingCampaign === idx ? 'Creating…' : 'Use in campaign'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Regenerate — refine composer */}
          {!showRegeneratePrompt && !pendingUseAsReference && onRegenerate && (
            <div className="pt-6 border-t space-y-3" style={{ borderColor: colors.border }}>
              <p className="text-sm font-medium" style={{ color: colors.foreground }}>
                Want to change something?
              </p>
              <p className="text-sm" style={{ color: colors.mutedForeground }}>
                Refine the creative direction or generate new variants from your brief.
              </p>
              <button
                onClick={onRegenerate}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  backgroundColor: colors.muted,
                  color: colors.foreground,
                  border: `1px solid ${colors.border}`,
                }}
              >
                Refine poster
              </button>
            </div>
          )}
      </div>
    </>
  );
}
