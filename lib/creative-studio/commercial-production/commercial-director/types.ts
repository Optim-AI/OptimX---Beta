import type { CampaignDurationSeconds } from "../campaign/campaign-duration";
import type { CampaignBrief, CommercialAspectRatio, CommercialPlatform } from "../campaign/types";
import type { ContinuityLock } from "../continuity/types";
import type { QCCheckId, QCResult } from "../qc/types";
import type { AdConcept, CreativeStrategy } from "../../strategy-types";

/**
 * Visual treatment must persist across the entire commercial.
 * Shots may vary composition and action; they must not invent a new look.
 */
export interface VisualTreatment {
  visualStyle: string;
  lighting: string;
  colorLanguage: string;
  environment: string;
  cameraLanguage: string;
  lensLanguage: string;
  texture: string;
  productionDesign: string;
  typographyDirection: string;
  motionLanguage: string;
  pacing: string;
}

/**
 * Campaign-level narrative/visual moment. Not a shot.
 * Phase 3 Shot Planner expands beats into CommercialShot[].
 */
export interface VisualBeat {
  id: string;
  /** Narrative zone label, e.g. "hook", "tension", "product_enter". */
  zone: string;
  /** Beat purpose in the story (establish, agitate, reveal, resolve, …). */
  purpose: string;
  timestampStartSeconds: number;
  timestampEndSeconds: number;
  emotion: string;
  /** Visual intent — what we should see / feel on screen. */
  intent: string;
  productVisible: boolean;
  /** Optional finer product presence: none | implied | partial | hero. */
  productVisibility?: "none" | "implied" | "partial" | "hero";
}

export interface EditorialPlan {
  storyStructure: string;
  pacing: string;
  transitionStrategy: string;
  cuttingRhythm: string;
  heroMomentSeconds: number;
}

export interface SoundDesignIntent {
  music?: string;
  voiceover?: string;
  soundEffects?: string;
  silenceStrategy?: string;
}

export interface ProductStrategy {
  visibilityRequirements: string;
  heroMoments: string[];
  identityLock: string;
  avoidRegeneratingProductWhenReferenceExists: boolean;
  /** Seconds into the campaign when the product first appears (may be late). */
  firstAppearanceSeconds?: number;
  /** Seconds when the product becomes narratively important. */
  becomesImportantSeconds?: number;
  prominence?: string;
  interaction?: string;
  packagingVisibility?: string;
  revealStrategy?: string;
  finalCtaFrame?: string;
}

export interface BrandStrategy {
  personality: string;
  message: string;
  doNotLookGeneric: string;
  differentiation: string;
  tone?: string;
  visualIdentity?: string;
  communicationStyle?: string;
  /** Explicit constraints derived from provided brand inputs only. */
  constraints?: string[];
  /**
   * Brand facts that were not provided — do not invent these downstream.
   * Prefer stating uncertainty over fabricating brand details.
   */
  unknowns?: string[];
}

export interface PlatformStrategy {
  platform?: CommercialPlatform;
  aspectRatio: CommercialAspectRatio;
  safeAreas?: string;
  firstFrameHook: string;
  framing?: string;
  pacingInfluence?: string;
  textUsage?: string;
  hookTiming?: string;
  composition?: string;
  ctaStrategy?: string;
}

export interface SelectedConcept {
  title: string;
  coreIdea: string;
  creativeConcept: string;
  emotionalDirection: string;
  visualMetaphor?: string;
  oneLinePitch: string;
  /** Why this concept fits THIS campaign (brief-specific rationale). */
  campaignFitRationale?: string;
  /** If the user already picked a performance concept, keep the id. */
  sourceConcept?: AdConcept;
}

/** Explored creative direction before selection — not the final selected concept. */
export interface ExploredCreativeConcept {
  id: string;
  title: string;
  coreIdea: string;
  creativeConcept: string;
  emotionalDirection: string;
  visualMetaphor?: string;
  oneLinePitch: string;
  narrativeMechanism: string;
  productInteraction: string;
  visualLanguage: string;
  campaignFitNotes: string;
}

export interface ArtifactRisk {
  id: string;
  category:
    | "product_packaging"
    | "text_logo"
    | "hands_interaction"
    | "reflections"
    | "food_texture"
    | "character_consistency"
    | "physics_interaction"
    | "other";
  description: string;
  severity: "low" | "medium" | "high";
  mitigation: string;
}

/**
 * What downstream QC must verify. Not an executed QC result.
 */
export interface CommercialQCRequirements {
  checks: QCCheckId[];
  productIdentity: string;
  brandConsistency: string;
  visualContinuity: string;
  conceptAdherence: string;
  productVisibility: string;
  visualTreatmentConsistency: string;
  artifactRiskChecks: string[];
}

/**
 * Campaign-level source of truth. Downstream shots execute this; they do not
 * re-decide visual style.
 */
export interface CommercialBlueprintCore {
  campaignId: string;
  selectedConcept: SelectedConcept;
  /** Concepts explored before selection (observability / audit). */
  exploredConcepts?: ExploredCreativeConcept[];
  creativeStrategy:
    | CreativeStrategy
    | {
        campaignGoal: string;
        targetAudience: string;
        creativeAngle: string;
        coreMessage: string;
      };
  visualTreatment: VisualTreatment;
  visualBeats: VisualBeat[];
  editorialPlan: EditorialPlan;
  soundDesignIntent: SoundDesignIntent;
  productStrategy: ProductStrategy;
  brandStrategy: BrandStrategy;
  platformStrategy: PlatformStrategy;
  campaignDuration: CampaignDurationSeconds;
  aspectRatio: CommercialAspectRatio;
  continuityLock: ContinuityLock;
  /** Requirements for future QC — not an executed evaluation. */
  commercialQCRequirements: CommercialQCRequirements;
  /**
   * Pending evaluation stub until QC execution exists.
   * Phase 2 sets passed=false with recommendedAction manual_review.
   */
  commercialQC: QCResult;
  artifactRisks: ArtifactRisk[];
  createdAt: string;
}

export interface CommercialDirectorOutput {
  blueprint: CommercialBlueprintCore;
  rationale: string;
  meta?: CommercialDirectorMeta;
}

export interface CommercialDirectorMeta {
  campaignId: string;
  selectedConceptTitle: string;
  model: string;
  generationDurationMs: number;
  validationPassed: boolean;
  exploredConceptCount: number;
  repairAttempted: boolean;
}

/**
 * Campaign-level Commercial Director.
 * Produces one coherent campaign-level CommercialBlueprintCore (no shots).
 */
export interface CommercialDirector {
  direct(brief: CampaignBrief): Promise<CommercialDirectorOutput>;
}

export type { CampaignBrief };
