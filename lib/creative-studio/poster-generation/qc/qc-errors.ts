/**
 * Poster QC domain errors — Phase 7.
 */

export type PosterQcErrorCode =
  | "VALIDATION"
  | "MISSING_ASSET"
  | "MISSING_SPEC"
  | "MISSING_STRATEGY"
  | "MISSING_CONCEPT"
  | "MISSING_DNA"
  | "PROVIDER"
  | "MALFORMED_MODEL_OUTPUT"
  | "INTERNAL";

export class PosterQcError extends Error {
  readonly code: PosterQcErrorCode;
  readonly stage: string;
  readonly retryable: boolean;

  constructor(options: {
    code: PosterQcErrorCode;
    message: string;
    stage?: string;
    retryable?: boolean;
  }) {
    super(options.message);
    this.name = "PosterQcError";
    this.code = options.code;
    this.stage = options.stage || "qc";
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

export function isPosterQcError(err: unknown): err is PosterQcError {
  return err instanceof PosterQcError;
}
