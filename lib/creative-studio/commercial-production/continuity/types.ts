/**
 * Continuity is explicit between shots. Do not rely on a model "remembering"
 * previous prompts.
 */

export interface ContinuityLock {
  character?: string;
  wardrobe?: string;
  location?: string;
  lighting?: string;
  timeOfDay?: string;
  product?: string;
  colorGrade?: string;
  visualTreatmentSummary?: string;
}

export interface ShotContinuity {
  /** Campaign-level locks that this shot must honor. */
  lock: ContinuityLock;
  /** Previous shot ids this shot must continue from. */
  continuesFromShotIds: string[];
  /** Human-readable must-match notes, e.g. "same woman, white shirt, morning kitchen". */
  mustMatch: string[];
  /** What is allowed to change in this shot. */
  allowedChanges?: string[];
  /**
   * Machine-readable continuity dimensions.
   * Prefer this over relying solely on prose in mustMatch.
   */
  mustMatchDimensions?: Array<
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
    | "color_grade"
  >;
}

export interface ContinuityLink {
  fromShotId: string;
  toShotId: string;
  carriedForward: ContinuityLock;
  notes: string;
}
