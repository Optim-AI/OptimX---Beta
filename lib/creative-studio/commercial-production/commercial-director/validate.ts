/**
 * Deterministic CommercialBlueprint validation.
 * Pure TypeScript — no AI, no Zod (project does not use Zod).
 */

import { isCampaignDurationSeconds } from "../campaign/campaign-duration";
import type { CommercialAspectRatio } from "../campaign/types";
import type {
  ArtifactRisk,
  BrandStrategy,
  CommercialBlueprintCore,
  CommercialQCRequirements,
  EditorialPlan,
  PlatformStrategy,
  ProductStrategy,
  SelectedConcept,
  VisualBeat,
  VisualTreatment,
} from "./types";
import type { ContinuityLock } from "../continuity/types";

const ASPECT_RATIOS: CommercialAspectRatio[] = [
  "9:16",
  "16:9",
  "1:1",
  "4:5",
  "4:3",
  "3:4",
];

export interface BlueprintValidationIssue {
  path: string;
  message: string;
}

export interface BlueprintValidationResult {
  ok: boolean;
  issues: BlueprintValidationIssue[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function push(issues: BlueprintValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

function validateVisualTreatment(
  treatment: unknown,
  issues: BlueprintValidationIssue[]
): asserts treatment is VisualTreatment {
  if (!treatment || typeof treatment !== "object") {
    push(issues, "visualTreatment", "visualTreatment is required");
    return;
  }
  const t = treatment as Record<string, unknown>;
  const required: Array<keyof VisualTreatment> = [
    "visualStyle",
    "lighting",
    "colorLanguage",
    "environment",
    "cameraLanguage",
    "lensLanguage",
    "texture",
    "productionDesign",
    "typographyDirection",
    "motionLanguage",
    "pacing",
  ];
  for (const key of required) {
    if (!isNonEmptyString(t[key])) {
      push(issues, `visualTreatment.${key}`, `${key} must be a non-empty string`);
    } else if (isGenericFiller(String(t[key]))) {
      push(
        issues,
        `visualTreatment.${key}`,
        `${key} is too generic — must describe a coherent visual system`
      );
    }
  }
}

const GENERIC_FILLERS = new Set([
  "cinematic",
  "dramatic",
  "dynamic",
  "vibrant",
  "modern",
  "premium",
  "professional",
  "nice",
  "good",
  "cool",
  "stylish",
]);

function isGenericFiller(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length < 12) return true;
  if (GENERIC_FILLERS.has(trimmed)) return true;
  // Single adjective with no detail
  if (/^[a-z]+$/i.test(trimmed) && trimmed.length < 20) return true;
  return false;
}

function validateSelectedConcept(
  concept: unknown,
  issues: BlueprintValidationIssue[]
): asserts concept is SelectedConcept {
  if (!concept || typeof concept !== "object") {
    push(issues, "selectedConcept", "selectedConcept is required");
    return;
  }
  const c = concept as Record<string, unknown>;
  for (const key of [
    "title",
    "coreIdea",
    "creativeConcept",
    "emotionalDirection",
    "oneLinePitch",
  ] as const) {
    if (!isNonEmptyString(c[key])) {
      push(issues, `selectedConcept.${key}`, `${key} must be a non-empty string`);
    }
  }
}

function validateVisualBeats(
  beats: unknown,
  duration: number,
  issues: BlueprintValidationIssue[]
): void {
  if (!Array.isArray(beats) || beats.length < 3) {
    push(issues, "visualBeats", "visualBeats must contain at least 3 beats");
    return;
  }
  beats.forEach((beat, index) => {
    const path = `visualBeats[${index}]`;
    if (!beat || typeof beat !== "object") {
      push(issues, path, "beat must be an object");
      return;
    }
    const b = beat as VisualBeat;
    if (!isNonEmptyString(b.id)) push(issues, `${path}.id`, "id required");
    if (!isNonEmptyString(b.zone)) push(issues, `${path}.zone`, "zone required");
    if (!isNonEmptyString(b.purpose)) push(issues, `${path}.purpose`, "purpose required");
    if (!isNonEmptyString(b.emotion)) push(issues, `${path}.emotion`, "emotion required");
    if (!isNonEmptyString(b.intent)) push(issues, `${path}.intent`, "intent required");
    if (typeof b.productVisible !== "boolean") {
      push(issues, `${path}.productVisible`, "productVisible must be boolean");
    }
    if (!isFiniteNumber(b.timestampStartSeconds) || !isFiniteNumber(b.timestampEndSeconds)) {
      push(issues, `${path}.timestamps`, "start/end seconds required");
    } else {
      if (b.timestampStartSeconds < 0 || b.timestampEndSeconds > duration + 0.5) {
        push(issues, `${path}.timestamps`, `timestamps must fit within 0–${duration}s`);
      }
      if (b.timestampEndSeconds <= b.timestampStartSeconds) {
        push(issues, `${path}.timestamps`, "end must be after start");
      }
    }
  });
}

function validateEditorialPlan(plan: unknown, issues: BlueprintValidationIssue[]): void {
  if (!plan || typeof plan !== "object") {
    push(issues, "editorialPlan", "editorialPlan is required");
    return;
  }
  const p = plan as EditorialPlan;
  for (const key of ["storyStructure", "pacing", "transitionStrategy", "cuttingRhythm"] as const) {
    if (!isNonEmptyString(p[key])) {
      push(issues, `editorialPlan.${key}`, `${key} required`);
    }
  }
  if (!isFiniteNumber(p.heroMomentSeconds)) {
    push(issues, "editorialPlan.heroMomentSeconds", "heroMomentSeconds required");
  }
}

function validateProductStrategy(strategy: unknown, issues: BlueprintValidationIssue[]): void {
  if (!strategy || typeof strategy !== "object") {
    push(issues, "productStrategy", "productStrategy is required");
    return;
  }
  const s = strategy as ProductStrategy;
  if (!isNonEmptyString(s.visibilityRequirements)) {
    push(issues, "productStrategy.visibilityRequirements", "required");
  }
  if (!Array.isArray(s.heroMoments) || s.heroMoments.length < 1) {
    push(issues, "productStrategy.heroMoments", "at least one hero moment required");
  }
  if (!isNonEmptyString(s.identityLock)) {
    push(issues, "productStrategy.identityLock", "required");
  }
  if (typeof s.avoidRegeneratingProductWhenReferenceExists !== "boolean") {
    push(
      issues,
      "productStrategy.avoidRegeneratingProductWhenReferenceExists",
      "must be boolean"
    );
  }
}

function validateBrandStrategy(strategy: unknown, issues: BlueprintValidationIssue[]): void {
  if (!strategy || typeof strategy !== "object") {
    push(issues, "brandStrategy", "brandStrategy is required");
    return;
  }
  const s = strategy as BrandStrategy;
  for (const key of ["personality", "message", "doNotLookGeneric", "differentiation"] as const) {
    if (!isNonEmptyString(s[key])) {
      push(issues, `brandStrategy.${key}`, `${key} required`);
    }
  }
}

function validatePlatformStrategy(strategy: unknown, issues: BlueprintValidationIssue[]): void {
  if (!strategy || typeof strategy !== "object") {
    push(issues, "platformStrategy", "platformStrategy is required");
    return;
  }
  const s = strategy as PlatformStrategy;
  if (!ASPECT_RATIOS.includes(s.aspectRatio)) {
    push(issues, "platformStrategy.aspectRatio", "invalid aspect ratio");
  }
  if (!isNonEmptyString(s.firstFrameHook)) {
    push(issues, "platformStrategy.firstFrameHook", "required");
  }
}

function validateContinuityLock(lock: unknown, issues: BlueprintValidationIssue[]): void {
  if (!lock || typeof lock !== "object") {
    push(issues, "continuityLock", "continuityLock is required");
    return;
  }
  const l = lock as ContinuityLock;
  const filled = [
    l.character,
    l.wardrobe,
    l.location,
    l.lighting,
    l.timeOfDay,
    l.product,
    l.colorGrade,
    l.visualTreatmentSummary,
  ].filter(isNonEmptyString);
  if (filled.length < 4) {
    push(
      issues,
      "continuityLock",
      "continuityLock must specify at least 4 lock dimensions"
    );
  }
}

function validateArtifactRisks(risks: unknown, issues: BlueprintValidationIssue[]): void {
  if (!Array.isArray(risks) || risks.length < 1) {
    push(issues, "artifactRisks", "at least one artifact risk required");
    return;
  }
  risks.forEach((risk, index) => {
    const path = `artifactRisks[${index}]`;
    if (!risk || typeof risk !== "object") {
      push(issues, path, "must be an object");
      return;
    }
    const r = risk as ArtifactRisk;
    if (!isNonEmptyString(r.id)) push(issues, `${path}.id`, "required");
    if (!isNonEmptyString(r.category)) push(issues, `${path}.category`, "required");
    if (!isNonEmptyString(r.description)) push(issues, `${path}.description`, "required");
    if (!["low", "medium", "high"].includes(r.severity)) {
      push(issues, `${path}.severity`, "must be low|medium|high");
    }
    if (!isNonEmptyString(r.mitigation)) push(issues, `${path}.mitigation`, "required");
  });
}

function validateQCRequirements(reqs: unknown, issues: BlueprintValidationIssue[]): void {
  if (!reqs || typeof reqs !== "object") {
    push(issues, "commercialQCRequirements", "commercialQCRequirements is required");
    return;
  }
  const r = reqs as CommercialQCRequirements;
  if (!Array.isArray(r.checks) || r.checks.length < 3) {
    push(issues, "commercialQCRequirements.checks", "at least 3 QC checks required");
  }
  for (const key of [
    "productIdentity",
    "brandConsistency",
    "visualContinuity",
    "conceptAdherence",
    "productVisibility",
    "visualTreatmentConsistency",
  ] as const) {
    if (!isNonEmptyString(r[key])) {
      push(issues, `commercialQCRequirements.${key}`, `${key} required`);
    }
  }
  if (!Array.isArray(r.artifactRiskChecks)) {
    push(issues, "commercialQCRequirements.artifactRiskChecks", "must be an array");
  }
}

/**
 * Validate a CommercialBlueprintCore (or candidate object) for Phase 2 completeness.
 */
export function validateCommercialBlueprint(input: unknown): BlueprintValidationResult {
  const issues: BlueprintValidationIssue[] = [];

  if (!input || typeof input !== "object") {
    return { ok: false, issues: [{ path: "", message: "blueprint must be an object" }] };
  }

  const b = input as Partial<CommercialBlueprintCore>;

  if (!isNonEmptyString(b.campaignId)) {
    push(issues, "campaignId", "campaignId is required");
  }

  if (!isCampaignDurationSeconds(Number(b.campaignDuration))) {
    push(issues, "campaignDuration", "campaignDuration must be 15 or 30");
  }

  if (!b.aspectRatio || !ASPECT_RATIOS.includes(b.aspectRatio)) {
    push(issues, "aspectRatio", "aspectRatio is required and must be a known ratio");
  }

  validateSelectedConcept(b.selectedConcept, issues);
  validateVisualTreatment(b.visualTreatment, issues);
  validateVisualBeats(b.visualBeats, Number(b.campaignDuration) || 15, issues);
  validateEditorialPlan(b.editorialPlan, issues);
  validateProductStrategy(b.productStrategy, issues);
  validateBrandStrategy(b.brandStrategy, issues);
  validatePlatformStrategy(b.platformStrategy, issues);
  validateContinuityLock(b.continuityLock, issues);
  validateArtifactRisks(b.artifactRisks, issues);
  validateQCRequirements(b.commercialQCRequirements, issues);

  if (!b.creativeStrategy || typeof b.creativeStrategy !== "object") {
    push(issues, "creativeStrategy", "creativeStrategy is required");
  }

  if (!isNonEmptyString(b.createdAt)) {
    push(issues, "createdAt", "createdAt is required");
  }

  return { ok: issues.length === 0, issues };
}

export function formatValidationIssues(issues: BlueprintValidationIssue[]): string {
  return issues.map((i) => `${i.path || "(root)"}: ${i.message}`).join("; ");
}
