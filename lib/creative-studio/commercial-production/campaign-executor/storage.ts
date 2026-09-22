/**
 * In-memory idempotency for native campaign video generations (process-local).
 */

import type { CampaignVideoResult } from "./types";

const COMPLETED = new Map<string, CampaignVideoResult>();
const IN_FLIGHT = new Map<string, CampaignVideoResult>();

export function campaignVideoIdempotencyKey(input: {
  campaignId: string;
  generationVersion: string;
  duration: number;
  generationMode: string;
}): string {
  return `${input.campaignId}:${input.generationVersion}:${input.duration}:${input.generationMode}`;
}

export function getCachedCampaignVideo(key: string): CampaignVideoResult | undefined {
  return COMPLETED.get(key);
}

export function getInFlightCampaignVideo(key: string): CampaignVideoResult | undefined {
  return IN_FLIGHT.get(key);
}

export function markCampaignVideoInFlight(key: string, result: CampaignVideoResult): void {
  IN_FLIGHT.set(key, result);
}

export function clearCampaignVideoInFlight(key: string): void {
  IN_FLIGHT.delete(key);
}

export function cacheCompletedCampaignVideo(key: string, result: CampaignVideoResult): void {
  if (result.status === "completed") COMPLETED.set(key, result);
  IN_FLIGHT.delete(key);
}

export function clearCampaignVideoCache(campaignId?: string): void {
  if (!campaignId) {
    COMPLETED.clear();
    IN_FLIGHT.clear();
    return;
  }
  for (const key of COMPLETED.keys()) {
    if (key.startsWith(`${campaignId}:`)) COMPLETED.delete(key);
  }
  for (const key of IN_FLIGHT.keys()) {
    if (key.startsWith(`${campaignId}:`)) IN_FLIGHT.delete(key);
  }
}
