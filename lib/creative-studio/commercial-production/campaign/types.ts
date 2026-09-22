import type { CampaignDurationSeconds } from "./campaign-duration";
import type { StoredAssetRef } from "../assets";
import type { AdConcept, CampaignGoal, CreativeStrategy, HookType } from "../../strategy-types";

export type CommercialAspectRatio = "9:16" | "16:9" | "1:1" | "4:5" | "4:3" | "3:4";

export type CommercialPlatform =
  | "instagram_reels"
  | "tiktok"
  | "youtube_shorts"
  | "instagram_feed"
  | "youtube_ad"
  | "meta_feed"
  | "other";

export interface CampaignBrandInput {
  name: string;
  personality?: string;
  voice?: string;
  tone?: string;
  visualPreferences?: string;
  logo?: StoredAssetRef;
  primaryColors?: string[];
  websiteUrl?: string;
  tagline?: string;
}

export interface CampaignProductInput {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  images: StoredAssetRef[];
  offer?: string;
}

/**
 * Campaign Input — everything the Commercial Director reasons over.
 * Maps from Brand Studio / Creative Studio session fields without depending on UI types.
 */
export interface CampaignBrief {
  campaignId: string;
  userId?: string;
  brand: CampaignBrandInput;
  product: CampaignProductInput;
  targetAudience?: string;
  marketingObjective?: CampaignGoal | string;
  campaignMessage?: string;
  offer?: string;
  platform?: CommercialPlatform;
  aspectRatio: CommercialAspectRatio;
  campaignDuration: CampaignDurationSeconds;
  /** Optional user-provided creative reference (style frames, competitor ads). */
  creativeReferences?: StoredAssetRef[];
  /** Optional user-written concept. */
  userConcept?: string;
  hookType?: HookType | string;
  /** Existing performance strategy, if already generated. */
  creativeStrategy?: CreativeStrategy;
  selectedConcept?: AdConcept;
}
