// BrandOnboarding.tsx
// Brand onboarding modal for first-time users

import React, { useState } from 'react';

type BrandOnboardingProps = {
  mode: "website" | "manual";
  onModeChange: (mode: "website" | "manual") => void;
  onWebsiteSubmit: (website: string) => void;
  onManualSubmit: (data: {
    name: string;
    offering: string;
    audience: string;
    personality?: string;
    colors?: { primary?: string; secondary?: string; accent?: string };
    tagline?: string;
  }) => void;
  onSkip: () => void;
};

export default function BrandOnboarding({
  mode,
  onModeChange,
  onWebsiteSubmit,
  onManualSubmit,
  onSkip,
}: BrandOnboardingProps) {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [manualForm, setManualForm] = useState({
    name: "",
    offering: "",
    audience: "",
    personality: "",
    primaryColor: "",
    secondaryColor: "",
    accentColor: "",
    tagline: "",
  });

  function handleWebsiteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (websiteUrl.trim()) {
      onWebsiteSubmit(websiteUrl.trim());
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualForm.name && manualForm.offering && manualForm.audience) {
      onManualSubmit({
        name: manualForm.name,
        offering: manualForm.offering,
        audience: manualForm.audience,
        personality: manualForm.personality || undefined,
        colors: {
          primary: manualForm.primaryColor || undefined,
          secondary: manualForm.secondaryColor || undefined,
          accent: manualForm.accentColor || undefined,
        },
        tagline: manualForm.tagline || undefined,
      });
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Prevent closing by clicking outside - modal is blocking
        if (e.target === e.currentTarget) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Set Up Your Brand</h2>
            <p className="text-gray-600 text-sm mt-1">
              Help me understand your brand so I can create consistent, on-brand creatives for you.
            </p>
          </div>
          <button
            onClick={onSkip}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Skip
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onModeChange("website")}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "website"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              From Website
            </button>
            <button
              onClick={() => onModeChange("manual")}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === "manual"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Manual Setup
            </button>
          </div>
        </div>

        {/* Website Mode */}
        {mode === "website" && (
          <form onSubmit={handleWebsiteSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Website URL
              </label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                I'll analyze your website to extract brand information automatically.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={!websiteUrl.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Analyze & Save
              </button>
            </div>
          </form>
        )}

        {/* Manual Mode */}
        {mode === "manual" && (
          <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business / Brand Name *
              </label>
              <input
                type="text"
                value={manualForm.name}
                onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                placeholder="Your Brand Name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What do you sell or offer? *
              </label>
              <input
                type="text"
                value={manualForm.offering}
                onChange={(e) => setManualForm({ ...manualForm, offering: e.target.value })}
                placeholder="e.g., Premium coffee, Digital marketing services"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Who is your target audience? *
              </label>
              <input
                type="text"
                value={manualForm.audience}
                onChange={(e) => setManualForm({ ...manualForm, audience: e.target.value })}
                placeholder="e.g., Young professionals, Small business owners"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brand Personality
              </label>
              <select
                value={manualForm.personality}
                onChange={(e) => setManualForm({ ...manualForm, personality: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select personality...</option>
                <option value="minimal">Minimal</option>
                <option value="bold">Bold</option>
                <option value="playful">Playful</option>
                <option value="premium">Premium</option>
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tagline or Key Message (Optional)
              </label>
              <input
                type="text"
                value={manualForm.tagline}
                onChange={(e) => setManualForm({ ...manualForm, tagline: e.target.value })}
                placeholder="e.g., Quality First, Always"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={!manualForm.name || !manualForm.offering || !manualForm.audience}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Brand Guideline
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
