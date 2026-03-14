// BrandGuidelineModal.tsx
// AI-generated Brand Kit UI - inline editable form

import React, { useState, useRef, KeyboardEvent } from 'react';
import type { BrandSnapshot } from './types';
import colors from '@/lib/ui/colors';
import { Copy, Check, Download, Pencil, ExternalLink, Plus, X, Save } from 'lucide-react';

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

const inputStyle: React.CSSProperties = {
  border: `1px solid ${brandKitColors.cardBorder}`,
  backgroundColor: brandKitColors.card,
  color: brandKitColors.text,
};

function TagEditor({
  tags,
  onChange,
  placeholder = 'Add tag…',
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag() {
    const val = input.trim();
    if (!val || tags.includes(val)) return;
    onChange([...tags, val]);
    setInput('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {tags.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm"
          style={{ backgroundColor: brandKitColors.pillBg, color: brandKitColors.text, border: `1px solid ${brandKitColors.pillBorder}` }}
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((_, i) => i !== idx))}
            className="hover:opacity-70 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <div className="inline-flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="px-2 py-1 rounded-lg text-sm focus:outline-none focus:ring-1 w-28"
          style={{ ...inputStyle, fontSize: '0.8125rem' }}
        />
        <button
          type="button"
          onClick={addTag}
          className="p-1 rounded-md hover:opacity-80 transition-opacity"
          style={{ color: colors.primary }}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ColorEditor({
  colorList,
  onChange,
}: {
  colorList: string[];
  onChange: (colors: string[]) => void;
}) {
  const [newHex, setNewHex] = useState('#');

  function addColor() {
    const val = newHex.trim();
    if (!/^#[0-9A-Fa-f]{3,8}$/.test(val)) return;
    onChange([...colorList, val]);
    setNewHex('#');
  }

  return (
    <div className="flex flex-wrap gap-4 items-end">
      {colorList.map((hex, idx) => (
        <div key={`${hex}-${idx}`} className="flex flex-col items-center gap-2 relative group">
          <div className="relative">
            <input
              type="color"
              value={hex}
              onChange={(e) => {
                const updated = [...colorList];
                updated[idx] = e.target.value;
                onChange(updated);
              }}
              className="w-14 h-14 rounded-full cursor-pointer border-2"
              style={{ borderColor: 'hsl(0 0% 28%)', backgroundColor: 'transparent' }}
            />
            <button
              type="button"
              onClick={() => onChange(colorList.filter((_, i) => i !== idx))}
              className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: 'hsl(0 84% 55%)', color: '#fff' }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <input
            type="text"
            value={hex}
            onChange={(e) => {
              const updated = [...colorList];
              updated[idx] = e.target.value;
              onChange(updated);
            }}
            className="text-xs font-mono w-20 text-center px-1 py-0.5 rounded"
            style={inputStyle}
          />
        </div>
      ))}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={addColor}
          className="w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center hover:opacity-80 transition-opacity"
          style={{ borderColor: brandKitColors.pillBorder, color: brandKitColors.textMuted }}
        >
          <Plus className="w-5 h-5" />
        </button>
        <input
          type="text"
          value={newHex}
          onChange={(e) => setNewHex(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addColor(); } }}
          placeholder="#hex"
          className="text-xs font-mono w-20 text-center px-1 py-0.5 rounded"
          style={inputStyle}
        />
      </div>
    </div>
  );
}

export default function BrandGuidelineModal({
  brand,
  onUpdate,
  onClose,
  onWebsiteAnalyze,
}: BrandGuidelineModalProps) {
  const [editing, setEditing] = useState(false);
  const [editSource, setEditSource] = useState<'choice' | 'website' | 'form'>('choice');
  const [formData, setFormData] = useState<BrandSnapshot>(brand);
  const [formColors, setFormColors] = useState<string[]>(getBrandColors(brand));
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const displayBrand = editing && editSource === 'form' ? formData : brand;
  const brandColors = editing && editSource === 'form' ? formColors : getBrandColors(displayBrand);
  const primaryFont = displayBrand.primaryFont || displayBrand.fontStyles || 'sans-serif';

  function enterEditForm(data?: BrandSnapshot) {
    const d = data || brand;
    setFormData(d);
    setFormColors(getBrandColors(d));
    setEditing(true);
    setEditSource('form');
  }

  function handleSave() {
    const updated: BrandSnapshot = {
      ...formData,
      primaryColors: formColors,
      colors: {
        primary: formColors[0] || '',
        secondary: formColors[1] || '',
        accent: formColors[2] || '',
        neutral: formColors[3] || '',
      },
    };
    onUpdate(updated);
    setEditing(false);
    setEditSource('choice');
  }

  function handleCancelEdit() {
    setEditing(false);
    setEditSource('choice');
    setFormData(brand);
    setFormColors(getBrandColors(brand));
    setWebsiteUrl('');
  }

  async function handleWebsiteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!websiteUrl.trim() || !onWebsiteAnalyze) return;
    setIsAnalyzing(true);
    try {
      const result = await onWebsiteAnalyze(websiteUrl.trim());
      if (result) {
        enterEditForm(result);
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

  function updateForm(patch: Partial<BrandSnapshot>) {
    setFormData((prev) => ({ ...prev, ...patch }));
  }

  const isFormMode = editing && editSource === 'form';

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
          <h2 className="text-xl font-semibold" style={{ color: brandKitColors.text }}>
            {isFormMode ? 'Edit Brand Guideline' : 'Brand Guideline'}
          </h2>
          <div className="flex items-center gap-2">
            {isFormMode ? (
              <>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                  style={{ color: brandKitColors.textMuted }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: colors.primaryForeground }}
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setEditing(true); setEditSource('choice'); }}
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
              </>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* ── Edit source picker (website vs manual) ── */}
          {editing && editSource === 'choice' && (
            <>
              <p className="text-sm mb-4" style={{ color: brandKitColors.textMuted }}>How would you like to update your brand guideline?</p>
              <div className="flex flex-col sm:flex-row gap-4">
                {onWebsiteAnalyze && (
                  <button
                    onClick={() => setEditSource('website')}
                    className="flex-1 px-6 py-4 rounded-xl border-2 text-left transition-colors"
                    style={{ borderColor: brandKitColors.cardBorder, backgroundColor: brandKitColors.card, color: brandKitColors.text }}
                  >
                    <span className="block font-semibold mb-1">Website set up</span>
                    <span className="text-sm" style={{ color: brandKitColors.textMuted }}>Analyze your website to extract brand information automatically.</span>
                  </button>
                )}
                <button
                  onClick={() => enterEditForm()}
                  className="flex-1 px-6 py-4 rounded-xl border-2 text-left transition-colors"
                  style={{ borderColor: brandKitColors.cardBorder, backgroundColor: brandKitColors.card, color: brandKitColors.text }}
                >
                  <span className="block font-semibold mb-1">Manual set up</span>
                  <span className="text-sm" style={{ color: brandKitColors.textMuted }}>Edit your brand details directly.</span>
                </button>
              </div>
              <div className="flex justify-end pt-4 border-t" style={{ borderColor: brandKitColors.cardBorder }}>
                <button onClick={handleCancelEdit} className="px-4 py-2 text-sm" style={{ color: brandKitColors.textMuted }}>Cancel</button>
              </div>
            </>
          )}

          {/* ── Website URL input ── */}
          {editing && editSource === 'website' && (
            <>
              <button onClick={() => setEditSource('choice')} className="text-sm mb-4" style={{ color: colors.primary }}>← Back</button>
              <form onSubmit={handleWebsiteSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: brandKitColors.text }}>Website URL</label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourwebsite.com"
                    className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2"
                    style={inputStyle}
                    disabled={isAnalyzing}
                  />
                  <p className="text-xs mt-1" style={{ color: brandKitColors.textMuted }}>We&apos;ll analyze your website and show you the extracted data for review.</p>
                </div>
                {isAnalyzing && (
                  <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: 'hsl(213 100% 55% / 0.15)', border: '1px solid hsl(213 100% 55% / 0.3)' }}>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent" style={{ borderColor: colors.primary }} />
                    <span className="text-sm font-medium" style={{ color: brandKitColors.text }}>Analyzing your website... This may take a moment.</span>
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setEditSource('choice')} className="px-4 py-2 text-sm" style={{ color: brandKitColors.textMuted }}>Cancel</button>
                  <button
                    type="submit"
                    disabled={!websiteUrl.trim() || isAnalyzing}
                    className="px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: colors.primary, color: colors.primaryForeground }}
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Analyze & Review'}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ── Inline editable form (same card layout) ── */}
          {isFormMode && (
            <>
              {/* Top Header Card */}
              <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                <div className="flex items-start gap-4">
                  {formData.logo && (
                    <img
                      src={formData.logo}
                      alt={`${formData.name} logo`}
                      className="h-14 w-14 object-contain rounded-lg p-2 shrink-0"
                      style={{ backgroundColor: 'hsl(0 0% 18%)', border: `1px solid ${brandKitColors.cardBorder}` }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-3">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateForm({ name: e.target.value })}
                      placeholder="Brand Name"
                      className="w-full text-xl font-semibold px-3 py-2 rounded-lg focus:outline-none focus:ring-1"
                      style={inputStyle}
                    />
                    <input
                      type="url"
                      value={formData.website_url || ''}
                      onChange={(e) => updateForm({ website_url: e.target.value })}
                      placeholder="https://yourwebsite.com"
                      className="w-full text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Logo + Typography */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                  <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: brandKitColors.textMuted }}>Logo URL</p>
                  <input
                    type="url"
                    value={formData.logo || ''}
                    onChange={(e) => updateForm({ logo: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="w-full text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1 mb-3"
                    style={inputStyle}
                  />
                  {formData.logo && (
                    <div className="flex items-center justify-center min-h-[80px] rounded-lg p-4" style={{ backgroundColor: 'hsl(0 0% 18%)' }}>
                      <img src={formData.logo} alt="Logo" className="max-h-16 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}
                </div>
                <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                  <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: brandKitColors.textMuted }}>Primary Font</p>
                  <input
                    type="text"
                    value={formData.primaryFont || formData.fontStyles || ''}
                    onChange={(e) => updateForm({ primaryFont: e.target.value, fontStyles: e.target.value })}
                    placeholder="e.g. sans-serif, Poppins, Inter"
                    className="w-full text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1"
                    style={inputStyle}
                  />
                  <div className="flex items-center gap-4 mt-4">
                    <span className="text-4xl font-bold" style={{ color: formColors[0] || colors.primary }}>Aa</span>
                    <p className="font-medium" style={{ color: brandKitColors.text }}>{formData.primaryFont || formData.fontStyles || 'sans-serif'}</p>
                  </div>
                </div>
              </div>

              {/* Color Palette */}
              <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                <p className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: brandKitColors.textMuted }}>Colors</p>
                <ColorEditor colorList={formColors} onChange={setFormColors} />
              </div>

              {/* Brand Personality Tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                  <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: brandKitColors.textMuted }}>Brand Aesthetic</p>
                  <TagEditor
                    tags={formData.brand_aesthetic || []}
                    onChange={(tags) => updateForm({ brand_aesthetic: tags })}
                    placeholder="e.g. minimalist"
                  />
                </div>
                <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                  <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: brandKitColors.textMuted }}>Brand Tone of Voice</p>
                  <TagEditor
                    tags={formData.brand_tone || []}
                    onChange={(tags) => updateForm({ brand_tone: tags })}
                    placeholder="e.g. friendly"
                  />
                </div>
              </div>

              {/* Brand Values */}
              <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: brandKitColors.textMuted }}>Brand Values</p>
                <TagEditor
                  tags={formData.brand_values || []}
                  onChange={(tags) => updateForm({ brand_values: tags })}
                  placeholder="e.g. Sustainability"
                />
              </div>

              {/* Tagline */}
              <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: brandKitColors.textMuted }}>Tagline</p>
                <input
                  type="text"
                  value={formData.tagline || ''}
                  onChange={(e) => updateForm({ tagline: e.target.value })}
                  placeholder="Your brand tagline"
                  className="w-full text-base italic px-3 py-2 rounded-lg focus:outline-none focus:ring-1"
                  style={inputStyle}
                />
              </div>

              {/* Business Overview */}
              <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: brandKitColors.textMuted }}>Business Overview</p>
                <textarea
                  value={formData.business_overview || formData.description || ''}
                  onChange={(e) => updateForm({ business_overview: e.target.value, description: e.target.value })}
                  rows={3}
                  placeholder="Describe what your business does…"
                  className="w-full text-sm leading-relaxed px-3 py-2 rounded-lg focus:outline-none focus:ring-1 resize-none"
                  style={inputStyle}
                />
              </div>

              {/* Target Audience & Offerings */}
              <div className="p-5 rounded-xl space-y-4" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: brandKitColors.textMuted }}>Target Audience</p>
                  <input
                    type="text"
                    value={formData.audience || ''}
                    onChange={(e) => updateForm({ audience: e.target.value })}
                    placeholder="e.g. Health enthusiasts"
                    className="w-full text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: brandKitColors.textMuted }}>Offerings</p>
                  <input
                    type="text"
                    value={formData.offering || ''}
                    onChange={(e) => updateForm({ offering: e.target.value })}
                    placeholder="e.g. Protein Bars, Energy Bars"
                    className="w-full text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Bottom Save/Cancel */}
              <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: brandKitColors.cardBorder }}>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-sm rounded-lg transition-colors hover:opacity-80"
                  style={{ color: brandKitColors.textMuted }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: colors.primaryForeground }}
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </>
          )}

          {/* ── Read-only view (default) ── */}
          {!editing && (
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
                        className="inline-flex items-center gap-1.5 mt-1 text-sm hover:underline max-w-full"
                        style={{ color: brandKitColors.textMuted }}
                      >
                        <span className="truncate">{displayBrand.website_url.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
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
                    <div className="min-h-[100px] rounded-lg flex items-center justify-center" style={{ backgroundColor: 'hsl(0 0% 18%)', color: brandKitColors.textMuted }}>No logo</div>
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
                    {brandColors.map((hex, idx) => (
                      <div key={`${hex}-${idx}`} className="flex flex-col items-center gap-2">
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
                          {displayBrand.brand_aesthetic.map((t, idx) => (
                            <span key={`${t}-${idx}`} className="px-3 py-1.5 rounded-full text-sm" style={{ backgroundColor: brandKitColors.pillBg, color: brandKitColors.text, border: `1px solid ${brandKitColors.pillBorder}` }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {displayBrand.brand_tone?.length ? (
                      <div className="p-5 rounded-xl" style={{ backgroundColor: brandKitColors.card, border: `1px solid ${brandKitColors.cardBorder}` }}>
                        <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: brandKitColors.textMuted }}>Brand tone of voice</p>
                        <div className="flex flex-wrap gap-2">
                          {displayBrand.brand_tone.map((t, idx) => (
                            <span key={`${t}-${idx}`} className="px-3 py-1.5 rounded-full text-sm" style={{ backgroundColor: brandKitColors.pillBg, color: brandKitColors.text, border: `1px solid ${brandKitColors.pillBorder}` }}>{t}</span>
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
                      {displayBrand.brand_values.map((v, idx) => (
                        <span key={`${v}-${idx}`} className="px-3 py-1.5 rounded-full text-sm" style={{ backgroundColor: brandKitColors.pillBg, color: brandKitColors.text, border: `1px solid ${brandKitColors.pillBorder}` }}>{v}</span>
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

              {/* Audience, Offering */}
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
          )}
        </div>
      </div>
    </div>
  );
}
