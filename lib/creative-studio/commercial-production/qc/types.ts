export const QC_RECOMMENDED_ACTIONS = [
  "accept",
  "regenerate",
  "regenerate_with_modified_prompt",
  "regenerate_keyframe",
  "switch_provider",
  "manual_review",
] as const;

export type QCRecommendedAction = (typeof QC_RECOMMENDED_ACTIONS)[number];

export type QCSeverity = "info" | "warning" | "error";

export type QCCheckId =
  | "product_visibility"
  | "product_identity"
  | "composition"
  | "continuity"
  | "visual_treatment"
  | "subject_consistency"
  | "motion_quality"
  | "artifact_risk"
  | "unwanted_text"
  | "malformed_objects"
  | "camera_consistency"
  | "campaign_relevance";

export interface QCIssue {
  check: QCCheckId;
  severity: QCSeverity;
  message: string;
}

export interface QCResult {
  passed: boolean;
  score: number;
  issues: QCIssue[];
  severity: QCSeverity;
  recommendedAction: QCRecommendedAction;
}

export const DEFAULT_SHOT_QC_CHECKS: QCCheckId[] = [
  "product_visibility",
  "product_identity",
  "composition",
  "continuity",
  "visual_treatment",
  "subject_consistency",
  "motion_quality",
  "artifact_risk",
  "unwanted_text",
  "malformed_objects",
  "camera_consistency",
  "campaign_relevance",
];

/**
 * QC evaluator contract. Implementations belong in later phases.
 * Do not auto-regenerate indefinitely — callers must honor recommendedAction.
 */
export interface ShotQCEvaluator {
  evaluate(input: {
    campaignId: string;
    shotId: string;
    assetUrl: string;
    requirements: string[];
  }): Promise<QCResult>;
}
