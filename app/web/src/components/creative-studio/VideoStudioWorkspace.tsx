import React, { useEffect, useRef, useState } from 'react';
import CreativeViewer from './CreativeViewer';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  Download,
  Film,
  ImagePlus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Smartphone,
  Sparkles,
  Scissors,
  Upload,
  X,
} from 'lucide-react';
import { InsufficientCreditsAlert } from '@/app/web/src/components/billing';
import { VIDEO_CREDITS_PER_SECOND } from '@/lib/billing/video-credits';
import { FREE_FIXES_PER_VIDEO } from '@/lib/creative-studio/commercial-production/fix/fix-pricing';
import { showError } from '@/app/web/src/components/ui/alert-modal-api';
import { authFetch, safeResponseJson } from '@/lib/utils';
import {
  type AdBuilderData,
  type BrandSnapshot,
  type CatalogProduct,
  type CommercialProductionStatus,
  type EndCardConfig,
  type FixPlanPreview,
  type FixTimelineData,
  type GeneratedVideo,
} from './types';
import FixEditor, { formatClock } from './FixEditor';
import GenerationReveal from './GenerationReveal';
import {
  HOOK_TYPES,
  HOOK_LABELS,
  CAMPAIGN_GOALS,
  CAMPAIGN_GOAL_LABELS,
  VIDEO_DURATIONS,
} from './utils';
import {
  VOICEOVER_CTA_OPTIONS,
  VOICEOVER_LANGUAGE_LABELS,
  VOICEOVER_LANGUAGES,
  type VoiceoverLanguage,
} from '@/lib/creative-studio/commercial-production/audio/voiceover-languages';
import { getAdTypePlaybook, normalizeAdType } from '@/lib/creative-studio/commercial-production/campaign/ad-type';
import type { ConceptCard } from '@/lib/creative-studio/commercial-production/concepts/generate-concepts';
import { GuidedAdSetup, IdeaCards, VoiceInputButton, WriteHelper } from './GuidedAdSetup';
import { RevoiceBar, UgcSetup } from './UgcSetup';
import { ugcSpeechFor } from '@/lib/creative-studio/commercial-production/campaign/ugc';
import type { AdDirection } from '@/lib/creative-studio/commercial-production/campaign/ad-direction';
import { buildGenerationSteps, generationProgress } from './generation-steps';

const PURPLE = '#A855F7';
const PURPLE_SOFT = 'rgba(168, 85, 247, 0.16)';
const PURPLE_BORDER = 'rgba(168, 85, 247, 0.42)';
const STUDIO_BG = '#0B0B0F';
const RAIL_BG = '#101014';
const SURFACE = '#16161C';
const SURFACE_2 = '#1A1A22';
const LINE = 'rgba(255,255,255,0.08)';
const MUTED = '#A3A3AF';

const HOOK_DESCRIPTIONS: Record<string, string> = {
  Auto: 'We pick the best opening for your product.',
  'Curiosity Hook': 'Open with something that makes people want to keep watching.',
  'Before & After': 'Show life before your product, then after.',
  'Social Proof': 'Show that many people already love it.',
  Contrarian: 'Open with a surprising fact people do not expect.',
  'Problem Agitation': 'Start with the everyday problem your product solves.',
  'Founder Story': 'Share why you started — it builds trust.',
  Testimonial: 'A happy customer talks about it.',
  'Product Demonstration': 'Simply show the product working.',
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

export type CatalogControls = {
  /** null until the user opens the catalog. */
  products: CatalogProduct[] | null;
  isScanning: boolean;
  hasWebsite: boolean;
  onBrowse: () => void;
  onSelect: (product: CatalogProduct) => void;
};

type VideoStudioWorkspaceProps = {
  sessionName?: string;
  isSaving: boolean;
  brand: BrandSnapshot | null;
  adBuilderData: AdBuilderData;
  onAdBuilderChange: (data: AdBuilderData) => void;
  /** Three storyboarded ideas for the current brief (free, before generation). */
  onRequestConcepts: () => Promise<ConceptCard[]>;
  /** "Help me write it": AI writes the description from tap-only answers. */
  onRequestWrite: (direction: AdDirection | undefined) => Promise<string>;
  /** UGC Studio: creator / format / delivery replace the ad-type and style cards. */
  studio?: 'brand' | 'ugc';
  /** UGC voice-over videos: make the same video in another language (no new generation). */
  onRevoice?: (video: GeneratedVideo, language: string) => Promise<void>;
  generatedVideos: GeneratedVideo[];
  selectedVideoId: string | null;
  onSelectVideo: (id: string) => void;
  productUrl: string;
  onProductUrlChange: (url: string) => void;
  onProductUrlSubmit: (e: React.FormEvent) => void;
  isScrapingProduct: boolean;
  /** Products scanned from the brand website. */
  catalog: CatalogControls;
  isFetchingLogo: boolean;
  selectedImageIndex: number | null;
  onSelectImage: (index: number, img: string) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isGeneratingScript: boolean;
  isGeneratingVideo: boolean;
  /** Seconds since the current generation started. */
  generationElapsed: number;
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
  /** "Edit a part": load the timeline, preview a fix (free), then apply a confirmed fix. */
  onLoadFixTimeline?: (video: GeneratedVideo) => Promise<FixTimelineData>;
  onPlanFix?: (
    video: GeneratedVideo,
    selection: { start: number; end: number },
    request: string
  ) => Promise<FixPlanPreview>;
  onApplyFix?: (video: GeneratedVideo, preview: FixPlanPreview) => Promise<void>;
};

export default function VideoStudioWorkspace({
  sessionName,
  isSaving,
  brand,
  adBuilderData,
  onAdBuilderChange,
  onRequestConcepts,
  onRequestWrite,
  studio = 'brand',
  onRevoice,
  generatedVideos,
  selectedVideoId,
  onSelectVideo,
  productUrl,
  onProductUrlChange,
  onProductUrlSubmit,
  isScrapingProduct,
  catalog,
  isFetchingLogo,
  selectedImageIndex,
  onSelectImage,
  onImageUpload,
  isGeneratingScript,
  isGeneratingVideo,
  generationElapsed,
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
  onLoadFixTimeline,
  onPlanFix,
  onApplyFix,
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
    ctaEnabled: true,
  };
  const product = adBuilderData?.product ?? null;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showConcept, setShowConcept] = useState(false);
  const [showReplaceProduct, setShowReplaceProduct] = useState(false);
  // A new product arrived (catalog, link or upload): the change-product panel has done its job.
  const productKey = `${adBuilderData.product?.product_name ?? ''}|${adBuilderData.product?.hero_image?.slice(-48) ?? ''}`;
  const lastProductKey = useRef(productKey);
  useEffect(() => {
    if (lastProductKey.current === productKey) return;
    lastProductKey.current = productKey;
    setShowReplaceProduct(false);
  }, [productKey]);
  const [showQcDetails, setShowQcDetails] = useState(false);
  const [showCreativePlan, setShowCreativePlan] = useState(false);
  // Finished ad: show the result view; the editor rail opens only on "Change & remake".
  const [showEditor, setShowEditor] = useState(false);
  const [showFix, setShowFix] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stageOpened, setStageOpened] = useState(false);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [promptBeforeEnhance, setPromptBeforeEnhance] = useState<string | null>(null);
  const [enhancedText, setEnhancedText] = useState<string | null>(null);
  // Undo only applies while the enhanced text is still what is in the box
  // (another change, e.g. "Help me write it", has its own undo).
  const canUndoEnhance =
    promptBeforeEnhance != null && enhancedText != null && adBuilderData.userDescription === enhancedText;

  const selectedVideo =
    generatedVideos.find((video) => video.id === selectedVideoId) ?? generatedVideos[generatedVideos.length - 1] ?? null;

  const title = commercialTitle(adBuilderData, sessionName);
  const hasVideo = Boolean(selectedVideo?.url);
  const [feedPreview, setFeedPreview] = useState(false);
  const videosWithUrl = generatedVideos.filter((v) => v.url);
  const isBusy = isGeneratingVideo || isGeneratingScript;
  const showStage = stageOpened || isBusy || hasVideo;
  const isResultView = hasVideo && !isBusy && !showEditor;

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
            creativeFormat: adSetup.creativeFormat,
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
      setEnhancedText(data.enhancedPrompt.trim());
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
  // Brand films, shop/service and festival greetings can run without a product.
  const productOptional = getAdTypePlaybook(normalizeAdType(adBuilderData.adType)).productPhotoOptional;
  const isUgc = studio === 'ugc';
  const hasSubject = isUgc
    ? Boolean(product) && Boolean(adBuilderData.ugc?.creator?.image)
    : Boolean(product) || productOptional;
  const [revoicing, setRevoicing] = useState<string | null>(null);
  const [revoiceError, setRevoiceError] = useState<string | null>(null);
  const canGenerate = hasSubject && !isBusy && !hasInsufficientCredits;
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

  const generationSteps = buildGenerationSteps({
    durationSeconds,
    voiceoverLanguage: voiceover.language,
    voiceoverEnabled: voiceover.enabled,
    endCardEnabled: adBuilderData.endCard?.enabled ?? true,
    ugcSpeech: isUgc
      ? ugcSpeechFor(adBuilderData.ugc?.delivery ?? 'voiceover', adBuilderData.voiceover?.language)
      : undefined,
  });
  const { index: cappedStep } = generationProgress(generationSteps, generationElapsed);

  const qcDecision = selectedVideo?.qcDecision;
  const creativePlan = selectedVideo?.creativePlan;
  const versionLabel = selectedVideo?.generationVersion || (
    generatedVideos.length
      ? `v${Math.max(1, generatedVideos.findIndex((v) => v.id === selectedVideo?.id) + 1)}`
      : null
  );

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setVideoDuration(0);
    setControlsVisible(true);
  }, [selectedVideo?.id]);

  useEffect(() => {
    if (isBusy || hasVideo) setStageOpened(true);
  }, [isBusy, hasVideo]);

  useEffect(() => {
    return () => {
      if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
    };
  }, []);

  function formatVideoTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const whole = Math.floor(seconds);
    const m = Math.floor(whole / 60);
    const s = whole % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function revealControls(sticky = false) {
    setControlsVisible(true);
    if (controlsHideTimerRef.current) {
      clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
    if (sticky) return;
    const el = videoRef.current;
    if (el && !el.paused) {
      controlsHideTimerRef.current = setTimeout(() => setControlsVisible(false), 2200);
    }
  }

  function togglePlayback() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => undefined);
      revealControls();
    } else {
      el.pause();
      revealControls(true);
    }
  }

  function seekVideo(nextSeconds: number) {
    const el = videoRef.current;
    if (!el || !Number.isFinite(nextSeconds)) return;
    const capped = Math.max(0, Math.min(nextSeconds, el.duration || videoDuration || 0));
    el.currentTime = capped;
    setCurrentTime(capped);
    revealControls();
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
          <p className="text-[14px] leading-relaxed" style={{ color: MUTED }}>
            Upload or import the actual product image so packaging and branding stay accurate.
          </p>
          <ProductSourcePicker
            stacked
            catalog={catalog}
            productUrl={productUrl}
            onProductUrlChange={onProductUrlChange}
            onProductUrlSubmit={onProductUrlSubmit}
            isScrapingProduct={isScrapingProduct}
            onUpload={() => fileInputRef.current?.click()}
          />
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
              <p className="text-[13px] mt-0.5 truncate" style={{ color: MUTED }}>
                {product.category || 'Product'}
                {product.brand_name ? ` · ${product.brand_name}` : brand?.name ? ` · ${brand.name}` : ''}
                {isFetchingLogo ? ' · fetching logo' : ''}
              </p>
              <button
                type="button"
                onClick={() => setShowReplaceProduct((open) => !open)}
                className="text-[13px] mt-1 hover:opacity-80"
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
                className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none"
                style={{ background: SURFACE, border: `1px solid ${LINE}`, color: '#F4F4F7' }}
                disabled={isScrapingProduct}
              />
              <button
                type="submit"
                disabled={!productUrl.trim() || isScrapingProduct}
                className="px-3 py-2 rounded-lg text-[13px] disabled:opacity-50"
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
          <p className="text-[13px]" style={{ color: MUTED }}>
            {referenceCount} reference image{referenceCount === 1 ? '' : 's'}
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[13px] inline-flex items-center gap-1 hover:opacity-80"
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
        <p className="text-[13px] mt-3 leading-relaxed" style={{ color: MUTED }}>
          This is the canonical product reference for packaging and branding.
        </p>
      </section>

      <section>
        {isUgc ? (
          <UgcSetup data={adBuilderData} onChange={onAdBuilderChange} />
        ) : (
          <GuidedAdSetup data={adBuilderData} onChange={onAdBuilderChange} compact />
        )}
      </section>

      <section>
        <SectionLabel>In your own words</SectionLabel>
        <p className="text-[14px] leading-relaxed mb-3" style={{ color: MUTED }}>
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
          <VoiceInputButton
            language={voiceover.language}
            onText={(text) =>
              onAdBuilderChange({
                ...adBuilderData,
                userDescription: [adBuilderData.userDescription?.trim(), text].filter(Boolean).join(' '),
              })
            }
          />
          {canUndoEnhance && !isEnhancingPrompt && (
            <button
              type="button"
              onClick={handleUndoEnhance}
              className="text-[14px]"
              style={{ color: '#C8C8D2' }}
            >
              Undo
            </button>
          )}
          <button
            type="button"
            onClick={handleEnhancePrompt}
            disabled={isEnhancingPrompt || isBusy || !(adBuilderData.userDescription || '').trim()}
            className="inline-flex items-center gap-1.5 text-[14px] px-2.5 py-1 rounded-lg disabled:opacity-40"
            style={{ color: '#E8E0FF', border: `1px solid ${PURPLE_BORDER}` }}
          >
            <Sparkles size={13} />
            {isEnhancingPrompt ? 'Enhancing…' : 'Enhance Prompt'}
          </button>
        </div>
        <div className="mt-3">
          <WriteHelper
            data={adBuilderData}
            onChange={onAdBuilderChange}
            onRequestWrite={onRequestWrite}
            disabled={isBusy || !hasSubject}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced((open) => !open)}
          className="mt-2 text-[14px] inline-flex items-center gap-1"
          style={{ color: '#D0D0D8' }}
        >
          More options
          <ChevronDown size={14} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>
      </section>

      <section>
        <SectionLabel>Ideas</SectionLabel>
        <IdeaCards
          data={adBuilderData}
          onChange={onAdBuilderChange}
          onRequestConcepts={onRequestConcepts}
          disabled={isBusy || !hasSubject}
          compact
        />
      </section>

      {showAdvanced && (
        <section className="space-y-4">
          <FieldLabel>Main goal of this ad</FieldLabel>
          <ChipGrid
            items={[...CAMPAIGN_GOALS]}
            labels={CAMPAIGN_GOAL_LABELS}
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


          <FieldLabel>How should the ad catch attention?</FieldLabel>
          <p className="text-[14px] -mt-2" style={{ color: MUTED }}>
            {HOOK_DESCRIPTIONS[adSetup.hookType]}
          </p>
          <ChipGrid
            items={[...HOOK_TYPES]}
            labels={HOOK_LABELS}
            value={adSetup.hookType}
            onChange={(hook) =>
              onAdBuilderChange({
                ...adBuilderData,
                adSetup: { ...adSetup, hookType: hook as AdBuilderData['adSetup']['hookType'] },
              })
            }
          />

          <FieldLabel>How should the ad feel?</FieldLabel>
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
            className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
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
            className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
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
                      <p className="text-[14px] font-medium" style={{ color: '#F4F4F7' }}>
                        {variant.label}
                      </p>
                      <p className="text-[13px] mt-1 line-clamp-2" style={{ color: MUTED }}>
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
        <p className="text-[13px] mb-2" style={{ color: MUTED }}>
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
                className="flex-1 py-2.5 rounded-xl text-[14px] font-medium"
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
        <p className="text-[13px] mb-2" style={{ color: MUTED }}>
          Aspect ratio
        </p>
        <div className="flex gap-2 mb-4">
          {(['9:16', '16:9'] as const).map((ratio) => {
            const selected = adSetup.aspect_ratio === ratio;
            return (
              <button
                key={ratio}
                type="button"
                onClick={() => onUpdateAspectRatio(ratio)}
                className="flex-1 py-2.5 rounded-xl text-[14px] font-medium inline-flex items-center justify-center gap-1.5"
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

        <p className="text-[13px] mb-2" style={{ color: MUTED }}>
          Voiceover language
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {VOICEOVER_LANGUAGES.map((lang) => {
            const selected = (voiceover.language || 'english') === lang;
            return (
              <button
                key={lang}
                type="button"
                onClick={() =>
                  onAdBuilderChange({
                    ...adBuilderData,
                    voiceover: {
                      ...voiceover,
                      language: lang,
                      enabled: true,
                    },
                  })
                }
                className="px-2.5 py-1.5 rounded-lg text-[13px] font-medium"
                style={{
                  background: selected ? PURPLE_SOFT : SURFACE,
                  border: `1px solid ${selected ? PURPLE_BORDER : LINE}`,
                  color: selected ? '#F4F4F7' : MUTED,
                }}
              >
                {VOICEOVER_LANGUAGE_LABELS[lang]}
              </button>
            );
          })}
        </div>
        <div className="mb-4" />

        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px]" style={{ color: MUTED }}>
            CTA
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={voiceover.ctaEnabled !== false}
            onClick={() =>
              onAdBuilderChange({
                ...adBuilderData,
                voiceover: {
                  ...voiceover,
                  ctaEnabled: voiceover.ctaEnabled === false,
                },
              })
            }
            className="relative w-10 h-6 rounded-full transition-colors"
            style={{
              background:
                voiceover.ctaEnabled === false ? SURFACE_2 : PURPLE_SOFT,
              border: `1px solid ${
                voiceover.ctaEnabled === false ? LINE : PURPLE_BORDER
              }`,
            }}
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
              style={{
                left: voiceover.ctaEnabled === false ? 2 : 18,
                background: voiceover.ctaEnabled === false ? MUTED : PURPLE,
              }}
            />
          </button>
        </div>
        {voiceover.ctaEnabled !== false && (
          <>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {VOICEOVER_CTA_OPTIONS.map((ctaOption) => {
                const selected =
                  (voiceover.cta || adBuilderData.creativeStrategy?.cta || '') ===
                  ctaOption;
                return (
                  <button
                    key={ctaOption}
                    type="button"
                    onClick={() =>
                      onAdBuilderChange({
                        ...adBuilderData,
                        voiceover: { ...voiceover, cta: ctaOption, ctaEnabled: true },
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg text-[13px] font-medium"
                    style={{
                      background: selected ? PURPLE_SOFT : SURFACE,
                      border: `1px solid ${selected ? PURPLE_BORDER : LINE}`,
                      color: selected ? '#F4F4F7' : MUTED,
                    }}
                  >
                    {ctaOption}
                  </button>
                );
              })}
            </div>
            <input
              value={voiceover.cta || adBuilderData.creativeStrategy?.cta || ''}
              onChange={(e) =>
                onAdBuilderChange({
                  ...adBuilderData,
                  voiceover: { ...voiceover, cta: e.target.value, ctaEnabled: true },
                })
              }
              placeholder="Custom CTA…"
              className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
              style={{ background: SURFACE, border: `1px solid ${LINE}`, color: '#F4F4F7' }}
            />
          </>
        )}
      </section>

      <section>
        <SectionLabel>End card</SectionLabel>
        <EndCardFields
          value={adBuilderData.endCard}
          onChange={(endCard) => onAdBuilderChange({ ...adBuilderData, endCard })}
          adBuilderData={adBuilderData}
          brand={brand}
        />
      </section>

      {(selectedConcept || adBuilderData.adAngle) && (
        <button
          type="button"
          onClick={() => setShowConcept((open) => !open)}
          className="w-full text-left py-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] tracking-[0.14em] uppercase" style={{ color: MUTED }}>
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
              <p className="text-[14px] font-medium" style={{ color: '#F4F4F7' }}>
                {selectedConcept?.title || adSetup.creativeFormat}
              </p>
              <p className="text-[13px] mt-1 leading-relaxed" style={{ color: MUTED }}>
                {selectedConcept?.oneLinePitch ||
                  adBuilderData.adAngle ||
                  `${HOOK_LABELS[adSetup.hookType] ?? adSetup.hookType} · ${CAMPAIGN_GOAL_LABELS[adSetup.campaignGoal] ?? adSetup.campaignGoal}`}
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

  const player = (
    <div
      className="relative flex-1 min-h-[240px] rounded-xl overflow-hidden"
      style={{ background: '#050507', border: `1px solid ${LINE}` }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative bg-black group/player"
          style={{
            aspectRatio: aspect,
            width: isLandscape ? '100%' : undefined,
            height: isLandscape ? undefined : '100%',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
          onMouseEnter={() => revealControls(true)}
          onMouseLeave={() => {
            if (videoRef.current && !videoRef.current.paused) {
              setControlsVisible(false);
            } else {
              setControlsVisible(true);
            }
          }}
          onMouseMove={() => revealControls()}
        >
          {hasVideo && selectedVideo ? (
            <video
              ref={videoRef}
              key={selectedVideo.id}
              src={selectedVideo.url}
              className="absolute inset-0 w-full h-full object-contain"
              playsInline
              crossOrigin="anonymous"
              onPlay={() => {
                setIsPlaying(true);
                revealControls();
              }}
              onPause={() => {
                setIsPlaying(false);
                revealControls(true);
              }}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                setVideoDuration(Number.isFinite(d) ? d : selectedVideo.duration || durationSeconds);
                setCurrentTime(e.currentTarget.currentTime || 0);
              }}
              onDurationChange={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && d > 0) setVideoDuration(d);
              }}
              onEnded={() => {
                setIsPlaying(false);
                revealControls(true);
              }}
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
              <p className="text-[13px] mt-1 max-w-sm" style={{ color: MUTED }}>
                Generation will appear here as soon as rendering starts.
              </p>
            </div>
          )}

          {hasVideo && !isBusy && (
            <>
              {/* Large center play when paused */}
              {!isPlaying && (
                <button
                  type="button"
                  onClick={togglePlayback}
                  className="absolute inset-0 flex items-center justify-center z-[1]"
                  aria-label="Play"
                >
                  <span
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(0,0,0,0.45)',
                      border: '1px solid rgba(255,255,255,0.16)',
                    }}
                  >
                    <Play size={26} fill="white" className="ml-0.5" />
                  </span>
                </button>
              )}

              {/* Hover / focus control bar */}
              <div
                className={`absolute inset-x-0 bottom-0 z-[2] px-3 pb-3 pt-10 transition-opacity duration-200 ${
                  controlsVisible || !isPlaying
                    ? 'opacity-100'
                    : 'opacity-0 pointer-events-none group-hover/player:opacity-100 group-hover/player:pointer-events-auto'
                }`}
                style={{
                  background:
                    'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.82) 100%)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="range"
                  min={0}
                  max={Math.max(videoDuration || selectedVideo?.duration || durationSeconds, 0.1)}
                  step={0.05}
                  value={Math.min(currentTime, videoDuration || currentTime)}
                  aria-label="Seek"
                  onChange={(e) => seekVideo(Number(e.target.value))}
                  className="w-full h-1.5 mb-2.5 appearance-none rounded-full cursor-pointer accent-[#A855F7]"
                  style={{
                    background: `linear-gradient(to right, ${PURPLE} ${
                      videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0
                    }%, rgba(255,255,255,0.22) 0%)`,
                  }}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePlayback}
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#F4F4F7',
                    }}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause size={14} fill="currentColor" />
                    ) : (
                      <Play size={14} fill="currentColor" className="ml-0.5" />
                    )}
                  </button>
                  <span
                    className="text-[12px] tabular-nums font-medium min-w-[72px]"
                    style={{ color: 'rgba(244,244,247,0.88)' }}
                  >
                    {formatVideoTime(currentTime)} /{' '}
                    {formatVideoTime(
                      videoDuration || selectedVideo?.duration || durationSeconds
                    )}
                  </span>
                </div>
              </div>
            </>
          )}

          {isBusy && (
            <GenerationReveal
              variant="overlay"
              image={product?.hero_image}
              aspect={aspect}
              title={productionStatus === 'regenerating' ? 'Improving your video ad' : 'Creating your video ad'}
              steps={generationSteps.map((step) => step.label)}
              activeStep={cappedStep}
              expectedSeconds={generationSteps.reduce((sum, step) => sum + step.seconds, 0)}
              elapsedSeconds={generationElapsed}
            />
          )}
        </div>
      </div>
    </div>
  );

  const regenModal = showRegenConfirm ? (
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
        <p className="text-[13px] mt-2" style={{ color: MUTED }}>
          Duration stays {durationSeconds}s — one continuous generation.
        </p>
        {(pendingRegeneration?.preservedRequirements?.length ||
          selectedVideo?.qcSummary?.preservedRequirements?.length) && (
          <div className="mt-3">
            <p className="text-[13px] font-medium" style={{ color: '#E8E8EE' }}>
              We&apos;ll preserve
            </p>
            <ul className="mt-1 text-[13px] space-y-0.5" style={{ color: MUTED }}>
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
            <p className="text-[13px] font-medium" style={{ color: '#E8E8EE' }}>
              We&apos;ll improve
            </p>
            <ul className="mt-1 text-[13px] space-y-0.5" style={{ color: MUTED }}>
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
            className="flex-1 py-2 rounded-lg text-[14px]"
            style={{ background: SURFACE_2, border: `1px solid ${LINE}`, color: '#E8E8EE' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setShowRegenConfirm(false);
              // The new version lands back on the result view.
              setShowEditor(false);
              onConfirmRegenerate();
            }}
            className="flex-1 py-2 rounded-lg text-[14px] font-medium"
            style={{ background: PURPLE, color: 'white' }}
          >
            Regenerate Commercial
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const needsReview = qcDecision === 'manual_review' || productionStatus === 'manual_review';
  const suggestsRetry = qcDecision === 'regenerate' || Boolean(pendingRegeneration);
  const languageLabel =
    VOICEOVER_LANGUAGE_LABELS[(selectedVideo?.language || voiceover.language || 'english') as VoiceoverLanguage] ?? 'English';
  const versionIndex = Math.max(0, generatedVideos.findIndex((v) => v.id === selectedVideo?.id));
  const canFix = Boolean(selectedVideo?.url && onLoadFixTimeline && onPlanFix && onApplyFix);
  const fixedFromVideo = selectedVideo?.fix?.fixedFromId
    ? generatedVideos.find((v) => v.id === selectedVideo.fix?.fixedFromId) ?? null
    : null;

  const resultPanel = selectedVideo ? (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2.5">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={
              suggestsRetry
                ? { background: 'rgba(251,191,36,0.14)', color: '#FBBF24' }
                : { background: 'rgba(52,211,153,0.14)', color: '#34D399' }
            }
          >
            {suggestsRetry ? <RefreshCw size={15} /> : <Check size={16} strokeWidth={2.5} />}
          </span>
          <h2 className="text-[20px] font-semibold tracking-[-0.01em]" style={{ color: '#F7F7FA' }}>
            {suggestsRetry ? 'One more try may help' : 'Your ad is ready'}
          </h2>
        </div>
        <p className="text-[13px] mt-2" style={{ color: MUTED }}>
          {selectedVideo.duration || durationSeconds} seconds · {isLandscape ? 'Wide' : 'Tall'} ({aspectRatio}) ·{' '}
          {languageLabel}
          {generatedVideos.length > 1 ? ` · Version ${versionIndex + 1}` : ''}
        </p>
        {selectedVideo.fix && (
          <p className="text-[13px] mt-2 flex flex-wrap items-center gap-x-2" style={{ color: '#C8C8D2' }}>
            <span>
              Fixed {formatClock(selectedVideo.fix.startSeconds)}–{formatClock(selectedVideo.fix.endSeconds)}
            </span>
            {fixedFromVideo && (
              <button
                type="button"
                onClick={() => onSelectVideo(fixedFromVideo.id)}
                className="underline underline-offset-2"
                style={{ color: '#C4B5FD' }}
              >
                Compare with before
              </button>
            )}
          </p>
        )}
        {(suggestsRetry || needsReview) && (
          <p
            className="text-[13px] mt-3 leading-relaxed rounded-xl px-3.5 py-3"
            style={{ background: SURFACE, border: `1px solid ${LINE}`, color: '#D4D4DC' }}
          >
            {suggestsRetry
              ? selectedVideo.qcSummary?.reason ||
                pendingRegeneration?.reason ||
                'We spotted something a new version could fix.'
              : 'Please watch it once. Keep it if you like it, or make a new version.'}
          </p>
        )}
      </div>

      {isUgc && onRevoice && selectedVideo.baseVideoUrl && (
        <div className="space-y-2">
          <RevoiceBar
            languages={VOICEOVER_LANGUAGES.map((id) => ({ id, label: VOICEOVER_LANGUAGE_LABELS[id] }))}
            currentLanguage={selectedVideo.language}
            busyLanguage={revoicing}
            onRevoice={async (language) => {
              setRevoicing(language);
              setRevoiceError(null);
              try {
                await onRevoice(selectedVideo, language);
              } catch (e) {
                setRevoiceError(e instanceof Error ? e.message : 'Could not make that language right now.');
              } finally {
                setRevoicing(null);
              }
            }}
          />
          {revoiceError && (
            <p className="text-[13px]" role="alert" style={{ color: '#FCA5A5' }}>
              {revoiceError}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => onDownload(selectedVideo)}
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-[15px] font-semibold transition-all hover:brightness-110"
          style={{ background: PURPLE, color: 'white', boxShadow: '0 10px 28px rgba(168,85,247,0.28)' }}
        >
          <Download size={17} />
          Download video
        </button>
        {needsReview && (
          <button
            type="button"
            onClick={onKeepVersion}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-medium"
            style={{ background: SURFACE_2, border: `1px solid ${LINE}`, color: '#F4F4F7' }}
          >
            <Check size={16} />
            Keep this version
          </button>
        )}
        <button
          type="button"
          onClick={() => setFeedPreview(true)}
          className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-medium hover:brightness-110"
          style={{ background: SURFACE, border: `1px solid ${LINE}`, color: '#E8E8EE' }}
        >
          <Smartphone size={16} />
          See it on Instagram
        </button>
      </div>

      <div className="pt-5" style={{ borderTop: `1px solid ${LINE}` }}>
        <p className="text-[14px] font-medium mb-3" style={{ color: '#F4F4F7' }}>
          Not quite right?
        </p>
        <div className="space-y-2">
          {canFix && (
            <button
              type="button"
              onClick={() => {
                videoRef.current?.pause();
                setShowFix(true);
              }}
              className="w-full flex items-center gap-3 text-left px-3.5 py-3 rounded-xl hover:brightness-110"
              style={{ background: PURPLE_SOFT, border: `1px solid ${PURPLE_BORDER}` }}
            >
              <Scissors size={16} style={{ color: '#C4B5FD' }} className="flex-shrink-0" />
              <span className="min-w-0">
                <span className="block text-[14px] font-medium" style={{ color: '#F4F4F7' }}>
                  Edit a part
                </span>
                <span className="block text-[12px]" style={{ color: MUTED }}>
                  Pick the seconds on a timeline and say what to change. First {FREE_FIXES_PER_VIDEO} edits are free
                </span>
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowEditor(true)}
            className="w-full flex items-center gap-3 text-left px-3.5 py-3 rounded-xl hover:brightness-110"
            style={
              suggestsRetry
                ? { background: PURPLE_SOFT, border: `1px solid ${PURPLE_BORDER}` }
                : { background: SURFACE, border: `1px solid ${LINE}` }
            }
          >
            <RefreshCw size={16} style={{ color: '#C4B5FD' }} className="flex-shrink-0" />
            <span className="min-w-0">
              <span className="block text-[14px] font-medium" style={{ color: '#F4F4F7' }}>
                Make a new version
              </span>
              <span className="block text-[12px]" style={{ color: MUTED }}>
                Change the idea, style, language or offer · {durationSeconds * VIDEO_CREDITS_PER_SECOND} credits
              </span>
            </span>
          </button>
        </div>
        {hasInsufficientCredits && (
          <div className="mt-3">
            <InsufficientCreditsAlert type="video" />
          </div>
        )}
      </div>

      {generatedVideos.length > 1 && (
        <div className="pt-5" style={{ borderTop: `1px solid ${LINE}` }}>
          <p className="text-[14px] font-medium mb-3" style={{ color: '#F4F4F7' }}>
            Your versions
          </p>
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {generatedVideos.map((video, index) => {
              const selected = video.id === selectedVideo.id;
              return (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => onSelectVideo(video.id)}
                  className="flex-shrink-0 text-center"
                  aria-label={`Version ${index + 1}`}
                  aria-pressed={selected}
                >
                  <span
                    className="block rounded-lg overflow-hidden bg-black"
                    style={{
                      width: isLandscape ? 96 : 56,
                      aspectRatio: aspect,
                      border: selected ? `2px solid ${PURPLE}` : `1px solid ${LINE}`,
                    }}
                  >
                    {video.url && (
                      <video
                        src={`${video.url}#t=1`}
                        muted
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-cover pointer-events-none"
                      />
                    )}
                  </span>
                  <span
                    className="block text-[11px] mt-1"
                    style={{ color: selected ? '#F4F4F7' : MUTED }}
                  >
                    Version {index + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {creativePlan && (
        <div className="pt-5" style={{ borderTop: `1px solid ${LINE}` }}>
          <button
            type="button"
            onClick={() => setShowCreativePlan((v) => !v)}
            aria-expanded={showCreativePlan}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-[14px] font-medium" style={{ color: '#F4F4F7' }}>
              What happens in this ad
            </span>
            <ChevronDown
              size={16}
              className="transition-transform"
              style={{ color: MUTED, transform: showCreativePlan ? 'rotate(180deg)' : undefined }}
            />
          </button>
          {!showCreativePlan && creativePlan.conceptTitle && (
            <p className="text-[13px] mt-1" style={{ color: MUTED }}>
              {creativePlan.conceptTitle}
            </p>
          )}
          {showCreativePlan && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[14px] font-medium" style={{ color: '#E9D5FF' }}>
                  {creativePlan.conceptTitle}
                </p>
                {creativePlan.conceptPitch && (
                  <p className="text-[13px] mt-1 leading-relaxed" style={{ color: '#C8C8D2' }}>
                    {creativePlan.conceptPitch}
                  </p>
                )}
              </div>
              {creativePlan.storyBeats?.length > 0 && (
                <ol className="space-y-2.5">
                  {creativePlan.storyBeats.map((beat, i) => (
                    <li key={beat.index} className="flex gap-3">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
                        style={{ background: SURFACE_2, color: '#D4D4DC' }}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium" style={{ color: '#E8E8EE' }}>
                          {beat.label}
                        </span>
                        {beat.intent && (
                          <span className="block text-[12px] leading-relaxed line-clamp-2" style={{ color: MUTED }}>
                            {beat.intent}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}

      {selectedVideo.qcSummary?.categories && (
        <div className="pt-5" style={{ borderTop: `1px solid ${LINE}` }}>
          <button
            type="button"
            onClick={() => setShowQcDetails((v) => !v)}
            aria-expanded={showQcDetails}
            className="w-full flex items-center justify-between text-left text-[12px]"
            style={{ color: MUTED }}
          >
            <span>
              {selectedVideo.qcSummary.visualAvailable ? 'Quality checked' : 'Technical checks passed'}
            </span>
            <ChevronDown
              size={14}
              className="transition-transform"
              style={{ transform: showQcDetails ? 'rotate(180deg)' : undefined }}
            />
          </button>
          {showQcDetails && (
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
            </ul>
          )}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div
      className="flex-1 flex flex-col min-w-0 h-full overflow-hidden"
      style={{ background: STUDIO_BG, borderLeft: `1px solid ${LINE}` }}
    >
      {feedPreview && videosWithUrl.length > 0 && (
        <CreativeViewer
          items={videosWithUrl.map((v, i) => ({
            id: v.id,
            images: [],
            videoUrl: v.url,
            title: `Video ${i + 1}`,
            caption: brand?.tagline || brand?.coreValueProp || undefined,
            headline: brand?.name,
          }))}
          index={Math.max(0, videosWithUrl.findIndex((v) => v.id === selectedVideo?.id))}
          onIndexChange={(i) => onSelectVideo(videosWithUrl[i].id)}
          onClose={() => setFeedPreview(false)}
          brand={{ name: brand?.name || 'yourbrand', logo: brand?.logo || brand?.logoUrl, website: brand?.website_url }}
          initialMode="instagram"
        />
      )}
      <div
        className="flex-shrink-0 px-4 md:px-5 py-2.5 flex items-center justify-between gap-3"
        style={{ borderBottom: `1px solid ${LINE}`, background: RAIL_BG }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.push('/brand-studio')}
            aria-label="Back to Brand Studio"
            title="Back to Brand Studio"
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:bg-white/5"
            style={{ color: '#D4D4DC', border: `1px solid ${LINE}` }}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="text-[15px] font-medium truncate" style={{ color: '#F4F4F7' }} title={title}>
              {sessionName || title}
            </h1>
            <p className="text-[13px] truncate" style={{ color: MUTED }}>
              {[product?.brand_name || brand?.name, isSaving ? 'Saving…' : isBusy ? 'Working…' : null]
                .filter(Boolean)
                .join(' · ') || 'Video ad'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {videoCredits !== null && (
            <MetaChip accent>
              {videoCredits.total} credit{videoCredits.total === 1 ? '' : 's'}
            </MetaChip>
          )}
          <GhostButton onClick={onSaveDraft} disabled={!product}>
            <Save size={13} />
            <span className="hidden sm:inline">Save draft</span>
          </GhostButton>
          {showStage && !isResultView && generateButton}
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
                    className="text-[12px] tracking-[0.2em] uppercase mb-2"
                    style={{ color: '#A78BFA' }}
                  >
                    {isUgc ? 'UGC video' : 'Commercial brief'}
                  </p>
                  <h2
                    className="text-[32px] md:text-[40px] font-medium tracking-[-0.03em] leading-[1.05]"
                    style={{ color: '#F7F7FA' }}
                  >
                    {sessionName || 'New commercial'}
                  </h2>
                  <p className="text-[15px] mt-3 max-w-lg leading-relaxed" style={{ color: MUTED }}>
                    {isUgc
                      ? 'Pick your creator and product. Hit generate and your video opens beside you.'
                      : 'Lock the product and direction. Hit generate and the studio stage opens beside you.'}
                  </p>
                </div>
              </header>

              <div className="flex flex-col gap-5 flex-1 min-h-0">
                {/* 1. Product — first, so everything below is about it */}
                <section
                  className="rounded-2xl p-5 md:p-6 space-y-4"
                  style={{
                    background: 'linear-gradient(165deg, #16161F 0%, #101018 55%, #0C0C12 100%)',
                    border: `1px solid ${LINE}`,
                  }}
                >
                  <div>
                    <p className="text-[16px] font-medium" style={{ color: '#F4F4F7' }}>
                      Your product
                    </p>
                    <p className="text-[14px] mt-1 leading-relaxed" style={{ color: MUTED }}>
                      Use a real photo so the ad keeps its true packaging and branding.
                    </p>
                  </div>

                  {product ? (
                    <div className="flex flex-col sm:flex-row gap-4">
                      {product.hero_image && (
                        <img
                          src={product.hero_image}
                          alt=""
                          className="w-full sm:w-[140px] aspect-square object-cover rounded-xl flex-shrink-0"
                          style={{ border: `1px solid ${LINE}` }}
                        />
                      )}
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <input
                              value={product.product_name}
                              onChange={(e) => patchProduct({ product_name: e.target.value })}
                              className="w-full bg-transparent text-[16px] font-medium outline-none"
                              style={{ color: '#F4F4F7' }}
                            />
                            <p className="text-[13px] mt-0.5" style={{ color: MUTED }}>
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
                            className="text-[14px] flex-shrink-0"
                            style={{ color: '#A1A1AA' }}
                          >
                            {showReplaceProduct ? 'Cancel' : 'Change product'}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(product.product_images || []).slice(0, 4).map((img, idx) => {
                            const selected = (selectedImageIndex ?? 0) === idx;
                            return (
                              <button
                                key={`${img.slice(0, 24)}-${idx}`}
                                type="button"
                                onClick={() => onSelectImage(idx, img)}
                                aria-label={`Use photo ${idx + 1}`}
                                className="relative w-[64px] h-[64px] rounded-xl overflow-hidden flex-shrink-0"
                                style={{ border: selected ? `2px solid ${PURPLE}` : `1px solid ${LINE}` }}
                              >
                                <img src={img} alt="" className="w-full h-full object-cover" />
                              </button>
                            );
                          })}
                          {referenceCount < 4 && (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              aria-label="Add another photo"
                              className="w-[64px] h-[64px] rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ border: `1px dashed ${LINE}`, color: MUTED }}
                            >
                              <Plus size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {(!product || showReplaceProduct) && (
                    <ProductSourcePicker
                      catalog={catalog}
                      productUrl={productUrl}
                      onProductUrlChange={onProductUrlChange}
                      onProductUrlSubmit={onProductUrlSubmit}
                      isScrapingProduct={isScrapingProduct}
                      onUpload={() => fileInputRef.current?.click()}
                    />
                  )}
                </section>

                {/* 2. What and how, then your own words and output */}
                <section className="flex flex-col gap-5 min-h-0">
                  <div
                    className="rounded-2xl p-5 md:p-6"
                    style={{
                      background: 'linear-gradient(180deg, #14141C 0%, #101016 100%)',
                      border: `1px solid ${LINE}`,
                    }}
                  >
                    {isUgc ? (
                      <UgcSetup data={adBuilderData} onChange={onAdBuilderChange} />
                    ) : (
                      <GuidedAdSetup data={adBuilderData} onChange={onAdBuilderChange} />
                    )}
                  </div>
                  <div
                    className="flex-1 flex flex-col rounded-2xl p-5 md:p-6 min-h-[280px]"
                    style={{
                      background: 'linear-gradient(180deg, #14141C 0%, #101016 100%)',
                      border: `1px solid ${LINE}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="text-[12px] tracking-[0.16em] uppercase" style={{ color: MUTED }}>
                          In your own words
                        </p>
                        <p className="text-[14px] mt-1" style={{ color: '#C8C8D2' }}>
                          Tell us about your business and what you want people to feel or do. Type or speak — any language.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAdvanced((open) => !open)}
                        className="text-[13px] inline-flex items-center gap-1 flex-shrink-0"
                        style={{ color: '#D0D0D8' }}
                      >
                        More options
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

                    <div className="mt-4">
                      <WriteHelper
                        data={adBuilderData}
                        onChange={onAdBuilderChange}
                        onRequestWrite={onRequestWrite}
                        disabled={isBusy || !hasSubject}
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-3">
                      <VoiceInputButton
                        language={voiceover.language}
                        onText={(text) =>
                          onAdBuilderChange({
                            ...adBuilderData,
                            userDescription: [adBuilderData.userDescription?.trim(), text].filter(Boolean).join(' '),
                          })
                        }
                      />
                      {canUndoEnhance && !isEnhancingPrompt && (
                        <button
                          type="button"
                          onClick={handleUndoEnhance}
                          className="text-[14px] px-2 py-1.5 rounded-lg"
                          style={{ color: '#C8C8D2' }}
                        >
                          Undo
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleEnhancePrompt}
                        disabled={isEnhancingPrompt || isBusy || !(adBuilderData.userDescription || '').trim()}
                        className="inline-flex items-center gap-1.5 text-[14px] px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-40"
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

                    <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${LINE}` }}>
                      <IdeaCards
                        data={adBuilderData}
                        onChange={onAdBuilderChange}
                        onRequestConcepts={onRequestConcepts}
                        disabled={isBusy || !hasSubject}
                      />
                    </div>

                    {showAdvanced && (
                      <div
                        className="mt-5 pt-5 space-y-4"
                        style={{ borderTop: `1px solid ${LINE}` }}
                      >
                        <FieldLabel>Main goal of this ad</FieldLabel>
                        <ChipGrid
                          items={[...CAMPAIGN_GOALS]}
                          labels={CAMPAIGN_GOAL_LABELS}
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
                        <FieldLabel>How should the ad catch attention?</FieldLabel>
                        <p className="text-[14px] -mt-2" style={{ color: MUTED }}>
                          {HOOK_DESCRIPTIONS[adSetup.hookType]}
                        </p>
                        <ChipGrid
                          items={[...HOOK_TYPES]}
                          labels={HOOK_LABELS}
                          value={adSetup.hookType}
                          onChange={(hook) =>
                            onAdBuilderChange({
                              ...adBuilderData,
                              adSetup: { ...adSetup, hookType: hook as AdBuilderData['adSetup']['hookType'] },
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
                        <p className="text-[12px] tracking-[0.14em] uppercase mb-2" style={{ color: MUTED }}>
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
                                className="flex-1 py-2.5 rounded-xl text-[14px] font-medium"
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
                        <p className="text-[12px] tracking-[0.14em] uppercase mb-2" style={{ color: MUTED }}>
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
                                className="flex-1 py-2.5 rounded-xl text-[14px] font-medium inline-flex items-center justify-center gap-1.5"
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
                      <div className="col-span-2">
                        <p className="text-[12px] tracking-[0.14em] uppercase mb-2" style={{ color: MUTED }}>
                          Voiceover language
                        </p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {VOICEOVER_LANGUAGES.map((lang) => {
                            const selected = (voiceover.language || 'english') === lang;
                            return (
                              <button
                                key={lang}
                                type="button"
                                onClick={() =>
                                  onAdBuilderChange({
                                    ...adBuilderData,
                                    voiceover: {
                                      ...voiceover,
                                      language: lang,
                                      enabled: true,
                                    },
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-lg text-[13px] font-medium"
                                style={{
                                  background: selected ? PURPLE_SOFT : SURFACE,
                                  border: `1px solid ${selected ? PURPLE_BORDER : LINE}`,
                                  color: selected ? '#F4F4F7' : MUTED,
                                }}
                              >
                                {VOICEOVER_LANGUAGE_LABELS[lang]}
                              </button>
                            );
                          })}
                        </div>
                        <div className="mb-3" />
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[12px] tracking-[0.14em] uppercase" style={{ color: MUTED }}>
                            CTA
                          </p>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={voiceover.ctaEnabled !== false}
                            onClick={() =>
                              onAdBuilderChange({
                                ...adBuilderData,
                                voiceover: {
                                  ...voiceover,
                                  ctaEnabled: voiceover.ctaEnabled === false,
                                },
                              })
                            }
                            className="relative w-10 h-6 rounded-full transition-colors"
                            style={{
                              background:
                                voiceover.ctaEnabled === false ? SURFACE_2 : PURPLE_SOFT,
                              border: `1px solid ${
                                voiceover.ctaEnabled === false ? LINE : PURPLE_BORDER
                              }`,
                            }}
                          >
                            <span
                              className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
                              style={{
                                left: voiceover.ctaEnabled === false ? 2 : 18,
                                background:
                                  voiceover.ctaEnabled === false ? MUTED : PURPLE,
                              }}
                            />
                          </button>
                        </div>
                        {voiceover.ctaEnabled !== false && (
                          <div className="flex flex-wrap gap-1.5">
                            {VOICEOVER_CTA_OPTIONS.map((ctaOption) => {
                              const selected =
                                (voiceover.cta ||
                                  adBuilderData.creativeStrategy?.cta ||
                                  '') === ctaOption;
                              return (
                                <button
                                  key={ctaOption}
                                  type="button"
                                  onClick={() =>
                                    onAdBuilderChange({
                                      ...adBuilderData,
                                      voiceover: {
                                        ...voiceover,
                                        cta: ctaOption,
                                        ctaEnabled: true,
                                      },
                                    })
                                  }
                                  className="px-2.5 py-1.5 rounded-lg text-[13px] font-medium"
                                  style={{
                                    background: selected ? PURPLE_SOFT : SURFACE,
                                    border: `1px solid ${selected ? PURPLE_BORDER : LINE}`,
                                    color: selected ? '#F4F4F7' : MUTED,
                                  }}
                                >
                                  {ctaOption}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <p className="text-[12px] tracking-[0.14em] uppercase mb-2" style={{ color: MUTED }}>
                          End card
                        </p>
                        <EndCardFields
                          value={adBuilderData.endCard}
                          onChange={(endCard) => onAdBuilderChange({ ...adBuilderData, endCard })}
                          adBuilderData={adBuilderData}
                          brand={brand}
                        />
                      </div>
                    </div>
                    <div className="sm:pl-2 sm:border-l flex-shrink-0" style={{ borderColor: LINE }}>
                      <p className="text-[13px] mb-2 hidden sm:block" style={{ color: MUTED }}>
                        {hasSubject ? 'Brief looks solid.' : 'Add a product first.'}
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
      ) : isResultView && selectedVideo && showFix && canFix ? (
        <FixEditor
          key={selectedVideo.id}
          player={player}
          currentTime={currentTime}
          voiceLanguage={voiceover.language}
          loadTimeline={() => onLoadFixTimeline!(selectedVideo)}
          onSeek={seekVideo}
          onPlay={() => videoRef.current?.play().catch(() => undefined)}
          onPause={() => videoRef.current?.pause()}
          onPlan={(selection, request) => onPlanFix!(selectedVideo, selection, request)}
          onApply={async (preview) => {
            await onApplyFix!(selectedVideo, preview);
            setShowFix(false);
          }}
          onClose={() => setShowFix(false)}
        />
      ) : isResultView && selectedVideo ? (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          <div className="flex-1 min-w-0 min-h-[480px] lg:min-h-0 p-4 md:p-6 flex flex-col">
            {player}
          </div>
          <aside
            className="w-full lg:w-[380px] flex-shrink-0 lg:overflow-y-auto px-5 py-6 md:px-6"
            style={{ background: RAIL_BG, borderLeft: `1px solid ${LINE}` }}
          >
            {resultPanel}
          </aside>
          {regenModal}
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          <aside
            className="w-[340px] flex-shrink-0 flex flex-col min-h-0"
            style={{ background: RAIL_BG, borderRight: `1px solid ${LINE}` }}
          >
            {hasVideo && !isBusy && (
              <div
                className="flex-shrink-0 px-4 py-3 flex items-center justify-between gap-2"
                style={{ borderBottom: `1px solid ${LINE}` }}
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-medium" style={{ color: '#F4F4F7' }}>
                    Change your ad
                  </p>
                  <p className="text-[12px]" style={{ color: MUTED }}>
                    Edit below, then press Regenerate.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  aria-label="Back to your ad"
                  title="Back to your ad"
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-white/5"
                  style={{ color: '#D4D4DC', border: `1px solid ${LINE}` }}
                >
                  <X size={15} />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">{composer}</div>
          </aside>

          <div className="flex-1 flex flex-col min-w-0 min-h-0" style={{ background: STUDIO_BG }}>
            <div className="flex-1 min-h-0 px-5 pt-4 pb-3 flex flex-col">
              {player}
              {regenModal}
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

/** Pick a product scanned from the brand website. */
function CatalogPanel({ catalog, onClose }: { catalog: CatalogControls; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const items = (catalog.products || []).filter((p) =>
    p.product_name.toLowerCase().includes(query.trim().toLowerCase())
  );
  return (
    <div className="rounded-xl p-3 space-y-2" style={{ background: '#0A0A0E', border: `1px solid ${LINE}` }}>
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-medium" style={{ color: '#F4F4F7' }}>
          Your catalog{catalog.products?.length ? ` · ${catalog.products.length}` : ''}
        </p>
        <button type="button" onClick={onClose} className="text-[13px]" style={{ color: MUTED }}>
          Close
        </button>
      </div>
      {catalog.isScanning ? (
        <p className="text-[14px] py-3" style={{ color: MUTED }}>
          Finding products on your website… this can take a minute.
        </p>
      ) : !catalog.hasWebsite ? (
        <p className="text-[14px] py-3" style={{ color: MUTED }}>
          Add your website in Brand Kit to see your products here. For now, paste a product link or upload a photo.
        </p>
      ) : !items.length && !query ? (
        <p className="text-[14px] py-3" style={{ color: MUTED }}>
          No products found on your website. Paste a product link or upload a photo instead.
        </p>
      ) : (
        <>
          {(catalog.products?.length || 0) > 6 && (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your products"
              className="w-full px-3 py-2 rounded-lg text-[14px] outline-none"
              style={{ background: SURFACE, border: `1px solid ${LINE}`, color: '#F4F4F7' }}
            />
          )}
          {/* Medium thumbnails: about 6 per row in the full-width brief, 2 in the narrow sidebar. */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5 max-h-[420px] overflow-y-auto pr-1">
            {items.map((item, idx) => (
              <button
                key={`${item.product_name}-${idx}`}
                type="button"
                onClick={() => catalog.onSelect(item)}
                className="text-left rounded-lg overflow-hidden"
                style={{ background: SURFACE, border: `1px solid ${LINE}` }}
              >
                {item.product_images?.[0] ? (
                  <img src={item.product_images[0]} alt="" className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square flex items-center justify-center" style={{ color: MUTED }}>
                    <Film size={18} />
                  </div>
                )}
                <span
                  className="px-2 py-1.5 text-[14px] leading-snug"
                  title={item.product_name}
                  // Long scraped names: keep cards even at two lines.
                  style={{ color: '#E8E8EE', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                >
                  {item.product_name}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** The three ways to add a product: catalog, link, upload. */
function ProductSourcePicker({
  catalog,
  productUrl,
  onProductUrlChange,
  onProductUrlSubmit,
  isScrapingProduct,
  onUpload,
  stacked,
}: {
  /** Narrow container (studio sidebar): one button per row. */
  stacked?: boolean;
  catalog: CatalogControls;
  productUrl: string;
  onProductUrlChange: (url: string) => void;
  onProductUrlSubmit: (e: React.FormEvent) => void;
  isScrapingProduct: boolean;
  onUpload: () => void;
}) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className={stacked ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-2'}>
        <button
          type="button"
          onClick={() => {
            setCatalogOpen(true);
            catalog.onBrowse();
          }}
          className="px-4 py-3 rounded-xl text-[14px] font-medium inline-flex items-center justify-center gap-2"
          style={{ background: PURPLE_SOFT, border: `1px solid ${PURPLE_BORDER}`, color: '#F4F4F7' }}
        >
          <BookOpen size={16} />
          Choose from catalog
        </button>
        <form onSubmit={onProductUrlSubmit} className="flex gap-2 min-w-0">
          <input
            type="url"
            value={productUrl}
            onChange={(e) => onProductUrlChange(e.target.value)}
            placeholder="Or paste a product link"
            className="flex-1 min-w-0 px-4 py-3 rounded-xl text-[14px] outline-none"
            style={{ background: '#0A0A0E', border: `1px solid ${LINE}`, color: '#F4F4F7' }}
            disabled={isScrapingProduct}
          />
          <button
            type="submit"
            disabled={!productUrl.trim() || isScrapingProduct}
            className="px-4 py-3 rounded-xl text-[14px] font-medium disabled:opacity-50 flex-shrink-0"
            style={{ background: PURPLE, color: 'white' }}
          >
            {isScrapingProduct ? 'Fetching…' : 'Import'}
          </button>
        </form>
        <button
          type="button"
          onClick={onUpload}
          className="px-4 py-3 rounded-xl text-[14px] inline-flex items-center justify-center gap-2"
          style={{ background: SURFACE, border: `1px solid ${LINE}`, color: '#E8E8EE' }}
        >
          <Upload size={16} />
          Upload photo
        </button>
      </div>
      {catalogOpen && <CatalogPanel catalog={catalog} onClose={() => setCatalogOpen(false)} />}
    </div>
  );
}

/** Brand end card: offer, CTA and contact drawn on the last 3 seconds in post. */
function EndCardFields({
  value,
  onChange,
  adBuilderData,
  brand,
}: {
  value: EndCardConfig | undefined;
  onChange: (next: EndCardConfig) => void;
  adBuilderData: AdBuilderData;
  brand: BrandSnapshot | null;
}) {
  const card = value ?? { enabled: true };
  const voiceover = adBuilderData.voiceover;
  const voiceoverCta = voiceover?.ctaEnabled !== false ? voiceover?.cta?.trim() : undefined;
  const input = (field: 'offer' | 'cta' | 'contact', placeholder: string) => (
    <input
      value={card[field] || ''}
      onChange={(e) => onChange({ ...card, [field]: e.target.value })}
      placeholder={placeholder}
      maxLength={60}
      className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none min-h-[44px]"
      style={{ background: SURFACE, border: `1px solid ${LINE}`, color: '#F4F4F7' }}
    />
  );
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px]" style={{ color: '#E4E4EA' }}>
          Show logo, offer and contact in the last 3 seconds
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={card.enabled}
          aria-label="Show end card"
          onClick={() => onChange({ ...card, enabled: !card.enabled })}
          className="relative w-11 h-7 rounded-full transition-colors flex-shrink-0"
          style={{
            background: card.enabled ? PURPLE_SOFT : SURFACE_2,
            border: `1px solid ${card.enabled ? PURPLE_BORDER : LINE}`,
          }}
        >
          <span
            className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
            style={{ left: card.enabled ? 20 : 2, background: card.enabled ? PURPLE : MUTED }}
          />
        </button>
      </div>
      {card.enabled && (
        <div className="flex gap-3 items-start">
          <div className="flex-1 min-w-0 space-y-2">
            {input('offer', 'Offer (optional) — e.g. Buy 2, get 1 free')}
            {input('cta', voiceoverCta ? `Button text — e.g. ${voiceoverCta}` : 'Button text — e.g. Order now')}
            {input('contact', 'Phone, WhatsApp or website (optional)')}
            <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>
              Type in English, Tamil, Hindi, Kannada or Malayalam. The picture shows how it will look.
            </p>
          </div>
          <EndCardPreview
            brandName={brand?.name || adBuilderData.product?.brand_name || ''}
            logoUrl={brand?.logo || brand?.logoUrl || adBuilderData.product?.brand_logo || undefined}
            accentColor={brand?.primaryColors?.[0]}
            offer={card.offer}
            cta={card.cta?.trim() || voiceoverCta}
            contact={card.contact}
            productImage={adBuilderData.product?.hero_image || adBuilderData.product?.product_images?.[0]}
            aspectRatio={adBuilderData.adSetup?.aspect_ratio === '16:9' ? '16:9' : '9:16'}
          />
        </div>
      )}
    </div>
  );
}

/** Live end card drawn by the same renderer as the finished video, over the product photo. */
function EndCardPreview({
  brandName,
  logoUrl,
  accentColor,
  offer,
  cta,
  contact,
  productImage,
  aspectRatio,
}: {
  brandName: string;
  logoUrl?: string;
  accentColor?: string;
  offer?: string;
  cta?: string;
  contact?: string;
  productImage?: string;
  aspectRatio: '9:16' | '16:9';
}) {
  const [cardUrl, setCardUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const timer = setTimeout(async () => {
      try {
        const response = await authFetch('/api/commercial/end-card-preview', {
          method: 'POST',
          body: JSON.stringify({ aspectRatio, brandName, logoUrl, accentColor, offer, cta, contact }),
        });
        if (!response.ok || cancelled) return;
        objectUrl = URL.createObjectURL(await response.blob());
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setCardUrl(objectUrl);
      } catch {
        // Preview only — keep the last picture.
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [aspectRatio, brandName, logoUrl, accentColor, offer, cta, contact]);

  const landscape = aspectRatio === '16:9';
  return (
    <div
      className="relative flex-shrink-0 overflow-hidden rounded-xl"
      style={{
        width: landscape ? 192 : 112,
        aspectRatio: landscape ? '16 / 9' : '9 / 16',
        background: SURFACE_2,
        border: `1px solid ${LINE}`,
      }}
      aria-label="End card preview"
    >
      {productImage && (
        <img src={productImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {cardUrl && <img src={cardUrl} alt="End card preview" className="absolute inset-0 w-full h-full" />}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] tracking-[0.16em] uppercase mb-2" style={{ color: MUTED }}>
      {children}
    </p>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[14px] font-medium" style={{ color: '#E4E4EA' }}>
      {children}
    </p>
  );
}

function MetaChip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className="px-2 py-1 rounded-md text-[12px] font-medium"
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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
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
  labels,
}: {
  items: readonly string[] | string[];
  value: string;
  onChange: (value: string) => void;
  /** Display text per value; values are what gets stored. */
  labels?: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const selected = value === item;
        return (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-pressed={selected}
            className="px-3 py-2 rounded-lg text-[14px] font-medium min-h-[40px]"
            style={{
              background: selected ? PURPLE_SOFT : SURFACE,
              border: `1px solid ${selected ? PURPLE_BORDER : LINE}`,
              color: selected ? '#F4F4F7' : '#C4C4CE',
            }}
          >
            {labels?.[item] ?? item}
          </button>
        );
      })}
    </div>
  );
}
