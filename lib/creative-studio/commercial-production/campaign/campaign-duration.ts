/**
 * Campaign duration is the length of the finished commercial.
 * It is independent of any video provider's per-clip generation limit.
 *
 * A 30s campaign is assembled from multiple generated shots.
 * A provider that only emits 5–10s clips is still valid for a 30s commercial.
 */

export const CAMPAIGN_DURATION_SECONDS = [15, 30] as const;

export type CampaignDurationSeconds = (typeof CAMPAIGN_DURATION_SECONDS)[number];

export const DEFAULT_CAMPAIGN_DURATION_SECONDS: CampaignDurationSeconds = 15;

/** Tolerance when summing shot durations against the campaign target. */
export const CAMPAIGN_DURATION_TOLERANCE_SECONDS = 0.5;

export function isCampaignDurationSeconds(value: number): value is CampaignDurationSeconds {
  return value === 15 || value === 30;
}

export function normalizeCampaignDuration(
  value: number | string | null | undefined
): CampaignDurationSeconds {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : value;
  if (n === 30 || n === 16) return 30;
  return 15;
}

export function totalShotDurationSeconds(durations: readonly number[]): number {
  return durations.reduce((sum, d) => sum + (Number.isFinite(d) ? d : 0), 0);
}

export function shotDurationsMatchCampaign(
  shotDurations: readonly number[],
  campaignDuration: CampaignDurationSeconds,
  toleranceSeconds: number = CAMPAIGN_DURATION_TOLERANCE_SECONDS
): boolean {
  return Math.abs(totalShotDurationSeconds(shotDurations) - campaignDuration) <= toleranceSeconds;
}

/**
 * A provider clip duration may be shorter than the campaign.
 * Downstream code must plan multiple shots / clips, then assemble via the timeline.
 */
export function providerClipDoesNotDefineCampaignDuration(
  campaignDuration: CampaignDurationSeconds,
  providerClipDurationSeconds: number
): boolean {
  return campaignDuration !== providerClipDurationSeconds;
}
