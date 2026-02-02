// BrandGuidelineModal.tsx
// Modal for viewing and editing brand guidelines

import React, { useState } from 'react';
import type { BrandSnapshot } from './types';

type BrandGuidelineModalProps = {
  brand: BrandSnapshot;
  onUpdate: (updated: BrandSnapshot) => void;
  onClose: () => void;
};

export default function BrandGuidelineModal({
  brand,
  onUpdate,
  onClose,
}: BrandGuidelineModalProps) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<BrandSnapshot>(brand);

  function handleSave() {
    onUpdate(formData);
    setEditing(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Brand Guideline</h2>
            <p className="text-gray-600 text-sm mt-1">
              Your brand information is used automatically in all creatives.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
                  <div className="flex items-center gap-4">
                    <img
                      src={brand.logo}
                      alt={`${brand.name} logo`}
                      className="h-16 w-auto object-contain border border-gray-200 rounded-lg p-2 bg-white"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <a
                      href={brand.logo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 underline"
                    >
                      View full size
                    </a>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name</label>
                <p className="text-gray-900">{brand.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <p className="text-gray-900">{brand.description}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                <p className="text-gray-900">{brand.audience}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Offering</label>
                <p className="text-gray-900">{brand.offering}</p>
              </div>
              {brand.tone && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                  <p className="text-gray-900 capitalize">{brand.tone}</p>
                </div>
              )}
              {brand.personality && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Personality</label>
                  <p className="text-gray-900 capitalize">{brand.personality}</p>
                </div>
              )}
              {brand.tagline && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
                  <p className="text-gray-900">{brand.tagline}</p>
                </div>
              )}
              {/* Primary Colors */}
              {brand.primaryColors && brand.primaryColors.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Primary Colors</label>
                  <div className="flex gap-3 flex-wrap">
                    {brand.primaryColors.map((color, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded border border-gray-300"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-sm text-gray-600">{color}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legacy Colors */}
              {brand.colors && !brand.primaryColors && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Brand Colors</label>
                  <div className="flex gap-3">
                    {brand.colors.primary && (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded border border-gray-300"
                          style={{ backgroundColor: brand.colors.primary }}
                        />
                        <span className="text-sm text-gray-600">Primary</span>
                      </div>
                    )}
                    {brand.colors.secondary && (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded border border-gray-300"
                          style={{ backgroundColor: brand.colors.secondary }}
                        />
                        <span className="text-sm text-gray-600">Secondary</span>
                      </div>
                    )}
                    {brand.colors.accent && (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded border border-gray-300"
                          style={{ backgroundColor: brand.colors.accent }}
                        />
                        <span className="text-sm text-gray-600">Accent</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {brand.fontStyles && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Font Style</label>
                  <p className="text-gray-900 capitalize">{brand.fontStyles}</p>
                </div>
              )}

              {brand.brandVoice && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand Voice</label>
                  <p className="text-gray-900">{brand.brandVoice}</p>
                </div>
              )}

              {brand.coreValueProp && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Core Value Proposition</label>
                  <p className="text-gray-900">{brand.coreValueProp}</p>
                </div>
              )}

              {brand.ctaPatterns && brand.ctaPatterns.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preferred CTAs</label>
                  <p className="text-sm text-gray-700">{brand.ctaPatterns.join(", ")}</p>
                </div>
              )}

              {brand.productCategory && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Category</label>
                  <p className="text-sm text-gray-700">{brand.productCategory}</p>
                </div>
              )}

              {brand.pricePositioning && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price Positioning</label>
                  <p className="text-sm text-gray-700 capitalize">{brand.pricePositioning}</p>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Edit
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Logo URL (Optional)</label>
                <div className="flex items-center gap-4">
                  {formData.logo && (
                    <img
                      src={formData.logo}
                      alt={`${formData.name} logo`}
                      className="h-16 w-auto object-contain border border-gray-200 rounded-lg p-2 bg-white"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.logo ? "Update logo URL or leave empty to remove" : "Enter a URL to add your logo"}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Brand Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                <input
                  type="text"
                  value={formData.audience}
                  onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Offering</label>
                <input
                  type="text"
                  value={formData.offering}
                  onChange={(e) => setFormData({ ...formData, offering: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                <input
                  type="text"
                  value={formData.tone}
                  onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tagline</label>
                <input
                  type="text"
                  value={formData.tagline || ""}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Brand Profile Section */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Brand Profile</h3>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {formData.primaryColors && formData.primaryColors.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {formData.primaryColors.map((color, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded border border-gray-300"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-xs text-gray-600">{color}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Font Style</label>
                  <select
                    value={formData.fontStyles || "sans-serif"}
                    onChange={(e) => setFormData({ ...formData, fontStyles: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="sans-serif">Sans-serif</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Monospace</option>
                    <option value="cursive">Cursive</option>
                    <option value="fantasy">Fantasy</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Brand Voice</label>
                  <select
                    value={formData.brandVoice || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      brandVoice: e.target.value as "Professional" | "Playful" | "Minimalist" | "Bold" | undefined
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select brand voice...</option>
                    <option value="Professional">Professional</option>
                    <option value="Playful">Playful</option>
                    <option value="Minimalist">Minimalist</option>
                    <option value="Bold">Bold</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Core Value Proposition (The "Hook")
                  </label>
                  <input
                    type="text"
                    value={formData.coreValueProp || ""}
                    onChange={(e) => setFormData({ ...formData, coreValueProp: e.target.value || undefined })}
                    placeholder="e.g., Quality First, Always"
                    maxLength={100}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Brand Intelligence Section */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Brand Intelligence</h3>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preferred CTAs (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.ctaPatterns?.join(", ") || ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      ctaPatterns: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                    })}
                    placeholder="e.g., Shop Now, Buy Today, Explore More"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Product Category</label>
                    <input
                      type="text"
                      value={formData.productCategory || ""}
                      onChange={(e) => setFormData({ ...formData, productCategory: e.target.value || undefined })}
                      placeholder="e.g., earbuds, headphones"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Price Positioning</label>
                    <select
                      value={formData.pricePositioning || ""}
                      onChange={(e) => setFormData({
                        ...formData,
                        pricePositioning: e.target.value as "budget" | "mid-range" | "premium" | undefined
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Not set</option>
                      <option value="budget">Budget</option>
                      <option value="mid-range">Mid-range</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setEditing(false);
                    setFormData(brand);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
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
