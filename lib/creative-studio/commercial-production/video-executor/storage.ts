/**
 * Shot-video idempotency cache + optional storage via existing video-delivery.
 */

import type { ShotVideoResult } from "./types";

const COMPLETED_CACHE = new Map<string, ShotVideoResult>();
const IN_FLIGHT = new Map<string, ShotVideoResult>();

function cacheKey(campaignId: string, shotId: string, generationVersion: string): string {
  return `${campaignId}:${shotId}:${generationVersion}`;
}

export function getCachedCompletedShotVideo(
  campaignId: string,
  shotId: string,
  generationVersion = "v1"
): ShotVideoResult | undefined {
  return COMPLETED_CACHE.get(cacheKey(campaignId, shotId, generationVersion));
}

export function getInFlightShotVideo(
  campaignId: string,
  shotId: string,
  generationVersion = "v1"
): ShotVideoResult | undefined {
  return IN_FLIGHT.get(cacheKey(campaignId, shotId, generationVersion));
}

export function markShotVideoInFlight(result: ShotVideoResult): void {
  IN_FLIGHT.set(
    cacheKey(result.campaignId, result.shotId, result.metadata.generationVersion),
    result
  );
}

export function clearShotVideoInFlight(
  campaignId: string,
  shotId: string,
  generationVersion = "v1"
): void {
  IN_FLIGHT.delete(cacheKey(campaignId, shotId, generationVersion));
}

export function cacheCompletedShotVideo(result: ShotVideoResult): void {
  if (result.status === "completed") {
    COMPLETED_CACHE.set(
      cacheKey(result.campaignId, result.shotId, result.metadata.generationVersion),
      result
    );
  }
  clearShotVideoInFlight(result.campaignId, result.shotId, result.metadata.generationVersion);
}

export function clearShotVideoCache(campaignId?: string): void {
  if (!campaignId) {
    COMPLETED_CACHE.clear();
    IN_FLIGHT.clear();
    return;
  }
  for (const key of COMPLETED_CACHE.keys()) {
    if (key.startsWith(`${campaignId}:`)) COMPLETED_CACHE.delete(key);
  }
  for (const key of IN_FLIGHT.keys()) {
    if (key.startsWith(`${campaignId}:`)) IN_FLIGHT.delete(key);
  }
}

export async function storeShotVideoBuffer(input: {
  buffer: Buffer;
  campaignId: string;
  shotId: string;
  generationVersion: string;
  attempt: number;
}): Promise<{ url: string; bytes: number; delivery: "storage" } | null> {
  try {
    const { uploadVideoBuffer } = await import("@/lib/creative-studio/video-delivery");
    const url = await uploadVideoBuffer(input.buffer);
    return { url, bytes: input.buffer.length, delivery: "storage" };
  } catch (e) {
    console.warn("[video-executor] shot video storage failed:", e);
    return null;
  }
}
