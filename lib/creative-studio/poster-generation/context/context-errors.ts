/**
 * Context normalization errors — Phase 3.
 */

export type PosterContextErrorCode =
  | "VALIDATION"
  | "MALFORMED_SOURCE"
  | "EMPTY_INPUT"
  | "INTERNAL";

export class PosterContextError extends Error {
  readonly code: PosterContextErrorCode;
  readonly stage: string;

  constructor(options: {
    code: PosterContextErrorCode;
    message: string;
    stage?: string;
  }) {
    super(options.message);
    this.name = "PosterContextError";
    this.code = options.code;
    this.stage = options.stage || "context";
  }

  toPublicJSON() {
    return {
      code: this.code,
      stage: this.stage,
      message: this.message,
    };
  }
}

export function isPosterContextError(err: unknown): err is PosterContextError {
  return err instanceof PosterContextError;
}
