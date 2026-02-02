// pages/creative-studio.tsx
// Creative Studio Landing Page - Refactored for modular architecture

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Sidebar from '@/app/web/src/components/Sidebar';
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
import { supabase } from '@/auth/supabase/client';

export default function CreativeStudioLanding() {
  const router = useRouter();

  // Session state
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  // Brand state
  const [brand, setBrand] = useState<BrandSnapshot | null>(null);
  const [showBrandOnboarding, setShowBrandOnboarding] = useState(false);
  const [showBrandGuidelineModal, setShowBrandGuidelineModal] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<'website' | 'manual'>('website');
  const [isAnalyzingBrand, setIsAnalyzingBrand] = useState(false);

  // Session naming modal state
  const [showNameModal, setShowNameModal] = useState(false);
  const [newSessionType, setNewSessionType] = useState<SessionType>('poster');
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Credits state
  const [credits, setCredits] = useState<number | null>(null);

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

  // ============== Load Sessions & Credits (after auth is ready) ==============

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

  useEffect(() => {
    if (!isAuthReady) return;

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
  }, [isAuthReady]);

  // ============== Load Brand from Database ==============

  const [isLoadingBrand, setIsLoadingBrand] = useState(true);

  useEffect(() => {
    if (!isAuthReady) return;

    async function loadBrandSnapshot() {
      setIsLoadingBrand(true);
      try {
        const response = await authFetch('/api/brand/snapshot');
        const data = await response.json();
        if (data.ok && data.brandSnapshot) {
          setBrand(data.brandSnapshot);
        } else {
          // No brand found - show the onboarding modal
          setShowBrandOnboarding(true);
        }
      } catch (err) {
        console.error('Error loading brand snapshot:', err);
        // On error, also show the onboarding modal
        setShowBrandOnboarding(true);
      } finally {
        setIsLoadingBrand(false);
      }
    }
    loadBrandSnapshot();
  }, [isAuthReady]);

  // ============== Save Brand to Database ==============

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
      alert('Please set up your brand first.');
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
          router.push(`/creative-studio/poster/${data.session.id}`);
        } else {
          router.push(`/creative-studio/video/${data.session.id}`);
        }
      } else {
        alert('Failed to create session: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error creating session:', err);
      alert('Failed to create session');
    } finally {
      setIsCreatingSession(false);
    }
  }

  function handleSessionClick(session: SessionListItem) {
    if (session.sessionType === 'poster') {
      router.push(`/creative-studio/poster/${session.id}`);
    } else {
      router.push(`/creative-studio/video/${session.id}`);
    }
  }

  // ============== Brand Handlers ==============

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

        // Only show the naming modal if user was trying to create a session
        if (newSessionType) {
          setShowNameModal(true);
        }
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

    // Only show the naming modal if user was trying to create a session
    if (newSessionType) {
      setShowNameModal(true);
    }
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

    // Only show the naming modal if user was trying to create a session
    if (newSessionType) {
      setShowNameModal(true);
    }
  }

  function updateBrandGuideline(updated: BrandSnapshot) {
    setBrand(updated);
    saveBrandSnapshot(updated);
    setShowBrandGuidelineModal(false);
  }

  // ============== Separate sessions by type ==============

  const posterSessions = sessions.filter((s) => s.sessionType === 'poster');
  const videoSessions = sessions.filter((s) => s.sessionType === 'video');

  // ============== Render ==============

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Sidebar - Without chat history */}
      <div className="flex-shrink-0 h-full">
        <Sidebar
          showChatHistory={false}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white flex-shrink-0">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Creative Studio</h1>
                <p className="text-gray-500 text-sm mt-1">
                  Create poster-ready creatives and video-first ad concepts
                </p>
              </div>
              {credits !== null && (
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg">
                  <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95c-.285.475-.507 1-.67 1.55H6a1 1 0 000 2h.013a9.358 9.358 0 000 1H6a1 1 0 100 2h.351c.163.55.385 1.075.67 1.55C7.721 15.216 8.768 16 10 16s2.279-.784 2.979-1.95a1 1 0 10-1.715-1.029c-.472.786-.96.979-1.264.979-.304 0-.792-.193-1.264-.979a4.265 4.265 0 01-.264-.521H10a1 1 0 100-2H8.017a7.36 7.36 0 010-1H10a1 1 0 100-2H8.472c.08-.185.167-.36.264-.521z" />
                  </svg>
                  <span className="font-semibold text-amber-700">{credits}</span>
                  <span className="text-amber-600 text-sm">credits</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Recent Sessions */}
            {sessions.length > 0 && (
              <div className="mb-12">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Sessions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sessions.slice(0, 6).map((session) => (
                    <button
                      key={session.id}
                      onClick={() => handleSessionClick(session)}
                      className="text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xl">
                          {session.sessionType === 'poster' ? '🖼️' : '🎬'}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            session.sessionType === 'poster'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {session.sessionType === 'poster' ? 'Poster' : 'Video'}
                        </span>
                      </div>
                      <h3 className="font-medium text-gray-900 truncate">{session.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTimestamp(session.updatedAt)}
                      </p>
                    </button>
                  ))}
                </div>

                {sessions.length > 6 && (
                  <div className="mt-4 text-center">
                    <span className="text-sm text-gray-500">
                      And {sessions.length - 6} more sessions...
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Brand Guideline Section */}
            {brand && (
              <div className="mb-12">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Brand Guideline</h2>
                  <button
                    onClick={() => setShowBrandGuidelineModal(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View / Edit
                  </button>
                </div>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="flex items-center gap-4">
                    {brand.logo && (
                      <img
                        src={brand.logo}
                        alt={brand.name}
                        className="h-12 w-12 object-contain rounded-lg border border-gray-200 bg-white p-1"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900">{brand.name}</h3>
                      <p className="text-sm text-gray-500">{brand.offering || brand.description}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Create New Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                What do you want to create?
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Poster Generation Card */}
                <button
                  onClick={handleStartPosterSession}
                  className="group relative aspect-square rounded-2xl border-2 border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-blue-500 transition-all flex flex-col items-center justify-center p-6 text-center"
                >
                  <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-blue-50 text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                    <span className="text-3xl">🖼️</span>
                  </div>
                  <div className="text-base font-semibold text-gray-900">Poster Generation</div>
                  <p className="mt-2 text-sm text-gray-500 max-w-xs">
                    Chat with AI to create high-conversion marketing posters.
                  </p>
                </button>

                {/* Video Generation Card */}
                <button
                  onClick={handleStartVideoSession}
                  className="group relative aspect-square rounded-2xl border-2 border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-purple-500 transition-all flex flex-col items-center justify-center p-6 text-center"
                >
                  <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-purple-50 text-purple-600 mb-4 group-hover:scale-110 transition-transform">
                    <span className="text-3xl">🎬</span>
                  </div>
                  <div className="text-base font-semibold text-gray-900">Video Generation</div>
                  <p className="mt-2 text-sm text-gray-500 max-w-xs">
                    Plan and generate video-first ad concepts and storyboards.
                  </p>
                </button>
              </div>
            </div>

            {/* Loading State */}
            {isLoadingSessions && (
              <div className="mt-8 flex items-center justify-center text-gray-500">
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
            onClose={() => setShowBrandGuidelineModal(false)}
          />
        )}
      </div>
    </div>
  );
}
