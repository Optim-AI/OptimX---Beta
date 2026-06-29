/**
 * Retry transient Gemini / Google Generative Language HTTP 429 (rate limits) and
 * RESOURCE_EXHAUSTED-style errors with Retry-After and exponential backoff.
 */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryAfterMs(headers: Headers | undefined): number | null {
  if (!headers || typeof headers.get !== "function") return null;
  const raw = headers.get("retry-after") ?? headers.get("Retry-After");
  if (!raw) return null;
  const sec = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(sec) || sec < 0) return null;
  return Math.min(sec * 1000, 120_000);
}

/** Billing/plan quota exhausted — retrying will not help until quota resets or billing is updated. */
export function isGeminiQuotaExhaustedError(error: unknown): boolean {
  const msg = String((error as Error)?.message ?? error);
  return /exceeded your current quota|check your plan and billing|billing details|quota exceeded/i.test(
    msg
  );
}

export function isGeminiRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; message?: string; name?: string; response?: { status?: number } };
  if (e.status === 429 || e.response?.status === 429) return true;
  if (e.name === "RateLimitError") return true;
  const msg = String((e as Error).message ?? error);
  if (
    /429|Too Many Requests|RESOURCE_EXHAUSTED|Resource exhausted|rate limit|quota exceeded/i.test(
      msg
    )
  ) {
    return true;
  }
  return false;
}

/** 500/503 and INTERNAL errors from Google — often transient; safe to retry. */
export function isGeminiTransientError(error: unknown): boolean {
  if (isGeminiRateLimitError(error)) return true;
  const e = error as {
    status?: number;
    message?: string;
    response?: { status?: number; data?: unknown };
  };
  const httpStatus = e.response?.status ?? e.status;
  if (httpStatus === 500 || httpStatus === 502 || httpStatus === 503 || httpStatus === 504) {
    return true;
  }
  const blob = JSON.stringify(e.response?.data ?? e.message ?? "");
  return /INTERNAL|UNAVAILABLE|DEADLINE_EXCEEDED|temporarily unavailable/i.test(blob);
}

export function getMsUntilRetry(error: unknown, attemptIndex: number): number {
  const headers = (error as { headers?: Headers }).headers;
  const fromHeader = getRetryAfterMs(headers);
  if (fromHeader != null) return fromHeader;
  const base = Math.min(2000 * 2 ** attemptIndex, 90_000);
  const jitter = Math.floor(Math.random() * 1000);
  return base + jitter;
}

export async function withRetryOnGeminiRateLimit<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; operationLabel?: string } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 6;
  const label = options.operationLabel ?? "gemini";
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (isGeminiQuotaExhaustedError(e)) {
        throw e;
      }
      if (!isGeminiRateLimitError(e) || attempt === maxRetries) {
        throw e;
      }
      const waitMs = getMsUntilRetry(e, attempt);
      console.warn(
        `[${label}] Rate limited (429), retry ${attempt + 1}/${maxRetries} in ${waitMs}ms`,
        { message: (e as Error)?.message }
      );
      await sleep(waitMs);
    }
  }
  throw lastError;
}

/** Retry on 429 rate limits and transient 5xx / INTERNAL Gemini failures. */
export async function withRetryOnGeminiTransient<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; operationLabel?: string } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 4;
  const label = options.operationLabel ?? "gemini";
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (isGeminiQuotaExhaustedError(e)) {
        throw e;
      }
      if (!isGeminiTransientError(e) || attempt === maxRetries) {
        throw e;
      }
      const waitMs = getMsUntilRetry(e, attempt);
      console.warn(
        `[${label}] Transient Gemini error, retry ${attempt + 1}/${maxRetries} in ${waitMs}ms`,
        { message: (e as Error)?.message }
      );
      await sleep(waitMs);
    }
  }
  throw lastError;
}

/**
 * fetch() wrapper: retries when the response status is 429 (body read for logging only on 429).
 */
export async function fetchWithGeminiRateLimitRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { maxRetries?: number; operationLabel?: string }
): Promise<Response> {
  return withRetryOnGeminiRateLimit(
    async () => {
      const r = await fetch(input, init);
      if (r.status === 429) {
        const text = await r.text();
        const err = new Error(text || "429 Too Many Requests") as Error & {
          status?: number;
          headers?: Headers;
        };
        err.status = 429;
        err.headers = r.headers;
        throw err;
      }
      return r;
    },
    { maxRetries: options?.maxRetries ?? 5, operationLabel: options?.operationLabel ?? "gemini-fetch" }
  );
}
