/**
 * Poster Generation Architecture — canonical schemas (Phase 1).
 *
 * Source of truth for structured creative state.
 * The image prompt is a DERIVATIVE of these structures — never the other way around.
 *
 * Reuses existing app types where appropriate:
 * - BrandSnapshot, Product from creative-studio UI types
 * - Aspect ratios / visual directions already used by PosterCreativeWorkspace
 *
 * No providers, no LLM calls, no API routes in this module yet.
 */

import type { BrandSnapshot, Product } from "@/app/web/src/components/creative-studio/types";

// ─────────────────────────────────────────────────────────────
// Shared literals (aligned with current UI)
// ─────────────────────────────────────────────────────────────

export const POSTER_ASPECT_RATIOS = ["1:1", "4:5", "9:16", "1.91:1"] as const;
export type PosterAspectRatio = (typeof POSTER_ASPECT_RATIOS)[number];

export const POSTER_VISUAL_DIRECTIONS = [
  "minimal",
  "professional",
  "commercial",
  "premium",
  "bold",
  "playful",
  "trendy",
  "festive",
  "dynamic",
] as const;
export type PosterVisualDirection = (typeof POSTER_VISUAL_DIRECTIONS)[number];

export const POSTER_VARIANT_COUNTS = [1, 2, 3] as const;
export type PosterVariantCount = (typeof POSTER_VARIANT_COUNTS)[number];

export const PRODUCT_SOURCE_KINDS = [
  "catalog",
  "url_import",
  "upload",
  "existing",
  "manual",
] as const;
export type ProductSourceKind = (typeof PRODUCT_SOURCE_KINDS)[number];

export const REFERENCE_ASSET_ROLES = [
  "product_packshot",
  "product_lifestyle",
  "brand_logo",
  "design_inspiration",
  "supporting_still",
] as const;
export type ReferenceAssetRole = (typeof REFERENCE_ASSET_ROLES)[number];

// ─────────────────────────────────────────────────────────────
// Assets
// ─────────────────────────────────────────────────────────────

export type PosterImageRef = {
  /** Public URL or data URL — never store provider secrets here */
  url: string;
  mimeType?: string | null;
  storagePath?: string | null;
  width?: number | null;
  height?: number | null;
  /** Content fingerprint for cache / dedupe */
  contentHash?: string | null;
};

/**
 * Product vs design references are explicitly role-separated.
 * product_* / brand_logo = WHAT must appear.
 * design_inspiration / supporting_still = HOW it should feel.
 */
export type PosterReferenceAsset = {
  id: string;
  role: ReferenceAssetRole;
  image: PosterImageRef;
  /** Design-grammar analysis when role is design_inspiration */
  designAnalysis?: PosterDesignReferenceAnalysis | null;
  influence?: "subtle" | "balanced" | "strong";
};

export type PosterDesignReferenceAnalysis = {
  composition: string;
  layout: string;
  typography: string;
  colorStrategy: string;
  imagery: string;
  graphicLanguage: string;
  hierarchy: string;
  spacing: string;
  visualTreatment: string;
  designMechanism: string;
  avoid: string[];
  styleTags?: string[];
  summary?: string;
};

/**
 * Normalized product context — catalog, URL import, and upload all converge here.
 * Claims must come from extracted/provided facts only (no invented claims later).
 */
export type PosterProductContext = {
  source: ProductSourceKind;
  name: string;
  description?: string | null;
  shortBenefit?: string | null;
  category?: string | null;
  benefits: string[];
  /** Strict factual claims only (e.g. "26g protein") — never marketing fluff invented by AI */
  factualClaims: string[];
  features: string[];
  price?: string | null;
  productUrl?: string | null;
  brandName?: string | null;
  targetAudience?: string | null;
  emotionalAngles: string[];
  useCases: string[];
  /** Canonical product images (packshots) */
  images: PosterImageRef[];
  /** Optional raw catalog Product for traceability */
  catalogProduct?: Product | null;
};

export type PosterBrandContext = {
  snapshot: BrandSnapshot | null;
  name?: string | null;
  logo?: PosterImageRef | null;
  primaryColors: string[];
  fonts?: string | null;
  tone?: string | null;
  voice?: string | null;
  industry?: string | null;
  audience?: string | null;
  tagline?: string | null;
  coreValueProp?: string | null;
  aestheticTags: string[];
  values: string[];
  guidelinesApplied: boolean;
};

// ─────────────────────────────────────────────────────────────
// LAYER 1 — Creative Brief (WHAT the user wants)
// ─────────────────────────────────────────────────────────────

/**
 * Canonical CreativeBrief.
 * Represents user intent + normalized context.
 * Must NOT contain a giant image-generation prompt.
 */
export type CreativeBrief = {
  id: string;
  createdAt: string;
  brand: PosterBrandContext;
  product: PosterProductContext | null;
  /** Free-form marketing instruction from the UI "Creative Direction" field */
  userInstruction: string;
  visualDirection: PosterVisualDirection | null;
  aspectRatio: PosterAspectRatio;
  variantCount: PosterVariantCount;
  platformHint?: string | null;
  /** Optional explicit objective if known; otherwise strategist infers */
  objectiveHint?: string | null;
  audienceHint?: string | null;
  offerHint?: string | null;
  constraints: string[];
  /** Product packshots / logos */
  productReferences: PosterReferenceAsset[];
  /** Design inspiration poster(s) */
  designReferences: PosterReferenceAsset[];
  /** Supporting stills (reference stills rail) */
  supportingReferences: PosterReferenceAsset[];
};

// ─────────────────────────────────────────────────────────────
// LAYER 2 — Marketing Strategy
// ─────────────────────────────────────────────────────────────

export type MarketingStrategy = {
  id: string;
  briefId: string;
  createdAt: string;
  /** Marketing objective (e.g. product_launch, seasonal_promotion, custom) — not a visual style */
  objective: string;
  audience: string;
  /** Singular primary communication message */
  primaryMessage: string;
  /** Framing angle (convenience, urgency, etc.) — not visual style */
  communicationAngle: string;
  valueProposition: string;
  emotionalDirection: string;
  /** Concise strategic rationale for debugging / Creative Director context */
  rationale: string;
  /** Secondary messages (not competing primaries) */
  supportingMessages: string[];
  /** Copy candidates derived only from factual product/brand data + user instruction */
  copy: {
    headline: string;
    supporting?: string | null;
    productLine?: string | null;
    cta?: string | null;
    badges: string[];
  };
  /** Information hierarchy for the poster (what must be noticed 1st → optional) */
  informationHierarchy: string[];
  /** Explicit list of claims allowed on the creative — subset of product factualClaims */
  allowedClaims: string[];
  /** Claims / phrasing explicitly forbidden */
  forbiddenClaims: string[];
  /** Softer restrictions (use with care / avoid as hard claims) */
  restrictedClaims: string[];
  /** Disclaimers required when known from brand/product rules — never invented */
  requiredDisclaimers: string[];
  /** Explicit user-supplied copy/intent that must not be overwritten */
  userOverrides: {
    headline?: string | null;
    cta?: string | null;
    audience?: string | null;
    message?: string | null;
    offer?: string | null;
  };
};

// ─────────────────────────────────────────────────────────────
// LAYER 3 — Creative Concept + Creative DNA
// ─────────────────────────────────────────────────────────────

export const CREATIVE_TERRITORIES = [
  "lifestyle",
  "product_hero",
  "editorial",
  "typography_led",
  "conceptual_metaphor",
  "demonstration",
  "social_ritual",
  "environment_story",
  /** Graphic-design-led communication */
  "graphic",
  /** Ingredient / feature storytelling */
  "ingredient_feature",
  /** Proof / testimonial when factual evidence exists */
  "social_proof",
  /** Occasion / cultural moment */
  "seasonal",
] as const;
export type CreativeTerritory = (typeof CREATIVE_TERRITORIES)[number];

export type CreativeConcept = {
  id: string;
  briefId: string;
  strategyId: string;
  createdAt: string;
  name: string;
  /** Short description of the creative idea (not a style tag) */
  description: string;
  territory: CreativeTerritory;
  /** Why this concept serves the MarketingStrategy */
  rationale: string;
  visualStory: string;
  composition: string;
  /** How the main subject is treated (distinct from productTreatment) */
  subjectTreatment: string;
  productTreatment: string;
  environment: string;
  humanPresence: string;
  /** Intended emotional expression of the concept */
  emotionalExpression: string;
  cameraDirection: string;
  typographyTreatment: string;
  colorTreatment: string;
  graphicLanguage: string;
  supportingElements: string;
  copyHierarchy: string;
  ctaTreatment: string;
  /** How visualDirection (theme) flavors this concept — art direction, not a layout template */
  visualDirectionExpression: string;
  /** Concise differentiation vs sibling concepts in the same set */
  differentiation: string;
};

/**
 * Creative DNA — persisted with every generated asset to prevent template collapse
 * and to power controlled iteration.
 */
export type CreativeDNA = {
  id: string;
  conceptId: string;
  visualTerritory: CreativeTerritory;
  composition: string;
  subjectTreatment: string;
  productTreatment: string;
  photographyStyle: string;
  lighting: string;
  colorStrategy: string;
  typographyStrategy: string;
  graphicLanguage: string;
  humanPresence: string;
  environment: string;
  mood: string;
  hierarchy: string;
  /** Visual pacing / rhythm of the composition */
  visualRhythm: string;
  aspectAwareNotes: string;
};

// ─────────────────────────────────────────────────────────────
// LAYER 4 — Generation Specification (structured plan → provider)
// ─────────────────────────────────────────────────────────────

export type GenerationSpecReference = {
  assetId: string;
  kind: "product" | "design" | "supporting" | "logo";
  role: ReferenceAssetRole;
  /** Human-readable label for provider prompt (REFERENCE A / PRODUCT …) */
  label: string;
  /** URL or data URL used when resolving references at generate time */
  url?: string | null;
};

export type GenerationCopySlot = {
  role: "primary" | "secondary" | "supporting" | "cta" | "badge" | "product_line";
  text: string;
  importance: "required" | "optional";
};

export type GenerationSpecification = {
  id: string;
  sessionId: string;
  briefId: string;
  strategyId: string;
  conceptId: string;
  dnaId: string;
  createdAt: string;
  /** Stable identity for this provider generation attempt */
  generationId: string;
  /** Stable variant identity — never an array index alone */
  variantId: string;
  variantIndex: number;
  aspectRatio: PosterAspectRatio;
  /** Derived platform intent from aspect ratio */
  intendedPlatform: string;
  /** Exact copy to render (from strategy + user overrides — never invented here) */
  renderCopy: {
    headline: string;
    supporting?: string | null;
    productLine?: string | null;
    cta?: string | null;
    badges: string[];
  };
  /** Explicit text hierarchy for the renderer */
  copyHierarchy: GenerationCopySlot[];
  /** Frozen strategy facts the provider must not rewrite */
  strategyAlignment: {
    objective: string;
    primaryMessage: string;
    audience: string;
    communicationAngle: string;
    allowedClaims: string[];
    forbiddenClaims: string[];
    restrictedClaims: string[];
  };
  /** Structured generation instructions — provider adapter turns this into a prompt */
  scene: {
    visualTerritory: string;
    visualStory: string;
    composition: string;
    subjectTreatment: string;
    productRole: string;
    productTreatment: string;
    environment: string;
    humanPresence: string;
    lighting: string;
    photographyStyle: string;
    colorStrategy: string;
    typography: string;
    graphicLanguage: string;
    visualRhythm: string;
    mood: string;
    hierarchy: string;
    productFidelityRules: string;
    brandIntegration: string;
    designReferenceInfluence: string;
    visualDirectionExpression: string;
    outputRequirements: string[];
  };
  references: GenerationSpecReference[];
  /** Attached asset IDs (product / logo / design refs) for the provider call */
  attachedAssetIds: string[];
  constraints: {
    productFidelity: string;
    logoFidelity: string;
    copyFidelity: string;
    unsupportedClaims: string[];
    referenceHandling: string;
    brandRequirements: string[];
  };
  userOverrides: {
    headline?: string | null;
    cta?: string | null;
    audience?: string | null;
    message?: string | null;
    offer?: string | null;
  };
  /** Final compiled prompt string — DERIVATIVE only, optional until provider compile */
  compiledPrompt?: string | null;
  /** Phase 8 — lineage when this spec was produced by iteration */
  parentGenerationId?: string | null;
  parentSpecificationId?: string | null;
  iterationId?: string | null;
};

// ─────────────────────────────────────────────────────────────
// LAYER 5 — Provider abstraction (interface only in Phase 1)
// ─────────────────────────────────────────────────────────────

export type ImageGenerationRequest = {
  specification: GenerationSpecification;
  prompt: string;
  aspectRatio: PosterAspectRatio;
  /** Inline or URL image parts (product, logo, refs) — labeled for the provider */
  referenceImages: Array<{
    role: ReferenceAssetRole;
    kind: "product" | "design" | "supporting" | "logo";
    label: string;
    instruction: string;
    mimeType: string;
    base64Data?: string;
    url?: string;
  }>;
  /** edit vs generate */
  mode: "generate" | "edit";
  /** Prior image for edit mode */
  baseImage?: { mimeType: string; base64Data: string } | null;
  metadata: {
    sessionId: string;
    generationId: string;
    variantId: string;
    userId: string;
  };
};

export type ImageGenerationResult = {
  ok: boolean;
  imageDataUrl?: string | null;
  imageBuffer?: Buffer | null;
  mimeType?: string | null;
  provider: string;
  model: string;
  durationMs?: number;
  estimatedCostCredits: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  rawProviderStatus?: string | null;
  /** Provider-rendered prompt used (for debug; no secrets) */
  compiledPrompt?: string | null;
};

export type ImageProviderCapabilities = {
  supportsGenerate: boolean;
  supportsEdit: boolean;
  supportedAspectRatios: PosterAspectRatio[];
  maxReferenceImages: number;
  /** True when provider can take a prior poster as a strong reference for controlled regen */
  supportsReferenceImages: boolean;
  /** Pixel-level inpainting — only true when actually supported */
  supportsInpainting: boolean;
};

/**
 * Provider interface — rest of the app must not care which model is used.
 * Implementation comes in a later phase (Nano Banana adapter wrapping existing nano-banana client).
 */
export interface ImageGenerationProvider {
  readonly id: string;
  getCapabilities(): ImageProviderCapabilities;
  checkAvailability(): Promise<{ available: boolean; reason?: string }>;
  estimateCost(request: ImageGenerationRequest): number;
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
  edit(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

// ─────────────────────────────────────────────────────────────
// LAYER 6 — Quality Control
// ─────────────────────────────────────────────────────────────

export const QC_ISSUE_CATEGORIES = [
  "product",
  "text",
  "copy",
  "design",
  "marketing",
  "brand",
  "technical",
  "composition",
  "concept",
  "strategy",
  "reference",
  "artifact",
  "claim",
] as const;
export type QcIssueCategory = (typeof QC_ISSUE_CATEGORIES)[number];

export const QC_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type QcSeverity = (typeof QC_SEVERITIES)[number];

/** Legacy decision enum — kept for compatibility; prefer status + recommendedAction */
export const QC_DECISIONS = ["pass", "fix", "regenerate"] as const;
export type QcDecision = (typeof QC_DECISIONS)[number];

export const QC_CHECK_STATUSES = ["pass", "warn", "fail"] as const;
export type QcCheckStatus = (typeof QC_CHECK_STATUSES)[number];

export const QC_CHECK_SEVERITIES = [
  "none",
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type QcCheckSeverity = (typeof QC_CHECK_SEVERITIES)[number];

export const QC_RESULT_STATUSES = [
  "pass",
  "fix_local",
  "regenerate",
  "fail",
] as const;
export type QcResultStatus = (typeof QC_RESULT_STATUSES)[number];

export const QC_RECOMMENDED_ACTIONS = [
  "accept",
  "local_fix",
  "regenerate",
  "review",
] as const;
export type QcRecommendedAction = (typeof QC_RECOMMENDED_ACTIONS)[number];

export const QC_FAILURE_TYPES = [
  "none",
  "generation_execution",
  "specification",
  "technical",
] as const;
export type QcFailureType = (typeof QC_FAILURE_TYPES)[number];

export type PosterQcCheck = {
  status: QcCheckStatus;
  severity: QcCheckSeverity;
  summary: string;
  evidence?: string[];
  expected?: string;
  observed?: string;
};

export type PosterQcIssue = {
  id: string;
  category: QcIssueCategory;
  severity: QcSeverity;
  code: string;
  message: string;
  expected?: string | null;
  observed?: string | null;
  actionable?: boolean;
  recommendedFix?: string | null;
};

export type PosterQcChecks = {
  productFidelity: PosterQcCheck;
  copyAccuracy: PosterQcCheck;
  visualHierarchy: PosterQcCheck;
  composition: PosterQcCheck;
  conceptExecution: PosterQcCheck;
  strategyAlignment: PosterQcCheck;
  brandCompliance: PosterQcCheck;
  referenceCompliance: PosterQcCheck;
  technicalQuality: PosterQcCheck;
  artifactDetection: PosterQcCheck;
  claimSafety: PosterQcCheck;
};

/**
 * Canonical QC result — machine-readable evaluation of generated poster
 * against the approved creative chain. Not a user-facing "quality score".
 */
export type PosterQcResult = {
  id: string;
  generationId: string;
  assetId: string;
  createdAt: string;
  /** Convenience: true when status === "pass" */
  passed: boolean;
  /** Legacy decision field */
  decision: QcDecision;
  status: QcResultStatus;
  recommendedAction: QcRecommendedAction;
  summary: string;
  /** Internal confidence 0–1 — not a product "quality score" */
  confidence: number;
  /** Distinguishes generation execution vs bad specification vs technical */
  failureType: QcFailureType;
  checks: PosterQcChecks;
  /** Deprecated for UI — kept null or unused; do not surface as 87/100 */
  score: number | null;
  issues: PosterQcIssue[];
  warnings: PosterQcIssue[];
  recommendedFixes: string[];
};

// ─────────────────────────────────────────────────────────────
// LAYER 7 — Iteration
// ─────────────────────────────────────────────────────────────

export const EDIT_CLASSIFICATIONS = [
  "LOCAL_EDIT",
  "DESIGN_EDIT",
  "CREATIVE_EDIT",
  "FULL_REGENERATION",
] as const;
export type EditClassification = (typeof EDIT_CLASSIFICATIONS)[number];

/** User-facing / planner shorthand for EditClassification */
export const ITERATION_MODES = [
  "LOCAL",
  "DESIGN",
  "CREATIVE",
  "FULL",
] as const;
export type IterationMode = (typeof ITERATION_MODES)[number];

export const ITERATION_LOCK_STATES = ["LOCKED", "MODIFY", "MAYBE"] as const;
export type IterationLockState = (typeof ITERATION_LOCK_STATES)[number];

export type IterationLocks = {
  strategy: IterationLockState;
  concept: IterationLockState;
  product: IterationLockState;
  brand: IterationLockState;
  copy: IterationLockState;
  composition: IterationLockState;
  visualTreatment: IterationLockState;
  references: IterationLockState;
};

export type IterationCopyChanges = {
  headline?: string | null;
  supporting?: string | null;
  productLine?: string | null;
  cta?: string | null;
};

export type IterationChanges = {
  /** What the user is targeting, e.g. "product scale" */
  target: string;
  /** Concise plan summary */
  summary: string;
  /** Explicit copy overrides when copy=MODIFY */
  copyChanges?: IterationCopyChanges | null;
  /** Scene field patches applied on top of the source specification */
  scenePatches?: Partial<GenerationSpecification["scene"]> | null;
  /**
   * Relative product presentation scale delta for LOCAL product-size edits.
   * e.g. +0.2 ≈ "make product larger". Applied as a scene productTreatment note
   * (GenerationSpecification has no discrete productScale field).
   */
  productScaleDelta?: number | null;
};

export type IterationClassificationDetail = {
  target: string;
  rationale: string;
  confidence: number;
};

export const ITERATION_STATUSES = [
  "planned",
  "generating",
  "completed",
  "failed",
] as const;
export type IterationStatus = (typeof ITERATION_STATUSES)[number];

export type PosterIterationRequest = {
  id: string;
  sessionId: string;
  targetGenerationId: string;
  userInstruction: string;
  classification?: EditClassification | null;
  createdAt: string;
};

/**
 * Persisted iteration history entry.
 * Phase 1 fields remain required; Phase 8 enriches with locks/plan/status.
 */
export type PosterIterationRecord = {
  id: string;
  request: PosterIterationRequest;
  classification: EditClassification;
  /** Alias of classification mapped to LOCAL|DESIGN|CREATIVE|FULL */
  mode?: IterationMode;
  classificationDetail?: IterationClassificationDetail | null;
  locks?: IterationLocks | null;
  changes?: IterationChanges | null;
  sourceSpecificationId?: string | null;
  parentGenerationId?: string | null;
  resultingGenerationId?: string | null;
  resultingSpecificationId?: string | null;
  preservedDnaFields: string[];
  changedDnaFields: string[];
  status?: IterationStatus;
  /** User-facing consequence copy (no technical jargon) */
  userFacingSummary?: string | null;
  createdAt?: string;
  errorMessage?: string | null;
};

export function editClassificationToMode(
  c: EditClassification
): IterationMode {
  switch (c) {
    case "LOCAL_EDIT":
      return "LOCAL";
    case "DESIGN_EDIT":
      return "DESIGN";
    case "CREATIVE_EDIT":
      return "CREATIVE";
    case "FULL_REGENERATION":
      return "FULL";
  }
}

export function modeToEditClassification(m: IterationMode): EditClassification {
  switch (m) {
    case "LOCAL":
      return "LOCAL_EDIT";
    case "DESIGN":
      return "DESIGN_EDIT";
    case "CREATIVE":
      return "CREATIVE_EDIT";
    case "FULL":
      return "FULL_REGENERATION";
  }
}

// ─────────────────────────────────────────────────────────────
// Generated asset + session (source of truth)
// ─────────────────────────────────────────────────────────────

export const POSTER_SESSION_STATUSES = [
  "draft",
  "brief_ready",
  "strategy_ready",
  "concepts_ready",
  "generating",
  "qc",
  "ready",
  "iterating",
  "failed",
  "cancelled",
] as const;
export type PosterSessionStatus = (typeof POSTER_SESSION_STATUSES)[number];

/** Structured failure context — never store secrets or stack traces for clients */
export type PosterSessionError = {
  code: string;
  stage: string;
  message: string;
  retryable: boolean;
};

export type PosterGeneratedAsset = {
  id: string;
  sessionId: string;
  /** Same as id — stable generation identity */
  generationId: string;
  /** Stable variant identity — do not use array index as identity */
  variantId: string;
  variantIndex: number;
  conceptId: string;
  dnaId: string;
  specificationId: string;
  /** Empty string when status=failed */
  imageUrl: string;
  storagePath?: string | null;
  provider: string;
  model: string;
  creditsConsumed: number;
  /** Phase 6: generated | failed — QC comes in Phase 7 */
  status: "generated" | "failed";
  attemptCount?: number;
  durationMs?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  qc?: PosterQcResult | null;
  createdAt: string;
  /** Phase 8 lineage */
  parentGenerationId?: string | null;
  iterationId?: string | null;
  /** 1-based version within a parent chain; original assets default to 1 */
  versionNumber?: number;
  /** Latest preferred version in a lineage (soft flag — originals stay immutable) */
  isActive?: boolean;
};

/**
 * PosterGenerationSession — single source of truth for one generation journey.
 * Maps from current Brand Studio UI controls without requiring a UI redesign.
 */
export type PosterGenerationSession = {
  id: string;
  userId: string;
  /** Optional link to existing creative_studio_sessions row during migration */
  studioSessionId?: string | null;
  brandId?: string | null;
  productId?: string | null;
  status: PosterSessionStatus;
  /** Optimistic concurrency token */
  version: number;
  createdAt: string;
  updatedAt: string;

  brief: CreativeBrief | null;
  strategy: MarketingStrategy | null;
  concepts: CreativeConcept[];
  selectedConceptIds: string[];
  dnaByConceptId: Record<string, CreativeDNA>;
  specifications: GenerationSpecification[];
  assets: PosterGeneratedAsset[];
  iterations: PosterIterationRecord[];

  error?: PosterSessionError | null;

  /** Observability / cost */
  trace: {
    lastProvider?: string | null;
    lastModel?: string | null;
    totalCreditsConsumed: number;
    generationCount: number;
    retryCount: number;
    lastError?: string | null;
  };
};

/**
 * UI control → CreativeBrief field mapping (documentation for Phase 12 wiring).
 *
 * Catalog / Import URL / Upload  → product + productReferences
 * Creative Direction textarea    → userInstruction
 * Reference Poster               → designReferences
 * Reference Stills               → supportingReferences
 * Visual Direction chips         → visualDirection
 * Format                         → aspectRatio
 * Variants                       → variantCount
 * Brand guidelines banner        → brand
 */
export type PosterUiBriefMapping = {
  catalogProduct: "product";
  importUrl: "product";
  uploadImage: "productReferences";
  creativeDirection: "userInstruction";
  referencePoster: "designReferences";
  referenceStills: "supportingReferences";
  visualDirection: "visualDirection";
  format: "aspectRatio";
  variants: "variantCount";
  brandBanner: "brand";
};
