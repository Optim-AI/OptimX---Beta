// BrandGuidelineModal.tsx
// Modal for viewing and editing brand guidelines

import React, { useState } from 'react';
import type { BrandSnapshot } from './types';
import colors from '@/lib/ui/colors';

type BrandGuidelineModalProps = {
  brand: BrandSnapshot;
  onUpdate: (updated: BrandSnapshot) => void;
  onClose: () => void;
  /** Optional: when provided, shows "Website set up" option in edit flow */
  onWebsiteAnalyze?: (website: string) => Promise<BrandSnapshot | null>;
};

export default function BrandGuidelineModal({
  brand,
  onUpdate,
  onClose,
  onWebsiteAnalyze,
}: BrandGuidelineModalProps) {
  const [editing, setEditing] = useState(false);
  const [editMode, setEditMode] = useState<'choice' | 'website' | 'manual'>('choice');
  const [formData, setFormData] = useState<BrandSnapshot>(brand);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  function handleSave() {
    onUpdate(formData);
    setEditing(false);
    setEditMode('choice');
  }

  function handleCancelEdit() {
    setEditing(false);
    setEditMode('choice');
    setFormData(brand);
    setWebsiteUrl('');
  }

  async function handleWebsiteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!websiteUrl.trim() || !onWebsiteAnalyze) return;
    setIsAnalyzing(true);
    try {
      const result = await onWebsiteAnalyze(websiteUrl.trim());
      if (result) {
        onUpdate(result);
        setEditing(false);
        setEditMode('choice');
        setWebsiteUrl('');
      }
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
        <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: colors.border }}>
          <div>
            <h2 className="text-2xl font-semibold" style={{ color: colors.foreground }}>Brand Guideline</h2>
            <p className="text-sm mt-1" style={{ color: colors.mutedForeground }}>
              Your brand information is used automatically in all creatives.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: colors.mutedForeground }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!editing ? (
            <>
              {brand.logo && (
                <div>
                  <label className="block text-sm font-medium mb-2"
                    style={{ color: colors.foreground }}>Logo</label>
                  <div className="flex items-center gap-4">
                    <img
                      src={brand.logo}
                      alt={`${brand.name} logo`}
                      className="h-16 w-auto object-contain rounded-lg p-2"
                      style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.card }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <a
                      href={brand.logo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:opacity-90 underline"
                    style={{ color: colors.primary }}
                    >
                      View full size
                    </a>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1"
                    style={{ color: colors.foreground }}>Brand Name</label>
                <p style={{ color: colors.foreground }}>{brand.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1"
                    style={{ color: colors.foreground }}>Description</label>
                <p style={{ color: colors.foreground }}>{brand.description}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1"
                    style={{ color: colors.foreground }}>Target Audience</label>
                <p style={{ color: colors.foreground }}>{brand.audience}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1"
                    style={{ color: colors.foreground }}>Offering</label>
                <p style={{ color: colors.foreground }}>{brand.offering}</p>
              </div>
              {brand.tagline && (
                <div>
                  <label className="block text-sm font-medium mb-1"
                    style={{ color: colors.foreground }}>Tagline</label>
                  <p style={{ color: colors.foreground }}>{brand.tagline}</p>
                </div>
              )}
              <div className="flex justify-end pt-4 border-t" style={{ borderColor: colors.border }}>
                <button
                  onClick={() => {
                    setEditing(true);
                    setEditMode('choice');
                  }}
                  className="px-4 py-2 text-white rounded-lg font-medium hover:opacity-90 transition-colors"
                  style={{ backgroundColor: colors.primary, color: colors.primaryForeground }}
                >
                  Edit
                </button>
              </div>
            </>
          ) : editMode === 'choice' ? (
            <>
              <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                How would you like to update your brand guideline?
              </p>
              <div className="flex gap-4">
                {onWebsiteAnalyze && (
                  <button
                    onClick={() => setEditMode('website')}
                    className="flex-1 px-6 py-4 rounded-lg border-2 text-left transition-colors"
                    style={{ borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground }}
                  >
                    <span className="block font-semibold mb-1" style={{ color: colors.foreground }}>Website set up</span>
                    <span className="text-sm" style={{ color: colors.mutedForeground }}>
                      Analyze your website to extract brand information automatically.
                    </span>
                  </button>
                )}
                <button
                  onClick={() => setEditMode('manual')}
                  className="flex-1 px-6 py-4 rounded-lg border-2 text-left transition-colors"
                  style={{ borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground }}
                >
                  <span className="block font-semibold mb-1" style={{ color: colors.foreground }}>Manual set up</span>
                  <span className="text-sm" style={{ color: colors.mutedForeground }}>
                    Enter your brand details directly.
                  </span>
                </button>
              </div>
              <div className="flex justify-end pt-4 border-t" style={{ borderColor: colors.border }}>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 transition-colors"
                  style={{ color: colors.mutedForeground }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : editMode === 'website' ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setEditMode('choice')}
                  className="text-sm"
                  style={{ color: colors.primary }}
                >
                  ← Back
                </button>
              </div>
              <form onSubmit={handleWebsiteSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourwebsite.com"
                    className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                    style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.foreground }}
                    disabled={isAnalyzing}
                  />
                  <p className="text-xs mt-1" style={{ color: colors.mutedForeground }}>
                    We&apos;ll analyze your website to extract brand information automatically.
                  </p>
                </div>
                {isAnalyzing && (
                  <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: 'hsl(213 100% 55% / 0.15)', border: `1px solid hsl(213 100% 55% / 0.3)` }}>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent" style={{ borderColor: colors.primary }} />
                    <span className="text-sm font-medium" style={{ color: colors.foreground }}>Analyzing your website... This may take a moment.</span>
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditMode('choice')}
                    className="px-4 py-2 transition-colors"
                    style={{ color: colors.mutedForeground }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!websiteUrl.trim() || isAnalyzing}
                    className="px-4 py-2 text-white rounded-lg font-medium hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: colors.primary, color: colors.primaryForeground }}
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Analyze & Update'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setEditMode('choice')}
                  className="text-sm"
                  style={{ color: colors.primary }}
                >
                  ← Back
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2"
                    style={{ color: colors.foreground }}>Logo URL (Optional)</label>
                <div className="flex items-center gap-4">
                  {formData.logo && (
                    <img
                      src={formData.logo}
                      alt={`${formData.name} logo`}
                      className="h-16 w-auto object-contain rounded-lg p-2"
                      style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.card }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex-1">
                    <input
                      type="url"
                      value={formData.logo || ""}
                      onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                      placeholder="https://example.com/logo.png"
                      className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(213_100%_55%)]"
                    style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.foreground }}
                    />
                    <p className="text-xs mt-1"
                    style={{ color: colors.mutedForeground }}>
                      {formData.logo ? "Update logo URL or leave empty to remove" : "Enter a URL to add your logo"}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2"
                    style={{ color: colors.foreground }}>Brand Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(213_100%_55%)]"
                    style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.foreground }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2"
                    style={{ color: colors.foreground }}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(213_100%_55%)]"
                    style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.foreground }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2"
                    style={{ color: colors.foreground }}>Target Audience</label>
                <input
                  type="text"
                  value={formData.audience}
                  onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(213_100%_55%)]"
                    style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.foreground }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2"
                    style={{ color: colors.foreground }}>Offering</label>
                <input
                  type="text"
                  value={formData.offering}
                  onChange={(e) => setFormData({ ...formData, offering: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(213_100%_55%)]"
                    style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.foreground }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2"
                    style={{ color: colors.foreground }}>Tagline</label>
                <input
                  type="text"
                  value={formData.tagline || ""}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(213_100%_55%)]"
                    style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.foreground }}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t"
              style={{ borderColor: colors.border }}>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 transition-colors"
                  style={{ color: colors.mutedForeground }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-white rounded-lg font-medium hover:opacity-90 transition-colors"
                  style={{ backgroundColor: colors.primary, color: colors.primaryForeground }}
                >
                  Save Changes
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
