import type { ContinuityLock, ShotContinuity } from "../continuity/types";
import type { GenerationStrategy } from "../generation/types";
import type { QCCheckId } from "../qc/types";
import type { CommercialBlueprintCore } from "../commercial-director/types";
import type { CampaignDurationSeconds } from "../campaign/campaign-duration";

/**
 * Conceptual shot roles. Planner selects based on campaign — not a fixed sequence.
 */
export const SHOT_ROLES = [
  "hook",
  "establishing",
  "character_introduction",
  "product_introduction",
  "product_interaction",
  "problem",
  "transformation",
  "emotional_beat",
  "detail_macro",
  "product_hero",
  "benefit_visualization",
  "transition",
  "payoff",
  "cta",
  "end_card",
  "atmosphere",
  "motion_graphic",
  "abstract_visual",
] as const;

export type ShotRole = (typeof SHOT_ROLES)[number];

export type ProductVisibility =
  | "hero"
  | "prominent"
  | "in-use"
  | "pack-shot"
  | "partial"
  | "background"
  | "implied"
  | "none";

export type TransitionType =
  | "cut"
  | "hard_cut"
  | "match_cut"
  | "object_continuity"
  | "motion_continuity"
  | "eye_line_match"
  | "whip"
  | "dissolve"
  | "fade"
  | "sound_bridge"
  | "object_wipe"
  | "graphic_transition"
  | "visual_transformation"
  | "motivated_cut"
  | "none";

/**
 * Provider-agnostic reference strategy for a shot.
 * Describes REQUIREMENTS for a future keyframe/image system — does not generate images.
 */
export const REFERENCE_STRATEGY_TYPES = [
  "none",
  "existing_product_image",
  "generated_keyframe",
  "product_and_environment",
  "character",
  "character_and_product",
  "previous_shot",
  "multiple_references",
  "compositing",
] as const;

export type ReferenceStrategyType = (typeof REFERENCE_STRATEGY_TYPES)[number];

export interface ShotReferenceRequirements {
  productImages: boolean;
  keyframe: boolean;
  startFrame: boolean;
  endFrame: boolean;
  styleReferences: boolean;
  reusableKeyframeId?: string;
  /** Whether product reference material is required for this shot. */
  productReferenceRequired: boolean;
  /** Why product reference is / is not required. */
  productReferenceReason: string;
  strategyType: ReferenceStrategyType;
  /** Human-readable purpose of the reference strategy. */
  purpose: string;
  characterReference?: boolean;
  /** Previous shot ids to reuse as visual reference (not continuity alone). */
  previousShotReferenceIds?: string[];
  /**
   * Whether a generated keyframe would materially improve control.
   * Future Phase 4+ may call an image model — NOT implemented in Phase 3.
   */
  keyframeRequired: boolean;
  keyframeRationale: string;
}

export type ProductStateId =
  | "absent"
  | "closed_package"
  | "open_package"
  | "product_removed"
  | "in_hand"
  | "preparing"
  | "in_use_consuming"
  | "hero_display"
  | "other";

export interface ProductStateSpec {
  state: ProductStateId | string;
  description: string;
  /** Shot id this state continues from, when applicable. */
  transitionsFromShotId?: string;
}

export interface CharacterContinuitySpec {
  characterId: string;
  identity: string;
  ageRange?: string;
  appearance?: string;
  wardrobe?: string;
  physicalAttributes?: string[];
  roleInStory?: string;
  /** Machine-readable match dimensions, e.g. face, hair, wardrobe, accessories. */
  mustMatch: string[];
}

export type ContinuityDimension =
  | "character"
  | "face"
  | "hair"
  | "wardrobe"
  | "accessories"
  | "product"
  | "product_state"
  | "environment"
  | "location"
  | "time_of_day"
  | "lighting"
  | "camera_language"
  | "props"
  | "emotional_state"
  | "color_grade";

export interface ShotArtifactRisk {
  id: string;
  risk: string;
  severity: "low" | "medium" | "high";
  reason: string;
  mitigation: string;
}

export type ShotEstimatedComplexity = "low" | "medium" | "high";

/**
 * One commercial shot. shotWhy is mandatory — no filler.
 * Provider-agnostic production unit for one moment of the commercial.
 */
export interface CommercialShot {
  id: string;
  sequence: number;
  durationSeconds: number;
  role: ShotRole;
  /** Visual beat id(s) this shot serves from the blueprint. */
  beatIds: string[];
  shotWhy: string;
  storyBeat: string;
  visualDescription: string;
  subject: string;
  productVisibility: ProductVisibility;
  /** Why product visibility is set this way for this moment. */
  productVisibilityReason: string;
  environment: string;
  lens?: string;
  framing: string;
  cameraMovement: string;
  cameraHeight?: string;
  cameraAngle?: string;
  depthOfField?: string;
  subjectDistance?: string;
  lighting: string;
  composition: string;
  transitionIn?: TransitionType;
  transitionOut?: TransitionType;
  generationStrategy: GenerationStrategy;
  referenceRequirements: ShotReferenceRequirements;
  continuity: ShotContinuity;
  /** Machine-readable continuity dimensions for this shot. */
  continuityDimensions?: ContinuityDimension[];
  characterContinuity?: CharacterContinuitySpec[];
  productState?: ProductStateSpec;
  /** Summary string for prompt compilers (legacy-compatible). */
  artifactRisk: string;
  artifactRisks: ShotArtifactRisk[];
  qcRequirements: QCCheckId[];
  /** Shot-specific QC notes beyond check ids. */
  qcNotes?: string[];
  generationRequired: boolean;
  estimatedComplexity: ShotEstimatedComplexity;
  referenceRequired: boolean;
}

export interface ShotPlanMeta {
  campaignId: string;
  campaignDuration: CampaignDurationSeconds;
  shotCount: number;
  totalDurationSeconds: number;
  referenceRequiredCount: number;
  keyframeFirstCount: number;
  motionGraphicsCount: number;
  textToVideoCount: number;
  productReferenceCount: number;
  model: string;
  generationDurationMs: number;
  validationPassed: boolean;
  durationNormalized: boolean;
  repairAttempted: boolean;
}

export interface ShotPlan {
  campaignId: string;
  shots: CommercialShot[];
  continuityLock: ContinuityLock;
  totalDurationSeconds: number;
  campaignDuration: CampaignDurationSeconds;
  /** Continuity edges for observability (optional graph view). */
  continuityLinks?: Array<{
    fromShotId: string;
    toShotId: string;
    dimensions: ContinuityDimension[];
    notes: string;
  }>;
  meta?: ShotPlanMeta;
}

/**
 * Converts a campaign-level blueprint into provider-agnostic shots.
 * Does not call Runway, Seedance, image models, or FFmpeg.
 */
export interface ShotPlanner {
  plan(blueprint: CommercialBlueprintCore): Promise<ShotPlan>;
}
