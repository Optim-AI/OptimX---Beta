import type { CampaignDurationSeconds } from "./campaign-duration";
import type { StoredAssetRef } from "../assets";
import type { AdConcept, CampaignGoal, CreativeStrategy, HookType } from "../../strategy-types";
import type { SpokenLanguageStyle } from "../audio/spoken-language-style";
import type { VoiceoverLanguage } from "../audio/voiceover-languages";

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
  /**
   * Physical handling facts read from the product photo (container, closure,
   * how it opens). Filled server-side by product understanding.
   */
  handling?: string;
}

export interface CampaignApprovedConcept {
  title: string;
  /** The idea in plain words. */
  idea: string;
  /** Story moments in order. */
  beats: string[];
}

export interface CampaignEndCardInput {
  enabled: boolean;
  /** e.g. "Buy 2, get 1 free" */
  offer?: string;
  /** Defaults to the voiceover CTA. */
  cta?: string;
  /** Phone, WhatsApp number or website. */
  contact?: string;
}

/**
 * Voiceover routing for the commercial.
 * English → Seedance native spoken audio.
 * Tamil / Hindi / Malayalam / Kannada → silent Seedance + Gemini 3.8 Flash TTS.
 */
export interface CampaignVoiceoverInput {
  enabled?: boolean;
  language?: VoiceoverLanguage;
  /**
   * Spoken register for Gemini TTS script generation.
   * Not exposed in UI yet. Tamil defaults to natural_spoken.
   */
  spokenLanguageStyle?: SpokenLanguageStyle;
  tone?: string;
  keyMessage?: string;
  cta?: string;
  /** When false, VO script omits a hard CTA. Default true. */
  ctaEnabled?: boolean;
  /** Optional pre-written script (preferred when already in target language). */
  script?: string;
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
  /** Voiceover language + CTA routing for Seedance vs Gemini TTS. */
  voiceover?: CampaignVoiceoverInput;
  /** Brand end card burned on in post (offer, CTA, contact, logo). Off when omitted. */
  endCard?: CampaignEndCardInput;
  /** What the ad sells (product, combo, brand, shop, festival…). Default: product. */
  adType?: import("./ad-type").AdTypeId;
  /** Other products in a multi-product / combo ad (primary stays in `product`). */
  additionalProducts?: CampaignProductInput[];
  /** Festival or occasion for festival ads (e.g. "Diwali"). */
  occasion?: string;
  /** Location / services for shop or service ads. */
  shopDetails?: string;
  /** Owner's tap-only answers: who is on screen, where, the feeling, what viewers should do. */
  adDirection?: import("./ad-direction").AdDirection;
  /**
   * Concept the user picked from the idea cards. The director must build on it
   * instead of choosing its own direction.
   */
  approvedConcept?: CampaignApprovedConcept;
  /** User-chosen visual style (Studio "Creative format"). Default: commercial. */
  creativeStyle?: import("./creative-style").CreativeStyleId;
}
