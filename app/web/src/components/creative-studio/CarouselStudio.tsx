"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Pencil,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { ArcSpinner } from "@/app/web/src/components/ui/loaders";
import { cn } from "@/lib/utils";
import CreativeViewer, { type ViewerBrand } from "./CreativeViewer";
import {
  CarouselClientError,
  downloadCarouselSlide,
  downloadCarouselZip,
  fetchCarouselBlob,
  generateCarousel,
  getCarousel,
  iterateCarouselSlide,
  newCarouselRequestId,
  retryCarouselSlide,
  slideImagePath,
  type PublicCarouselCampaign,
  type PublicCarouselSlide,
} from "./carousel-client";

const BLUE = {
  soft: "rgba(59,130,246,0.14)",
  mid: "rgba(59,130,246,0.28)",
  solid: "#3B82F6",
  text: "#93C5FD",
} as const;

const ASPECT_CLASS: Record<string, string> = {
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
  "1.91:1": "aspect-[1.91/1]",
};

const MAX_RESUME_ROUNDS = 40;

export type CarouselStudioProps = {
  campaign: PublicCarouselCampaign;
  onCampaignChange: (campaign: PublicCarouselCampaign) => void;
  onRegenerateStory: () => Promise<void>;
  isPlanning: boolean;
  onChangeDirection?: () => void;
  creditsAvailable: number | null;
  onCreditsChanged?: () => void;
  onError: (message: string) => void;
  onNotice?: (message: string) => void;
  /** Brand shown in the Instagram / Facebook feed preview */
  brand?: ViewerBrand;
};

function statusMeta(status: PublicCarouselSlide["status"]): { label: string; className: string } {
  switch (status) {
    case "ready":
      return { label: "Ready", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
    case "needs_review":
      // QC verdicts stay internal; a generated slide is shown as ready.
      return { label: "Ready", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
    case "failed":
      return { label: "Failed", className: "bg-red-500/15 text-red-300 border-red-500/30" };
    case "unbilled":
      return { label: "Awaiting credits", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
    case "generating":
    case "qc_pending":
      return { label: status === "qc_pending" ? "Checking" : "Generating", className: "bg-blue-500/15 text-blue-300 border-blue-500/30" };
    default:
      return { label: "Planned", className: "bg-white/[0.06] text-white/55 border-white/10" };
  }
}

/** Authenticated image → object URL (no public storage URLs in the UI) */
function useSlideImage(campaignId: string, slide: PublicCarouselSlide): string | null {
  const { slideId, imageVersion, hasImage } = slide;
  const key = hasImage && imageVersion ? `${campaignId}:${slideId}:${imageVersion}` : null;
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    fetchCarouselBlob(slideImagePath(campaignId, { slideId, imageVersion }))
      .then(({ blob }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ key, url: objectUrl });
      })
      .catch(() => {
        // Card falls back to the copy preview
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [key, campaignId, slideId, imageVersion]);
  return key && loaded?.key === key ? loaded.url : null;
}

function SlideCard({
  campaign,
  slide,
  busy,
  generationStarted,
  onRetry,
  onIterate,
  onDownload,
  onImage,
  onOpen,
}: {
  campaign: PublicCarouselCampaign;
  slide: PublicCarouselSlide;
  onImage?: (slideId: string, url: string | null) => void;
  onOpen?: (slide: PublicCarouselSlide) => void;
  busy: boolean;
  generationStarted: boolean;
  onRetry: (slide: PublicCarouselSlide) => void;
  onIterate: (slide: PublicCarouselSlide, request: string) => Promise<boolean>;
  onDownload: (slide: PublicCarouselSlide) => void;
}) {
  const imageUrl = useSlideImage(campaign.id, slide);
  useEffect(() => {
    onImage?.(slide.slideId, imageUrl);
  }, [imageUrl, slide.slideId, onImage]);
  const [qcOpen, setQcOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState("");
  const meta = statusMeta(slide.status);
  const working = slide.status === "generating" || slide.status === "qc_pending";
  const qcItems = slide.qc ? [...slide.qc.issues, ...slide.qc.warnings] : [];

  const retryLabel =
    slide.status === "failed" ? "Retry slide" : slide.status === "unbilled" ? "Complete with 1 credit" : "Regenerate";

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
      <div className={cn("relative w-full bg-black/30", ASPECT_CLASS[campaign.aspectRatio] || "aspect-[4/5]")}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`Slide ${slide.slideNumber}: ${slide.copy.headline}`}
            className="h-full w-full cursor-zoom-in object-cover"
            onClick={() => onOpen?.(slide)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            {working ? (
              <ArcSpinner className="h-6 w-6 animate-spin" style={{ color: BLUE.solid }} />
            ) : slide.status === "failed" ? (
              <AlertTriangle className="h-6 w-6 text-red-300/80" />
            ) : null}
            <p className="text-sm font-medium text-white/80">{slide.copy.headline}</p>
            {slide.copy.supporting && <p className="text-xs text-white/45">{slide.copy.supporting}</p>}
            {slide.copy.cta && (
              <span className="mt-1 rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/60">{slide.copy.cta}</span>
            )}
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
          {String(slide.slideNumber).padStart(2, "0")}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">{slide.roleLabel}</p>
            <p className="mt-0.5 truncate text-sm text-white/85" title={slide.copy.headline}>
              {slide.copy.headline}
            </p>
          </div>
          {(generationStarted || slide.status !== "planned") && (
            <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium", meta.className)}>
              {meta.label}
            </span>
          )}
        </div>
        <p className="text-xs leading-relaxed text-white/45">{slide.objective}</p>
        {slide.versionNumber > 1 && (
          <p className="text-[11px] text-white/35">
            Version {slide.versionNumber}
            {slide.lastEdit?.request ? ` · “${slide.lastEdit.request}”` : ""}
          </p>
        )}
        {slide.error && slide.status !== "planned" && (
          <p className="text-xs text-red-300/80">{slide.error.message}</p>
        )}

        {slide.qc && (
          <div>
            <button
              type="button"
              onClick={() => setQcOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-white/55 hover:text-white/80"
              aria-expanded={qcOpen}
            >
              Quality check {qcItems.length ? `· ${qcItems.length} note${qcItems.length === 1 ? "" : "s"}` : "· passed"}
              {qcOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {qcOpen && (
              <div className="mt-2 space-y-1.5 rounded-lg border border-white/[0.06] bg-black/20 p-2 text-xs text-white/60">
                <p>{slide.qc.summary}</p>
                {qcItems.map((i, idx) => (
                  <p key={idx} className={i.severity === "critical" || i.severity === "major" ? "text-amber-300/90" : undefined}>
                    • {i.message}
                  </p>
                ))}
                {slide.qc.recommendedFixes.map((f, idx) => (
                  <p key={`f${idx}`} className="text-white/45">
                    Suggested: {f}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {editOpen && slide.canIterate && (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="e.g. make the background warmer, move the product left"
              className="w-full resize-none rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-white placeholder:text-white/30 focus:border-blue-500/50 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || !editText.trim()}
                onClick={async () => {
                  const ok = await onIterate(slide, editText.trim());
                  if (ok) {
                    setEditText("");
                    setEditOpen(false);
                  }
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-45"
                style={{ background: BLUE.solid }}
              >
                Apply edit · 1 credit
              </button>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {slide.hasImage && (
            <button
              type="button"
              onClick={() => onDownload(slide)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/70 hover:text-white"
            >
              <Download className="h-3 w-3" /> PNG
            </button>
          )}
          {slide.canIterate && !editOpen && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/70 hover:text-white disabled:opacity-45"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          )}
          {slide.canRetry && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onRetry(slide)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/70 hover:text-white disabled:opacity-45"
            >
              <RefreshCw className="h-3 w-3" /> {retryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CarouselStudio({
  campaign,
  onCampaignChange,
  onRegenerateStory,
  isPlanning,
  onChangeDirection,
  creditsAvailable,
  onCreditsChanged,
  onError,
  onNotice,
  brand,
}: CarouselStudioProps) {
  const [slideUrls, setSlideUrls] = useState<Record<string, string>>({});
  const [viewerSlide, setViewerSlide] = useState<number | null>(null);
  const [viewerMode, setViewerMode] = useState<"full" | "instagram">("full");
  const reportImage = useCallback((slideId: string, url: string | null) => {
    setSlideUrls((m) => {
      if (!url) {
        if (!(slideId in m)) return m;
        const { [slideId]: _gone, ...rest } = m;
        return rest;
      }
      return m[slideId] === url ? m : { ...m, [slideId]: url };
    });
  }, []);
  const [looping, setLooping] = useState(false);
  const [slideBusy, setSlideBusy] = useState<string | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const cancelledRef = useRef(false);
  const loopingRef = useRef(false);
  const autoResumedRef = useRef<string | null>(null);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const { progress } = campaign;
  const generationStarted = campaign.status !== "ready" && campaign.status !== "planning";
  const finishedOrHasImage = campaign.slides.filter((s) => s.hasImage).length;
  const failingChecks = campaign.checks.filter((c) => c.status !== "pass");

  const runGeneration = useCallback(async () => {
    if (loopingRef.current) return;
    loopingRef.current = true;
    setLooping(true);
    try {
      for (let round = 0; round < MAX_RESUME_ROUNDS && !cancelledRef.current; round++) {
        const res = await generateCarousel(campaign.id);
        onCampaignChange(res.campaign);
        if (res.creditsCharged > 0) onCreditsChanged?.();
        if (res.done) break;
        if (res.attemptedSlides === 0) {
          if (res.inFlightSlides === 0) break;
          // Another request (e.g. another tab) owns the remaining slides — poll.
          await new Promise((r) => setTimeout(r, 4000));
        }
      }
    } catch (err) {
      const e = err as CarouselClientError;
      onError(e.message || "Carousel generation stopped. You can resume it.");
      try {
        onCampaignChange(await getCarousel(campaign.id));
      } catch {
        // keep last known state
      }
    } finally {
      loopingRef.current = false;
      if (!cancelledRef.current) setLooping(false);
    }
  }, [campaign.id, onCampaignChange, onCreditsChanged, onError]);

  // Restore after refresh: continue only slides that were never generated.
  useEffect(() => {
    if (campaign.status === "generating" && autoResumedRef.current !== campaign.id) {
      autoResumedRef.current = campaign.id;
      void runGeneration();
    }
  }, [campaign.id, campaign.status, runGeneration]);

  async function handleRetry(slide: PublicCarouselSlide) {
    setSlideBusy(slide.slideId);
    try {
      const res = await retryCarouselSlide(campaign.id, slide.slideId, newCarouselRequestId());
      onCampaignChange(res.campaign);
      if (res.creditsCharged > 0) onCreditsChanged?.();
    } catch (err) {
      onError((err as Error).message);
      try {
        onCampaignChange(await getCarousel(campaign.id));
      } catch {
        // keep last known state
      }
    } finally {
      setSlideBusy(null);
    }
  }

  async function handleIterate(slide: PublicCarouselSlide, request: string): Promise<boolean> {
    setSlideBusy(slide.slideId);
    try {
      const res = await iterateCarouselSlide(campaign.id, slide.slideId, request, newCarouselRequestId());
      onCampaignChange(res.campaign);
      if (res.creditsCharged > 0) onCreditsChanged?.();
      if (res.slide.error && res.creditsCharged === 0) {
        onError(res.slide.error.message);
        return false;
      }
      if (res.summary) onNotice?.(res.summary);
      return true;
    } catch (err) {
      onError((err as Error).message);
      return false;
    } finally {
      setSlideBusy(null);
    }
  }

  async function handleDownload(slide: PublicCarouselSlide) {
    try {
      await downloadCarouselSlide(campaign.id, slide);
    } catch (err) {
      onError((err as Error).message);
    }
  }

  async function handleZip() {
    setZipBusy(true);
    try {
      const r = await downloadCarouselZip(campaign.id);
      if (!r.complete) {
        onNotice?.(`Partial download: ${r.included} of ${r.total} slides. The manifest lists the missing slides.`);
      }
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setZipBusy(false);
    }
  }

  const pendingCredits = progress.pending;
  const insufficient = creditsAvailable != null && creditsAvailable < pendingCredits;

  return (
    <div className="space-y-6">
      {/* Story review */}
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: BLUE.text }}>
              Carousel story · {campaign.slideCount} slides
            </p>
            <h3 className="mt-1 text-lg font-medium text-white">{campaign.story.coreMessage}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/55">{campaign.story.narrativeRationale}</p>
            {campaign.story.copyProgression && (
              <p className="mt-1 text-xs text-white/40">Copy progression: {campaign.story.copyProgression}</p>
            )}
          </div>
          <div className="text-right text-xs text-white/45">
            <p className="capitalize">{campaign.story.narrativeStructure.replace(/_/g, " ")}</p>
            <p className="mt-1">{campaign.aspectRatio}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-xs text-white/50 sm:grid-cols-2 lg:grid-cols-4">
          <p><span className="text-white/35">Palette · </span>{campaign.visualSystem.palette}</p>
          <p><span className="text-white/35">Typography · </span>{campaign.visualSystem.typography}</p>
          <p><span className="text-white/35">Imagery · </span>{campaign.visualSystem.photographyStyle}</p>
          <p><span className="text-white/35">Mood · </span>{campaign.visualSystem.mood}</p>
        </div>
        {failingChecks.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-amber-300/80">
            {failingChecks.map((c) => (
              <li key={c.code}>• {c.message}</li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!generationStarted ? (
            <>
              <button
                type="button"
                disabled={looping || isPlanning || insufficient}
                onClick={() => void runGeneration()}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                style={{ background: BLUE.solid }}
              >
                {looping ? <ArcSpinner className="h-4 w-4 animate-spin" /> : null}
                Generate {campaign.slideCount} slides
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={looping || isPlanning}
                onClick={() => void onRegenerateStory()}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/75 hover:bg-white/[0.08] hover:text-white disabled:opacity-45"
              >
                {isPlanning ? <ArcSpinner className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Regenerate story
              </button>
              {onChangeDirection && (
                <button
                  type="button"
                  disabled={looping || isPlanning}
                  onClick={onChangeDirection}
                  className="text-xs text-white/50 hover:text-white/80 disabled:opacity-45"
                >
                  Change direction
                </button>
              )}
              <p className="text-xs text-white/40">
                Up to {campaign.slideCount} image credits · charged only for slides that generate
                {creditsAvailable != null ? ` · ${creditsAvailable} available` : ""}
              </p>
              {insufficient && (
                <p className="w-full text-xs text-amber-300/80">
                  You need {pendingCredits} credits to generate every slide.
                </p>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={Object.keys(slideUrls).length === 0}
                onClick={() => {
                  setViewerMode("instagram");
                  setViewerSlide(0);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/85 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Eye className="h-4 w-4" /> Preview in feed
              </button>
              <button
                type="button"
                disabled={zipBusy || finishedOrHasImage === 0}
                onClick={() => void handleZip()}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                style={{ background: BLUE.solid }}
              >
                {zipBusy ? <ArcSpinner className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {finishedOrHasImage === campaign.slideCount
                  ? "Download ZIP"
                  : `Download ZIP (partial · ${finishedOrHasImage}/${campaign.slideCount})`}
              </button>
              {progress.pending > 0 && !looping && (
                <button
                  type="button"
                  onClick={() => void runGeneration()}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/75 hover:bg-white/[0.08] hover:text-white"
                >
                  <RefreshCw className="h-4 w-4" /> Resume generation
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* Progress */}
      {generationStarted && (
        <div>
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>
              {looping || progress.generating > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <ArcSpinner className="h-3 w-3 animate-spin" /> Generating slides…
                </span>
              ) : campaign.status === "completed" ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-300/80">
                  <Check className="h-3 w-3" /> Carousel complete
                </span>
              ) : (
                "Carousel partially complete"
              )}
            </span>
            <span>
              {progress.finished}/{progress.total} finished
              {progress.failed ? ` · ${progress.failed} failed` : ""}
              {progress.unbilled ? ` · ${progress.unbilled} awaiting credits` : ""}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(progress.finished / Math.max(1, progress.total)) * 100}%`, background: BLUE.solid }}
            />
          </div>
        </div>
      )}

      {/* Gallery */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {campaign.slides.map((slide) => (
          <SlideCard
            key={slide.slideId}
            campaign={campaign}
            slide={slide}
            busy={looping || slideBusy !== null}
            generationStarted={generationStarted}
            onRetry={(s) => void handleRetry(s)}
            onIterate={handleIterate}
            onDownload={(s) => void handleDownload(s)}
            onImage={reportImage}
            onOpen={(s) => {
              const ready = campaign.slides.filter((x) => slideUrls[x.slideId]);
              const at = ready.findIndex((x) => x.slideId === s.slideId);
              setViewerMode("full");
              setViewerSlide(at < 0 ? 0 : at);
            }}
          />
        ))}
      </div>

      {viewerSlide !== null && (() => {
        const ready = campaign.slides.filter((x) => slideUrls[x.slideId]);
        if (!ready.length) return null;
        const first = campaign.slides[0]?.copy;
        return (
          <CreativeViewer
            items={[
              {
                id: campaign.id,
                images: ready.map((x) => slideUrls[x.slideId]),
                title: `Carousel · ${ready.length}/${campaign.slideCount} slides`,
                caption: campaign.story.coreMessage || first?.headline,
                headline: first?.headline,
                ctaLabel: campaign.slides[campaign.slides.length - 1]?.copy.cta || undefined,
              },
            ]}
            index={0}
            onIndexChange={() => undefined}
            initialSlide={viewerSlide}
            initialMode={viewerMode}
            onClose={() => setViewerSlide(null)}
            brand={brand || { name: "yourbrand" }}
          />
        );
      })()}
    </div>
  );
}

export default CarouselStudio;
