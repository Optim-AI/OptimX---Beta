/**
 * Bounded job polling for VideoProvider jobs.
 * Reuses the same pattern as the Brand Studio single-clip path — no second polling system.
 */

import type { ProviderJobStatus, VideoProvider } from "../video/providers/types";
import { VideoExecutorError } from "./types";

const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_MAX_WAIT_MS = 12 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForVideoJob(input: {
  provider: VideoProvider;
  providerJobId: string;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  onPoll?: (status: ProviderJobStatus) => void;
}): Promise<ProviderJobStatus> {
  const pollIntervalMs = input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxWaitMs = input.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    const status = await input.provider.getJob(input.providerJobId);
    input.onPoll?.(status);

    if (status.state === "succeeded") return status;
    if (status.state === "failed" || status.state === "cancelled") {
      throw new VideoExecutorError(
        "VIDEO_JOB_FAILED",
        status.failureReason || `Provider job ${status.state}`,
        { providerJobId: input.providerJobId, state: status.state },
        false
      );
    }

    await sleep(pollIntervalMs);
  }

  throw new VideoExecutorError(
    "VIDEO_JOB_TIMEOUT",
    `Video job timed out after ${Math.round(maxWaitMs / 1000)}s (${input.providerJobId})`,
    { providerJobId: input.providerJobId, maxWaitMs },
    true
  );
}

export function isRetryableProviderError(error: unknown): boolean {
  if (error instanceof VideoExecutorError) {
    return error.retryable || error.code === "RATE_LIMITED" || error.code === "VIDEO_JOB_TIMEOUT";
  }
  const msg = error instanceof Error ? error.message : String(error);
  if (/429|rate limit|RESOURCE_EXHAUSTED|THROTTLED/i.test(msg)) return true;
  if (/5\d\d|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(msg)) return true;
  if (/timed out/i.test(msg)) return true;
  return false;
}

export function mapProviderError(error: unknown): VideoExecutorError {
  if (error instanceof VideoExecutorError) return error;
  const msg = error instanceof Error ? error.message : String(error);
  if (/429|rate limit|THROTTLED|RESOURCE_EXHAUSTED/i.test(msg)) {
    return new VideoExecutorError("RATE_LIMITED", msg, undefined, true);
  }
  if (/quota/i.test(msg)) {
    return new VideoExecutorError("QUOTA_EXCEEDED", msg, undefined, false);
  }
  if (/invalid|unsupported|bad request|400/i.test(msg)) {
    return new VideoExecutorError("VIDEO_REQUEST_INVALID", msg, undefined, false);
  }
  return new VideoExecutorError("VIDEO_JOB_FAILED", msg, undefined, isRetryableProviderError(error));
}
