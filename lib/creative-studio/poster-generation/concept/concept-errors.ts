/**
 * Creative Concept domain errors — Phase 5.
 */

export type PosterConceptErrorCode =
  | "VALIDATION"
  | "MISSING_BRIEF"
  | "MISSING_STRATEGY"
  | "STALE_STRATEGY"
  | "INSUFFICIENT_DIVERSITY"
  | "MALFORMED_MODEL_OUTPUT"
  | "PROVIDER"
  | "INTERNAL";

export class PosterConceptError extends Error {
  readonly code: PosterConceptErrorCode;
  readonly stage: string;
  readonly retryable: boolean;

  constructor(options: {
    code: PosterConceptErrorCode;
    message: string;
    stage?: string;
    retryable?: boolean;
  }) {
    super(options.message);
    this.name = "PosterConceptError";
    this.code = options.code;
    this.stage = options.stage || "concept";
    this.retryable = options.retryable ?? false;
  }

  toPublicJSON() {
    return {
      code: this.code,
      stage: this.stage,
      message: this.message,
      retryable: this.retryable,
    };
  }
}

export function isPosterConceptError(err: unknown): err is PosterConceptError {
  return err instanceof PosterConceptError;
}
