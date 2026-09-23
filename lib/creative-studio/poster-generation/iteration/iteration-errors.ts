/**
 * Phase 8 — Iteration errors
 */

import { sanitizeErrorForClient } from "../production-safety";

export type PosterIterationErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "MISSING_ASSET"
  | "MISSING_SPEC"
  | "MISSING_STRATEGY"
  | "MISSING_CONCEPT"
  | "MISSING_DNA"
  | "MISSING_BRIEF"
  | "CLASSIFICATION_FAILED"
  | "PLAN_INVALID"
  | "INSUFFICIENT_CREDITS"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_FAILED"
  | "CONFLICT"
  | "UNAUTHORIZED";

export class PosterIterationError extends Error {
  readonly code: PosterIterationErrorCode;
  readonly stage: string;
  readonly retryable: boolean;

  constructor(input: {
    code: PosterIterationErrorCode;
    message: string;
    stage: string;
    retryable?: boolean;
  }) {
    super(input.message);
    this.name = "PosterIterationError";
    this.code = input.code;
    this.stage = input.stage;
    this.retryable = input.retryable ?? false;
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

export function isPosterIterationError(
  err: unknown
): err is PosterIterationError {
  return err instanceof PosterIterationError;
}
