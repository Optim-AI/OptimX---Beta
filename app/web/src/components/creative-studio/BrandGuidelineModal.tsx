// BrandGuidelineModal.tsx
// AI-generated Brand Kit UI - Pomeli/Canva Brand Kit style

import React, { useState } from 'react';
import type { BrandSnapshot } from './types';
import colors from '@/lib/ui/colors';
import { Copy, Check, Download, Pencil, ExternalLink } from 'lucide-react';

// Soft dark theme tokens for Brand Kit
const brandKitColors = {
  bg: '#0f0f0f',
  card: 'hsl(0 0% 14%)',
  cardBorder: 'hsl(0 0% 22%)',
  text: 'hsl(0 0% 95%)',
  textMuted: 'hsl(0 0% 60%)',
  pillBg: 'hsl(0 0% 20%)',
  pillBorder: 'hsl(0 0% 28%)',
};

type BrandGuidelineModalProps = {
  brand: BrandSnapshot;
  onUpdate: (updated: BrandSnapshot) => void;
  onClose: () => void;
  onWebsiteAnalyze?: (website: string) => Promise<BrandSnapshot | null>;
};

function getBrandColors(brand: BrandSnapshot): string[] {
  const arr = brand.primaryColors || [];
  if (arr.length >= 4) return arr.slice(0, 4);
  const fromObj = brand.colors;
  const extras: string[] = [];
  if (fromObj?.primary) extras.push(fromObj.primary);
  if (fromObj?.secondary) extras.push(fromObj.secondary);
  if (fromObj?.accent) extras.push(fromObj.accent);
  if (fromObj?.neutral) extras.push(fromObj.neutral);
  const combined = [...arr, ...extras].filter(Boolean);
  return combined.slice(0, 4);
}

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
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const displayBrand = editing ? formData : brand;
  const brandColors = getBrandColors(displayBrand);
  const primaryFont = displayBrand.primaryFont || displayBrand.fontStyles || 'sans-serif';

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

  async function copyHex(hex: string) {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 1500);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  }

  function downloadPalette() {
    const hex = brandColors.join('\n');
    const blob = new Blob([hex], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(displayBrand.name || 'brand').replace(/\s+/g, '-')}-palette.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>

      <div
        className="rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: brandKitColors.bg, border: `1px solid ${brandKitColors.cardBorder}` }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b"
          style={{ backgroundColor: brandKitColors.bg, borderColor: brandKitColors.cardBorder }}>
          <h2 className="text-xl font-semibold" style={{ color: brandKitColors.text }}>Brand Guideline</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditing(true); setEditMode('choice'); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
              style={{ backgroundColor: brandKitColors.pillBg, color: brandKitColors.text, border: `1px solid ${brandKitColors.pillBorder}` }}
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:opacity-80"
              style={{ color: brandKitColors.textMuted }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {!editing ? (
            <>
              {/* Top Header Card */}
              <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                <div className="flex items-start gap-4">
                  {displayBrand.logo && (
                    <img
                      src={displayBrand.logo}
                      alt={`${displayBrand.name} logo`}
                      className="h-14 w-14 object-contain rounded-lg p-2 shrink-0"
                      style={{ backgroundColor: 'hsl(0 0% 18%)', border: `1px solid ${brandKitColors.cardBorder}` }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl font-semibold truncate" style={{ color: brandKitColors.text }}>{displayBrand.name}</h1>
                    {displayBrand.website_url && (
                      <a
                        href={displayBrand.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-1 text-sm hover:underline"
                        style={{ color: brandKitColors.textMuted }}
                      >
                        {displayBrand.website_url.replace(/^https?:\/\//, '')}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Brand Visual Identity: Logo + Typography */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                  <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: brandKitColors.textMuted }}>Logo</p>
                  {displayBrand.logo ? (
                    <div className="flex items-center justify-center min-h-[100px] rounded-lg p-4" style={{ backgroundColor: 'hsl(0 0% 18%)' }}>
                      <img src={displayBrand.logo} alt="Logo" className="max-h-20 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  ) : (
                    <div className="min-h-[100px] rounded-lg flex items-center justify-center" style={{ backgroundColor: 'hsl(0 0% 18%)', color: brandKitColors.textMuted }}
                    >No logo</div>
                  )}
                </div>
                <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                  <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: brandKitColors.textMuted }}>Fonts</p>
                  <div className="flex items-center gap-4">
                    <span className="text-4xl font-bold" style={{ color: brandColors[0] || colors.primary }}>Aa</span>
                    <div>
                      <p className="font-medium" style={{ color: brandKitColors.text }}>{primaryFont}</p>
                      <p className="text-sm" style={{ color: brandKitColors.textMuted }}>Primary font</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Color Palette */}
              {brandColors.length > 0 && (
                <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color: brandKitColors.textMuted }}>Colors</p>
                    <button
                      onClick={downloadPalette}
                      className="flex items-center gap-1.5 text-sm font-medium hover:opacity-90"
                      style={{ color: colors.primary }}
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-6">
                    {brandColors.map((hex) => (
                      <div key={hex} className="flex flex-col items-center gap-2">
                        <button
                          onClick={() => copyHex(hex)}
                          className="w-14 h-14 rounded-full border-2 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0f0f0f]"
                          style={{ backgroundColor: hex, borderColor: 'hsl(0 0% 28%)' }}
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-mono" style={{ color: brandKitColors.textMuted }}>{hex}</span>
                          <button
                            onClick={() => copyHex(hex)}
                            className="p-1 rounded hover:bg-white/10 transition-colors"
                            title="Copy"
                          >
                            {copiedHex === hex ? (
                              <Check className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                            ) : (
                              <Copy className="w-3.5 h-3.5" style={{ color: brandKitColors.textMuted }} />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Brand Personality: Tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(displayBrand.brand_aesthetic?.length || displayBrand.brand_tone?.length) ? (
                  <>
                    {displayBrand.brand_aesthetic?.length ? (
                      <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                        <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: brandKitColors.textMuted }}>Brand aesthetic</p>
                        <div className="flex flex-wrap gap-2">
                          {displayBrand.brand_aesthetic.map((t) => (
                            <span key={t} className="px-3 py-1.5 rounded-full text-sm" style={{ backgroundColor: brandKitColors.pillBg, color: brandKitColors.text, border: `1px solid ${brandKitColors.pillBorder}` }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {displayBrand.brand_tone?.length ? (
                      <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                        <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: brandKitColors.textMuted }}>Brand tone of voice</p>
                        <div className="flex flex-wrap gap-2">
                          {displayBrand.brand_tone.map((t) => (
                            <span key={t} className="px-3 py-1.5 rounded-full text-sm" style={{ backgroundColor: brandKitColors.pillBg, color: brandKitColors.text, border: `1px solid ${brandKitColors.pillBorder}` }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
                {displayBrand.brand_values?.length ? (
                  <div className="p-5 rounded-xl sm:col-span-2" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                    <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: brandKitColors.textMuted }}>Brand values</p>
                    <div className="flex flex-wrap gap-2">
                      {displayBrand.brand_values.map((v) => (
                        <span key={v} className="px-3 py-1.5 rounded-full text-sm" style={{ backgroundColor: brandKitColors.pillBg, color: brandKitColors.text, border: `1px solid ${brandKitColors.pillBorder}` }}>{v}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Tagline */}
              {displayBrand.tagline && (
                <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                  <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: brandKitColors.textMuted }}>Tagline</p>
                  <p className="text-base italic" style={{ color: brandKitColors.text }}>{displayBrand.tagline}</p>
                </div>
              )}

              {/* Business Overview */}
              {(displayBrand.business_overview || displayBrand.description) && (
                <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                  <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: brandKitColors.textMuted }}>Business overview</p>
                  <p className="text-sm leading-relaxed" style={{ color: brandKitColors.text }}>
                    {displayBrand.business_overview || displayBrand.description}
                  </p>
                </div>
              )}

              {/* Legacy: Audience, Offering */}
              {(displayBrand.audience || displayBrand.offering) && (
                <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                  {displayBrand.audience && (
                    <div className="mb-2">
                      <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: brandKitColors.textMuted }}>Target audience</p>
                      <p className="text-sm" style={{ color: brandKitColors.text }}>{displayBrand.audience}</p>
                    </div>
                  )}
                  {displayBrand.offering && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: brandKitColors.textMuted }}>Offerings</p>
                      <p className="text-sm" style={{ color: brandKitColors.text }}>{displayBrand.offering}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : editMode === 'choice' ? (
            <>
              <p className="text-sm mb-4" style={{ color: brandKitColors.textMuted }}>How would you like to update your brand guideline?</p>
              <div className="flex flex-col sm:flex-row gap-4">
                {onWebsiteAnalyze && (
                  <button
                    onClick={() => setEditMode('website')}
                    className="flex-1 px-6 py-4 rounded-xl border-2 text-left transition-colors"
                    style={{ borderColor: brandKitColors.cardBorder, backgroundColor: brandKitColors.card, color: brandKitColors.text }}
                  >
                    <span className="block font-semibold mb-1">Website set up</span>
                    <span className="text-sm" style={{ color: brandKitColors.textMuted }}>Analyze your website to extract brand information automatically.</span>
                  </button>
                )}
                <button
                  onClick={() => setEditMode('manual')}
                  className="flex-1 px-6 py-4 rounded-xl border-2 text-left transition-colors"
                  style={{ borderColor: brandKitColors.cardBorder, backgroundColor: brandKitColors.card, color: brandKitColors.text }}
                >
                  <span className="block font-semibold mb-1">Manual set up</span>
                  <span className="text-sm" style={{ color: brandKitColors.textMuted }}>Enter your brand details directly.</span>
                </button>
              </div>
              <div className="flex justify-end pt-4 border-t" style={{ borderColor: brandKitColors.cardBorder }}>
                <button onClick={handleCancelEdit} className="px-4 py-2 text-sm" style={{ color: brandKitColors.textMuted }}>Cancel</button>
              </div>
            </>
          ) : editMode === 'website' ? (
            <>
              <button onClick={() => setEditMode('choice')} className="text-sm mb-4" style={{ color: colors.primary }}>← Back</button>
              <form onSubmit={handleWebsiteSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: brandKitColors.text }}>Website URL</label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourwebsite.com"
                    className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2"
                    style={{ border: `1px solid ${brandKitColors.cardBorder}`, backgroundColor: brandKitColors.card, color: brandKitColors.text }}
                    disabled={isAnalyzing}
                  />
                  <p className="text-xs mt-1" style={{ color: brandKitColors.textMuted }}>We&apos;ll analyze your website to extract brand information automatically.</p>
                </div>
                {isAnalyzing && (
                  <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: 'hsl(213 100% 55% / 0.15)', border: '1px solid hsl(213 100% 55% / 0.3)' }}>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent" style={{ borderColor: colors.primary }} />
                    <span className="text-sm font-medium" style={{ color: brandKitColors.text }}>Analyzing your website... This may take a moment.</span>
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setEditMode('choice')} className="px-4 py-2 text-sm" style={{ color: brandKitColors.textMuted }}>Cancel</button>
                  <button
                    type="submit"
                    disabled={!websiteUrl.trim() || isAnalyzing}
                    className="px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: colors.primary, color: colors.primaryForeground }}
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Analyze & Update'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <button onClick={() => setEditMode('choice')} className="text-sm mb-4" style={{ color: colors.primary }}>← Back</button>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: brandKitColors.text }}>Brand Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2"
                    style={{ border: `1px solid ${brandKitColors.cardBorder}`, backgroundColor: brandKitColors.card, color: brandKitColors.text }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: brandKitColors.text }}>Logo URL (Optional)</label>
                  <input
                    type="url"
                    value={formData.logo || ''}
                    onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2"
                    style={{ border: `1px solid ${brandKitColors.cardBorder}`, backgroundColor: brandKitColors.card, color: brandKitColors.text }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: brandKitColors.text }}>Business overview</label>
                  <textarea
                    value={formData.business_overview || formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, business_overview: e.target.value, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2"
                    style={{ border: `1px solid ${brandKitColors.cardBorder}`, backgroundColor: brandKitColors.card, color: brandKitColors.text }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: brandKitColors.text }}>Tagline</label>
                  <input
                    type="text"
                    value={formData.tagline || ''}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2"
                    style={{ border: `1px solid ${brandKitColors.cardBorder}`, backgroundColor: brandKitColors.card, color: brandKitColors.text }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: brandKitColors.text }}>Target audience</label>
                  <input
                    type="text"
                    value={formData.audience}
                    onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2"
                    style={{ border: `1px solid ${brandKitColors.cardBorder}`, backgroundColor: brandKitColors.card, color: brandKitColors.text }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: brandKitColors.text }}>Offerings</label>
                  <input
                    type="text"
                    value={formData.offering}
                    onChange={(e) => setFormData({ ...formData, offering: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2"
                    style={{ border: `1px solid ${brandKitColors.cardBorder}`, backgroundColor: brandKitColors.card, color: brandKitColors.text }}
                  />
                </div>
                <div className="flex gap-3 pt-4 border-t" style={{ borderColor: brandKitColors.cardBorder }}>
                  <button onClick={handleCancelEdit} className="px-4 py-2 text-sm" style={{ color: brandKitColors.textMuted }}>Cancel</button>
                  <button onClick={handleSave} className="px-4 py-2 rounded-lg font-medium" style={{ backgroundColor: colors.primary, color: colors.primaryForeground }}>Save Changes</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
