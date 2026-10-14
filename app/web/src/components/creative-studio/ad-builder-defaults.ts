/**
 * Default Ad Builder Data (dependency-free so server routes can import it)
 */
export const DEFAULT_AD_BUILDER_DATA = {
  step: 1 as const,
  product: null,
  adSetup: {
    creativeFormat: "Commercial" as const,
    hookType: "Auto" as const,
    campaignGoal: "Drive Sales" as const,
    audience: "Auto" as const,
    duration: 15 as const,
    platform: "Instagram Reels / TikTok" as const,
    aspect_ratio: "9:16" as const,
  },
  voiceover: {
    enabled: true,
    language: "english" as const,
    tone: "Energetic" as const,
    ctaEnabled: true,
  },
  onScreenText: {
    enabled: true,
    textStyle: "animated_effects" as const,
    textPosition: "lower_third" as const,
    alignBrand: true,
  },
};
