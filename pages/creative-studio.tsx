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

  // ============== Load Brand from localStorage ==============

  useEffect(() => {
    const storedBrand = localStorage.getItem('brand:snapshot');
    if (storedBrand) {
      try {
        setBrand(JSON.parse(storedBrand));
      } catch (e) {
        console.error('Failed to parse stored brand:', e);
      }
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
          router.push(`/creative-studio/poster?id=${data.session.id}`);
        } else {
          router.push(`/creative-studio/video?id=${data.session.id}`);
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
      router.push(`/creative-studio/poster?id=${session.id}`);
    } else {
      router.push(`/creative-studio/video?id=${session.id}`);
    }
  }

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
          logoUrl: data.brand.logoUrl,
          primaryColors: data.brand.primaryColors,
          fontStyles: data.brand.fontStyles,
          brandVoice: data.brand.brandVoice,
          coreValueProp: data.brand.coreValueProp,
        };

        setBrand(brandSnapshot);
        localStorage.setItem('brand:snapshot', JSON.stringify(brandSnapshot));

        // Now show the naming modal
        setShowNameModal(true);
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

    // Now show the naming modal
    setShowNameModal(true);
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

    // Now show the naming modal
    setShowNameModal(true);
  }

  function updateBrandGuideline(updated: BrandSnapshot) {
    setBrand(updated);
    localStorage.setItem('brand:snapshot', JSON.stringify(updated));
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
              <div className="flex items-center gap-3">
                {/* Image Credits */}
                {imageCredits !== null && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                    <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-semibold text-blue-700">{imageCredits}</span>
                    <span className="text-blue-600 text-sm">images</span>
                  </div>
                )}

                {/* Video Credits */}
                {videoCredits !== null && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                    <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="font-semibold text-purple-700">{videoCredits}s</span>
                    <span className="text-purple-600 text-sm">video</span>
                  </div>
                )}
              </div>
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
