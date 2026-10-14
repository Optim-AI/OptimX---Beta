/**
 * Carousel domain errors. Public payloads go through sanitizeErrorForClient.
 */

import { sanitizeErrorForClient } from "../production-safety";

export type PosterCarouselErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "MISSING_BRIEF"
  | "MISSING_STRATEGY"
  | "MISSING_CONCEPT"
  | "STALE_STRATEGY"
  | "STORY_INVALID"
  | "PLAN_INVALID"
  | "PROVIDER"
  | "PROVIDER_UNAVAILABLE"
  | "INSUFFICIENT_CREDITS"
  | "CONFLICT"
  | "NOT_ELIGIBLE"
  | "MALFORMED_PERSISTED_DATA"
  | "EXPORT_EMPTY"
  | "INTERNAL";

export class PosterCarouselError extends Error {
  readonly code: PosterCarouselErrorCode;
  readonly stage: string;
  readonly retryable: boolean;
  readonly issues?: string[];

  constructor(options: {
    code: PosterCarouselErrorCode;
    message: string;
    stage?: string;
    retryable?: boolean;
    issues?: string[];
  }) {
    super(options.message);
    this.name = "PosterCarouselError";
    this.code = options.code;
    this.stage = options.stage || "carousel";
    this.retryable = options.retryable ?? false;
    this.issues = options.issues;
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

export function isPosterCarouselError(err: unknown): err is PosterCarouselError {
  return err instanceof PosterCarouselError;
}

export function carouselErrorHttpStatus(code: string): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "MISSING_BRIEF":
    case "MISSING_STRATEGY":
    case "MISSING_CONCEPT":
    case "STALE_STRATEGY":
    case "NOT_ELIGIBLE":
    case "EXPORT_EMPTY":
      return 409;
    case "VALIDATION":
      return 400;
    case "STORY_INVALID":
    case "PLAN_INVALID":
      return 422;
    case "INSUFFICIENT_CREDITS":
      return 402;
    case "CONFLICT":
      return 409;
    case "PROVIDER":
    case "PROVIDER_UNAVAILABLE":
      return 502;
    default:
      return 500;
  }
}
