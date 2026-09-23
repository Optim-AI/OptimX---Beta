/**
 * Domain / repository errors for Poster Generation Session (Phase 2).
 * Never include secrets or stack traces in public API payloads.
 */

import { sanitizeErrorForClient } from "../production-safety";

export type PosterSessionErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "VALIDATION"
  | "CONFLICT"
  | "MALFORMED_PERSISTED_DATA"
  | "LEGACY_SESSION"
  | "INTERNAL";

export class PosterGenerationSessionError extends Error {
  readonly code: PosterSessionErrorCode;
  readonly stage: string;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(options: {
    code: PosterSessionErrorCode;
    message: string;
    stage?: string;
    retryable?: boolean;
    details?: unknown;
  }) {
    super(options.message);
    this.name = "PosterGenerationSessionError";
    this.code = options.code;
    this.stage = options.stage || "session";
    this.retryable = options.retryable ?? false;
    this.details = options.details;
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

export function isPosterSessionError(
  err: unknown
): err is PosterGenerationSessionError {
  return err instanceof PosterGenerationSessionError;
}
