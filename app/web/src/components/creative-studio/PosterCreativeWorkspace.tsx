"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ImagePlus,
  Link2,
  Loader2,
  Package,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type { BrandSnapshot, PosterConfig, Product } from "./types";
import { ASPECT_RATIOS, POSTER_THEMES } from "./utils";
import { cn } from "@/lib/utils";

const STUDIO_BG = "#0B0B0F";
const BLUE = {
  soft: "rgba(59,130,246,0.14)",
  mid: "rgba(59,130,246,0.28)",
  solid: "#3B82F6",
  text: "#93C5FD",
} as const;

type ThemeKey = (typeof POSTER_THEMES)[number]["id"];
type AspectRatio = PosterConfig["aspectRatio"];

/** Mini frame glyph matching each poster aspect ratio */
function FormatGlyph({
  ratio,
  selected,
}: {
  ratio: AspectRatio;
  selected: boolean;
}) {
  const stroke = selected ? "#EFF6FF" : "rgba(255,255,255,0.45)";
  // Proportional frames inside a fixed 18×18 cell
  const dims: Record<AspectRatio, { w: number; h: number }> = {
    "1:1": { w: 12, h: 12 },
    "4:5": { w: 10, h: 13 },
    "9:16": { w: 8, h: 14 },
    "1.91:1": { w: 15, h: 8 },
  };
  const { w, h } = dims[ratio] || dims["1:1"];
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center"
      style={{ width: 18, height: 18 }}
    >
      <span
        style={{
          width: w,
          height: h,
          borderRadius: 2,
          border: `1.5px solid ${stroke}`,
          display: "block",
          background: selected ? "rgba(255,255,255,0.12)" : "transparent",
        }}
      />
    </span>
  );
}

export type PosterCreativeWorkspaceProps = {
  brand: BrandSnapshot | null;
  sessionName?: string;
  creditsAvailable: number | null;
  onOpenBrandGuidelines: () => void;
  onBackToBrandStudio: () => void;

  /* Product */
  selectedProduct: Product | null;
  productImages: File[];
  productImageUrls: string[];
  onProductImagesChange: (files: File[]) => void;
  onClearProduct: () => void;

  /* Catalog */
  fetchedProducts: Product[];
  isScanningProducts: boolean;
  onSelectCatalogProduct: (product: Product) => void;
  onBrowseCatalog: () => void;
  onImportProductUrl: (url: string) => void;

  /* Creative direction */
  creativePrompt: string;
  onCreativePromptChange: (value: string) => void;
  onEnhancePrompt: () => void;
  isEnhancingPrompt: boolean;

  /* Reference poster */
  referencePosterPreviewUrl: string | null;
  isAnalyzingReferencePoster: boolean;
  onReferencePosterFile: (file: File | null) => void;
  onClearReferencePoster: () => void;

  /* Settings */
  theme: string;
  onThemeChange: (theme: ThemeKey) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  numVariants: 1 | 2 | 3;
  onNumVariantsChange: (n: 1 | 2 | 3) => void;

  /* Generate */
  canGenerate: boolean;
  generateBlockedReason: string | null;
  onGenerate: () => void;
  isGenerating: boolean;
  thinkingMessages?: string[];
  /** Primary CTA label — e.g. "Develop creative" or "Generate poster" */
  primaryCtaLabel?: string;
  /** Pipeline stage for progressive UX */
  pipelineStage?: "compose" | "directions" | "generating" | "ready";
  /** Creative direction cards (internal concepts, user-facing) */
  creativeDirections?: Array<{
    id: string;
    name: string;
    description: string;
    visualApproach: string;
  }>;
  selectedDirectionId?: string | null;
  onSelectDirection?: (id: string) => void;
  onRegenerateDirections?: () => void;
  isRegeneratingDirections?: boolean;
  onGenerateFromDirection?: () => void;
  canGenerateFromDirection?: boolean;

  /* Overlays */
  brandReviewSlot?: React.ReactNode;
  resultsSlot?: React.ReactNode;
  creditsAlertSlot?: React.ReactNode;
  onBackToCompose?: () => void;
};

function surfaceClass(extra?: string) {
  return cn(
    "rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm",
    extra
  );
}

function generatingHeadline(messages: string[]): string {
  const joined = messages.join(" ").toLowerCase();
  if (joined.includes("creating your poster") || joined.includes("generating visual")) {
    return "Creating your poster";
  }
  if (
    joined.includes("understanding") ||
    joined.includes("marketing direction") ||
    joined.includes("creative directions") ||
    joined.includes("exploring new")
  ) {
    return "Understanding your campaign";
  }
  return "Working on your creative";
}

function BrandContextBar({
  brand,
  onOpenBrandGuidelines,
}: {
  brand: BrandSnapshot;
  onOpenBrandGuidelines: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="shrink-0 border-b border-white/[0.06] px-4 py-2.5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-left text-sm text-white/70 transition hover:text-white/85"
        >
          Using <span className="font-medium text-white">{brand.name}</span>
          <span className="mx-2 text-white/25">·</span>
          <span className="text-white/45">Brand guidelines applied</span>
        </button>
        <button
          type="button"
          onClick={onOpenBrandGuidelines}
          className="text-xs font-medium transition hover:underline"
          style={{ color: BLUE.text }}
        >
          View / Edit
        </button>
      </div>
      {expanded && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45">
          <li>✓ Brand identity</li>
          <li>✓ Product information</li>
          <li>✓ Visual guidelines</li>
        </ul>
      )}
    </div>
  );
}

export function PosterCreativeWorkspace({
  brand,
  sessionName,
  creditsAvailable,
  onOpenBrandGuidelines,
  onBackToBrandStudio,
  selectedProduct,
  productImages,
  productImageUrls,
  onProductImagesChange,
  onClearProduct: _onClearProduct,
  fetchedProducts,
  isScanningProducts,
  onSelectCatalogProduct,
  onBrowseCatalog,
  onImportProductUrl,
  creativePrompt,
  onCreativePromptChange,
  onEnhancePrompt,
  isEnhancingPrompt,
  referencePosterPreviewUrl,
  isAnalyzingReferencePoster,
  onReferencePosterFile,
  onClearReferencePoster,
  theme,
  onThemeChange,
  aspectRatio,
  onAspectRatioChange,
  numVariants,
  onNumVariantsChange,
  canGenerate,
  generateBlockedReason,
  onGenerate,
  isGenerating,
  thinkingMessages = [],
  primaryCtaLabel = "Generate poster",
  pipelineStage = "compose",
  creativeDirections = [],
  selectedDirectionId = null,
  onSelectDirection,
  onRegenerateDirections,
  isRegeneratingDirections = false,
  onGenerateFromDirection,
  canGenerateFromDirection = false,
  brandReviewSlot,
  resultsSlot,
  creditsAlertSlot,
  onBackToCompose,
}: PosterCreativeWorkspaceProps) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [urlOpen, setUrlOpen] = useState(false);
  const [productUrl, setProductUrl] = useState("");
  const [changingProduct, setChangingProduct] = useState(false);

  const productUploadRef = useRef<HTMLInputElement>(null);
  const productUrlInputRef = useRef<HTMLInputElement>(null);
  const referenceUploadRef = useRef<HTMLInputElement>(null);
  const stillsUploadRef = useRef<HTMLInputElement>(null);

  const hasProduct =
    !!selectedProduct ||
    productImages.length > 0 ||
    productImageUrls.length > 0;

  const primaryThumb =
    productImageUrls[0] ||
    selectedProduct?.product_images?.[0] ||
    null;

  const [objectUrlThumb, setObjectUrlThumb] = useState<string | null>(null);
  useEffect(() => {
    if (productImageUrls[0] || selectedProduct?.product_images?.[0]) {
      setObjectUrlThumb(null);
      return;
    }
    if (!productImages[0]) {
      setObjectUrlThumb(null);
      return;
    }
    const url = URL.createObjectURL(productImages[0]);
    setObjectUrlThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [productImages, productImageUrls, selectedProduct]);

  const displayThumb = primaryThumb || objectUrlThumb;

  const productLabel =
    selectedProduct?.product_name ||
    productImages[0]?.name?.replace(/\.[^.]+$/, "") ||
    "Selected product";

  const productDescriptor =
    selectedProduct?.short_benefit ||
    selectedProduct?.description?.slice(0, 80) ||
    null;

  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    if (!q) return fetchedProducts;
    return fetchedProducts.filter((p) => {
      const hay = `${p.product_name} ${p.description || ""} ${p.category || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [fetchedProducts, catalogQuery]);

  const showProductPicker = !hasProduct || changingProduct;

  const stillThumbs = useMemo(() => {
    const urls = productImageUrls.slice(1);
    return urls;
  }, [productImageUrls]);

  useEffect(() => {
    if (hasProduct && !changingProduct) {
      setCatalogOpen(false);
      setUrlOpen(false);
    }
  }, [hasProduct, changingProduct]);

  function handleBrowseCatalog() {
    setCatalogOpen(true);
    setUrlOpen(false);
    if (fetchedProducts.length === 0) {
      onBrowseCatalog();
    }
  }

  function handleSelectProduct(product: Product) {
    onSelectCatalogProduct(product);
    setCatalogOpen(false);
    setChangingProduct(false);
    setCatalogQuery("");
  }

  function handleImportUrl() {
    // Prefer the live DOM value — avoids paste→Enter races where React state
    // hasn't flushed yet, which previously sent an empty URL to the API.
    const live = productUrlInputRef.current?.value ?? productUrl;
    const trimmed = live.trim();
    if (!trimmed) return;
    onImportProductUrl(trimmed);
    setProductUrl("");
    if (productUrlInputRef.current) productUrlInputRef.current.value = "";
    setUrlOpen(false);
    setChangingProduct(false);
  }

  function handleProductUpload(files: FileList | null) {
    if (!files?.length) return;
    const next = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!next.length) return;
    onProductImagesChange([...productImages, ...next].slice(0, 8));
    setChangingProduct(false);
    setCatalogOpen(false);
  }

  function handleStillsUpload(files: FileList | null) {
    if (!files?.length) return;
    const next = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!next.length) return;
    onProductImagesChange([...productImages, ...next].slice(0, 8));
  }

  function handleReferenceUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    onReferencePosterFile(file);
  }

  const showResults =
    pipelineStage === "ready" && !!resultsSlot && !isGenerating;
  const showDirections =
    pipelineStage === "directions" &&
    !isGenerating &&
    creativeDirections.length > 0;
  const showCompose =
    !isGenerating && !showResults && !showDirections && !brandReviewSlot;

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden text-white"
      style={{ background: STUDIO_BG }}
    >
      {/* Studio header */}
      <div className="shrink-0 border-b border-white/[0.06] px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onBackToBrandStudio}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Brand Studio
            </button>
            <div className="min-w-0">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: BLUE.text }}
              >
                Poster Studio
              </p>
              <p className="truncate text-sm font-medium text-white/90">
                {sessionName || "Untitled Poster"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {creditsAvailable != null && (
              <p className="text-xs text-white/45">
                <span className="text-white/70">{creditsAvailable}</span> credits
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Brand context — compact + expandable */}
      {brand && (
        <BrandContextBar brand={brand} onOpenBrandGuidelines={onOpenBrandGuidelines} />
      )}

      {creditsAlertSlot}

      {brandReviewSlot && (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{brandReviewSlot}</div>
      )}

      {/* Generating */}
      {isGenerating && !brandReviewSlot && (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-16">
          <div className="w-full max-w-md space-y-6 text-center">
            <Loader2
              className="mx-auto h-8 w-8 animate-spin"
              style={{ color: BLUE.solid }}
            />
            <div>
              <h2 className="text-lg font-medium tracking-tight text-white">
                {generatingHeadline(thinkingMessages)}
              </h2>
              <p className="mt-2 text-sm text-white/45">
                {thinkingMessages.find((m) => m.startsWith("→")) ||
                  thinkingMessages[thinkingMessages.length - 1] ||
                  "Working on your creative…"}
              </p>
            </div>
            {thinkingMessages.length > 0 && (
              <ul className="space-y-2 text-left text-sm text-white/40">
                {thinkingMessages.slice(0, 6).map((msg, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: BLUE.solid }}
                    />
                    {msg}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {showResults && !brandReviewSlot && (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-[1200px]">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: BLUE.text }}
                >
                  Poster results
                </p>
                <h2 className="mt-1 text-xl font-medium text-white">Your posters</h2>
              </div>
              {onBackToCompose && (
                <button
                  type="button"
                  onClick={onBackToCompose}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Adjust brief
                </button>
              )}
            </div>
            {resultsSlot}
          </div>
        </div>
      )}

      {/* Creative directions selection */}
      {showDirections && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1100px] space-y-6 p-4 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: BLUE.text }}
                >
                  Creative directions
                </p>
                <h2 className="mt-1 text-xl font-medium text-white">
                  Choose a direction for your poster
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  Exploring directions uses no image credits. Generation charges only when you
                  create posters.
                </p>
              </div>
              {onBackToCompose && (
                <button
                  type="button"
                  onClick={onBackToCompose}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Adjust brief
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {creativeDirections.map((dir, idx) => {
                const selected = selectedDirectionId === dir.id;
                return (
                  <button
                    key={dir.id}
                    type="button"
                    onClick={() => onSelectDirection?.(dir.id)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition",
                      selected
                        ? "border-blue-500/50 bg-blue-500/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                        Direction {String(idx + 1).padStart(2, "0")}
                      </p>
                      {selected && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                          style={{ background: BLUE.solid }}
                        >
                          <Check className="h-3 w-3" />
                          Selected
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-base font-medium text-white">{dir.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">
                      {dir.description}
                    </p>
                    <p className="mt-3 text-xs text-white/40">
                      Visual: {dir.visualApproach}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {onRegenerateDirections && (
                <button
                  type="button"
                  onClick={onRegenerateDirections}
                  disabled={isRegeneratingDirections || isGenerating}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/75 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-45"
                >
                  {isRegeneratingDirections ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Regenerate directions
                </button>
              )}
              <button
                type="button"
                onClick={onGenerateFromDirection}
                disabled={
                  !canGenerateFromDirection ||
                  !selectedDirectionId ||
                  isGenerating
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
                style={{ background: BLUE.solid }}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    Generate poster
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              {selectedDirectionId && (
                <p className="text-xs text-white/40">
                  {numVariants} poster{numVariants === 1 ? "" : "s"} · {numVariants} image
                  credit{numVariants === 1 ? "" : "s"}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Two-column compose workspace */}
      {showCompose && !brandReviewSlot && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid max-w-[1400px] gap-4 p-4 sm:p-6 lg:grid-cols-12 lg:gap-6">
            {/* LEFT — Product */}
            <aside className="space-y-4 lg:col-span-4">
              <section className={surfaceClass("p-4 sm:p-5")}>
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" style={{ color: BLUE.text }} />
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                      Product
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-white/50">
                    Choose the product you want to advertise.
                  </p>
                </div>

                {hasProduct && !changingProduct && (
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                      {displayThumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={displayThumb}
                          alt={productLabel}
                          className="aspect-[4/3] w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[4/3] items-center justify-center bg-white/[0.04] text-white/30">
                          <Package className="h-8 w-8" />
                        </div>
                      )}
                      <div className="space-y-1 border-t border-white/[0.06] p-3">
                        <p className="text-sm font-medium text-white">{productLabel}</p>
                        {productDescriptor && (
                          <p className="line-clamp-2 text-xs text-white/45">{productDescriptor}</p>
                        )}
                        <p
                          className="flex items-center gap-1 text-[11px] font-medium"
                          style={{ color: BLUE.text }}
                        >
                          <Check className="h-3 w-3" />
                          Selected
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChangingProduct(true)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      Change product
                    </button>
                  </div>
                )}

                {showProductPicker && (
                  <div className="space-y-3">
                    {!hasProduct && (
                      <p className="text-sm text-white/55">Choose a product to get started.</p>
                    )}

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                      <button
                        type="button"
                        onClick={handleBrowseCatalog}
                        disabled={isScanningProducts}
                        className={cn(
                          "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition",
                          fetchedProducts.length > 0 || catalogOpen
                            ? "border-blue-500/40 bg-blue-500/15 text-white"
                            : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]"
                        )}
                      >
                        {isScanningProducts ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <BookOpen className="h-4 w-4" />
                        )}
                        {fetchedProducts.length > 0
                          ? `Catalog · ${fetchedProducts.length}`
                          : "Browse catalog"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setUrlOpen((v) => !v);
                          setCatalogOpen(false);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 transition hover:bg-white/[0.08]"
                      >
                        <Link2 className="h-4 w-4" />
                        Import URL
                      </button>

                      <button
                        type="button"
                        onClick={() => productUploadRef.current?.click()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/80 transition hover:bg-white/[0.08]"
                      >
                        <Upload className="h-4 w-4" />
                        Upload image
                      </button>
                    </div>

                    <input
                      ref={productUploadRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleProductUpload(e.target.files);
                        e.target.value = "";
                      }}
                    />

                    {urlOpen && (
                      <div className="space-y-2 rounded-xl border border-white/10 bg-black/25 p-3">
                        <label className="text-[11px] uppercase tracking-wider text-white/40">
                          Paste product URL
                        </label>
                        <input
                          ref={productUrlInputRef}
                          type="text"
                          inputMode="url"
                          autoComplete="url"
                          value={productUrl}
                          onChange={(e) => setProductUrl(e.target.value)}
                          onPaste={(e) => {
                            const pasted = e.clipboardData.getData("text")?.trim();
                            if (!pasted) return;
                            // Ensure paste is applied before Enter can fire in the same tick
                            e.preventDefault();
                            setProductUrl(pasted);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleImportUrl();
                            }
                            if (e.key === "Escape") setUrlOpen(false);
                          }}
                          placeholder="https://…"
                          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500/50"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleImportUrl}
                          disabled={!productUrl.trim() || isScanningProducts}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
                          style={{ background: BLUE.solid }}
                        >
                          {isScanningProducts ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : null}
                          Import
                        </button>
                      </div>
                    )}

                    {catalogOpen && (
                      <div className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                              Catalog
                            </p>
                            {fetchedProducts.length > 0 && (
                              <p className="text-xs text-white/40">
                                {fetchedProducts.length} products
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setCatalogOpen(false)}
                            className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white"
                            aria-label="Close catalog"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {isScanningProducts && fetchedProducts.length === 0 ? (
                          <div className="flex items-center gap-2 py-6 text-sm text-white/50">
                            <Loader2
                              className="h-4 w-4 animate-spin"
                              style={{ color: BLUE.text }}
                            />
                            Scanning catalog…
                          </div>
                        ) : fetchedProducts.length === 0 ? (
                          <p className="py-4 text-sm text-white/45">
                            No products yet. Import a product URL or upload an image.
                          </p>
                        ) : (
                          <>
                            <input
                              type="search"
                              value={catalogQuery}
                              onChange={(e) => setCatalogQuery(e.target.value)}
                              placeholder="Search catalog…"
                              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500/50"
                            />
                            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                              {filteredCatalog.map((product, idx) => {
                                const thumb = product.product_images?.[0];
                                const isSelected =
                                  selectedProduct?.product_name === product.product_name;
                                return (
                                  <button
                                    key={`${product.product_name}-${idx}`}
                                    type="button"
                                    onClick={() => handleSelectProduct(product)}
                                    className={cn(
                                      "flex w-full items-center gap-3 rounded-xl border p-2 text-left transition",
                                      isSelected
                                        ? "border-blue-500/50 bg-blue-500/15"
                                        : "border-white/[0.06] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]"
                                    )}
                                  >
                                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/40">
                                      {thumb ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={thumb}
                                          alt=""
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-white/25">
                                          <Package className="h-4 w-4" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium text-white">
                                        {product.product_name}
                                      </p>
                                      {(product.short_benefit || product.description) && (
                                        <p className="line-clamp-1 text-xs text-white/40">
                                          {product.short_benefit || product.description}
                                        </p>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                              {filteredCatalog.length === 0 && (
                                <p className="py-4 text-center text-sm text-white/40">
                                  No products match “{catalogQuery}”
                                </p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {hasProduct && changingProduct && (
                      <button
                        type="button"
                        onClick={() => setChangingProduct(false)}
                        className="text-xs text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </section>

              <section className={surfaceClass("p-4 sm:p-5")}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                      Reference stills
                    </h3>
                    <p className="mt-0.5 text-xs text-white/35">
                      Supporting product or context images
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => stillsUploadRef.current?.click()}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                    aria-label="Add reference still"
                  >
                    <ImagePlus className="h-4 w-4" />
                  </button>
                  <input
                    ref={stillsUploadRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleStillsUpload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>
                {stillThumbs.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {stillThumbs.map((src, idx) => (
                      <div
                        key={idx}
                        className="h-14 w-14 overflow-hidden rounded-lg border border-white/10"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </aside>

            {/* RIGHT — Creative direction */}
            <section className="space-y-4 lg:col-span-8">
              <div className={surfaceClass("p-4 sm:p-6")}>
                <div className="mb-4">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                    Creative direction
                  </h2>
                  <p className="mt-1 text-sm text-white/50">
                    Describe what you want the poster to communicate.
                  </p>
                </div>

                <textarea
                  value={creativePrompt}
                  onChange={(e) => onCreativePromptChange(e.target.value)}
                  rows={6}
                  placeholder="Create a festive Christmas promotion highlighting the product…"
                  className="min-h-[140px] w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[15px] leading-relaxed text-white outline-none placeholder:text-white/30 focus:border-blue-500/45"
                />

                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={onEnhancePrompt}
                    disabled={isEnhancingPrompt || !creativePrompt.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/55 transition hover:bg-white/[0.06] hover:text-white/80 disabled:opacity-40"
                  >
                    {isEnhancingPrompt ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" style={{ color: BLUE.text }} />
                    )}
                    Help me create the idea
                  </button>
                </div>

                <div className="mt-6 border-t border-white/[0.06] pt-5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    Design inspiration
                  </h3>
                  <p className="mt-1 text-xs text-white/35">
                    Optional reference poster — how the design could feel (not the product)
                  </p>

                  {referencePosterPreviewUrl || isAnalyzingReferencePoster ? (
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-2.5">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-black/40">
                        {referencePosterPreviewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={referencePosterPreviewUrl}
                            alt="Design inspiration"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Loader2
                              className="h-4 w-4 animate-spin"
                              style={{ color: BLUE.text }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/85">Design inspiration</p>
                        <p className="text-xs text-white/40">
                          {isAnalyzingReferencePoster
                            ? "Analyzing reference…"
                            : "Reference poster"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={onClearReferencePoster}
                        className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
                        aria-label="Remove reference poster"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => referenceUploadRef.current?.click()}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-2.5 text-sm text-white/65 transition hover:border-white/25 hover:bg-white/[0.04] hover:text-white"
                    >
                      <ImagePlus className="h-4 w-4" />
                      Add reference poster
                    </button>
                  )}
                  <input
                    ref={referenceUploadRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleReferenceUpload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>

                <div className="mt-6 border-t border-white/[0.06] pt-5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    Visual direction
                  </h3>
                  <p className="mt-1 text-xs text-white/35">
                    Creative modifiers — not templates
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {POSTER_THEMES.map((t) => {
                      const selected = theme === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onThemeChange(t.id)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                            selected
                              ? "border-blue-500/60 text-white"
                              : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/20 hover:text-white"
                          )}
                          style={
                            selected
                              ? { background: BLUE.soft, borderColor: BLUE.mid }
                              : undefined
                          }
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 border-t border-white/[0.06] pt-5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    Format
                  </h3>
                  <div className="mt-3 inline-flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/25 p-1">
                    {ASPECT_RATIOS.map((ratio) => {
                      const selected = aspectRatio === ratio.id;
                      return (
                        <button
                          key={ratio.id}
                          type="button"
                          onClick={() => onAspectRatioChange(ratio.id)}
                          className={cn(
                            "inline-flex min-w-[4.25rem] flex-col items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition",
                            selected ? "text-white" : "text-white/55 hover:text-white"
                          )}
                          style={selected ? { background: BLUE.solid } : undefined}
                          aria-pressed={selected}
                          title={ratio.description}
                        >
                          <FormatGlyph ratio={ratio.id} selected={selected} />
                          {ratio.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 border-t border-white/[0.06] pt-5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    Variants
                  </h3>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="inline-flex gap-1 rounded-xl border border-white/10 bg-black/25 p-1">
                      {([1, 2, 3] as const).map((n) => {
                        const selected = numVariants === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => onNumVariantsChange(n)}
                            className={cn(
                              "min-w-[2.5rem] rounded-lg px-3 py-2 text-xs font-medium transition",
                              selected ? "text-white" : "text-white/55 hover:text-white"
                            )}
                            style={selected ? { background: BLUE.solid } : undefined}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-white/40">
                      {numVariants} variant{numVariants === 1 ? "" : "s"} · {numVariants}{" "}
                      image credit{numVariants === 1 ? "" : "s"}
                      {creditsAvailable != null ? ` · ${creditsAvailable} available` : ""}
                    </p>
                  </div>
                </div>

                <div className="mt-6 border-t border-white/[0.06] pt-5">
                  <button
                    type="button"
                    onClick={onGenerate}
                    disabled={!canGenerate || isGenerating}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:min-w-[220px]"
                    style={{ background: BLUE.solid }}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        {primaryCtaLabel}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                  {!canGenerate && generateBlockedReason && (
                    <p className="mt-2 text-xs text-white/45">{generateBlockedReason}</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

export default PosterCreativeWorkspace;
