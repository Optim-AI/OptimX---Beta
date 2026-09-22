/**
 * Deterministic ShotPlan validation.
 * Pure TypeScript — no AI. No silent creative repairs.
 */

import {
  CAMPAIGN_DURATION_TOLERANCE_SECONDS,
  isCampaignDurationSeconds,
  shotDurationsMatchCampaign,
  totalShotDurationSeconds,
} from "../campaign/campaign-duration";
import type { CampaignDurationSeconds } from "../campaign/campaign-duration";
import { GENERATION_STRATEGY_IDS, type GenerationStrategyId } from "../generation/types";
import { DEFAULT_SHOT_QC_CHECKS, type QCCheckId } from "../qc/types";
import {
  REFERENCE_STRATEGY_TYPES,
  SHOT_ROLES,
  type CommercialShot,
  type ProductVisibility,
  type ReferenceStrategyType,
  type ShotPlan,
  type ShotRole,
  type TransitionType,
} from "./types";

export interface ShotPlanValidationIssue {
  path: string;
  message: string;
}

export interface ShotPlanValidationResult {
  ok: boolean;
  issues: ShotPlanValidationIssue[];
}

/** Practical minimum duration for a generative/edit shot (seconds). */
export const MIN_SHOT_DURATION_SECONDS = 1;

/** Practical maximum share of a campaign for a single shot (fraction). */
export const MAX_SHOT_FRACTION_OF_CAMPAIGN = 0.85;

const PRODUCT_VISIBILITIES = new Set<ProductVisibility>([
  "hero",
  "prominent",
  "in-use",
  "pack-shot",
  "partial",
  "background",
  "implied",
  "none",
]);

const TRANSITIONS = new Set<string>([
  "cut",
  "hard_cut",
  "match_cut",
  "object_continuity",
  "motion_continuity",
  "eye_line_match",
  "whip",
  "dissolve",
  "fade",
  "sound_bridge",
  "object_wipe",
  "graphic_transition",
  "visual_transformation",
  "motivated_cut",
  "none",
]);

const STRATEGY_IDS = new Set<string>(GENERATION_STRATEGY_IDS);
const ROLE_IDS = new Set<string>(SHOT_ROLES);
const REF_TYPES = new Set<string>(REFERENCE_STRATEGY_TYPES);
const QC_IDS = new Set<string>(DEFAULT_SHOT_QC_CHECKS);

function push(issues: ShotPlanValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isGenericShotWhy(value: string): boolean {
  const t = value.trim().toLowerCase();
  if (t.length < 24) return true;
  const bad = ["show the product", "show product", "cinematic shot", "nice shot", "hero shot"];
  return bad.includes(t);
}

function validateReferenceRequirements(
  shot: CommercialShot,
  path: string,
  issues: ShotPlanValidationIssue[]
): void {
  const r = shot.referenceRequirements;
  if (!r || typeof r !== "object") {
    push(issues, `${path}.referenceRequirements`, "referenceRequirements required");
    return;
  }
  for (const key of [
    "productImages",
    "keyframe",
    "startFrame",
    "endFrame",
    "styleReferences",
    "productReferenceRequired",
    "keyframeRequired",
  ] as const) {
    if (typeof r[key] !== "boolean") {
      push(issues, `${path}.referenceRequirements.${key}`, "must be boolean");
    }
  }
  if (!isNonEmptyString(r.productReferenceReason)) {
    push(issues, `${path}.referenceRequirements.productReferenceReason`, "required");
  }
  if (!isNonEmptyString(r.purpose)) {
    push(issues, `${path}.referenceRequirements.purpose`, "required");
  }
  if (!isNonEmptyString(r.keyframeRationale)) {
    push(issues, `${path}.referenceRequirements.keyframeRationale`, "required");
  }
  if (!REF_TYPES.has(r.strategyType)) {
    push(issues, `${path}.referenceRequirements.strategyType`, "invalid strategyType");
  }
  if (r.previousShotReferenceIds) {
    if (!Array.isArray(r.previousShotReferenceIds)) {
      push(issues, `${path}.referenceRequirements.previousShotReferenceIds`, "must be array");
    }
  }

  const productHeavy =
    shot.productVisibility === "hero" ||
    shot.productVisibility === "pack-shot" ||
    shot.productVisibility === "prominent" ||
    shot.role === "product_hero";

  if (productHeavy && !r.productReferenceRequired) {
    push(
      issues,
      `${path}.referenceRequirements.productReferenceRequired`,
      "product hero / pack / prominent shots must require product reference"
    );
  }

  if (r.productReferenceRequired && shot.generationStrategy) {
    if (!shot.generationStrategy.requiresProductReference) {
      push(
        issues,
        `${path}.generationStrategy.requiresProductReference`,
        "must be true when productReferenceRequired is true"
      );
    }
  }

  if (r.keyframeRequired && shot.generationStrategy && !shot.generationStrategy.requiresKeyframe) {
    if (
      shot.generationStrategy.id === "keyframe-first" ||
      shot.generationStrategy.id === "hybrid"
    ) {
      push(
        issues,
        `${path}.generationStrategy.requiresKeyframe`,
        "keyframeRequired true but strategy.requiresKeyframe is false"
      );
    }
  }
}

function validateGenerationStrategy(
  shot: CommercialShot,
  path: string,
  issues: ShotPlanValidationIssue[]
): void {
  const g = shot.generationStrategy;
  if (!g || typeof g !== "object") {
    push(issues, `${path}.generationStrategy`, "generationStrategy required");
    return;
  }
  if (!STRATEGY_IDS.has(g.id)) {
    push(issues, `${path}.generationStrategy.id`, "invalid generation strategy id");
  }
  if (!isNonEmptyString(g.rationale) || g.rationale.trim().length < 12) {
    push(issues, `${path}.generationStrategy.rationale`, "rationale must be specific");
  }
  if (!Array.isArray(g.steps) || g.steps.length < 1) {
    push(issues, `${path}.generationStrategy.steps`, "steps required");
  }
  for (const flag of [
    "requiresKeyframe",
    "requiresProductReference",
    "requiresStartFrame",
    "requiresEndFrame",
    "prefersCompositing",
  ] as const) {
    if (typeof g[flag] !== "boolean") {
      push(issues, `${path}.generationStrategy.${flag}`, "must be boolean");
    }
  }
}

function validateContinuity(
  shot: CommercialShot,
  shotIds: Set<string>,
  path: string,
  issues: ShotPlanValidationIssue[]
): void {
  const c = shot.continuity;
  if (!c || typeof c !== "object") {
    push(issues, `${path}.continuity`, "continuity required");
    return;
  }
  if (!Array.isArray(c.continuesFromShotIds)) {
    push(issues, `${path}.continuity.continuesFromShotIds`, "must be an array");
    return;
  }
  for (const id of c.continuesFromShotIds) {
    if (!shotIds.has(id)) {
      push(
        issues,
        `${path}.continuity.continuesFromShotIds`,
        `references nonexistent shot id "${id}"`
      );
    }
    if (id === shot.id) {
      push(issues, `${path}.continuity.continuesFromShotIds`, "shot cannot continue from itself");
    }
  }
  if (!Array.isArray(c.mustMatch)) {
    push(issues, `${path}.continuity.mustMatch`, "must be an array");
  } else if (c.continuesFromShotIds.length > 0 && c.mustMatch.length < 1) {
    push(
      issues,
      `${path}.continuity.mustMatch`,
      "mustMatch required when continuesFromShotIds is non-empty"
    );
  }
}

function validateArtifactRisks(
  shot: CommercialShot,
  path: string,
  issues: ShotPlanValidationIssue[]
): void {
  if (!isNonEmptyString(shot.artifactRisk)) {
    push(issues, `${path}.artifactRisk`, "artifactRisk summary required");
  }
  if (!Array.isArray(shot.artifactRisks) || shot.artifactRisks.length < 1) {
    push(issues, `${path}.artifactRisks`, "at least one structured artifact risk required");
    return;
  }
  shot.artifactRisks.forEach((r, i) => {
    const p = `${path}.artifactRisks[${i}]`;
    if (!isNonEmptyString(r.id)) push(issues, `${p}.id`, "required");
    if (!isNonEmptyString(r.risk)) push(issues, `${p}.risk`, "required");
    if (!["low", "medium", "high"].includes(r.severity)) {
      push(issues, `${p}.severity`, "must be low|medium|high");
    }
    if (!isNonEmptyString(r.reason)) push(issues, `${p}.reason`, "required");
    if (!isNonEmptyString(r.mitigation)) push(issues, `${p}.mitigation`, "required");
  });
}

function validateShot(
  shot: CommercialShot,
  campaignDuration: CampaignDurationSeconds,
  shotIds: Set<string>,
  index: number,
  issues: ShotPlanValidationIssue[]
): void {
  const path = `shots[${index}]`;

  if (!isNonEmptyString(shot.id)) push(issues, `${path}.id`, "id required");
  if (!Number.isInteger(shot.sequence) || shot.sequence < 1) {
    push(issues, `${path}.sequence`, "sequence must be a positive integer");
  }
  if (typeof shot.durationSeconds !== "number" || !Number.isFinite(shot.durationSeconds)) {
    push(issues, `${path}.durationSeconds`, "durationSeconds must be a finite number");
  } else {
    if (shot.durationSeconds <= 0) {
      push(issues, `${path}.durationSeconds`, "duration must be > 0");
    }
    if (shot.durationSeconds < MIN_SHOT_DURATION_SECONDS) {
      push(
        issues,
        `${path}.durationSeconds`,
        `duration must be >= ${MIN_SHOT_DURATION_SECONDS}s for practical generation/editing`
      );
    }
    if (shot.durationSeconds > campaignDuration * MAX_SHOT_FRACTION_OF_CAMPAIGN + 0.01) {
      push(
        issues,
        `${path}.durationSeconds`,
        `single shot exceeds ${MAX_SHOT_FRACTION_OF_CAMPAIGN * 100}% of campaign — prefer decomposition`
      );
    }
  }

  if (!ROLE_IDS.has(shot.role)) {
    push(issues, `${path}.role`, `invalid role "${shot.role}"`);
  }
  if (!Array.isArray(shot.beatIds)) {
    push(issues, `${path}.beatIds`, "beatIds must be an array");
  }
  if (!isNonEmptyString(shot.shotWhy) || isGenericShotWhy(shot.shotWhy)) {
    push(issues, `${path}.shotWhy`, "shotWhy must be specific and campaign-meaningful");
  }
  if (!isNonEmptyString(shot.storyBeat)) push(issues, `${path}.storyBeat`, "required");
  if (!isNonEmptyString(shot.visualDescription) || shot.visualDescription.trim().length < 40) {
    push(issues, `${path}.visualDescription`, "visualDescription must be concrete and detailed");
  }
  if (!isNonEmptyString(shot.subject)) push(issues, `${path}.subject`, "required");
  if (!PRODUCT_VISIBILITIES.has(shot.productVisibility)) {
    push(issues, `${path}.productVisibility`, "invalid productVisibility");
  }
  if (!isNonEmptyString(shot.productVisibilityReason)) {
    push(issues, `${path}.productVisibilityReason`, "required");
  }
  if (!isNonEmptyString(shot.environment)) push(issues, `${path}.environment`, "required");
  if (!isNonEmptyString(shot.framing)) push(issues, `${path}.framing`, "required");
  if (!isNonEmptyString(shot.cameraMovement)) push(issues, `${path}.cameraMovement`, "required");
  if (!isNonEmptyString(shot.lighting)) push(issues, `${path}.lighting`, "required");
  if (!isNonEmptyString(shot.composition) || shot.composition.trim().length < 12) {
    push(issues, `${path}.composition`, "composition must be production-specific");
  }
  if (shot.transitionIn != null && !TRANSITIONS.has(shot.transitionIn)) {
    push(issues, `${path}.transitionIn`, "invalid transition");
  }
  if (shot.transitionOut != null && !TRANSITIONS.has(shot.transitionOut)) {
    push(issues, `${path}.transitionOut`, "invalid transition");
  }

  validateGenerationStrategy(shot, path, issues);
  if (shot.generationStrategy) {
    validateReferenceRequirements(shot, path, issues);
  }
  validateContinuity(shot, shotIds, path, issues);
  validateArtifactRisks(shot, path, issues);

  if (!Array.isArray(shot.qcRequirements) || shot.qcRequirements.length < 2) {
    push(issues, `${path}.qcRequirements`, "at least 2 QC check ids required");
  } else {
    for (const check of shot.qcRequirements) {
      if (!QC_IDS.has(check)) {
        push(issues, `${path}.qcRequirements`, `unknown QC check "${check}"`);
      }
    }
  }

  if (typeof shot.generationRequired !== "boolean") {
    push(issues, `${path}.generationRequired`, "must be boolean");
  }
  if (!["low", "medium", "high"].includes(shot.estimatedComplexity)) {
    push(issues, `${path}.estimatedComplexity`, "must be low|medium|high");
  }
  if (typeof shot.referenceRequired !== "boolean") {
    push(issues, `${path}.referenceRequired`, "must be boolean");
  }

  if (shot.productState) {
    if (!isNonEmptyString(shot.productState.state) || !isNonEmptyString(shot.productState.description)) {
      push(issues, `${path}.productState`, "state and description required when present");
    }
    if (
      shot.productState.transitionsFromShotId &&
      !shotIds.has(shot.productState.transitionsFromShotId)
    ) {
      push(
        issues,
        `${path}.productState.transitionsFromShotId`,
        `references nonexistent shot "${shot.productState.transitionsFromShotId}"`
      );
    }
  }

  if (shot.characterContinuity) {
    shot.characterContinuity.forEach((ch, i) => {
      const p = `${path}.characterContinuity[${i}]`;
      if (!isNonEmptyString(ch.characterId)) push(issues, `${p}.characterId`, "required");
      if (!isNonEmptyString(ch.identity)) push(issues, `${p}.identity`, "required");
      if (!Array.isArray(ch.mustMatch) || ch.mustMatch.length < 1) {
        push(issues, `${p}.mustMatch`, "at least one mustMatch dimension required");
      }
    });
  }

  // Previous-shot references must exist
  for (const id of shot.referenceRequirements?.previousShotReferenceIds || []) {
    if (!shotIds.has(id)) {
      push(
        issues,
        `${path}.referenceRequirements.previousShotReferenceIds`,
        `references nonexistent shot "${id}"`
      );
    }
  }
}

/**
 * Validate a ShotPlan against campaign duration and structural rules.
 */
export function validateShotPlan(
  plan: unknown,
  expectedCampaignDuration?: CampaignDurationSeconds
): ShotPlanValidationResult {
  const issues: ShotPlanValidationIssue[] = [];

  if (!plan || typeof plan !== "object") {
    return { ok: false, issues: [{ path: "", message: "shot plan must be an object" }] };
  }

  const p = plan as ShotPlan;

  if (!isNonEmptyString(p.campaignId)) {
    push(issues, "campaignId", "campaignId is required");
  }

  const duration = expectedCampaignDuration ?? p.campaignDuration;
  if (!isCampaignDurationSeconds(Number(duration))) {
    push(issues, "campaignDuration", "campaignDuration must be 15 or 30");
  }

  if (!Array.isArray(p.shots) || p.shots.length < 1) {
    push(issues, "shots", "at least one shot is required");
    return { ok: false, issues };
  }

  const shotIds = new Set(p.shots.map((s) => s.id).filter(Boolean));
  const sequences = p.shots.map((s) => s.sequence);

  // Sequence integrity
  const sorted = [...sequences].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) {
      push(
        issues,
        "shots.sequence",
        `sequence numbers must be contiguous 1..N with no duplicates or gaps (got ${sequences.join(",")})`
      );
      break;
    }
  }

  // Order: shots array should be in sequence order
  for (let i = 0; i < p.shots.length; i++) {
    if (p.shots[i].sequence !== i + 1) {
      push(issues, `shots[${i}].sequence`, "shots must be returned in ascending sequence order");
      break;
    }
  }

  // Unique ids
  if (shotIds.size !== p.shots.length) {
    push(issues, "shots.id", "shot ids must be unique");
  }

  const campaignDuration = (isCampaignDurationSeconds(Number(duration))
    ? Number(duration)
    : 15) as CampaignDurationSeconds;

  p.shots.forEach((shot, index) => {
    validateShot(shot, campaignDuration, shotIds, index, issues);
  });

  const durations = p.shots.map((s) => s.durationSeconds);
  const total = totalShotDurationSeconds(durations);

  if (typeof p.totalDurationSeconds === "number" && Math.abs(p.totalDurationSeconds - total) > 0.01) {
    push(
      issues,
      "totalDurationSeconds",
      `totalDurationSeconds (${p.totalDurationSeconds}) does not match sum of shot durations (${total})`
    );
  }

  if (isCampaignDurationSeconds(campaignDuration)) {
    if (!shotDurationsMatchCampaign(durations, campaignDuration, CAMPAIGN_DURATION_TOLERANCE_SECONDS)) {
      push(
        issues,
        "totalDurationSeconds",
        `shot durations sum to ${total}s, expected ${campaignDuration}s ±${CAMPAIGN_DURATION_TOLERANCE_SECONDS}s`
      );
    }
  }

  if (!p.continuityLock || typeof p.continuityLock !== "object") {
    push(issues, "continuityLock", "continuityLock required");
  }

  // Continuity links if present
  if (p.continuityLinks) {
    p.continuityLinks.forEach((link, i) => {
      if (!shotIds.has(link.fromShotId) || !shotIds.has(link.toShotId)) {
        push(issues, `continuityLinks[${i}]`, "link references nonexistent shot");
      }
    });
  }

  return { ok: issues.length === 0, issues };
}

export function formatShotPlanValidationIssues(issues: ShotPlanValidationIssue[]): string {
  return issues.map((i) => `${i.path || "(root)"}: ${i.message}`).join("; ");
}

export function isShotRole(value: string): value is ShotRole {
  return ROLE_IDS.has(value);
}

export function isGenerationStrategyId(value: string): value is GenerationStrategyId {
  return STRATEGY_IDS.has(value);
}

export function isReferenceStrategyType(value: string): value is ReferenceStrategyType {
  return REF_TYPES.has(value);
}

export function isTransitionType(value: string): value is TransitionType {
  return TRANSITIONS.has(value);
}

export function isQCCheckId(value: string): value is QCCheckId {
  return QC_IDS.has(value);
}
