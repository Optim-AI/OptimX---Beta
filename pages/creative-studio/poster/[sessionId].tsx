// pages/creative-studio/poster/[sessionId].tsx
// Poster Generation Session Page

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/auth/supabase/client';
import Sidebar from '@/app/web/src/components/Sidebar';
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

  // Credits state
  const [credits, setCredits] = useState<number | null>(null);
  const [hasInsufficientCredits, setHasInsufficientCredits] = useState(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageIdCounter = useRef<number>(0);

  // ============== Load Session ==============
  
  useEffect(() => {
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
        // Handle 'new' session - don't fetch from API
        if (sessionId === 'new') {
          // Load brand from localStorage if available
          const storedBrand = localStorage.getItem('brand:snapshot');
          if (storedBrand) {
            setBrand(JSON.parse(storedBrand));
          } else {
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
        
        // Restore messages
        if (loadedSession.messages) {
          const restoredMessages: Message[] = loadedSession.messages.map((m: SerializedMessage) => ({
            ...m,
            images: undefined, // Images aren't stored in serialized messages
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
  }, [sessionId]);

  // ============== Load Poster Sessions for Sidebar ==============
  
  useEffect(() => {
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
      // Convert product images to data URLs for persistence
      const productImageDataUrls: string[] = [];
      if (savedProductData?.images) {
        for (const img of savedProductData.images.slice(0, 3)) {
          const dataUrl = await fileToDataUrl(img);
          productImageDataUrls.push(dataUrl);
        }
      }
      
      // Serialize messages (remove File objects)
      const serializedMessages: SerializedMessage[] = messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
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
  
  function addMessage(role: 'user' | 'system', content: string, images?: File[]) {
    const newMessage: Message = {
      id: generateId(),
      role,
      content,
      images,
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
  
  async function handleWebsiteBrandSetup(website: string) {
    setShowBrandOnboarding(false);
    setThinkingMessages(['Analyzing your website...']);
    
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
          logoUrl: data.brand.logoUrl,
          primaryColors: data.brand.primaryColors,
          fontStyles: data.brand.fontStyles,
          brandVoice: data.brand.brandVoice,
          coreValueProp: data.brand.coreValueProp,
        };
        
        setBrand(brandSnapshot);
        localStorage.setItem('brand:snapshot', JSON.stringify(brandSnapshot));
        setPhase('brand-review');
        addMessage('system', `I've analyzed your website and extracted your brand information. Please review it below.`);
      } else {
        addMessage('system', 'I had trouble analyzing that website. Please try a different URL or set up your brand manually.');
        setShowBrandOnboarding(true);
      }
    } catch (err) {
      console.error('Brand analysis error:', err);
      addMessage('system', 'There was an error analyzing your website. Please try again or set up your brand manually.');
      setShowBrandOnboarding(true);
    } finally {
      setThinkingMessages([]);
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
    setPhase('product-input');
    addMessage('system', `No problem! You can set up your brand guidelines later. Let's start creating - tell me about what you want to promote.`);
  }

  function handleBrandConfirm() {
    if (brand) {
      localStorage.setItem('brand:snapshot', JSON.stringify(brand));
    }
    setPhase('product-input');
    addMessage('system', `Great! Your brand is set. Now tell me about the product or service you want to promote, or upload some product images.`);
  }

  function updateBrandGuideline(updated: BrandSnapshot) {
    setBrand(updated);
    localStorage.setItem('brand:snapshot', JSON.stringify(updated));
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
      // Build the generation prompt
      const hasProductImage = savedProductData?.images && savedProductData.images.length > 0;
      
      const prompt = buildPosterPrompt({
        userRequest: posterPrompt || savedProductData?.prompt || '',
        theme: config.theme,
        aspectRatio: config.aspectRatio,
        brand,
        hasProductImage: !!hasProductImage,
      });
      
      // Generate 3 variants
      const posters: string[] = [];
      let creditError = false;
      let lastError = '';
      
      for (let i = 0; i < 3; i++) {
        setThinkingMessages([`Generating variant ${i + 1} of 3...`]);
        
        const response = await authFetch('/api/generate-campaign', {
          method: 'POST',
          body: JSON.stringify({
            prompt: prompt,
            images: savedProductData?.imageDataUrls || [],
            aspectRatio: config.aspectRatio,
            variant: i + 1,
          }),
        });
        
        const data = await response.json();
        
        if (data.ok && data.image) {
          posters.push(data.image);
          // Update credits if returned
          if (data.creditsRemaining !== undefined) {
            setCredits(data.creditsRemaining);
          }
        } else if (data.error) {
          console.error(`Poster generation ${i + 1} failed:`, data.error);
          lastError = data.error;
          // Check for credit-related errors
          if (data.error.toLowerCase().includes('credit') || response.status === 402) {
            creditError = true;
            setCredits(0);
            setHasInsufficientCredits(true);
            break; // Stop trying if no credits
          }
        }
      }
      
      if (posters.length > 0) {
        setGeneratedPosters(posters);
        setPhase('ready');
        addMessage('system', `Here ${posters.length === 1 ? 'is your poster' : `are your ${posters.length} poster variants`}! Click on any to save it or use it in a campaign.`);
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

  function handleUseAsReference(url: string, index: number) {
    // TODO: Implement use as reference functionality
    alert('Use as reference feature coming soon!');
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
      // Set product data first, then trigger the submit which will add the message
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
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === 'user' ? (
                    <UserBubble message={msg} />
                  ) : (
                    <SystemBubble images={msg.images}>
                      {msg.content}
                    </SystemBubble>
                  )}
                </div>
              ))}

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
}: {
  config: PosterConfig;
  onConfigChange: (config: PosterConfig) => void;
  onSubmit: () => void;
}) {
  const themes = POSTER_THEMES;
  const aspectRatios = ASPECT_RATIOS;

  return (
    <div className="flex gap-4 max-w-3xl ml-auto">
      <div className="flex-shrink-0 w-8" />
      <div className="flex-1">
        <div className="border-2 border-gray-200 rounded-xl p-6 bg-white space-y-6 hover:border-gray-300 shadow-sm">
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

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!config.theme}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Generate 3 Variants
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
}) {
  return (
    <div className="flex gap-4 max-w-4xl ml-auto">
      <div className="flex-shrink-0 w-8" />
      <div className="flex-1 space-y-8">
        {showRegeneratePrompt && (
          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Edit your prompt or add changes
            </label>
            <textarea
              value={regeneratePrompt}
              onChange={(e) => onRegeneratePromptChange(e.target.value)}
              placeholder="e.g., Make it more colorful..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
              rows={3}
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={onRegenerateSubmit}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
              >
                Generate
              </button>
              <button
                onClick={onRegenerateCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {posters.map((poster, idx) => (
            <div key={idx} className="group">
              <div className="mb-4 rounded-lg overflow-hidden bg-gray-50 border border-gray-100">
                <img
                  src={poster}
                  alt={`Generated poster ${idx + 1}`}
                  className="w-full h-auto block"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onCreateCampaign(poster, idx)}
                  disabled={creatingCampaign === idx}
                  className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingCampaign === idx ? 'Creating...' : 'Use in Campaign'}
                </button>

                <button
                  onClick={() => onSavePoster(poster, idx)}
                  disabled={savingPoster === idx}
                  className="p-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                  title="Save to Library"
                >
                  {savingPoster === idx ? '...' : '💾'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {!showRegeneratePrompt && (
          <div className="pt-4 border-t border-gray-100">
            <button
              onClick={onRegenerate}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Generate New Variants
            </button>
          </div>
        )}
      </div>
      <div className="flex-shrink-0 w-8" />
    </div>
  );
}
