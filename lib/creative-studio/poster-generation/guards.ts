/**
 * Lightweight runtime guards for poster-generation schemas.
 * No I/O. Safe to import from client or server.
 */

import {
  POSTER_ASPECT_RATIOS,
  POSTER_SESSION_STATUSES,
  POSTER_VARIANT_COUNTS,
  POSTER_VISUAL_DIRECTIONS,
  type CreativeBrief,
  type CreativeConcept,
  type CreativeDNA,
  type GenerationSpecification,
  type MarketingStrategy,
  type PosterAspectRatio,
  type PosterGeneratedAsset,
  type PosterGenerationSession,
  type PosterIterationRecord,
  type PosterQcResult,
  type PosterSessionError,
  type PosterSessionStatus,
  type PosterVariantCount,
  type PosterVisualDirection,
} from "./types";

export function isPosterAspectRatio(v: unknown): v is PosterAspectRatio {
  return (
    typeof v === "string" &&
    (POSTER_ASPECT_RATIOS as readonly string[]).includes(v)
  );
}

export function isPosterVisualDirection(v: unknown): v is PosterVisualDirection {
  return (
    typeof v === "string" &&
    (POSTER_VISUAL_DIRECTIONS as readonly string[]).includes(v)
  );
}

export function isPosterVariantCount(v: unknown): v is PosterVariantCount {
  return (
    typeof v === "number" &&
    (POSTER_VARIANT_COUNTS as readonly number[]).includes(v)
  );
}

export function isPosterSessionStatus(v: unknown): v is PosterSessionStatus {
  return (
    typeof v === "string" &&
    (POSTER_SESSION_STATUSES as readonly string[]).includes(v)
  );
}

/** Minimal shape check — does not validate nested product facts. */
export function assertCreativeBriefShape(brief: unknown): brief is CreativeBrief {
  if (!brief || typeof brief !== "object") return false;
  const b = brief as CreativeBrief;
  return (
    typeof b.id === "string" &&
    typeof b.userInstruction === "string" &&
    isPosterAspectRatio(b.aspectRatio) &&
    isPosterVariantCount(b.variantCount) &&
    Array.isArray(b.productReferences) &&
    Array.isArray(b.designReferences) &&
    Array.isArray(b.supportingReferences) &&
    Array.isArray(b.constraints)
  );
}

export function assertMarketingStrategyShape(
  strategy: unknown
): strategy is MarketingStrategy {
  if (!strategy || typeof strategy !== "object") return false;
  const s = strategy as MarketingStrategy;
  return (
    typeof s.id === "string" &&
    typeof s.briefId === "string" &&
    typeof s.objective === "string" &&
    typeof s.audience === "string" &&
    typeof s.primaryMessage === "string" &&
    typeof s.communicationAngle === "string" &&
    typeof s.valueProposition === "string" &&
    typeof s.emotionalDirection === "string" &&
    typeof s.rationale === "string" &&
    Array.isArray(s.supportingMessages) &&
    !!s.copy &&
    typeof s.copy.headline === "string" &&
    Array.isArray(s.informationHierarchy) &&
    Array.isArray(s.allowedClaims) &&
    Array.isArray(s.forbiddenClaims) &&
    Array.isArray(s.restrictedClaims) &&
    Array.isArray(s.requiredDisclaimers) &&
    !!s.userOverrides &&
    typeof s.userOverrides === "object"
  );
}

export function assertCreativeConceptShape(
  concept: unknown
): concept is CreativeConcept {
  if (!concept || typeof concept !== "object") return false;
  const c = concept as CreativeConcept;
  return (
    typeof c.id === "string" &&
    typeof c.name === "string" &&
    typeof c.description === "string" &&
    typeof c.territory === "string" &&
    typeof c.rationale === "string" &&
    typeof c.visualStory === "string" &&
    typeof c.composition === "string" &&
    typeof c.subjectTreatment === "string" &&
    typeof c.productTreatment === "string" &&
    typeof c.environment === "string" &&
    typeof c.humanPresence === "string" &&
    typeof c.emotionalExpression === "string" &&
    typeof c.differentiation === "string" &&
    typeof c.strategyId === "string" &&
    typeof c.briefId === "string"
  );
}

export function assertCreativeDnaShape(dna: unknown): dna is CreativeDNA {
  if (!dna || typeof dna !== "object") return false;
  const d = dna as CreativeDNA;
  return (
    typeof d.id === "string" &&
    typeof d.conceptId === "string" &&
    typeof d.visualTerritory === "string" &&
    typeof d.composition === "string" &&
    typeof d.subjectTreatment === "string" &&
    typeof d.productTreatment === "string" &&
    typeof d.photographyStyle === "string" &&
    typeof d.lighting === "string" &&
    typeof d.colorStrategy === "string" &&
    typeof d.typographyStrategy === "string" &&
    typeof d.graphicLanguage === "string" &&
    typeof d.humanPresence === "string" &&
    typeof d.environment === "string" &&
    typeof d.mood === "string" &&
    typeof d.hierarchy === "string" &&
    typeof d.visualRhythm === "string"
  );
}

export function assertGenerationSpecificationShape(
  spec: unknown
): spec is GenerationSpecification {
  if (!spec || typeof spec !== "object") return false;
  const s = spec as GenerationSpecification;
  return (
    typeof s.id === "string" &&
    typeof s.sessionId === "string" &&
    typeof s.conceptId === "string" &&
    typeof s.dnaId === "string" &&
    typeof s.generationId === "string" &&
    typeof s.variantId === "string" &&
    typeof s.aspectRatio === "string" &&
    !!s.renderCopy &&
    typeof s.renderCopy.headline === "string" &&
    !!s.scene &&
    typeof s.scene.visualStory === "string" &&
    Array.isArray(s.copyHierarchy) &&
    !!s.strategyAlignment &&
    Array.isArray(s.references) &&
    !!s.constraints &&
    Array.isArray(s.attachedAssetIds)
  );
}

export function assertPosterQcResultShape(qc: unknown): qc is PosterQcResult {
  if (!qc || typeof qc !== "object") return false;
  const q = qc as PosterQcResult;
  return (
    typeof q.id === "string" &&
    typeof q.generationId === "string" &&
    typeof q.assetId === "string" &&
    typeof q.passed === "boolean" &&
    typeof q.decision === "string" &&
    typeof q.status === "string" &&
    typeof q.recommendedAction === "string" &&
    typeof q.summary === "string" &&
    typeof q.confidence === "number" &&
    typeof q.failureType === "string" &&
    !!q.checks &&
    typeof q.checks === "object" &&
    Array.isArray(q.issues) &&
    Array.isArray(q.warnings)
  );
}

export function assertPosterGeneratedAssetShape(
  asset: unknown
): asset is PosterGeneratedAsset {
  if (!asset || typeof asset !== "object") return false;
  const a = asset as PosterGeneratedAsset;
  return (
    typeof a.id === "string" &&
    typeof a.sessionId === "string" &&
    typeof a.generationId === "string" &&
    typeof a.variantId === "string" &&
    typeof a.variantIndex === "number" &&
    typeof a.imageUrl === "string" &&
    typeof a.provider === "string" &&
    typeof a.model === "string" &&
    (a.status === "generated" || a.status === "failed")
  );
}

export function assertPosterIterationRecordShape(
  iteration: unknown
): iteration is PosterIterationRecord {
  if (!iteration || typeof iteration !== "object") return false;
  const i = iteration as PosterIterationRecord;
  return (
    typeof i.id === "string" &&
    !!i.request &&
    typeof i.request.id === "string" &&
    typeof i.request.userInstruction === "string" &&
    typeof i.classification === "string" &&
    Array.isArray(i.preservedDnaFields) &&
    Array.isArray(i.changedDnaFields)
  );
}

export function assertPosterSessionErrorShape(
  err: unknown
): err is PosterSessionError {
  if (!err || typeof err !== "object") return false;
  const e = err as PosterSessionError;
  return (
    typeof e.code === "string" &&
    typeof e.stage === "string" &&
    typeof e.message === "string" &&
    typeof e.retryable === "boolean"
  );
}

export function createEmptyPosterSession(input: {
  id: string;
  userId: string;
  studioSessionId?: string | null;
  brandId?: string | null;
  productId?: string | null;
}): PosterGenerationSession {
  const now = new Date().toISOString();
  return {
    id: input.id,
    userId: input.userId,
    studioSessionId: input.studioSessionId ?? null,
    brandId: input.brandId ?? null,
    productId: input.productId ?? null,
    status: "draft",
    version: 1,
    createdAt: now,
    updatedAt: now,
    brief: null,
    strategy: null,
    concepts: [],
    selectedConceptIds: [],
    dnaByConceptId: {},
    specifications: [],
    assets: [],
    iterations: [],
    error: null,
    trace: {
      totalCreditsConsumed: 0,
      generationCount: 0,
      retryCount: 0,
    },
  };
}
