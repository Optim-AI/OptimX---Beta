/**
 * Provider ids are stable. Adding a provider must not require changes to the
 * Commercial Director or Shot Planner.
 */
export const VIDEO_PROVIDER_IDS = ["runway", "seedance", "veo", "kling", "wan"] as const;

export type VideoProviderId = (typeof VIDEO_PROVIDER_IDS)[number];

/** Active commercial provider only. Seedance 2.5 is a model under runway. */
export const PRIMARY_VIDEO_PROVIDERS = ["runway"] as const;
