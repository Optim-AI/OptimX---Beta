import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  ChevronDown,
  Download,
  Film,
  ImagePlus,
  Pause,
  Play,
  Plus,
  Save,
  Sparkles,
  Upload,
} from 'lucide-react';
import { InsufficientCreditsAlert } from '@/app/web/src/components/billing';
import { showError } from '@/app/web/src/components/ui/alert-modal-api';
import { authFetch, safeResponseJson } from '@/lib/utils';
import {
  type AdBuilderData,
  type BrandSnapshot,
  type CommercialProductionStatus,
  type GeneratedVideo,
} from './types';
import {
  CREATIVE_FORMATS,
  HOOK_TYPES,
  CAMPAIGN_GOALS,
  VIDEO_DURATIONS,
} from './utils';

const PURPLE = '#A855F7';
const PURPLE_SOFT = 'rgba(168, 85, 247, 0.16)';
const PURPLE_BORDER = 'rgba(168, 85, 247, 0.42)';
const STUDIO_BG = '#0B0B0F';
const RAIL_BG = '#101014';
const SURFACE = '#16161C';
const SURFACE_2 = '#1A1A22';
const LINE = 'rgba(255,255,255,0.08)';
const MUTED = '#8B8B98';

const FORMAT_DESCRIPTIONS: Record<string, string> = {
  UGC: 'Real person filmed on phone. Casual, believable, native to Reels/Shorts.',
  Commercial: 'Paid ad feel. High production value, product as hero, punchy pacing.',
  Lifestyle: 'Product in real-world use. Relatable scenarios, natural lighting.',
  'Product Showcase': 'Detail-driven product focus. Close-ups, texture, benefits.',
  'Motion Graphics': 'Design-forward animated composition and graphic flow.',
  Cinematic: 'Film-style polish. Emotion and message lead; cinematography supports.',
};

const HOOK_DESCRIPTIONS: Record<string, string> = {
  Auto: 'AI picks the strongest hook for your product and campaign goal.',
  'Curiosity Hook': 'Pattern interrupt that makes viewers need to know more.',
  'Before & After': 'Transformation contrast — problem state vs. result state.',
  'Social Proof': 'Reviews, results, and credibility to overcome skepticism.',
  Contrarian: 'Challenge a common belief to stop the scroll.',
  'Problem Agitation': 'Amplify the pain before presenting your solution.',
  'Founder Story': 'Authentic origin story that builds trust and differentiation.',
  Testimonial: 'Real customer voice — relatable proof that converts.',
  'Product Demonstration': 'Show the product working — clarity drives clicks.',
};

type PromptVariantPreview = {
  filmStyleId: string;
  label: string;
  summary: string;
  promptPreview: string;
  estimatedTokens: number;
};

function AspectRatioGlyph({
  ratio,
  selected,
}: {
  ratio: '9:16' | '16:9';
  selected: boolean;
}) {
  const stroke = selected ? '#E9D5FF' : MUTED;
  const isPortrait = ratio === '9:16';
  // Outlined frame matching the aspect — visual reference only
  const width = isPortrait ? 8 : 14;
  const height = isPortrait ? 14 : 8;
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center"
      style={{ width: 14, height: 14 }}
    >
      <span
        style={{
          width,
          height,
          borderRadius: 2,
          border: `1.5px solid ${stroke}`,
          display: 'block',
        }}
      />
    </span>
  );
}

function commercialTitle(data: AdBuilderData, sessionName?: string): string {
  const product = data.product;
  if (!product) return sessionName || 'New video commercial';
  const parts = [product.product_name, product.category, product.brand_name].filter(Boolean);
  const duration = data.adSetup?.duration ?? 15;
  const format = data.adSetup?.creativeFormat || 'Commercial';
  return `${parts.join(' | ')} — ${duration}s ${format}`;
}

type VideoStudioWorkspaceProps = {
  sessionName?: string;
  isSaving: boolean;
  brand: BrandSnapshot | null;
  adBuilderData: AdBuilderData;
  onAdBuilderChange: (data: AdBuilderData) => void;
  generatedVideos: GeneratedVideo[];
  selectedVideoId: string | null;
  onSelectVideo: (id: string) => void;
  productUrl: string;
  onProductUrlChange: (url: string) => void;
  onProductUrlSubmit: (e: React.FormEvent) => void;
  isScrapingProduct: boolean;
  isFetchingLogo: boolean;
  selectedImageIndex: number | null;
  onSelectImage: (index: number, img: string) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isGeneratingScript: boolean;
  isGeneratingVideo: boolean;
  generationStep: number;
  productionStatus: CommercialProductionStatus;
  pendingRegeneration: {
    nextVersion: string;
    reason: string;
    requiredChanges: string[];
    preservedRequirements: string[];
  } | null;
  hasInsufficientCredits: boolean;
  videoCredits: { subscription: number; addon: number; total: number } | null;
  promptVariants: PromptVariantPreview[];
  selectedFilmStyleId: string | null;
  onSelectFilmStyle: (id: string) => void;
  isLoadingVariants: boolean;
  onGenerateVideo: () => void;
  onConfirmRegenerate: () => void;
  onKeepVersion: () => void;
  onSaveDraft: () => void;
  onDownload: (video: GeneratedVideo) => void;
  onUpdateAspectRatio: (ratio: '9:16' | '16:9') => void;
};

export default function VideoStudioWorkspace({
  sessionName,
  isSaving,
  brand,
  adBuilderData,
  onAdBuilderChange,
  generatedVideos,
  selectedVideoId,
  onSelectVideo,
  productUrl,
  onProductUrlChange,
  onProductUrlSubmit,
  isScrapingProduct,
  isFetchingLogo,
  selectedImageIndex,
  onSelectImage,
  onImageUpload,
  isGeneratingScript,
  isGeneratingVideo,
  generationStep,
  productionStatus,
  pendingRegeneration,
  hasInsufficientCredits,
  videoCredits,
  promptVariants,
  selectedFilmStyleId,
  onSelectFilmStyle,
  isLoadingVariants,
  onGenerateVideo,
  onConfirmRegenerate,
  onKeepVersion,
  onSaveDraft,
  onDownload,
  onUpdateAspectRatio,
}: VideoStudioWorkspaceProps) {
  const router = useRouter();
  const adSetup = adBuilderData?.adSetup ?? {
    creativeFormat: 'Commercial' as const,
    hookType: 'Auto' as const,
    campaignGoal: 'Drive Sales' as const,
    audience: 'Auto' as const,
    duration: 15 as const,
    platform: 'Instagram Reels / TikTok' as const,
    aspect_ratio: '9:16' as const,
  };
  const voiceover = adBuilderData?.voiceover ?? {
    enabled: true,
    language: 'english' as const,
    tone: 'Energetic' as const,
  };
  const product = adBuilderData?.product ?? null;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showConcept, setShowConcept] = useState(false);
  const [showReplaceProduct, setShowReplaceProduct] = useState(false);
  const [showQcDetails, setShowQcDetails] = useState(false);
  const [showCreativePlan, setShowCreativePlan] = useState(true);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stageOpened, setStageOpened] = useState(false);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [promptBeforeEnhance, setPromptBeforeEnhance] = useState<string | null>(null);

  const selectedVideo =
    generatedVideos.find((video) => video.id === selectedVideoId) ?? generatedVideos[generatedVideos.length - 1] ?? null;

  const title = commercialTitle(adBuilderData, sessionName);
  const hasVideo = Boolean(selectedVideo?.url);
  const isBusy = isGeneratingVideo || isGeneratingScript;
  const showStage = stageOpened || isBusy || hasVideo;

  async function handleEnhancePrompt() {
    const current = adBuilderData.userDescription?.trim() || '';
    if (!current) {
      showError('Write a creative idea first, then enhance it.');
      return;
    }
    if (isEnhancingPrompt || isBusy) return;

    const brandName =
      brand?.name?.trim() ||
      product?.brand_name?.trim() ||
      undefined;
    const productName = product?.product_name?.trim() || undefined;

    setIsEnhancingPrompt(true);
    setPromptBeforeEnhance(adBuilderData.userDescription || '');
    try {
      const response = await authFetch('/api/commercial/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: current,
          brand: brandName,
          product: productName,
          productDescription:
            brand?.coreValueProp?.trim() ||
            brand?.offering?.trim() ||
            brand?.description?.trim() ||
            undefined,
          campaignContext: {
            category: product?.category,
            audience: adSetup.audience,
            campaignGoal: adSetup.campaignGoal,
            platform: adSetup.platform,
            duration: adSetup.duration,
          },
        }),
      });
      const data = await safeResponseJson<{
        ok?: boolean;
        enhancedPrompt?: string;
        error?: string;
      }>(response);
      if (!response.ok || !data?.ok || !data.enhancedPrompt?.trim()) {
        setPromptBeforeEnhance(null);
        showError(data?.error || 'Could not enhance the prompt. Your original text was kept.');
        return;
      }
      onAdBuilderChange({
        ...adBuilderData,
        userDescription: data.enhancedPrompt.trim(),
      });
    } catch (err: any) {
      setPromptBeforeEnhance(null);
      showError(err?.message || 'Could not enhance the prompt. Your original text was kept.');
    } finally {
      setIsEnhancingPrompt(false);
    }
  }

  function handleUndoEnhance() {
    if (promptBeforeEnhance == null) return;
    onAdBuilderChange({
      ...adBuilderData,
      userDescription: promptBeforeEnhance,
    });
    setPromptBeforeEnhance(null);
  }
  const canGenerate = Boolean(product) && !isBusy && !hasInsufficientCredits;
  const generateLabel = hasVideo ? 'Regenerate' : 'Generate';
  const durationSeconds = adSetup.duration ?? 15;
  const aspectRatio = adSetup.aspect_ratio || '9:16';
  const isLandscape = aspectRatio === '16:9';
  const aspect = isLandscape ? '16 / 9' : '9 / 16';
  const referenceCount = product?.product_images?.length || 0;
  const selectedConcept =
    adBuilderData?.adConcepts?.find((concept) => concept.id === adBuilderData.selectedConceptId) ??
    adBuilderData?.adConcepts?.[0] ??
    null;

  const generationSteps = [
    'Understanding your brief',
    'Planning your commercial',
    `Generating your ${durationSeconds}-second commercial`,
    'Checking the result',
  ];
  const cappedStep = Math.min(generationStep, generationSteps.length - 1);

  const qcDecision = selectedVideo?.qcDecision;
  const creativePlan = selectedVideo?.creativePlan;
  const versionLabel = selectedVideo?.generationVersion || (
    generatedVideos.length
      ? `v${Math.max(1, generatedVideos.findIndex((v) => v.id === selectedVideo?.id) + 1)}`
      : null
  );

  useEffect(() => {
    setIsPlaying(false);
  }, [selectedVideo?.id]);

  useEffect(() => {
    if (isBusy || hasVideo) setStageOpened(true);
  }, [isBusy, hasVideo]);

  function togglePlayback() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  }

  function patchProduct(partial: Partial<NonNullable<AdBuilderData['product']>>) {
    if (!product) return;
    onAdBuilderChange({ ...adBuilderData, product: { ...product, ...partial } });
  }

  function handleGenerate() {
    setStageOpened(true);
    if (hasVideo) {
      setShowRegenConfirm(true);
      return;
    }
    onGenerateVideo();
  }

  const composer = (
    <>
      {!product ? (
        <section className="space-y-3">
          <SectionLabel>Product reference</SectionLabel>
          <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>
            Upload or import the actual product image so packaging and branding stay accurate.
          </p>
          <form onSubmit={onProductUrlSubmit} className="space-y-2">
            <input
              type="url"
              value={productUrl}
              onChange={(e) => onProductUrlChange(e.target.value)}
              placeholder="Paste a product URL"
              className="w-full px-3.5 py-3 rounded-xl text-[14px] outline-none"
              style={{ background: SURFACE, border: `1px solid ${LINE}`, color: '#F4F4F7' }}
              disabled={isScrapingProduct}
            />
            <button
              type="submit"
              disabled={!productUrl.trim() || isScrapingProduct}
              className="w-full py-2.5 rounded-xl text-[13px] font-medium disabled:opacity-50"
              style={{ background: SURFACE_2, color: '#F4F4F7', border: `1px solid ${LINE}` }}
            >
              {isScrapingProduct ? 'Fetching product…' : 'Import product'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 rounded-xl text-[13px] inline-flex items-center justify-center gap-1.5"
            style={{ color: MUTED, border: `1px dashed ${LINE}` }}
          >
            <Upload size={14} />
            Or upload product images
          </button>
        </section>
      ) : (
        <section>
          <SectionLabel>Product reference</SectionLabel>
          <div className="flex items-start gap-3 mt-2">
            <div
              className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0"
              style={{ border: `1px solid ${LINE}`, background: SURFACE }}
            >
              {product.hero_image ? (
                <img src={product.hero_image} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ color: MUTED }}>
                  <Film size={18} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <input
                value={product.product_name}
                onChange={(e) => patchProduct({ product_name: e.target.value })}
                className="w-full bg-transparent text-[15px] font-medium outline-none leading-snug"
                style={{ color: '#F4F4F7' }}
              />
              <p className="text-[12px] mt-0.5 truncate" style={{ color: MUTED }}>
                {product.category || 'Product'}
                {product.brand_name ? ` · ${product.brand_name}` : brand?.name ? ` · ${brand.name}` : ''}
                {isFetchingLogo ? ' · fetching logo' : ''}
              </p>
              <button
                type="button"
                onClick={() => setShowReplaceProduct((open) => !open)}
                className="text-[12px] mt-1 hover:opacity-80"
                style={{ color: '#A1A1AA' }}
              >
                Replace product
              </button>
            </div>
          </div>
          {showReplaceProduct && (
            <form onSubmit={onProductUrlSubmit} className="mt-3 flex gap-2">
              <input
                type="url"
                value={productUrl}
                onChange={(e) => onProductUrlChange(e.target.value)}
                placeholder="Replace via product URL"
                className="flex-1 px-3 py-2 rounded-lg text-[12px] outline-none"
                style={{ background: SURFACE, border: `1px solid ${LINE}`, color: '#F4F4F7' }}
                disabled={isScrapingProduct}
              />
              <button
                type="submit"
                disabled={!productUrl.trim() || isScrapingProduct}
                className="px-3 py-2 rounded-lg text-[12px] disabled:opacity-50"
                style={{ background: SURFACE_2, border: `1px solid ${LINE}`, color: '#E8E8EE' }}
              >
                {isScrapingProduct ? '…' : 'Go'}
              </button>
            </form>
          )}
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px]" style={{ color: MUTED }}>
            {referenceCount} reference image{referenceCount === 1 ? '' : 's'}
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[12px] inline-flex items-center gap-1 hover:opacity-80"
            style={{ color: '#D4D4DC' }}
          >
            <ImagePlus size={13} />
            Add images
          </button>
        </div>
        <div className="flex gap-2">
          {(product?.product_images || []).slice(0, 3).map((img, idx) => {
            const selected = (selectedImageIndex ?? 0) === idx;
            return (
              <button
                key={`${img.slice(0, 24)}-${idx}`}
                type="button"
                onClick={() => onSelectImage(idx, img)}
                className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"
                style={{
                  border: selected ? `2px solid ${PURPLE}` : `1px solid ${LINE}`,
                  boxShadow: selected ? `0 0 0 3px ${PURPLE_SOFT}` : undefined,
                }}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            );
          })}
          {referenceCount === 0 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 rounded-xl flex items-center justify-center"
              style={{ border: `1px dashed ${LINE}`, color: MUTED }}
            >
              <Plus size={18} />
            </button>
          )}
        </div>
        <p className="text-[12px] mt-3 leading-relaxed" style={{ color: MUTED }}>
          This is the canonical product reference for packaging and branding.
        </p>
      </section>

      <section>
        <SectionLabel>Creative direction</SectionLabel>
        <p className="text-[13px] leading-relaxed mb-3" style={{ color: MUTED }}>
          Optional notes for the director. Strategy, concept, and cinematography are drafted automatically.
        </p>
        <textarea
          value={adBuilderData.userDescription || ''}
          onChange={(e) => {
            if (promptBeforeEnhance != null) setPromptBeforeEnhance(null);
            onAdBuilderChange({ ...adBuilderData, userDescription: e.target.value });
          }}
          placeholder="Families like quinoa and porridge. Children enjoy the taste, parents appreciate the quick and nutritious meal…"
          rows={showStage ? 6 : 8}
          className="w-full px-3.5 py-3 rounded-xl text-[14px] leading-relaxed resize-none outline-none"
          style={{ background: SURFACE, border: `1px solid ${LINE}`, color: '#EDEDF2' }}
        />
        <div className="mt-2 flex items-center justify-end gap-3">
          {promptBeforeEnhance != null && !isEnhancingPrompt && (
            <button
              type="button"
              onClick={handleUndoEnhance}
              className="text-[13px]"
              style={{ color: '#C8C8D2' }}
            >
              Undo
            </button>
          )}
          <button
            type="button"
            onClick={handleEnhancePrompt}
            disabled={isEnhancingPrompt || isBusy || !(adBuilderData.userDescription || '').trim()}
            className="inline-flex items-center gap-1.5 text-[13px] px-2.5 py-1 rounded-lg disabled:opacity-40"
            style={{ color: '#E8E0FF', border: `1px solid ${PURPLE_BORDER}` }}
          >
            <Sparkles size={13} />
            {isEnhancingPrompt ? 'Enhancing…' : 'Enhance Prompt'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced((open) => !open)}
          className="mt-2 text-[13px] inline-flex items-center gap-1"
          style={{ color: '#D0D0D8' }}
        >
          Advanced creative form
          <ChevronDown size={14} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>
      </section>

      {showAdvanced && (
        <section className="space-y-4">
          <FieldLabel>Campaign goal</FieldLabel>
          <ChipGrid
            items={[...CAMPAIGN_GOALS]}
            value={adSetup.campaignGoal}
            onChange={(goal) =>
              onAdBuilderChange({
                ...adBuilderData,
                adSetup: {
                  ...adSetup,
                  campaignGoal: goal as AdBuilderData['adSetup']['campaignGoal'],
                },
              })
            }
          />

          <FieldLabel>Creative format</FieldLabel>
          <p className="text-[12px] -mt-2" style={{ color: MUTED }}>
            {FORMAT_DESCRIPTIONS[adSetup.creativeFormat]}
          </p>
          <ChipGrid
            items={[...CREATIVE_FORMATS]}
            value={adSetup.creativeFormat}
            onChange={(format) =>
              onAdBuilderChange({
                ...adBuilderData,
                adSetup: {
                  ...adSetup,
                  creativeFormat: format as AdBuilderData['adSetup']['creativeFormat'],
                },
              })
            }
          />

          <FieldLabel>Hook type</FieldLabel>
          <p className="text-[12px] -mt-2" style={{ color: MUTED }}>
            {HOOK_DESCRIPTIONS[adSetup.hookType]}
          </p>
          <ChipGrid
            items={HOOK_TYPES.map((hook) => (hook === 'Auto' ? 'Auto (Recommended)' : hook))}
            value={adSetup.hookType === 'Auto' ? 'Auto (Recommended)' : adSetup.hookType}
            onChange={(hook) =>
              onAdBuilderChange({
                ...adBuilderData,
                adSetup: {
                  ...adSetup,
                  hookType: (hook === 'Auto (Recommended)' ? 'Auto' : hook) as AdBuilderData['adSetup']['hookType'],
                },
              })
            }
          />

          <FieldLabel>Ad tone</FieldLabel>
          <ChipGrid
            items={['Energetic', 'Calm', 'Premium', 'Fun']}
            value={voiceover.tone}
            onChange={(tone) =>
              onAdBuilderChange({
                ...adBuilderData,
                voiceover: { ...voiceover, tone: tone as AdBuilderData['voiceover']['tone'] },
              })
            }
          />

          <FieldLabel>Key benefit</FieldLabel>
          <input
            value={voiceover.key_message || ''}
            onChange={(e) =>
              onAdBuilderChange({
                ...adBuilderData,
                voiceover: { ...voiceover, key_message: e.target.value },
              })
            }
            placeholder="What should the viewer feel or believe?"
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
            style={{ background: SURFACE, border: `1px solid ${LINE}`, color: '#F4F4F7' }}
          />

          <FieldLabel>CTA</FieldLabel>
          <input
            value={voiceover.cta || adBuilderData.creativeStrategy?.cta || ''}
            onChange={(e) =>
              onAdBuilderChange({
                ...adBuilderData,
                voiceover: { ...voiceover, cta: e.target.value },
              })
            }
            placeholder="Shop now, try it today…"
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
            style={{ background: SURFACE, border: `1px solid ${LINE}`, color: '#F4F4F7' }}
          />

          {(promptVariants.length > 0 || isLoadingVariants) && (
            <div>
              <FieldLabel>Cinematic style {isLoadingVariants ? '(loading…)' : ''}</FieldLabel>
              <div className="space-y-2">
                {promptVariants.map((variant) => {
                  const selected = selectedFilmStyleId === variant.filmStyleId;
                  return (
                    <button
                      key={variant.filmStyleId}
                      type="button"
                      onClick={() => onSelectFilmStyle(variant.filmStyleId)}
                      className="w-full text-left p-3 rounded-xl"
                      style={{
                        border: `1px solid ${selected ? PURPLE_BORDER : LINE}`,
                        background: selected ? PURPLE_SOFT : SURFACE,
                      }}
                    >
                      <p className="text-[13px] font-medium" style={{ color: '#F4F4F7' }}>
                        {variant.label}
                      </p>
                      <p className="text-[12px] mt-1 line-clamp-2" style={{ color: MUTED }}>
                        {variant.summary}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      <section>
        <SectionLabel>Output</SectionLabel>
        <p className="text-[12px] mb-2" style={{ color: MUTED }}>
          Duration
        </p>
        <div className="flex gap-2 mb-4">
          {VIDEO_DURATIONS.map((dur) => {
            const selected = adSetup.duration === dur;
            return (
              <button
                key={dur}
                type="button"
                onClick={() =>
                  onAdBuilderChange({
                    ...adBuilderData,
                    adSetup: { ...adSetup, duration: dur },
                  })
                }
                className="flex-1 py-2.5 rounded-xl text-[13px] font-medium"
                style={{
                  background: selected ? PURPLE_SOFT : SURFACE,
                  border: `1px solid ${selected ? PURPLE_BORDER : LINE}`,
                  color: selected ? '#F4F4F7' : MUTED,
                }}
              >
                {dur}s
              </button>
            );
          })}
        </div>
        <p className="text-[12px] mb-2" style={{ color: MUTED }}>
          Aspect ratio
        </p>
        <div className="flex gap-2">
          {(['9:16', '16:9'] as const).map((ratio) => {
            const selected = adSetup.aspect_ratio === ratio;
            return (
              <button
                key={ratio}
                type="button"
                onClick={() => onUpdateAspectRatio(ratio)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-medium inline-flex items-center justify-center gap-1.5"
                style={{
                  background: selected ? PURPLE_SOFT : SURFACE,
                  border: `1px solid ${selected ? PURPLE_BORDER : LINE}`,
                  color: selected ? '#F4F4F7' : MUTED,
                }}
              >
                <span>{ratio}</span>
                <AspectRatioGlyph ratio={ratio} selected={selected} />
              </button>
            );
          })}
        </div>
      </section>

      {(selectedConcept || adBuilderData.adAngle) && (
        <button
          type="button"
          onClick={() => setShowConcept((open) => !open)}
          className="w-full text-left py-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] tracking-[0.14em] uppercase" style={{ color: MUTED }}>
              Creative concept
            </span>
            <ChevronDown
              size={13}
              className={`transition-transform ${showConcept ? 'rotate-180' : ''}`}
              style={{ color: MUTED }}
            />
          </div>
          {showConcept && (
            <div className="mt-2">
              <p className="text-[13px] font-medium" style={{ color: '#F4F4F7' }}>
                {selectedConcept?.title || adSetup.creativeFormat}
              </p>
              <p className="text-[12px] mt-1 leading-relaxed" style={{ color: MUTED }}>
                {selectedConcept?.oneLinePitch ||
                  adBuilderData.adAngle ||
                  `${adSetup.hookType} · ${adSetup.campaignGoal}`}
              </p>
            </div>
          )}
        </button>
      )}
    </>
  );

  const generateButton = (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={!canGenerate}
      className="inline-flex items-center justify-center gap-2 min-w-[11.5rem] px-8 py-2.5 rounded-xl text-[14px] font-semibold transition-all disabled:opacity-45 disabled:cursor-not-allowed"
      style={{
        background: PURPLE,
        color: 'white',
        boxShadow: canGenerate ? '0 10px 28px rgba(168,85,247,0.3)' : undefined,
      }}
    >
      {isBusy ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
      ) : (
        <Sparkles size={15} />
      )}
      {isBusy ? 'Generating…' : generateLabel}
    </button>
  );

  return (
    <div
      className="flex-1 flex flex-col min-w-0 h-full overflow-hidden"
      style={{ background: STUDIO_BG, borderLeft: `1px solid ${LINE}` }}
    >
      <div
        className="flex-shrink-0 px-4 h-11 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${LINE}`, background: RAIL_BG }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.push('/brand-studio')}
            className="inline-flex items-center gap-1.5 text-[13px] transition-colors hover:opacity-90"
            style={{ color: MUTED }}
          >
            <ArrowLeft size={14} />
            Back to Brand Studio
          </button>
          <span className="text-[11px] tracking-[0.16em] uppercase font-medium" style={{ color: '#C4C4CE' }}>
            Studio
          </span>
        </div>
        <div className="text-[11px]" style={{ color: MUTED }}>
          {isSaving ? 'Saving…' : isBusy ? 'Working…' : 'Ready'}
        </div>
      </div>

      <div
        className="flex-shrink-0 px-5 py-3 flex items-center justify-between gap-4 flex-wrap"
        style={{ borderBottom: `1px solid ${LINE}` }}
      >
        <div className="min-w-0">
          <h1 className="text-[15px] font-medium truncate" style={{ color: '#F4F4F7' }} title={title}>
            {sessionName || title}
          </h1>
          {product?.brand_name && (
            <p className="text-[11px] mt-0.5 truncate" style={{ color: MUTED }}>
              {product.brand_name}
              {product.category ? ` · ${product.category}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {showStage && (
            <>
              <MetaChip>{durationSeconds}s</MetaChip>
              <MetaChip>{aspectRatio}</MetaChip>
            </>
          )}
          {videoCredits !== null && (
            <MetaChip accent>
              {videoCredits.total} credit{videoCredits.total === 1 ? '' : 's'}
            </MetaChip>
          )}
          <GhostButton onClick={onSaveDraft} disabled={!product}>
            <Save size={13} />
            Save Draft
          </GhostButton>
          {showStage && (
            <GhostButton onClick={() => selectedVideo && onDownload(selectedVideo)} disabled={!selectedVideo}>
              <Download size={13} />
              Download
            </GhostButton>
          )}
          {showStage && generateButton}
        </div>
      </div>

      {!showStage ? (
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 70% 55% at 18% 20%, rgba(168,85,247,0.14), transparent 55%),
                radial-gradient(ellipse 55% 45% at 88% 80%, rgba(52,211,153,0.06), transparent 50%),
                linear-gradient(180deg, #0E0E14 0%, ${STUDIO_BG} 48%, #08080C 100%)
              `,
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: '72px 72px',
              maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
            }}
          />

          <div className="relative h-full overflow-y-auto">
            <div className="min-h-full px-6 md:px-10 lg:px-14 py-7 md:py-9 flex flex-col gap-7">
              <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div className="min-w-0 max-w-2xl">
                  <p
                    className="text-[11px] tracking-[0.2em] uppercase mb-2"
                    style={{ color: '#A78BFA' }}
                  >
                    Commercial brief
                  </p>
                  <h2
                    className="text-[32px] md:text-[40px] font-medium tracking-[-0.03em] leading-[1.05]"
                    style={{ color: '#F7F7FA' }}
                  >
                    {sessionName || 'New commercial'}
                  </h2>
                  <p className="text-[15px] mt-3 max-w-lg leading-relaxed" style={{ color: MUTED }}>
                    Lock the product and direction. Hit generate and the studio stage opens beside you.
                  </p>
                </div>
              </header>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 xl:gap-6 flex-1 min-h-0">
                {/* Product column — visual weight */}
                <section
                  className="xl:col-span-5 flex flex-col rounded-2xl overflow-hidden min-h-[420px]"
                  style={{
                    background: 'linear-gradient(165deg, #16161F 0%, #101018 55%, #0C0C12 100%)',
                    border: `1px solid ${LINE}`,
                  }}
                >
                  <div
                    className="relative flex-1 min-h-[220px] flex items-center justify-center p-6"
                    style={{
                      background:
                        'radial-gradient(ellipse at 50% 40%, rgba(168,85,247,0.12), transparent 65%)',
                    }}
                  >
                    {product?.hero_image ? (
                      <div className="relative w-full max-w-[280px]">
                        <div
                          className="absolute -inset-6 rounded-full blur-3xl opacity-40"
                          style={{ background: PURPLE }}
                        />
                        <img
                          src={product.hero_image}
                          alt=""
                          className="relative w-full aspect-square object-cover rounded-2xl"
                          style={{ border: `1px solid ${LINE}`, boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }}
                        />
                      </div>
                    ) : (
                      <form
                        onSubmit={onProductUrlSubmit}
                        className="w-full max-w-md flex flex-col items-center text-center gap-4"
                      >
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center"
                          style={{ background: SURFACE, border: `1px solid ${LINE}` }}
                        >
                          <Film size={26} style={{ color: '#C4B5FD' }} />
                        </div>
                        <div>
                          <p className="text-[17px] font-medium" style={{ color: '#F4F4F7' }}>
                            Product reference
                          </p>
                          <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: MUTED }}>
                            Upload the actual product image so the commercial can preserve its
                            appearance, packaging and branding.
                          </p>
                        </div>
                        <input
                          type="url"
                          value={productUrl}
                          onChange={(e) => onProductUrlChange(e.target.value)}
                          placeholder="https://yourstore.com/product"
                          className="w-full px-4 py-3 rounded-xl text-[14px] outline-none text-left"
                          style={{ background: '#0A0A0E', border: `1px solid ${LINE}`, color: '#F4F4F7' }}
                          disabled={isScrapingProduct}
                        />
                        <div className="flex w-full gap-2">
                          <button
                            type="submit"
                            disabled={!productUrl.trim() || isScrapingProduct}
                            className="flex-1 py-2.5 rounded-xl text-[13px] font-medium disabled:opacity-50"
                            style={{ background: PURPLE, color: 'white' }}
                          >
                            {isScrapingProduct ? 'Fetching…' : 'Import URL'}
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2.5 rounded-xl text-[13px] inline-flex items-center gap-1.5"
                            style={{ background: SURFACE, border: `1px solid ${LINE}`, color: '#E8E8EE' }}
                          >
                            <Upload size={14} />
                            Upload
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  <div className="px-5 py-4 space-y-3" style={{ borderTop: `1px solid ${LINE}` }}>
                    {product && (
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <input
                            value={product.product_name}
                            onChange={(e) => patchProduct({ product_name: e.target.value })}
                            className="w-full bg-transparent text-[16px] font-medium outline-none"
                            style={{ color: '#F4F4F7' }}
                          />
                          <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>
                            {product.category || 'Product'}
                            {product.brand_name
                              ? ` · ${product.brand_name}`
                              : brand?.name
                                ? ` · ${brand.name}`
                                : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowReplaceProduct((open) => !open)}
                          className="text-[12px] flex-shrink-0"
                          style={{ color: '#A1A1AA' }}
                        >
                          Replace
                        </button>
                      </div>
                    )}
                    {product && showReplaceProduct && (
                      <form onSubmit={onProductUrlSubmit} className="flex gap-2">
                        <input
                          type="url"
                          value={productUrl}
                          onChange={(e) => onProductUrlChange(e.target.value)}
                          placeholder="Replace via product URL"
                          className="flex-1 px-3 py-2 rounded-lg text-[12px] outline-none"
                          style={{ background: SURFACE, border: `1px solid ${LINE}`, color: '#F4F4F7' }}
                          disabled={isScrapingProduct}
                        />
                        <button
                          type="submit"
                          disabled={!productUrl.trim() || isScrapingProduct}
                          className="px-3 py-2 rounded-lg text-[12px] disabled:opacity-50"
                          style={{ background: SURFACE_2, border: `1px solid ${LINE}`, color: '#E8E8EE' }}
                        >
                          Go
                        </button>
                      </form>
                    )}

                    <div className="flex items-center justify-between">
                      <p className="text-[12px]" style={{ color: MUTED }}>
                        Reference stills
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[12px] inline-flex items-center gap-1"
                        style={{ color: '#D4D4DC' }}
                      >
                        <ImagePlus size={13} />
                        Add
                      </button>
                    </div>
                    <div className="flex gap-2">
                      {(product?.product_images || []).slice(0, 4).map((img, idx) => {
                        const selected = (selectedImageIndex ?? 0) === idx;
                        return (
                          <button
                            key={`${img.slice(0, 24)}-${idx}`}
                            type="button"
                            onClick={() => onSelectImage(idx, img)}
                            className="relative w-[72px] h-[72px] rounded-xl overflow-hidden flex-shrink-0"
                            style={{
                              border: selected ? `2px solid ${PURPLE}` : `1px solid ${LINE}`,
                            }}
                          >
                            <img src={img} alt="" className="w-full h-full object-cover" />
                          </button>
                        );
                      })}
                      {referenceCount < 4 && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-[72px] h-[72px] rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ border: `1px dashed ${LINE}`, color: MUTED }}
                        >
                          <Plus size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                {/* Direction + output column */}
                <section className="xl:col-span-7 flex flex-col gap-5 min-h-0">
                  <div
                    className="flex-1 flex flex-col rounded-2xl p-5 md:p-6 min-h-[280px]"
                    style={{
                      background: 'linear-gradient(180deg, #14141C 0%, #101016 100%)',
                      border: `1px solid ${LINE}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="text-[11px] tracking-[0.16em] uppercase" style={{ color: MUTED }}>
                          Creative direction
                        </p>
                        <p className="text-[14px] mt-1" style={{ color: '#C8C8D2' }}>
                          Tone, story, and what the viewer should feel.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAdvanced((open) => !open)}
                        className="text-[12px] inline-flex items-center gap-1 flex-shrink-0"
                        style={{ color: '#D0D0D8' }}
                      >
                        Advanced
                        <ChevronDown
                          size={14}
                          className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </div>
                    <textarea
                      value={adBuilderData.userDescription || ''}
                      onChange={(e) => {
                        if (promptBeforeEnhance != null) setPromptBeforeEnhance(null);
                        onAdBuilderChange({ ...adBuilderData, userDescription: e.target.value });
                      }}
                      placeholder="Warm family breakfast. Soft daylight. Product feels comforting and everyday — not clinical."
                      className="flex-1 w-full min-h-[180px] px-0 py-0 text-[16px] md:text-[17px] leading-[1.55] resize-none outline-none bg-transparent"
                      style={{ color: '#F0F0F5' }}
                    />

                    <div className="mt-4 flex items-center justify-end gap-3">
                      {promptBeforeEnhance != null && !isEnhancingPrompt && (
                        <button
                          type="button"
                          onClick={handleUndoEnhance}
                          className="text-[13px] px-2 py-1.5 rounded-lg"
                          style={{ color: '#C8C8D2' }}
                        >
                          Undo
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleEnhancePrompt}
                        disabled={isEnhancingPrompt || isBusy || !(adBuilderData.userDescription || '').trim()}
                        className="inline-flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-40"
                        style={{
                          color: '#E8E0FF',
                          background: 'rgba(168, 85, 247, 0.12)',
                          border: `1px solid ${PURPLE_BORDER}`,
                        }}
                      >
                        <Sparkles size={14} />
                        {isEnhancingPrompt ? 'Enhancing…' : 'Enhance Prompt'}
                      </button>
                    </div>

                    {showAdvanced && (
                      <div
                        className="mt-5 pt-5 space-y-4"
                        style={{ borderTop: `1px solid ${LINE}` }}
                      >
                        <FieldLabel>Campaign goal</FieldLabel>
                        <ChipGrid
                          items={[...CAMPAIGN_GOALS]}
                          value={adSetup.campaignGoal}
                          onChange={(goal) =>
                            onAdBuilderChange({
                              ...adBuilderData,
                              adSetup: {
                                ...adSetup,
                                campaignGoal: goal as AdBuilderData['adSetup']['campaignGoal'],
                              },
                            })
                          }
                        />
                        <FieldLabel>Creative format</FieldLabel>
                        <ChipGrid
                          items={[...CREATIVE_FORMATS]}
                          value={adSetup.creativeFormat}
                          onChange={(format) =>
                            onAdBuilderChange({
                              ...adBuilderData,
                              adSetup: {
                                ...adSetup,
                                creativeFormat: format as AdBuilderData['adSetup']['creativeFormat'],
                              },
                            })
                          }
                        />
                        <FieldLabel>Hook type</FieldLabel>
                        <ChipGrid
                          items={HOOK_TYPES.map((hook) =>
                            hook === 'Auto' ? 'Auto (Recommended)' : hook
                          )}
                          value={
                            adSetup.hookType === 'Auto' ? 'Auto (Recommended)' : adSetup.hookType
                          }
                          onChange={(hook) =>
                            onAdBuilderChange({
                              ...adBuilderData,
                              adSetup: {
                                ...adSetup,
                                hookType: (hook === 'Auto (Recommended)'
                                  ? 'Auto'
                                  : hook) as AdBuilderData['adSetup']['hookType'],
                              },
                            })
                          }
                        />
                      </div>
                    )}
                  </div>

                  <div
                    className="rounded-2xl p-5 md:px-6 md:py-5 flex flex-col sm:flex-row sm:items-center gap-5"
                    style={{
                      background: RAIL_BG,
                      border: `1px solid ${LINE}`,
                    }}
                  >
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[11px] tracking-[0.14em] uppercase mb-2" style={{ color: MUTED }}>
                          Duration
                        </p>
                        <div className="flex gap-2">
                          {VIDEO_DURATIONS.map((dur) => {
                            const selected = adSetup.duration === dur;
                            return (
                              <button
                                key={dur}
                                type="button"
                                onClick={() =>
                                  onAdBuilderChange({
                                    ...adBuilderData,
                                    adSetup: { ...adSetup, duration: dur },
                                  })
                                }
                                className="flex-1 py-2.5 rounded-xl text-[13px] font-medium"
                                style={{
                                  background: selected ? PURPLE_SOFT : SURFACE,
                                  border: `1px solid ${selected ? PURPLE_BORDER : LINE}`,
                                  color: selected ? '#F4F4F7' : MUTED,
                                }}
                              >
                                {dur}s
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] tracking-[0.14em] uppercase mb-2" style={{ color: MUTED }}>
                          Aspect ratio
                        </p>
                        <div className="flex gap-2">
                          {(['9:16', '16:9'] as const).map((ratio) => {
                            const selected = adSetup.aspect_ratio === ratio;
                            return (
                              <button
                                key={ratio}
                                type="button"
                                onClick={() => onUpdateAspectRatio(ratio)}
                                className="flex-1 py-2.5 rounded-xl text-[13px] font-medium inline-flex items-center justify-center gap-1.5"
                                style={{
                                  background: selected ? PURPLE_SOFT : SURFACE,
                                  border: `1px solid ${selected ? PURPLE_BORDER : LINE}`,
                                  color: selected ? '#F4F4F7' : MUTED,
                                }}
                              >
                                <span>{ratio}</span>
                                <AspectRatioGlyph ratio={ratio} selected={selected} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="sm:pl-2 sm:border-l flex-shrink-0" style={{ borderColor: LINE }}>
                      <p className="text-[12px] mb-2 hidden sm:block" style={{ color: MUTED }}>
                        {product ? 'Brief looks solid.' : 'Add a product first.'}
                      </p>
                      {generateButton}
                    </div>
                  </div>

                  {hasInsufficientCredits && <InsufficientCreditsAlert type="video" />}
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          <aside
            className="w-[340px] flex-shrink-0 flex flex-col min-h-0"
            style={{ background: RAIL_BG, borderRight: `1px solid ${LINE}` }}
          >
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">{composer}</div>
          </aside>

          <div className="flex-1 flex flex-col min-w-0 min-h-0" style={{ background: STUDIO_BG }}>
            <div className="flex-1 min-h-0 px-5 pt-4 pb-3 flex flex-col">
              <div className="flex items-start justify-between gap-4 mb-2 px-1">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: '#F4F4F7' }}>
                    {title}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>
                    {durationSeconds}s commercial · {aspectRatio}
                    {versionLabel ? ` · ${versionLabel}` : ''} ·{' '}
                    {isBusy
                      ? productionStatus === 'regenerating'
                        ? 'Regenerating'
                        : 'Generating'
                      : productionStatus === 'manual_review'
                        ? 'Needs review'
                        : hasVideo
                          ? qcDecision === 'accept'
                            ? 'Ready'
                            : qcDecision === 'regenerate'
                              ? 'Review suggested'
                              : 'Ready'
                          : 'Directing'}
                  </p>
                </div>
                {generatedVideos.length > 1 && (
                  <div className="flex items-center gap-1.5 text-[11px]" style={{ color: MUTED }}>
                    {generatedVideos.map((video, index) => (
                      <button
                        key={video.id}
                        type="button"
                        onClick={() => onSelectVideo(video.id)}
                        className="w-2 h-2 rounded-full"
                        style={{
                          background: video.id === selectedVideo?.id ? PURPLE : 'rgba(255,255,255,0.22)',
                        }}
                        aria-label={`Version ${video.generationVersion || index + 1}`}
                      />
                    ))}
                    <span>
                      {versionLabel || `v${Math.max(1, generatedVideos.findIndex((video) => video.id === selectedVideo?.id) + 1)}`}
                      {selectedVideo?.id === generatedVideos[generatedVideos.length - 1]?.id
                        ? ' · Current'
                        : ''}
                    </span>
                  </div>
                )}
              </div>

              <div
                className="relative flex-1 min-h-[240px] rounded-xl overflow-hidden"
                style={{ background: '#050507', border: `1px solid ${LINE}` }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="relative bg-black"
                    style={{
                      aspectRatio: aspect,
                      width: isLandscape ? '100%' : undefined,
                      height: isLandscape ? undefined : '100%',
                      maxWidth: '100%',
                      maxHeight: '100%',
                    }}
                  >
                    {hasVideo && selectedVideo ? (
                      <video
                        ref={videoRef}
                        key={selectedVideo.id}
                        src={selectedVideo.url}
                        className="absolute inset-0 w-full h-full object-contain"
                        playsInline
                        crossOrigin="anonymous"
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onClick={togglePlayback}
                      />
                    ) : product?.hero_image ? (
                      <img
                        src={product.hero_image}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-40"
                      />
                    ) : null}

                    {!hasVideo && !isBusy && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                          style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${LINE}` }}
                        >
                          <Play size={22} fill="white" className="ml-0.5" />
                        </div>
                        <p className="text-[14px] font-medium" style={{ color: '#F4F4F7' }}>
                          Preparing your commercial
                        </p>
                        <p className="text-[12px] mt-1 max-w-sm" style={{ color: MUTED }}>
                          Generation will appear here as soon as rendering starts.
                        </p>
                      </div>
                    )}

                    {hasVideo && !isBusy && (
                      <button
                        type="button"
                        onClick={togglePlayback}
                        className="absolute inset-0 flex items-center justify-center group"
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                      >
                        <span
                          className={`w-16 h-16 rounded-full flex items-center justify-center transition-opacity ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
                          style={{
                            background: 'rgba(0,0,0,0.45)',
                            border: '1px solid rgba(255,255,255,0.16)',
                          }}
                        >
                          {isPlaying ? (
                            <Pause size={26} fill="white" />
                          ) : (
                            <Play size={26} fill="white" className="ml-0.5" />
                          )}
                        </span>
                      </button>
                    )}

                    {isBusy && (
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center px-8"
                        style={{ background: 'rgba(5,5,7,0.72)' }}
                      >
                        <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin mb-4" />
                        <p className="text-[14px] font-medium" style={{ color: '#F4F4F7' }}>
                          {productionStatus === 'regenerating'
                            ? 'Improving your commercial'
                            : 'Creating your commercial'}
                        </p>
                        <ul className="mt-4 space-y-1.5 text-left w-64" aria-live="polite">
                          {generationSteps.map((label, i) => {
                            const done = i < cappedStep;
                            const active = i === cappedStep;
                            return (
                              <li
                                key={label}
                                className="text-[12px] flex items-center gap-2"
                                style={{
                                  color: done || active ? '#F4F4F7' : MUTED,
                                }}
                              >
                                <span className="w-4 text-center" aria-hidden>
                                  {done ? '✓' : active ? '●' : '○'}
                                </span>
                                {label}
                              </li>
                            );
                          })}
                        </ul>
                        <p className="text-[11px] mt-4" style={{ color: MUTED }}>
                          Keep this tab open. One {durationSeconds}-second generation — usually a few
                          minutes.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {hasVideo && !isBusy && selectedVideo && (
                <div className="mt-3 px-1 space-y-3">
                  {/* QC status */}
                  <div
                    className="rounded-xl px-4 py-3"
                    style={{ background: SURFACE, border: `1px solid ${LINE}` }}
                  >
                    {qcDecision === 'accept' || (!qcDecision && hasVideo) ? (
                      <>
                        <p className="text-[13px] font-medium" style={{ color: '#F4F4F7' }}>
                          Commercial ready
                        </p>
                        <p className="text-[12px] mt-1" style={{ color: MUTED }}>
                          Your {selectedVideo.duration || durationSeconds}s commercial
                          {selectedVideo.qcSummary?.visualAvailable
                            ? ' passed quality checks'
                            : ' passed technical checks'}
                          .
                        </p>
                      </>
                    ) : qcDecision === 'manual_review' || productionStatus === 'manual_review' ? (
                      <>
                        <p className="text-[13px] font-medium" style={{ color: '#F4F4F7' }}>
                          Needs review
                        </p>
                        <p className="text-[12px] mt-1" style={{ color: MUTED }}>
                          Automated checks could not confidently verify something. You can keep this
                          version or regenerate.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[13px] font-medium" style={{ color: '#F4F4F7' }}>
                          Improvement suggested
                        </p>
                        <p className="text-[12px] mt-1" style={{ color: MUTED }}>
                          {selectedVideo.qcSummary?.reason ||
                            pendingRegeneration?.reason ||
                            'We found an issue worth regenerating.'}
                        </p>
                      </>
                    )}

                    <div className="flex flex-wrap gap-2 mt-3">
                      {(qcDecision === 'regenerate' || pendingRegeneration) && (
                        <button
                          type="button"
                          onClick={() => setShowRegenConfirm(true)}
                          className="px-3 py-1.5 rounded-lg text-[12px] font-medium"
                          style={{ background: PURPLE, color: 'white' }}
                        >
                          Regenerate
                        </button>
                      )}
                      {(qcDecision === 'manual_review' || productionStatus === 'manual_review') && (
                        <>
                          <button
                            type="button"
                            onClick={onKeepVersion}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-medium"
                            style={{ background: PURPLE, color: 'white' }}
                          >
                            Keep this version
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowRegenConfirm(true)}
                            className="px-3 py-1.5 rounded-lg text-[12px]"
                            style={{ background: SURFACE_2, border: `1px solid ${LINE}`, color: '#E8E8EE' }}
                          >
                            Regenerate
                          </button>
                        </>
                      )}
                      {(qcDecision === 'accept' || !qcDecision) && (
                        <button
                          type="button"
                          onClick={() => setShowRegenConfirm(true)}
                          className="px-3 py-1.5 rounded-lg text-[12px]"
                          style={{ background: SURFACE_2, border: `1px solid ${LINE}`, color: '#E8E8EE' }}
                        >
                          Regenerate
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowQcDetails((v) => !v)}
                        className="px-3 py-1.5 rounded-lg text-[12px]"
                        style={{ color: MUTED }}
                      >
                        {showQcDetails ? 'Hide QC details' : 'View QC details'}
                      </button>
                    </div>

                    {showQcDetails && selectedVideo.qcSummary?.categories && (
                      <ul className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                        {Object.entries(selectedVideo.qcSummary.categories).map(([key, status]) => (
                          <li
                            key={key}
                            className="flex justify-between gap-2 px-2 py-1.5 rounded-md"
                            style={{ background: SURFACE_2 }}
                          >
                            <span style={{ color: MUTED, textTransform: 'capitalize' }}>
                              {key === 'artifacts' ? 'Visual artifacts' : key}
                            </span>
                            <span style={{ color: '#E8E8EE' }}>{String(status).replace(/_/g, ' ')}</span>
                          </li>
                        ))}
                        <li className="col-span-2 text-[11px]" style={{ color: MUTED }}>
                          {selectedVideo.qcSummary.visualAvailable
                            ? 'Includes visual review of sampled frames.'
                            : 'Technical checks only — visual review was not run.'}
                        </li>
                      </ul>
                    )}
                  </div>

                  {/* Creative plan */}
                  {creativePlan && (
                    <div
                      className="rounded-xl px-4 py-3"
                      style={{ background: SURFACE, border: `1px solid ${LINE}` }}
                    >
                      <button
                        type="button"
                        onClick={() => setShowCreativePlan((v) => !v)}
                        className="w-full flex items-center justify-between text-left"
                      >
                        <span className="text-[11px] tracking-[0.16em] uppercase" style={{ color: MUTED }}>
                          Creative plan
                        </span>
                        <ChevronDown
                          size={14}
                          style={{
                            color: MUTED,
                            transform: showCreativePlan ? 'rotate(180deg)' : undefined,
                          }}
                        />
                      </button>
                      {showCreativePlan && (
                        <div className="mt-3 space-y-2">
                          <p className="text-[13px] font-medium" style={{ color: '#F4F4F7' }}>
                            {creativePlan.conceptTitle}
                          </p>
                          {creativePlan.conceptPitch && (
                            <p className="text-[12px] leading-relaxed" style={{ color: MUTED }}>
                              {creativePlan.conceptPitch}
                            </p>
                          )}
                          {creativePlan.visualDirection && (
                            <p className="text-[12px] leading-relaxed" style={{ color: '#D0D0D8' }}>
                              {creativePlan.visualDirection}
                            </p>
                          )}
                          {creativePlan.storyBeats?.length > 0 && (
                            <ol className="mt-2 space-y-1">
                              {creativePlan.storyBeats.map((beat) => (
                                <li key={beat.index} className="text-[12px]" style={{ color: MUTED }}>
                                  <span style={{ color: '#E8E8EE' }}>
                                    {String(beat.index).padStart(2, '0')} {beat.label}
                                  </span>
                                  {beat.intent ? ` — ${beat.intent}` : ''}
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {showRegenConfirm && (
                <div
                  className="fixed inset-0 z-40 flex items-center justify-center p-4"
                  style={{ background: 'rgba(0,0,0,0.55)' }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setShowRegenConfirm(false);
                  }}
                >
                  <div
                    className="max-w-md w-full rounded-xl p-5"
                    style={{ background: RAIL_BG, border: `1px solid ${LINE}` }}
                    role="dialog"
                    aria-labelledby="regen-title"
                  >
                    <h3 id="regen-title" className="text-[15px] font-medium" style={{ color: '#F4F4F7' }}>
                      Regenerate commercial
                    </h3>
                    <p className="text-[12px] mt-2" style={{ color: MUTED }}>
                      Duration stays {durationSeconds}s — one continuous generation.
                    </p>
                    {(pendingRegeneration?.preservedRequirements?.length ||
                      selectedVideo?.qcSummary?.preservedRequirements?.length) && (
                      <div className="mt-3">
                        <p className="text-[12px] font-medium" style={{ color: '#E8E8EE' }}>
                          We&apos;ll preserve
                        </p>
                        <ul className="mt-1 text-[12px] space-y-0.5" style={{ color: MUTED }}>
                          {(
                            pendingRegeneration?.preservedRequirements ||
                            selectedVideo?.qcSummary?.preservedRequirements ||
                            []
                          )
                            .slice(0, 5)
                            .map((item) => (
                              <li key={item}>• {item}</li>
                            ))}
                        </ul>
                      </div>
                    )}
                    {(pendingRegeneration?.requiredChanges?.length ||
                      selectedVideo?.qcSummary?.requiredChanges?.length) && (
                      <div className="mt-3">
                        <p className="text-[12px] font-medium" style={{ color: '#E8E8EE' }}>
                          We&apos;ll improve
                        </p>
                        <ul className="mt-1 text-[12px] space-y-0.5" style={{ color: MUTED }}>
                          {(
                            pendingRegeneration?.requiredChanges ||
                            selectedVideo?.qcSummary?.requiredChanges ||
                            []
                          )
                            .slice(0, 4)
                            .map((item) => (
                              <li key={item}>• {item}</li>
                            ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => setShowRegenConfirm(false)}
                        className="flex-1 py-2 rounded-lg text-[13px]"
                        style={{ background: SURFACE_2, border: `1px solid ${LINE}`, color: '#E8E8EE' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowRegenConfirm(false);
                          onConfirmRegenerate();
                        }}
                        className="flex-1 py-2 rounded-lg text-[13px] font-medium"
                        style={{ background: PURPLE, color: 'white' }}
                      >
                        Regenerate Commercial
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {hasInsufficientCredits && (
              <div className="px-5 pb-2">
                <InsufficientCreditsAlert type="video" />
              </div>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onImageUpload}
      />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] tracking-[0.16em] uppercase mb-2" style={{ color: MUTED }}>
      {children}
    </p>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-medium" style={{ color: '#D0D0D8' }}>
      {children}
    </p>
  );
}

function MetaChip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className="px-2 py-1 rounded-md text-[11px] font-medium"
      style={{
        background: accent ? PURPLE_SOFT : SURFACE,
        border: `1px solid ${accent ? PURPLE_BORDER : LINE}`,
        color: accent ? '#E9D5FF' : '#D4D4DC',
      }}
    >
      {children}
    </span>
  );
}

function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
      style={{ background: SURFACE, border: `1px solid ${LINE}`, color: '#E8E8EE' }}
    >
      {children}
    </button>
  );
}

function ChipGrid({
  items,
  value,
  onChange,
}: {
  items: readonly string[] | string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const selected = value === item;
        return (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium"
            style={{
              background: selected ? PURPLE_SOFT : SURFACE,
              border: `1px solid ${selected ? PURPLE_BORDER : LINE}`,
              color: selected ? '#F4F4F7' : MUTED,
            }}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}
