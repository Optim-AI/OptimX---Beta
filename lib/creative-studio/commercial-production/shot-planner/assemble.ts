/**
 * Assemble / normalize Shot Planner LLM draft → ShotPlan.
 *
 * Duration policy (deterministic):
 * 1. Clamp each duration to >= MIN_SHOT_DURATION_SECONDS
 * 2. Round to 1 decimal place
 * 3. If sum is within CAMPAIGN_DURATION_TOLERANCE_SECONDS of campaign duration,
 *    adjust the LAST shot so the total equals campaign duration exactly
 * 4. If sum is outside tolerance, leave as-is and let validation fail
 *    (no silent creative rewrite of the plan)
 */

import {
  CAMPAIGN_DURATION_TOLERANCE_SECONDS,
  totalShotDurationSeconds,
  type CampaignDurationSeconds,
} from "../campaign/campaign-duration";
import type { CommercialBlueprintCore } from "../commercial-director/types";
import { defaultStrategyForId, type GenerationStrategyId } from "../generation/types";
import type { ContinuityLock } from "../continuity/types";
import type { QCCheckId } from "../qc/types";
import {
  MIN_SHOT_DURATION_SECONDS,
  isGenerationStrategyId,
  isQCCheckId,
  isReferenceStrategyType,
  isShotRole,
  isTransitionType,
} from "./validate";
import type {
  CharacterContinuitySpec,
  CommercialShot,
  ContinuityDimension,
  ProductStateSpec,
  ProductVisibility,
  ReferenceStrategyType,
  ShotArtifactRisk,
  ShotEstimatedComplexity,
  ShotPlan,
  ShotPlanMeta,
  ShotReferenceRequirements,
  ShotRole,
  TransitionType,
} from "./types";

export interface ShotPlannerDraftShot {
  id?: string;
  sequence?: number;
  durationSeconds?: number;
  role?: string;
  beatIds?: string[];
  shotWhy?: string;
  storyBeat?: string;
  visualDescription?: string;
  subject?: string;
  productVisibility?: string;
  productVisibilityReason?: string;
  environment?: string;
  lens?: string;
  framing?: string;
  cameraMovement?: string;
  cameraHeight?: string;
  cameraAngle?: string;
  depthOfField?: string;
  subjectDistance?: string;
  lighting?: string;
  composition?: string;
  transitionIn?: string;
  transitionOut?: string;
  generationStrategyId?: string;
  generationStrategyRationale?: string;
  referenceRequirements?: Partial<ShotReferenceRequirements> | ShotReferenceRequirements;
  continuesFromShotIds?: string[];
  mustMatch?: string[];
  mustMatchDimensions?: string[];
  allowedChanges?: string[];
  characterContinuity?: Array<Partial<CharacterContinuitySpec> | CharacterContinuitySpec>;
  productState?: Partial<ProductStateSpec> | ProductStateSpec;
  artifactRisks?: Array<Partial<ShotArtifactRisk> | ShotArtifactRisk>;
  qcRequirements?: string[];
  qcNotes?: string[];
  generationRequired?: boolean;
  estimatedComplexity?: string;
  referenceRequired?: boolean;
}

export interface ShotPlannerDraft {
  shots?: ShotPlannerDraftShot[];
  continuityLinks?: Array<{
    fromShotId?: string;
    toShotId?: string;
    dimensions?: string[];
    notes?: string;
  }>;
}

function str(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Normalize durations to exact campaign total when within tolerance.
 * Returns { durations, normalized }.
 */
export function normalizeShotDurations(
  rawDurations: number[],
  campaignDuration: CampaignDurationSeconds
): { durations: number[]; normalized: boolean } {
  if (rawDurations.length === 0) return { durations: [], normalized: false };

  let durations = rawDurations.map((d) =>
    round1(Math.max(MIN_SHOT_DURATION_SECONDS, Number.isFinite(d) ? d : MIN_SHOT_DURATION_SECONDS))
  );

  const sum = totalShotDurationSeconds(durations);
  const delta = campaignDuration - sum;

  if (Math.abs(delta) <= CAMPAIGN_DURATION_TOLERANCE_SECONDS && durations.length > 0) {
    const last = durations.length - 1;
    const adjusted = round1(Math.max(MIN_SHOT_DURATION_SECONDS, durations[last] + delta));
    durations = [...durations];
    durations[last] = adjusted;
    // Fix residual 0.1 float drift
    const sum2 = totalShotDurationSeconds(durations);
    const residual = round1(campaignDuration - sum2);
    if (residual !== 0) {
      durations[last] = round1(Math.max(MIN_SHOT_DURATION_SECONDS, durations[last] + residual));
    }
    return { durations, normalized: Math.abs(delta) > 0.001 };
  }

  return { durations, normalized: false };
}

function mapProductVisibility(raw: string | undefined): ProductVisibility {
  const v = (raw || "none").toLowerCase().replace(/\s+/g, "-");
  const allowed: ProductVisibility[] = [
    "hero",
    "prominent",
    "in-use",
    "pack-shot",
    "partial",
    "background",
    "implied",
    "none",
  ];
  if (allowed.includes(v as ProductVisibility)) return v as ProductVisibility;
  if (v === "hidden") return "none";
  if (v === "visible") return "in-use";
  if (v === "incidental") return "background";
  return "none";
}

function mapStrategyId(raw: string | undefined, shot: ShotPlannerDraftShot): GenerationStrategyId {
  if (raw && isGenerationStrategyId(raw)) return raw;
  // Heuristic fallback only when model omits id — still validated later
  if (shot.role === "motion_graphic" || shot.role === "end_card" || shot.role === "cta") {
    return "motion-graphics";
  }
  if (shot.role === "product_hero" || shot.productVisibility === "hero") {
    return "keyframe-first";
  }
  return "text-to-video";
}

function buildReferenceRequirements(
  draft: ShotPlannerDraftShot,
  strategyId: GenerationStrategyId
): ShotReferenceRequirements {
  const r = draft.referenceRequirements || {};
  const productVisibility = mapProductVisibility(draft.productVisibility);
  const productHeavy =
    productVisibility === "hero" ||
    productVisibility === "pack-shot" ||
    productVisibility === "prominent" ||
    draft.role === "product_hero";

  const productReferenceRequired = bool(
    r.productReferenceRequired,
    productHeavy || strategyId === "product-reference-first" || strategyId === "keyframe-first"
  );

  const keyframeRequired = bool(
    r.keyframeRequired,
    strategyId === "keyframe-first" || strategyId === "hybrid" || bool(r.keyframe, false)
  );

  let strategyType: ReferenceStrategyType = isReferenceStrategyType(String(r.strategyType || ""))
    ? (r.strategyType as ReferenceStrategyType)
    : "none";

  if (strategyType === "none") {
    if (productReferenceRequired && keyframeRequired && bool(r.characterReference, false)) {
      strategyType = "character_and_product";
    } else if (productReferenceRequired && keyframeRequired) {
      strategyType = "generated_keyframe";
    } else if (productReferenceRequired) {
      strategyType = "existing_product_image";
    } else if (bool(r.characterReference, false)) {
      strategyType = "character";
    } else if (
      Array.isArray(r.previousShotReferenceIds) &&
      (r.previousShotReferenceIds as unknown[]).length > 0
    ) {
      strategyType = "previous_shot";
    } else if (strategyId === "motion-graphics" || strategyId === "composited") {
      strategyType = "compositing";
    }
  }

  return {
    productImages: bool(r.productImages, productReferenceRequired),
    keyframe: bool(r.keyframe, keyframeRequired),
    startFrame: bool(
      r.startFrame,
      strategyId === "image-to-video" || strategyId === "keyframe-first" || keyframeRequired
    ),
    endFrame: bool(r.endFrame, false),
    styleReferences: bool(r.styleReferences, false),
    reusableKeyframeId: str(r.reusableKeyframeId) || undefined,
    productReferenceRequired,
    productReferenceReason: str(
      r.productReferenceReason,
      productReferenceRequired
        ? "Product appearance is visible and must match campaign product identity"
        : "Product is not visually material in this shot"
    ),
    strategyType,
    purpose: str(
      r.purpose,
      productReferenceRequired
        ? "Establish exact product packaging / placement before generative video"
        : "No product reference required for this shot"
    ),
    characterReference: bool(r.characterReference, false),
    previousShotReferenceIds: Array.isArray(r.previousShotReferenceIds)
      ? (r.previousShotReferenceIds as unknown[]).map((x) => str(x)).filter(Boolean)
      : undefined,
    keyframeRequired,
    keyframeRationale: str(
      r.keyframeRationale,
      keyframeRequired
        ? "A controlled keyframe would improve composition / product / character lock before image-to-video"
        : "Direct generation is sufficient; exact first-frame control is not critical"
    ),
  };
}

function inheritLock(
  blueprint: CommercialBlueprintCore,
  draft: ShotPlannerDraftShot
): ContinuityLock {
  return {
    ...blueprint.continuityLock,
    // Allow shot to refine but not wipe campaign lock without reason
    location: str(draft.environment, blueprint.continuityLock.location),
  };
}

export function assembleShotPlanFromDraft(
  blueprint: CommercialBlueprintCore,
  draft: ShotPlannerDraft,
  metaBase?: Partial<ShotPlanMeta>
): { plan: ShotPlan; durationNormalized: boolean } {
  const rawShots = Array.isArray(draft.shots) ? draft.shots.slice() : [];
  rawShots.sort((a, b) => num(a.sequence, 0) - num(b.sequence, 0));

  const rawDurations = rawShots.map((s, i) =>
    num(s.durationSeconds, blueprint.campaignDuration / Math.max(rawShots.length, 1))
  );
  const { durations, normalized } = normalizeShotDurations(
    rawDurations,
    blueprint.campaignDuration
  );

  const treatment = blueprint.visualTreatment;

  const shots: CommercialShot[] = rawShots.map((s, i) => {
    const id = str(s.id, `shot-${i + 1}`);
    const role: ShotRole = isShotRole(String(s.role || ""))
      ? (s.role as ShotRole)
      : "emotional_beat";
    const strategyId = mapStrategyId(s.generationStrategyId, { ...s, role });
    const rationale = str(
      s.generationStrategyRationale,
      `Selected ${strategyId} for role ${role}`
    );
    const generationStrategy = defaultStrategyForId(strategyId, rationale);
    const referenceRequirements = buildReferenceRequirements(
      { ...s, role, productVisibility: s.productVisibility },
      strategyId
    );

    // Align strategy flags with reference requirements
    generationStrategy.requiresProductReference =
      referenceRequirements.productReferenceRequired || generationStrategy.requiresProductReference;
    generationStrategy.requiresKeyframe =
      referenceRequirements.keyframeRequired || generationStrategy.requiresKeyframe;
    if (referenceRequirements.keyframeRequired && strategyId === "text-to-video") {
      // Keep model's strategy id but ensure flags honest if they asked for keyframe
      generationStrategy.requiresKeyframe = true;
    }

    const productVisibility = mapProductVisibility(s.productVisibility);
    const artifactRisks: ShotArtifactRisk[] = (
      Array.isArray(s.artifactRisks) && s.artifactRisks.length
        ? s.artifactRisks
        : blueprint.artifactRisks.slice(0, 2).map((r, idx) => ({
            id: r.id || `inherited-${idx + 1}`,
            risk: r.category,
            severity: r.severity,
            reason: r.description,
            mitigation: r.mitigation,
          }))
    ).map((r, idx) => ({
      id: str((r as ShotArtifactRisk).id, `risk-${i + 1}-${idx + 1}`),
      risk: str((r as ShotArtifactRisk).risk, "artifact"),
      severity:
        (r as ShotArtifactRisk).severity === "low" ||
        (r as ShotArtifactRisk).severity === "medium" ||
        (r as ShotArtifactRisk).severity === "high"
          ? (r as ShotArtifactRisk).severity
          : "medium",
      reason: str((r as ShotArtifactRisk).reason),
      mitigation: str((r as ShotArtifactRisk).mitigation),
    }));

    const qcRequirements: QCCheckId[] = (
      Array.isArray(s.qcRequirements) ? s.qcRequirements : []
    )
      .map((c) => String(c))
      .filter(isQCCheckId);

    const defaultQc: QCCheckId[] =
      role === "product_hero" || productVisibility === "hero"
        ? ["product_identity", "product_visibility", "unwanted_text", "visual_treatment", "composition"]
        : role === "motion_graphic" || role === "end_card"
          ? ["visual_treatment", "campaign_relevance", "unwanted_text"]
          : role === "atmosphere" || role === "abstract_visual"
            ? ["visual_treatment", "motion_quality", "artifact_risk"]
            : ["continuity", "visual_treatment", "subject_consistency", "campaign_relevance"];

    const continuesFromShotIds = Array.isArray(s.continuesFromShotIds)
      ? s.continuesFromShotIds.map((x) => str(x)).filter(Boolean)
      : [];

    const characterContinuity: CharacterContinuitySpec[] | undefined = Array.isArray(
      s.characterContinuity
    )
      ? s.characterContinuity.map((ch, ci) => ({
          characterId: str(ch.characterId, `char-${ci + 1}`),
          identity: str(ch.identity),
          ageRange: str(ch.ageRange) || undefined,
          appearance: str(ch.appearance) || undefined,
          wardrobe: str(ch.wardrobe) || undefined,
          physicalAttributes: Array.isArray(ch.physicalAttributes)
            ? (ch.physicalAttributes as unknown[]).map((x) => str(x)).filter(Boolean)
            : undefined,
          roleInStory: str(ch.roleInStory) || undefined,
          mustMatch: Array.isArray(ch.mustMatch)
            ? (ch.mustMatch as unknown[]).map((x) => str(x)).filter(Boolean)
            : ["face", "wardrobe"],
        }))
      : undefined;

    let productState: ProductStateSpec | undefined;
    if (s.productState && (s.productState.state || s.productState.description)) {
      productState = {
        state: str(s.productState.state, productVisibility === "none" ? "absent" : "other"),
        description: str(s.productState.description),
        transitionsFromShotId: str(s.productState.transitionsFromShotId) || undefined,
      };
    }

    const complexity: ShotEstimatedComplexity =
      s.estimatedComplexity === "low" ||
      s.estimatedComplexity === "medium" ||
      s.estimatedComplexity === "high"
        ? s.estimatedComplexity
        : referenceRequirements.keyframeRequired
          ? "high"
          : "medium";

    const transitionIn = isTransitionType(String(s.transitionIn || ""))
      ? (s.transitionIn as TransitionType)
      : i === 0
        ? "none"
        : "cut";
    const transitionOut = isTransitionType(String(s.transitionOut || ""))
      ? (s.transitionOut as TransitionType)
      : "cut";

    const mustMatchDimensions = Array.isArray(s.mustMatchDimensions)
      ? (s.mustMatchDimensions.map((d) => str(d)).filter(Boolean) as ContinuityDimension[])
      : undefined;

    const shot: CommercialShot = {
      id,
      sequence: i + 1,
      durationSeconds: durations[i] ?? MIN_SHOT_DURATION_SECONDS,
      role,
      beatIds: Array.isArray(s.beatIds) ? s.beatIds.map((b) => str(b)).filter(Boolean) : [],
      shotWhy: str(s.shotWhy),
      storyBeat: str(s.storyBeat, role),
      visualDescription: str(s.visualDescription),
      subject: str(s.subject),
      productVisibility,
      productVisibilityReason: str(
        s.productVisibilityReason,
        productVisibility === "none"
          ? "Product intentionally withheld for story"
          : "Product visibility supports this beat"
      ),
      environment: str(s.environment, treatment.environment),
      lens: str(s.lens, treatment.lensLanguage) || undefined,
      framing: str(s.framing),
      cameraMovement: str(s.cameraMovement, treatment.cameraLanguage),
      cameraHeight: str(s.cameraHeight) || undefined,
      cameraAngle: str(s.cameraAngle) || undefined,
      depthOfField: str(s.depthOfField) || undefined,
      subjectDistance: str(s.subjectDistance) || undefined,
      lighting: str(s.lighting, treatment.lighting),
      composition: str(s.composition),
      transitionIn,
      transitionOut,
      generationStrategy,
      referenceRequirements,
      continuity: {
        lock: inheritLock(blueprint, s),
        continuesFromShotIds,
        mustMatch: Array.isArray(s.mustMatch) ? s.mustMatch.map((m) => str(m)).filter(Boolean) : [],
        allowedChanges: Array.isArray(s.allowedChanges)
          ? s.allowedChanges.map((m) => str(m)).filter(Boolean)
          : undefined,
        mustMatchDimensions,
      },
      continuityDimensions: mustMatchDimensions,
      characterContinuity,
      productState,
      artifactRisk: artifactRisks.map((r) => r.risk).join("; "),
      artifactRisks,
      qcRequirements: qcRequirements.length >= 2 ? qcRequirements : defaultQc,
      qcNotes: Array.isArray(s.qcNotes) ? s.qcNotes.map((n) => str(n)).filter(Boolean) : undefined,
      generationRequired: bool(
        s.generationRequired,
        strategyId !== "motion-graphics" && strategyId !== "composited" ? true : true
      ),
      estimatedComplexity: complexity,
      referenceRequired: bool(
        s.referenceRequired,
        referenceRequirements.productReferenceRequired ||
          referenceRequirements.keyframeRequired ||
          referenceRequirements.characterReference === true
      ),
    };

    return shot;
  });

  const totalDurationSeconds = round1(totalShotDurationSeconds(shots.map((s) => s.durationSeconds)));

  const continuityLinks = Array.isArray(draft.continuityLinks)
    ? draft.continuityLinks
        .filter((l) => l.fromShotId && l.toShotId)
        .map((l) => ({
          fromShotId: str(l.fromShotId),
          toShotId: str(l.toShotId),
          dimensions: (Array.isArray(l.dimensions)
            ? l.dimensions.map((d) => str(d))
            : []) as ContinuityDimension[],
          notes: str(l.notes),
        }))
    : shots
        .filter((s) => s.continuity.continuesFromShotIds.length > 0)
        .flatMap((s) =>
          s.continuity.continuesFromShotIds.map((from) => ({
            fromShotId: from,
            toShotId: s.id,
            dimensions: (s.continuityDimensions || []) as ContinuityDimension[],
            notes: s.continuity.mustMatch.join("; "),
          }))
        );

  const plan: ShotPlan = {
    campaignId: blueprint.campaignId,
    shots,
    continuityLock: blueprint.continuityLock,
    totalDurationSeconds,
    campaignDuration: blueprint.campaignDuration,
    continuityLinks,
    meta: metaBase
      ? {
          campaignId: blueprint.campaignId,
          campaignDuration: blueprint.campaignDuration,
          shotCount: shots.length,
          totalDurationSeconds,
          referenceRequiredCount: shots.filter((s) => s.referenceRequired).length,
          keyframeFirstCount: shots.filter((s) => s.generationStrategy.id === "keyframe-first")
            .length,
          motionGraphicsCount: shots.filter(
            (s) =>
              s.generationStrategy.id === "motion-graphics" ||
              s.generationStrategy.id === "composited"
          ).length,
          textToVideoCount: shots.filter((s) => s.generationStrategy.id === "text-to-video").length,
          productReferenceCount: shots.filter(
            (s) => s.referenceRequirements.productReferenceRequired
          ).length,
          model: metaBase.model || "unknown",
          generationDurationMs: metaBase.generationDurationMs || 0,
          validationPassed: metaBase.validationPassed ?? false,
          durationNormalized: normalized,
          repairAttempted: metaBase.repairAttempted ?? false,
        }
      : undefined,
  };

  return { plan, durationNormalized: normalized };
}
