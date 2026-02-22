// BrandGuidelineModal.tsx
// Modal for viewing and editing brand guidelines

import React, { useState } from 'react';
import type { BrandSnapshot } from './types';
import colors from '@/lib/ui/colors';

type BrandGuidelineModalProps = {
  brand: BrandSnapshot;
  onUpdate: (updated: BrandSnapshot) => void;
  onClose: () => void;
  onWebsiteReanalyze?: (website: string) => Promise<void>;
  isAnalyzingBrand?: boolean;
};

export default function BrandGuidelineModal({
  brand,
  onUpdate,
  onClose,
  onWebsiteReanalyze,
  isAnalyzingBrand = false,
}: BrandGuidelineModalProps) {
  const [editing, setEditing] = useState(false);
  const [editMode, setEditMode] = useState<'website' | 'manual'>('manual');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [formData, setFormData] = useState<BrandSnapshot>(brand);

  function handleSave() {
    onUpdate(formData);
    setEditing(false);
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
              {brand.tone && (
                <div>
                  <label className="block text-sm font-medium mb-1"
                    style={{ color: colors.foreground }}>Tone</label>
                  <p className="capitalize"
                    style={{ color: colors.foreground }}>{brand.tone}</p>
                </div>
              )}
              {brand.personality && (
                <div>
                  <label className="block text-sm font-medium mb-1"
                    style={{ color: colors.foreground }}>Personality</label>
                  <p className="capitalize"
                    style={{ color: colors.foreground }}>{brand.personality}</p>
                </div>
              )}
              {brand.tagline && (
                <div>
                  <label className="block text-sm font-medium mb-1"
                    style={{ color: colors.foreground }}>Tagline</label>
                  <p style={{ color: colors.foreground }}>{brand.tagline}</p>
                </div>
              )}
              {/* Primary Colors */}
              {brand.primaryColors && brand.primaryColors.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2"
                    style={{ color: colors.foreground }}>Primary Colors</label>
                  <div className="flex gap-3 flex-wrap">
                    {brand.primaryColors.map((color, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded border"
                          style={{ borderColor: colors.border, backgroundColor: color }}
                        />
                        <span className="text-sm"
                    style={{ color: colors.mutedForeground }}>{color}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legacy Colors */}
              {brand.colors && !brand.primaryColors && (
                <div>
                  <label className="block text-sm font-medium mb-2"
                    style={{ color: colors.foreground }}>Brand Colors</label>
                  <div className="flex gap-3">
                    {brand.colors.primary && (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded border"
                          style={{ borderColor: colors.border, backgroundColor: brand.colors.primary }}
                        />
                        <span className="text-sm"
                    style={{ color: colors.mutedForeground }}>Primary</span>
                      </div>
                    )}
                    {brand.colors.secondary && (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded border"
                          style={{ borderColor: colors.border, backgroundColor: brand.colors.secondary }}
                        />
                        <span className="text-sm"
                    style={{ color: colors.mutedForeground }}>Secondary</span>
                      </div>
                    )}
                    {brand.colors.accent && (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded border"
                          style={{ borderColor: colors.border, backgroundColor: brand.colors.accent }}
                        />
                        <span className="text-sm"
                    style={{ color: colors.mutedForeground }}>Accent</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {brand.fontStyles && (
                <div>
                  <label className="block text-sm font-medium mb-1"
                    style={{ color: colors.foreground }}>Font Style</label>
                  <p className="capitalize"
                    style={{ color: colors.foreground }}>{brand.fontStyles}</p>
                </div>
              )}

              {brand.brandVoice && (
                <div>
                  <label className="block text-sm font-medium mb-1"
                    style={{ color: colors.foreground }}>Brand Voice</label>
                  <p style={{ color: colors.foreground }}>{brand.brandVoice}</p>
                </div>
              )}

              {brand.coreValueProp && (
                <div>
                  <label className="block text-sm font-medium mb-1"
                    style={{ color: colors.foreground }}>Core Value Proposition</label>
                  <p style={{ color: colors.foreground }}>{brand.coreValueProp}</p>
                </div>
              )}

              {brand.ctaPatterns && brand.ctaPatterns.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1"
                    style={{ color: colors.foreground }}>Preferred CTAs</label>
                  <p className="text-sm"
                    style={{ color: colors.foreground }}>{brand.ctaPatterns.join(", ")}</p>
                </div>
              )}

              {brand.productCategory && (
                <div>
                  <label className="block text-sm font-medium mb-1"
                    style={{ color: colors.foreground }}>Product Category</label>
                  <p className="text-sm"
                    style={{ color: colors.foreground }}>{brand.productCategory}</p>
                </div>
              )}

              {brand.pricePositioning && (
                <div>
                  <label className="block text-sm font-medium mb-1"
                    style={{ color: colors.foreground }}>Price Positioning</label>
                  <p className="text-sm capitalize"
                    style={{ color: colors.foreground }}>{brand.pricePositioning}</p>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t" style={{ borderColor: colors.border }}>
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 text-white rounded-lg font-medium hover:opacity-90 transition-colors"
                  style={{ backgroundColor: colors.primary, color: colors.primaryForeground }}
                >
                  Edit
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Edit mode toggle: From Website | Manual Setup (only when re-analyze is supported) */}
              {onWebsiteReanalyze && (
              <div className="flex gap-2 rounded-lg p-1 mb-6" style={{ backgroundColor: colors.muted }}>
                <button
                  type="button"
                  onClick={() => setEditMode('website')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    editMode === 'website' ? 'shadow-sm' : 'hover:opacity-90'
                  }`}
                  style={{
                    backgroundColor: editMode === 'website' ? colors.secondary : 'transparent',
                    color: editMode === 'website' ? colors.foreground : colors.mutedForeground,
                  }}
                >
                  From Website
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode('manual')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    editMode === 'manual' ? 'shadow-sm' : 'hover:opacity-90'
                  }`}
                  style={{
                    backgroundColor: editMode === 'manual' ? colors.secondary : 'transparent',
                    color: editMode === 'manual' ? colors.foreground : colors.mutedForeground,
                  }}
                >
                  Manual Setup
                </button>
              </div>
              )}

              {editMode === 'website' && onWebsiteReanalyze ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (websiteUrl.trim()) onWebsiteReanalyze(websiteUrl.trim());
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>
                      Website URL
                    </label>
                    <input
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://yourwebsite.com"
                      disabled={isAnalyzingBrand}
                      className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(213_100%_55%)] disabled:opacity-50"
                      style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.foreground }}
                    />
                    <p className="text-xs mt-1" style={{ color: colors.mutedForeground }}>
                      I'll analyze your website to extract brand information automatically.
                    </p>
                  </div>
                  {isAnalyzingBrand && (
                    <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: 'hsl(213 100% 55% / 0.15)', border: `1px solid hsl(213 100% 55% / 0.3)` }}>
                      <svg className="animate-spin h-5 w-5" style={{ color: colors.primary }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-sm font-medium" style={{ color: colors.foreground }}>Analyzing your website... This may take a moment.</span>
                    </div>
                  )}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => { setEditing(false); setEditMode('manual'); setWebsiteUrl(''); }}
                      className="px-4 py-2 transition-colors"
                      style={{ color: colors.mutedForeground }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!websiteUrl.trim() || isAnalyzingBrand}
                      className="px-4 py-2 text-white rounded-lg font-medium hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: colors.primary, color: colors.primaryForeground }}
                    >
                      {isAnalyzingBrand ? 'Analyzing...' : 'Analyze & Save'}
                    </button>
                  </div>
                </form>
              ) : editMode === 'manual' || !onWebsiteReanalyze ? (
                <>
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
                    style={{ color: colors.foreground }}>Tone</label>
                <input
                  type="text"
                  value={formData.tone}
                  onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
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

              {/* Brand Profile Section */}
              <div className="pt-4 border-t" style={{ borderColor: colors.border }}>
                <h3 className="text-lg font-semibold mb-4"
                style={{ color: colors.foreground }}>Brand Profile</h3>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2"
                    style={{ color: colors.foreground }}>
                    Primary Colors (hex codes, comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.primaryColors?.join(", ") || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      primaryColors: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                    })}
                    placeholder="e.g., #FF0000, #00FF00, #0000FF"
                    className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(213_100%_55%)]"
                    style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.foreground }}
                  />
                  {formData.primaryColors && formData.primaryColors.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {formData.primaryColors.map((color, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-xs"
                          style={{ color: colors.mutedForeground }}>{color}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2"
                    style={{ color: colors.foreground }}>Font Style</label>
                  <select
                    value={formData.fontStyles || "sans-serif"}
                    onChange={(e) => setFormData({ ...formData, fontStyles: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(213_100%_55%)]"
                    style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.foreground }}
                  >
                    <option value="sans-serif">Sans-serif</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Monospace</option>
                    <option value="cursive">Cursive</option>
                    <option value="fantasy">Fantasy</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2"
                    style={{ color: colors.foreground }}>Brand Voice</label>
                  <select
                    value={formData.brandVoice || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      brandVoice: e.target.value as "Professional" | "Playful" | "Minimalist" | "Bold" | undefined
                    })}
                    className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(213_100%_55%)]"
                    style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.foreground }}
                  >
                    <option value="">Select brand voice...</option>
                    <option value="Professional">Professional</option>
                    <option value="Playful">Playful</option>
                    <option value="Minimalist">Minimalist</option>
                    <option value="Bold">Bold</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2"
                    style={{ color: colors.foreground }}>
                    Core Value Proposition (The "Hook")
                  </label>
                  <input
                    type="text"
                    value={formData.coreValueProp || ""}
                    onChange={(e) => setFormData({ ...formData, coreValueProp: e.target.value || undefined })}
                    placeholder="e.g., Quality First, Always"
                    maxLength={100}
                    className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(213_100%_55%)]"
                    style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.foreground }}
                  />
                </div>
              </div>

              {/* Brand Intelligence Section */}
              <div className="pt-4 border-t" style={{ borderColor: colors.border }}>
                <h3 className="text-lg font-semibold mb-4"
                style={{ color: colors.foreground }}>Brand Intelligence</h3>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2"
                    style={{ color: colors.foreground }}>Preferred CTAs (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.ctaPatterns?.join(", ") || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      ctaPatterns: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                    })}
                    placeholder="e.g., Shop Now, Buy Today, Explore More"
                    className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(213_100%_55%)]"
                    style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.foreground }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2"
                    style={{ color: colors.foreground }}>Product Category</label>
                    <input
                      type="text"
                      value={formData.productCategory || ""}
                      onChange={(e) => setFormData({ ...formData, productCategory: e.target.value || undefined })}
                      placeholder="e.g., earbuds, headphones"
                      className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(213_100%_55%)]"
                    style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.foreground }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2"
                    style={{ color: colors.foreground }}>Price Positioning</label>
                    <select
                      value={formData.pricePositioning || ""}
                      onChange={(e) => setFormData({
                        ...formData,
                        pricePositioning: e.target.value as "budget" | "mid-range" | "premium" | undefined
                      })}
                      className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(213_100%_55%)]"
                    style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.foreground }}
                    >
                      <option value="">Not set</option>
                      <option value="budget">Budget</option>
                      <option value="mid-range">Mid-range</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t"
              style={{ borderColor: colors.border }}>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditMode('manual');
                    setWebsiteUrl('');
                    setFormData(brand);
                  }}
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
          ) : null}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
