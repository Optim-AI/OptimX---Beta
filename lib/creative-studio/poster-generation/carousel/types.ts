/**
 * Carousel campaign schemas.
 *
 * A carousel is ONE campaign: one MarketingStrategy, one ordered story, one shared
 * visual system, and N slides that each carry their own CreativeConcept, CreativeDNA
 * and GenerationSpecification. Slides reuse the single-poster asset/QC/iteration types.
 */

import type {
  CreativeConcept,
  CreativeDNA,
  GenerationSpecification,
  PosterAspectRatio,
  PosterGeneratedAsset,
  PosterIterationRecord,
  PosterQcResult,
} from "../types";

export const CAROUSEL_MIN_SLIDES = 2;
export const CAROUSEL_MAX_SLIDES = 10;

export const CAROUSEL_CAMPAIGN_STATUSES = [
  "planning",
  "ready",
  "generating",
  "partial",
  "completed",
  "failed",
] as const;
export type CarouselCampaignStatus = (typeof CAROUSEL_CAMPAIGN_STATUSES)[number];

/**
 * planned      — story approved, no image yet
 * generating   — claimed by a worker (lease), provider call in flight
 * qc_pending   — image persisted and charged; QC not yet recorded
 * ready        — QC passed
 * needs_review — QC did not pass or could not complete (asset kept)
 * failed       — generation failed; 0 credits; retryable
 * unbilled     — image persisted but the credit charge failed; withheld until charged
 */
export const CAROUSEL_SLIDE_STATUSES = [
  "planned",
  "generating",
  "qc_pending",
  "ready",
  "needs_review",
  "failed",
  "unbilled",
] as const;
export type CarouselSlideStatus = (typeof CAROUSEL_SLIDE_STATUSES)[number];

export const CAROUSEL_NARRATIVE_STRUCTURES = [
  "product_launch",
  "educational",
  "problem_solution",
  "product_benefits",
  "lifestyle_story",
  "promotion",
  "feature_explanation",
  "social_proof",
  "custom",
] as const;
export type CarouselNarrativeStructure =
  (typeof CAROUSEL_NARRATIVE_STRUCTURES)[number];

export type CarouselStory = {
  objective: string;
  audience: string;
  coreMessage: string;
  narrativeStructure: CarouselNarrativeStructure;
  /** Why this structure fits the campaign goal */
  narrativeRationale: string;
  /** Ordered role labels, index-aligned with slides */
  slideRoles: string[];
  /** How copy builds across the slides */
  copyProgression: string;
  /** "none" when the campaign should not close on a CTA */
  ctaIntent: string;
  strategyConstraints: {
    allowedClaims: string[];
    forbiddenClaims: string[];
    requiredDisclaimers: string[];
  };
};

export type CarouselCreativeDNA = {
  id: string;
  /** Concept the user selected as campaign direction, when available */
  directionConceptId: string | null;
  brandIdentity: string;
  palette: string;
  typography: string;
  photographyStyle: string;
  graphicLanguage: string;
  productRepresentation: string;
  mood: string;
  visualHierarchy: string;
  lighting: string;
  recurringElements: string[];
  consistencyRules: string[];
  permittedVariation: string[];
};

export type CarouselSlideCopy = {
  headline: string;
  supporting: string | null;
  cta: string | null;
  badges: string[];
};

export type CarouselSlideError = {
  code: string;
  message: string;
  retryable: boolean;
};

/** Immutable snapshot of a previous slide version (retry or iteration parent) */
export type CarouselSlideVersion = {
  generationId: string;
  specification: GenerationSpecification | null;
  asset: PosterGeneratedAsset | null;
  qc: PosterQcResult | null;
  status: CarouselSlideStatus;
  error: CarouselSlideError | null;
  iteration: PosterIterationRecord | null;
  archivedAt: string;
};

/**
 * generate — first attempt or retry of a failed slide (failure → status failed)
 * rerun / iterate — new version of a successful slide (failure → previous version kept)
 */
export type CarouselLeaseKind = "generate" | "rerun" | "iterate";

export type CarouselSlideLease = {
  token: string;
  expiresAt: string;
  previousStatus: CarouselSlideStatus;
  kind: CarouselLeaseKind;
  generationId: string;
  specification: GenerationSpecification;
  iteration: PosterIterationRecord | null;
};

export type CarouselSlide = {
  slideId: string;
  campaignId: string;
  /** 0-based, stable */
  index: number;
  role: string;
  roleLabel: string;
  objective: string;
  copy: CarouselSlideCopy;
  /** Allowed claims this slide relies on (subset of strategy.allowedClaims) */
  claimsUsed: string[];
  concept: CreativeConcept;
  dna: CreativeDNA;
  status: CarouselSlideStatus;
  /** Current generation identity (null before the first claim) */
  generationId: string | null;
  specification: GenerationSpecification | null;
  asset: PosterGeneratedAsset | null;
  qc: PosterQcResult | null;
  error: CarouselSlideError | null;
  /** Number of provider generations started for this slide */
  attemptCount: number;
  versionNumber: number;
  history: CarouselSlideVersion[];
  /** Iteration that produced the current version, when applicable */
  iteration: PosterIterationRecord | null;
  /** In-flight attempt; current version fields stay untouched until commit */
  lease: CarouselSlideLease | null;
  creditsCharged: number;
  createdAt: string;
  updatedAt: string;
};

export type CarouselCampaignCheck = {
  code: string;
  status: "pass" | "warn" | "fail";
  message: string;
  slideIds?: string[];
};

export type CarouselExport = {
  exportedAt: string;
  includedSlideIds: string[];
  missingSlideIds: string[];
  complete: boolean;
  fileName: string;
};

export type CarouselCampaign = {
  id: string;
  sessionId: string;
  userId: string;
  status: CarouselCampaignStatus;
  /** Optimistic concurrency token for campaign-level updates */
  version: number;
  slideCount: number;
  aspectRatio: PosterAspectRatio;
  briefId: string;
  strategyId: string;
  story: CarouselStory;
  sharedDNA: CarouselCreativeDNA;
  campaignChecks: CarouselCampaignCheck[];
  lastExport: CarouselExport | null;
  generationStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CarouselCampaignWithSlides = {
  campaign: CarouselCampaign;
  /** Always ordered by index */
  slides: CarouselSlide[];
};

/** Statuses that hold a successful, charged image */
export const CAROUSEL_SUCCESS_STATUSES: readonly CarouselSlideStatus[] = [
  "qc_pending",
  "ready",
  "needs_review",
];
