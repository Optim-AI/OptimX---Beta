/**
 * Runtime guards for carousel requests and persisted JSON. No I/O.
 */

import {
  assertCreativeConceptShape,
  assertCreativeDnaShape,
  assertGenerationSpecificationShape,
  assertPosterGeneratedAssetShape,
  assertPosterQcResultShape,
  isPosterAspectRatio,
} from "../guards";
import {
  CAROUSEL_CAMPAIGN_STATUSES,
  CAROUSEL_MAX_SLIDES,
  CAROUSEL_MIN_SLIDES,
  CAROUSEL_NARRATIVE_STRUCTURES,
  CAROUSEL_SLIDE_STATUSES,
  type CarouselCampaign,
  type CarouselCampaignStatus,
  type CarouselCreativeDNA,
  type CarouselNarrativeStructure,
  type CarouselSlide,
  type CarouselSlideStatus,
  type CarouselStory,
} from "./types";

function isStr(v: unknown): v is string {
  return typeof v === "string";
}

function isStrArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isStr);
}

export function isCarouselCampaignStatus(v: unknown): v is CarouselCampaignStatus {
  return isStr(v) && (CAROUSEL_CAMPAIGN_STATUSES as readonly string[]).includes(v);
}

export function isCarouselSlideStatus(v: unknown): v is CarouselSlideStatus {
  return isStr(v) && (CAROUSEL_SLIDE_STATUSES as readonly string[]).includes(v);
}

export function isCarouselNarrativeStructure(
  v: unknown
): v is CarouselNarrativeStructure {
  return isStr(v) && (CAROUSEL_NARRATIVE_STRUCTURES as readonly string[]).includes(v);
}

/** Strict: a JSON number that is an integer in [2, 10]. Strings are rejected. */
export function parseCarouselSlideCount(
  raw: unknown
): { ok: true; value: number } | { ok: false; message: string } {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return { ok: false, message: "slideCount must be a number" };
  }
  if (!Number.isInteger(raw)) {
    return { ok: false, message: "slideCount must be a whole number" };
  }
  if (raw < CAROUSEL_MIN_SLIDES || raw > CAROUSEL_MAX_SLIDES) {
    return {
      ok: false,
      message: `slideCount must be between ${CAROUSEL_MIN_SLIDES} and ${CAROUSEL_MAX_SLIDES}`,
    };
  }
  return { ok: true, value: raw };
}

export function assertCarouselStoryShape(v: unknown): v is CarouselStory {
  if (!v || typeof v !== "object") return false;
  const s = v as CarouselStory;
  return (
    isStr(s.objective) &&
    isStr(s.audience) &&
    isStr(s.coreMessage) &&
    isCarouselNarrativeStructure(s.narrativeStructure) &&
    isStr(s.narrativeRationale) &&
    isStrArray(s.slideRoles) &&
    isStr(s.copyProgression) &&
    isStr(s.ctaIntent) &&
    !!s.strategyConstraints &&
    isStrArray(s.strategyConstraints.allowedClaims) &&
    isStrArray(s.strategyConstraints.forbiddenClaims) &&
    isStrArray(s.strategyConstraints.requiredDisclaimers)
  );
}

export function assertCarouselCreativeDnaShape(
  v: unknown
): v is CarouselCreativeDNA {
  if (!v || typeof v !== "object") return false;
  const d = v as CarouselCreativeDNA;
  return (
    isStr(d.id) &&
    (d.directionConceptId === null || isStr(d.directionConceptId)) &&
    isStr(d.brandIdentity) &&
    isStr(d.palette) &&
    isStr(d.typography) &&
    isStr(d.photographyStyle) &&
    isStr(d.graphicLanguage) &&
    isStr(d.productRepresentation) &&
    isStr(d.mood) &&
    isStr(d.visualHierarchy) &&
    isStr(d.lighting) &&
    isStrArray(d.recurringElements) &&
    isStrArray(d.consistencyRules) &&
    isStrArray(d.permittedVariation)
  );
}

export function assertCarouselCampaignShape(v: unknown): v is CarouselCampaign {
  if (!v || typeof v !== "object") return false;
  const c = v as CarouselCampaign;
  return (
    isStr(c.id) &&
    isStr(c.sessionId) &&
    isStr(c.userId) &&
    isCarouselCampaignStatus(c.status) &&
    typeof c.version === "number" &&
    typeof c.slideCount === "number" &&
    c.slideCount >= CAROUSEL_MIN_SLIDES &&
    c.slideCount <= CAROUSEL_MAX_SLIDES &&
    isPosterAspectRatio(c.aspectRatio) &&
    isStr(c.briefId) &&
    isStr(c.strategyId) &&
    assertCarouselStoryShape(c.story) &&
    assertCarouselCreativeDnaShape(c.sharedDNA) &&
    Array.isArray(c.campaignChecks)
  );
}

export function assertCarouselSlideShape(v: unknown): v is CarouselSlide {
  if (!v || typeof v !== "object") return false;
  const s = v as CarouselSlide;
  return (
    isStr(s.slideId) &&
    isStr(s.campaignId) &&
    typeof s.index === "number" &&
    Number.isInteger(s.index) &&
    s.index >= 0 &&
    isStr(s.role) &&
    isStr(s.roleLabel) &&
    isStr(s.objective) &&
    !!s.copy &&
    isStr(s.copy.headline) &&
    isStrArray(s.copy.badges) &&
    isStrArray(s.claimsUsed) &&
    assertCreativeConceptShape(s.concept) &&
    assertCreativeDnaShape(s.dna) &&
    isCarouselSlideStatus(s.status) &&
    (s.generationId === null || isStr(s.generationId)) &&
    (s.specification === null || assertGenerationSpecificationShape(s.specification)) &&
    (s.asset === null || assertPosterGeneratedAssetShape(s.asset)) &&
    (s.qc === null || assertPosterQcResultShape(s.qc)) &&
    typeof s.attemptCount === "number" &&
    typeof s.versionNumber === "number" &&
    Array.isArray(s.history) &&
    typeof s.creditsCharged === "number"
  );
}
