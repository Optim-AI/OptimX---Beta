/**
 * Commercial QC & Regeneration Loop — Phase 8 types.
 *
 * Decision model: accept | regenerate | manual_review
 * NO overall quality score. Evaluate against creative/production specification.
 */

import type { CampaignBrief } from "../campaign/types";
import type { CommercialBlueprintCore } from "../commercial-director/types";
import type { ShotPlan } from "../shot-planner/types";
import type { ProductionManifest } from "../campaign-orchestrator/types";
import type { FinalCommercial } from "../campaign-executor/types";
import type { AvailableCampaignAssets, ReferenceAsset } from "../reference-engine/types";
import type { StoredAssetRef } from "../assets";

export const COMMERCIAL_QC_DECISIONS = [
  "accept",
  "regenerate",
  "manual_review",
] as const;

export type CommercialQCDecision = (typeof COMMERCIAL_QC_DECISIONS)[number];

export const VISUAL_OBSERVATION_CATEGORIES = [
  "product",
  "brand",
  "character",
  "environment",
  "narrative",
  "camera",
  "continuity",
  "composition",
  "artifact",
  "ending",
  "treatment",
] as const;

export type VisualObservationCategory =
  (typeof VISUAL_OBSERVATION_CATEGORIES)[number];

export const QC_SEVERITIES = ["info", "warning", "error", "critical"] as const;

export type QCSeverity = (typeof QC_SEVERITIES)[number];

export const QC_CATEGORY_STATUSES = [
  "pass",
  "warning",
  "fail",
  "not_applicable",
  "insufficient_evidence",
] as const;

export type QCStatus = (typeof QC_CATEGORY_STATUSES)[number];

export type RegenerationTarget = "campaign" | "shot";

/** Configurable confidence thresholds for decision logic. */
export interface CommercialQCThresholds {
  /** Observations at or above this may drive automatic regenerate decisions. */
  autoDecisionMinConfidence: number;
  /** Below this → prefer manual_review for material visual findings. */
  manualReviewBelowConfidence: number;
}

export const DEFAULT_QC_THRESHOLDS: CommercialQCThresholds = {
  autoDecisionMinConfidence: 0.85,
  manualReviewBelowConfidence: 0.7,
};

/** Hard bound on automatic regenerations (prevents credit burn). */
export const DEFAULT_MAX_AUTO_REGENERATIONS = 2;

export interface DeterministicCheck {
  check: string;
  passed: boolean;
  severity: QCSeverity;
  message: string;
  expected?: string | number | boolean;
  actual?: string | number | boolean;
}

export interface DeterministicQCResult {
  passed: boolean;
  checks: DeterministicCheck[];
  /** When true, visual analysis should be skipped (hard technical failure). */
  skipVisualAnalysis: boolean;
}

export interface VisualSamplingPlan {
  timestamps: number[];
  reason: string;
  durationSeconds: number;
  sampleCount: number;
}

export interface SampledFrame {
  timestamp: number;
  /** data URL, https URL, or opaque placeholder id for mocks */
  imageRef: string;
  mimeType?: string;
  /** When true, frame is a test stub — not real pixels. */
  isMock?: boolean;
}

export interface VisualObservation {
  category: VisualObservationCategory;
  severity: QCSeverity;
  timestamp?: number;
  observation: string;
  evidence: string;
  confidence: number;
}

export interface CommercialVisualAnalysis {
  available: boolean;
  observations: VisualObservation[];
  analyzerConfidence?: number;
  model?: string;
  samplingPlan?: VisualSamplingPlan;
  error?: string;
}

export interface CommercialVisualAnalysisInput {
  campaignId: string;
  generationVersion: string;
  durationSeconds: number;
  frames: SampledFrame[];
  samplingPlan: VisualSamplingPlan;
  blueprint: CommercialBlueprintCore;
  shotPlan: ShotPlan;
  /** Canonical product reference — preferred over generated keyframes. */
  productReference?: ReferenceAsset | StoredAssetRef;
  characterReferences?: ReferenceAsset[];
  environmentReferences?: ReferenceAsset[];
  requirementsSummary: string;
}

export interface CommercialVisualAnalyzer {
  readonly id: string;
  analyze(
    input: CommercialVisualAnalysisInput
  ): Promise<CommercialVisualAnalysis>;
}

export interface CategoryEvaluation {
  status: QCStatus;
  findings: VisualObservation[];
  summary: string;
}

export interface CreativeEvaluationResult {
  product: CategoryEvaluation;
  brand: CategoryEvaluation;
  narrative: CategoryEvaluation;
  continuity: CategoryEvaluation;
  treatment: CategoryEvaluation;
  ending: CategoryEvaluation;
  artifacts: CategoryEvaluation;
}

export interface RegenerationPlan {
  reason: string;
  target: RegenerationTarget;
  issues: VisualObservation[];
  requiredChanges: string[];
  preservedRequirements: string[];
  /** Version that failed QC (source). */
  sourceGenerationVersion: string;
  /** Version to produce next. */
  generationVersion: string;
  /** How many auto regenerations have already been attempted (before this plan). */
  priorRegenerationCount: number;
}

export interface RegenerationHistoryEntry {
  fromVersion: string;
  toVersion: string;
  decidedAt: string;
  decision: CommercialQCDecision;
  reason: string;
  plan?: RegenerationPlan;
}

export interface CommercialQCReport {
  campaignId: string;
  generationVersion: string;
  decision: CommercialQCDecision;
  deterministic: DeterministicQCResult;
  visual: {
    available: boolean;
    observations: VisualObservation[];
    samplingPlan?: VisualSamplingPlan;
    error?: string;
  };
  categories: {
    product: QCStatus;
    brand: QCStatus;
    narrative: QCStatus;
    continuity: QCStatus;
    artifacts: QCStatus;
    ending: QCStatus;
    treatment: QCStatus;
  };
  regeneration?: RegenerationPlan;
  regenerationHistory?: RegenerationHistoryEntry[];
  analyzerConfidence?: number;
  evaluatedAt: string;
}

export interface CommercialQCInput {
  campaignBrief: CampaignBrief;
  blueprint: CommercialBlueprintCore;
  shotPlan: ShotPlan;
  finalCommercial: FinalCommercial;
  /** Optional — when present, used for consistency checks. */
  manifest?: ProductionManifest;
  availableAssets?: AvailableCampaignAssets;
  /** Prior regenerations for this campaign lineage. */
  regenerationHistory?: RegenerationHistoryEntry[];
  /** How many auto regenerations already consumed. */
  regenerationCount?: number;
  thresholds?: Partial<CommercialQCThresholds>;
  maxAutoRegenerations?: number;
  /** Injected analyzer — tests use mocks; production may use Gemini. */
  visualAnalyzer?: CommercialVisualAnalyzer;
  /** Injected frames — when omitted, sampler plan is built but frames may be empty. */
  frames?: SampledFrame[];
  /** Frame sampler — optional; skipped when deterministic fails hard. */
  frameSampler?: CommercialFrameSampler;
  skipVisualIfDeterministicFails?: boolean;
}

export interface CommercialFrameSampler {
  sample(input: {
    videoUrl: string;
    durationSeconds: number;
    plan: VisualSamplingPlan;
  }): Promise<SampledFrame[]>;
}

export interface CommercialQCOptions {
  thresholds?: Partial<CommercialQCThresholds>;
  maxAutoRegenerations?: number;
  visualAnalyzer?: CommercialVisualAnalyzer;
  frameSampler?: CommercialFrameSampler;
  log?: (event: string, payload: Record<string, unknown>) => void;
}

export interface QCDecisionInput {
  deterministic: DeterministicQCResult;
  visual: CommercialVisualAnalysis;
  creative: CreativeEvaluationResult;
  regenerationCount: number;
  maxAutoRegenerations: number;
  thresholds: CommercialQCThresholds;
}

export interface QCDecisionResult {
  decision: CommercialQCDecision;
  reason: string;
  materialFailures: VisualObservation[];
  ambiguousFindings: VisualObservation[];
}
