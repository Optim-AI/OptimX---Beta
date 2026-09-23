/**
 * Phase 9 — Production safety helpers for poster engine API responses.
 * Strip internal artifacts before anything reaches the browser.
 */

import type {
  GenerationSpecification,
  PosterGenerationSession,
} from "./types";

const IS_PROD = () => process.env.NODE_ENV === "production";

/** Friendly messages — never expose Gemini/provider internals to users */
export const PUBLIC_ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_CREDITS:
    "You don't have enough image credits for this request.",
  PROVIDER_UNAVAILABLE:
    "Image generation is temporarily unavailable. Please try again shortly.",
  PROVIDER_FAILED:
    "We couldn't generate this poster. Your credit wasn't charged for failed images.",
  RATE_LIMITED:
    "We're handling a lot of requests right now. Please try again in a moment.",
  VALIDATION: "Something about this request couldn't be processed. Please try again.",
  MISSING_BRIEF: "Add a creative direction before continuing.",
  MISSING_STRATEGY: "Campaign direction isn't ready yet. Try developing creative again.",
  MISSING_CONCEPT: "Select a creative direction before generating.",
  MISSING_DNA: "Creative direction is incomplete. Try regenerating directions.",
  MISSING_ASSET: "That poster couldn't be found.",
  MISSING_SPEC: "Poster details are missing. Please generate again.",
  NOT_FOUND: "We couldn't find that session or poster.",
  FORBIDDEN: "You don't have access to this session.",
  CONFLICT: "This session was updated elsewhere. Refresh and try again.",
  STORAGE_FAILED: "We generated the poster but couldn't save it. Please try again.",
  PLAN_INVALID: "We couldn't plan that change. Try rephrasing your edit.",
  CLASSIFICATION_FAILED: "We couldn't understand that change. Try rephrasing.",
  MALFORMED_SPEC: "Poster setup was invalid. Please try again.",
  INTERNAL: "Something went wrong. Please try again.",
};

export function publicErrorMessage(
  code: string | undefined,
  fallback?: string
): string {
  if (code && PUBLIC_ERROR_MESSAGES[code]) return PUBLIC_ERROR_MESSAGES[code];
  return (
    fallback ||
    "We couldn't complete that request. Please try again."
  );
}

/**
 * Never forward raw provider/stack messages to the browser in production.
 * In non-production, keep technical detail for debugging.
 */
export function sanitizeErrorForClient(options: {
  code?: string;
  message?: string;
  stage?: string;
  retryable?: boolean;
}): {
  code: string;
  message: string;
  stage?: string;
  retryable: boolean;
} {
  const code = options.code || "INTERNAL";
  const retryable = options.retryable ?? true;

  if (!IS_PROD()) {
    return {
      code,
      message: options.message || publicErrorMessage(code),
      stage: options.stage,
      retryable,
    };
  }

  return {
    code,
    message: publicErrorMessage(code, options.message),
    retryable,
  };
}

function stripSpec(
  spec: GenerationSpecification
): GenerationSpecification {
  if (!IS_PROD()) return spec;
  const { compiledPrompt: _c, ...rest } = spec;
  return { ...rest, compiledPrompt: null };
}

/**
 * Session payload for browser — strips compiled prompts and softens lastError in prod.
 */
export function sanitizeSessionForClient(
  session: PosterGenerationSession
): PosterGenerationSession {
  if (!IS_PROD()) return session;

  return {
    ...session,
    specifications: (session.specifications || []).map(stripSpec),
    assets: (session.assets || []).map((a) => ({
      ...a,
      errorMessage: a.errorMessage
        ? publicErrorMessage(
            a.errorCode || "PROVIDER_FAILED",
            "Generation failed"
          )
        : a.errorMessage,
    })),
    trace: {
      ...session.trace,
      lastError: session.trace?.lastError
        ? "A previous step failed. You can try again."
        : session.trace?.lastError,
    },
  };
}

export function isPosterEngineDebugEnabled(req?: {
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
}): boolean {
  if (IS_PROD()) {
    // Explicit override for staging with secret header only
    const header = req?.headers?.["x-poster-engine-debug"];
    const expected = process.env.POSTER_ENGINE_DEBUG_SECRET;
    if (!expected || !header) return false;
    const value = Array.isArray(header) ? header[0] : header;
    return value === expected;
  }
  // Non-prod: allow unless explicitly disabled
  const q = req?.query?.debug;
  if (q === "0" || q === "false") return false;
  return process.env.POSTER_ENGINE_DEBUG !== "0";
}
