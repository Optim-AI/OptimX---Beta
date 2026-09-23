/**
 * Strategy domain errors — Phase 4.
 */

export type PosterStrategyErrorCode =
  | "VALIDATION"
  | "MISSING_BRIEF"
  | "MALFORMED_MODEL_OUTPUT"
  | "UNSUPPORTED_CLAIMS"
  | "PROVIDER"
  | "INTERNAL";

export class PosterStrategyError extends Error {
  readonly code: PosterStrategyErrorCode;
  readonly stage: string;
  readonly retryable: boolean;

  constructor(options: {
    code: PosterStrategyErrorCode;
    message: string;
    stage?: string;
    retryable?: boolean;
  }) {
    super(options.message);
    this.name = "PosterStrategyError";
    this.code = options.code;
    this.stage = options.stage || "strategy";
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

export function isPosterStrategyError(err: unknown): err is PosterStrategyError {
  return err instanceof PosterStrategyError;
}
