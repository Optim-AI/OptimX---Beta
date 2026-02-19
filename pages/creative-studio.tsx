// pages/creative-studio.tsx
// Creative Studio Landing Page - Refactored for modular architecture

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { showAlert, showError } from '@/app/web/src/components/ui/AlertModal';
import Link from 'next/link';
import Sidebar from '@/app/web/src/components/Sidebar';
import colors from '@/lib/ui/colors';
import {
  type BrandSnapshot,
  type SessionListItem,
  type SessionType,
  SessionNameModal,
  BrandOnboarding,
  BrandGuidelineModal,
  formatTimestamp,
} from '@/app/web/src/components/creative-studio';
import { authFetch } from '@/lib/utils';

export default function CreativeStudioLanding() {
  const router = useRouter();

  // Session state
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  // Brand state
  const [brand, setBrand] = useState<BrandSnapshot | null>(null);
  const [showBrandOnboarding, setShowBrandOnboarding] = useState(false);
  const [showBrandGuidelineModal, setShowBrandGuidelineModal] = useState(false);
  const [isAnalyzingBrand, setIsAnalyzingBrand] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<'website' | 'manual'>('website');

  // Session naming modal state
  const [showNameModal, setShowNameModal] = useState(false);
  const [newSessionType, setNewSessionType] = useState<SessionType>('poster');
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Credits state
  const [imageCredits, setImageCredits] = useState<number | null>(null);
  const [videoCredits, setVideoCredits] = useState<number | null>(null);

  // ============== Load Sessions & Credits ==============

  useEffect(() => {
    async function loadCredits() {
      try {
        const response = await authFetch('/api/credits/balance');
        const data = await response.json();
        if (data.success) {
          setImageCredits(data.imageCredits?.total ?? 0);
          setVideoCredits(data.videoCredits?.total ?? 0);
        }
      } catch (err) {
        console.error('Error loading credits:', err);
      }
    }
    loadCredits();
  }, []);

  useEffect(() => {
    async function loadSessions() {
      setIsLoadingSessions(true);
      try {
        const response = await authFetch('/api/creative-studio/sessions');
        const data = await response.json();

        if (data.ok) {
          setSessions(
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
        console.error('Error loading sessions:', err);
      } finally {
        setIsLoadingSessions(false);
      }
    }

    loadSessions();
  }, []);

  // ============== Load Brand from localStorage & show entry popup ==============

  useEffect(() => {
    const storedBrand = localStorage.getItem('brand:snapshot');
    if (storedBrand) {
      try {
        const parsed = JSON.parse(storedBrand);
        setBrand(parsed);
        // Only show brand guideline modal on first visit (not every page entry)
        if (!localStorage.getItem('brand:guideline_seen')) {
          setShowBrandGuidelineModal(true);
        }
      } catch (e) {
        console.error('Failed to parse stored brand:', e);
        setShowBrandOnboarding(true);
      }
    } else {
      // No stored brand: show onboarding so user can analyze and store brand guideline
      setShowBrandOnboarding(true);
    }
  }, []);

  // ============== Session Handlers ==============

  function handleStartPosterSession() {
    if (!brand) {
      setShowBrandOnboarding(true);
      setNewSessionType('poster');
      return;
    }
    setNewSessionType('poster');
    setShowNameModal(true);
  }

  function handleStartVideoSession() {
    if (!brand) {
      setShowBrandOnboarding(true);
      setNewSessionType('video');
      return;
    }
    setNewSessionType('video');
    setShowNameModal(true);
  }

  async function handleCreateSession(name: string) {
    if (!brand) {
      showAlert('Please set up your brand first.', 'Brand Required');
      return;
    }

    setIsCreatingSession(true);

    try {
      const response = await authFetch('/api/creative-studio/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name,
          sessionType: newSessionType,
          brandSnapshot: brand,
          phase: newSessionType === 'poster' ? 'input' : undefined,
        }),
      });

      const data = await response.json();

      if (data.ok && data.session) {
        setShowNameModal(false);
        // Navigate to the session page
        if (newSessionType === 'poster') {
          router.push(`/creative-studio/poster?id=${data.session.id}`);
        } else {
          router.push(`/creative-studio/video?id=${data.session.id}`);
        }
      } else {
        showError('Failed to create session: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error creating session:', err);
      showError('Failed to create session');
    } finally {
      setIsCreatingSession(false);
    }
  }

  function handleSessionClick(session: SessionListItem) {
    if (session.sessionType === 'poster') {
      router.push(`/creative-studio/poster?id=${session.id}`);
    } else {
      router.push(`/creative-studio/video?id=${session.id}`);
    }
  }

  // ============== Brand Handlers ==============

  async function handleWebsiteBrandSetup(website: string) {
    setIsAnalyzingBrand(true);
    // Keep onboarding modal open so user sees "Analyzing..." UI

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
            ? {
                primary: result.colors.primary ?? undefined,
                secondary: result.colors.secondary ?? undefined,
                accent: result.colors.accent ?? undefined,
              }
            : undefined,
        };

        setBrand(brandSnapshot);
        localStorage.setItem('brand:snapshot', JSON.stringify(brandSnapshot));
        setShowBrandOnboarding(false);
        // Show stored brand guideline in the creative studio page
        setShowBrandGuidelineModal(true);
      } else {
        const errorMsg = data.error || 'Could not analyze website.';
        setShowBrandOnboarding(true);
        showError(`${errorMsg} Please try manual setup.`);
      }
    } catch (err: any) {
      console.error('Brand analysis error:', err);
      setShowBrandOnboarding(true);
      showError(`Error analyzing website: ${err?.message || 'Unknown error'}. Please try manual setup.`);
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
    localStorage.setItem('brand:snapshot', JSON.stringify(brandSnapshot));
    setShowBrandOnboarding(false);
    // Show stored brand guideline so user can view/edit
    setShowBrandGuidelineModal(true);
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
    localStorage.setItem('brand:snapshot', JSON.stringify(minimalBrand));
    setShowBrandOnboarding(false);
    // Show brand guideline so user can fill in details later
    setShowBrandGuidelineModal(true);
  }

  function updateBrandGuideline(updated: BrandSnapshot) {
    setBrand(updated);
    localStorage.setItem('brand:snapshot', JSON.stringify(updated));
    localStorage.setItem('brand:guideline_seen', 'true');
    setShowBrandGuidelineModal(false);
  }

  // ============== Separate sessions by type ==============

  const posterSessions = sessions.filter((s) => s.sessionType === 'poster');
  const videoSessions = sessions.filter((s) => s.sessionType === 'video');

  // ============== Render ==============

  return (
    <div className="h-screen flex overflow-hidden app-page">
      {/* Sidebar - Without chat history */}
      <div className="flex-shrink-0 h-full">
        <Sidebar
          showChatHistory={false}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ backgroundColor: colors.card, borderLeft: `1px solid ${colors.border}` }}>
        {/* Header */}
        <div className="border-b flex-shrink-0" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold" style={{ color: colors.foreground }}>Creative Studio</h1>
                <p className="text-sm mt-1" style={{ color: colors.mutedForeground }}>
                  Create poster-ready creatives and video-first ad concepts
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Image Credits */}
                {imageCredits !== null && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'hsl(213 100% 55% / 0.15)', border: '1px solid hsl(213 100% 55% / 0.35)' }}>
                    <svg className="w-5 h-5" style={{ color: colors.primary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-semibold" style={{ color: colors.primary }}>{imageCredits}</span>
                    <span className="text-sm" style={{ color: colors.primary }}>images</span>
                  </div>
                )}

                {/* Video Credits */}
                {videoCredits !== null && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'hsl(270 80% 55% / 0.15)', border: '1px solid hsl(270 80% 55% / 0.3)' }}>
                    <svg className="w-5 h-5" style={{ color: 'hsl(270 80% 65%)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="font-semibold" style={{ color: 'hsl(270 80% 70%)' }}>{videoCredits}s</span>
                    <span className="text-sm" style={{ color: 'hsl(270 80% 65%)' }}>video</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Guided banner (shown when user skipped onboarding) */}
            {router.query.guided === '1' && (
              <div className="mb-6 p-4 rounded-xl flex items-center justify-between gap-4" style={{ backgroundColor: 'hsl(213 100% 55% / 0.12)', border: `1px solid hsl(213 100% 55% / 0.35)` }}>
                <div>
                  <p className="font-medium" style={{ color: colors.foreground }}>Quick tip</p>
                  <p className="text-sm mt-0.5" style={{ color: colors.mutedForeground }}>
                    Set up your brand and workspace for better results. You can do this anytime from your brand settings.
                  </p>
                </div>
                <Link
                  href="/onboardingInfo"
                  className="shrink-0 px-4 py-2 rounded-lg font-medium text-sm"
                  style={{ backgroundColor: colors.primary, color: 'white' }}
                >
                  Set up workspace
                </Link>
              </div>
            )}

            {/* AI disclaimer note */}
            <div className="mb-8 p-4 rounded-xl relative z-10" style={{ backgroundColor: 'hsl(30 60% 22%)', border: '1px solid hsl(30 50% 40%)' }}>
              <p className="text-sm leading-relaxed" style={{ color: '#FAFAFA' }}>
                <strong style={{ color: '#FAFAFA' }}>Note:</strong> If a generation glitches or looks incorrect,{' '}
                <Link href="/report" className="font-medium underline" style={{ color: 'hsl(38 92% 65%)' }}>
                  send us a screenshot
                </Link>
                {' '}and we&apos;ll refund the credit as an apology. We&apos;re continuously improving the system to deliver better results every day.
              </p>
            </div>

            {/* Recent Sessions */}
            {sessions.length > 0 && (
              <div className="mb-12">
                <h2 className="text-lg font-semibold mb-4" style={{ color: colors.foreground }}>Recent Sessions</h2>
                <div className="max-h-[420px] overflow-y-auto overflow-x-hidden rounded-xl pr-1 -mr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => handleSessionClick(session)}
                        className="text-left p-4 rounded-xl hover:shadow-sm transition-all"
                        style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xl">
                            {session.sessionType === 'poster' ? '🖼️' : '🎬'}
                          </span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={session.sessionType === 'poster' ? { background: 'hsl(213 100% 55% / 0.2)', color: colors.primary } : { background: 'hsl(270 80% 55% / 0.2)', color: 'hsl(270 80% 70%)' }}
                          >
                            {session.sessionType === 'poster' ? 'Poster' : 'Video'}
                          </span>
                        </div>
                        <h3 className="font-medium truncate" style={{ color: colors.foreground }}>{session.name}</h3>
                        <p className="text-xs mt-1" style={{ color: colors.mutedForeground }}>
                          {formatTimestamp(session.updatedAt)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Brand Guideline Section */}
            {brand && (
              <div className="mb-12">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold" style={{ color: colors.foreground }}>Brand Guideline</h2>
                  <button
                    onClick={() => setShowBrandGuidelineModal(true)}
                    className="text-sm font-medium"
                    style={{ color: colors.primary }}
                  >
                    View / Edit
                  </button>
                </div>
                <div className="p-4 rounded-xl" style={{ backgroundColor: colors.muted, border: `1px solid ${colors.border}` }}>
                  <div className="flex items-center gap-4">
                    {brand.logo && (
                      <img
                        src={brand.logo}
                        alt={brand.name}
                        className="h-12 w-12 object-contain rounded-lg p-1"
                        style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.card }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      <h3 className="font-semibold" style={{ color: colors.foreground }}>{brand.name}</h3>
                      <p className="text-sm" style={{ color: colors.mutedForeground }}>{brand.offering || brand.description}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Create New Section */}
            <div>
              <h2 className="text-lg font-semibold mb-4" style={{ color: colors.foreground }}>
                What do you want to create?
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Poster Generation Card */}
                <button
                  onClick={handleStartPosterSession}
                  className="group relative aspect-square rounded-2xl border-2 shadow-sm transition-all flex flex-col items-center justify-center p-6 text-center"
                  style={{ borderColor: colors.border, backgroundColor: colors.background }}
                >
                  <div className="flex items-center justify-center w-16 h-16 rounded-xl mb-4 group-hover:scale-110 transition-transform" style={{ backgroundColor: 'hsl(213 100% 55% / 0.2)', color: colors.primary }}>
                    <span className="text-3xl">🖼️</span>
                  </div>
                  <div className="text-base font-semibold" style={{ color: colors.foreground }}>Poster Generation</div>
                  <p className="mt-2 text-sm max-w-xs" style={{ color: colors.mutedForeground }}>
                    Chat with AI to create high-conversion marketing posters.
                  </p>
                </button>

                {/* Video Generation Card */}
                <button
                  onClick={handleStartVideoSession}
                  className="group relative aspect-square rounded-2xl border-2 shadow-sm transition-all flex flex-col items-center justify-center p-6 text-center"
                  style={{ borderColor: colors.border, backgroundColor: colors.background }}
                >
                  <div className="flex items-center justify-center w-16 h-16 rounded-xl mb-4 group-hover:scale-110 transition-transform" style={{ backgroundColor: 'hsl(270 80% 55% / 0.2)', color: 'hsl(270 80% 70%)' }}>
                    <span className="text-3xl">🎬</span>
                  </div>
                  <div className="text-base font-semibold" style={{ color: colors.foreground }}>Video Generation</div>
                  <p className="mt-2 text-sm max-w-xs" style={{ color: colors.mutedForeground }}>
                    Plan and generate video-first ad concepts and storyboards.
                  </p>
                </button>
              </div>
            </div>

            {/* Loading State */}
            {isLoadingSessions && (
              <div className="mt-8 flex items-center justify-center" style={{ color: colors.mutedForeground }}>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-gray-600 mr-2" />
                Loading sessions...
              </div>
            )}
          </div>
        </div>

        {/* Session Name Modal */}
        <SessionNameModal
          isOpen={showNameModal}
          sessionType={newSessionType}
          onClose={() => setShowNameModal(false)}
          onSubmit={handleCreateSession}
          isLoading={isCreatingSession}
        />

        {/* Brand Onboarding Modal */}
        {showBrandOnboarding && (
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
            onClose={() => {
              localStorage.setItem('brand:guideline_seen', 'true');
              setShowBrandGuidelineModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
