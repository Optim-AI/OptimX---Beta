/**
 * Generation domain errors — Phase 6 / Phase 9 public sanitization.
 */

import { sanitizeErrorForClient } from "../production-safety";

export type PosterGenerationErrorCode =
  | "VALIDATION"
  | "MISSING_BRIEF"
  | "MISSING_STRATEGY"
  | "MISSING_CONCEPT"
  | "MISSING_DNA"
  | "STALE_STRATEGY"
  | "INSUFFICIENT_CREDITS"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_FAILED"
  | "MALFORMED_SPEC"
  | "STORAGE_FAILED"
  | "CONFLICT"
  | "INTERNAL";

export class PosterGenerationError extends Error {
  readonly code: PosterGenerationErrorCode;
  readonly stage: string;
  readonly retryable: boolean;

  constructor(options: {
    code: PosterGenerationErrorCode;
    message: string;
    stage?: string;
    retryable?: boolean;
  }) {
    super(options.message);
    this.name = "PosterGenerationError";
    this.code = options.code;
    this.stage = options.stage || "generation";
    this.retryable = options.retryable ?? false;
  }

  toPublicJSON() {
    return sanitizeErrorForClient({
      code: this.code,
      message: this.message,
      stage: this.stage,
      retryable: this.retryable,
    });
  }
}

export function isPosterGenerationError(
  err: unknown
): err is PosterGenerationError {
  return err instanceof PosterGenerationError;
}
