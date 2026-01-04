// integrations/meta/retry.ts
// Reusable retry utility with exponential backoff for handling transient failures

export interface RetryOptions {
  maxAttempts?: number;
  delays?: number[]; // Delays in milliseconds for each retry
  shouldRetry?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  delays: [1000, 5000, 30000], // 1s, 5s, 30s
  shouldRetry: (error: any) => {
    // Retry on network errors, timeouts, and 5xx server errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    if (error.response?.status >= 500) {
      return true;
    }
    // Don't retry on client errors (4xx) or Facebook auth errors
    return false;
  },
  onRetry: () => {},
};

/**
 * Retry an async function with exponential backoff
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Promise resolving to function result
 *
 * @example
 * const result = await retryWithBackoff(
 *   () => fetch('https://api.facebook.com/...'),
 *   { maxAttempts: 3 }
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if we should retry this error
      if (!config.shouldRetry(error)) {
        throw error;
      }

      // Don't wait after the last attempt
      if (attempt === config.maxAttempts) {
        break;
      }

      // Calculate delay for this attempt
      const delay = config.delays[attempt - 1] || config.delays[config.delays.length - 1];

      // Call retry callback
      config.onRetry(attempt, error);

      console.log(`[Retry] Attempt ${attempt}/${config.maxAttempts} failed. Retrying in ${delay}ms...`, {
        error: error.message,
        code: error.code,
        status: error.response?.status,
      });

      // Wait before retrying
      await sleep(delay);
    }
  }

  // All retries exhausted
  console.error(`[Retry] All ${config.maxAttempts} attempts failed`, {
    lastError: lastError?.message,
  });

  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is a transient network error that should be retried
 */
export function isTransientError(error: any): boolean {
  return DEFAULT_OPTIONS.shouldRetry(error);
}
