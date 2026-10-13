/**
 * First-release Traffic-only Marketing API field mapping (PR W2.5).
 *
 * Evidence labels:
 * - Code fact: SkalX draft fields / budget helpers / Page id from write context.
 * - Secondary sources (official developers.facebook.com often 403 here):
 *   OUTCOME_TRAFFIC + PAUSED campaign; special_ad_categories required;
 *   ad set optimization_goal LINK_CLICKS + billing_event IMPRESSIONS;
 *   Page-backed link_data creative with image_hash.
 * - Unverified on staging: exact enum acceptance, budget account minimums,
 *   placement publisher_platforms shape, NONE vs [] for special categories.
 *
 * Awareness / Engagement creation is intentionally rejected.
 */

import { majorToMetaBudgetMinor } from "@/lib/ads/providers/meta/budget";
import {
  isMetaAdsDraftCta,
  parseMetaAdsDraftPlacements,
  parseMetaAdsDraftTargeting,
  type MetaAdsDraftCta,
  type MetaAdsDraftPlacements,
  type MetaAdsDraftTargeting,
} from "@/lib/ads/meta/draft-contract";
import { isPublicHttpsUrl } from "@/lib/ads/meta/draft-contract";

/** Only Traffic is supported for create-paused in W2.5. */
export const META_ADS_CREATE_PAUSED_OBJECTIVE = "OUTCOME_TRAFFIC" as const;

/**
 * First-release product policy: non-special-ad-category campaigns only.
 * Secondary sources accept [] or ["NONE"]; we send [].
 * Non-empty draft overrides are rejected (not silently coerced).
 */
export const META_ADS_CREATE_PAUSED_SPECIAL_AD_CATEGORIES: readonly string[] =
  [];

export type MetaAdsCreatePausedMapErrorCode =
  | "unsupported_objective"
  | "missing_name"
  | "missing_budget"
  | "invalid_budget"
  | "missing_targeting"
  | "missing_placements"
  | "missing_destination"
  | "invalid_destination"
  | "missing_cta"
  | "invalid_cta"
  | "missing_primary_text"
  | "missing_headline"
  | "missing_page_id"
  | "missing_image_hash"
  | "unsupported_special_ad_categories"
  | "currency_mismatch"
  | "invalid_schedule";

export class MetaAdsCreatePausedMapError extends Error {
  readonly code: MetaAdsCreatePausedMapErrorCode;

  constructor(code: MetaAdsCreatePausedMapErrorCode, message: string) {
    super(message);
    this.name = "MetaAdsCreatePausedMapError";
    this.code = code;
  }
}

export type MetaAdsCreatePausedDraftFields = {
  name: string | null;
  objective: string | null;
  dailyBudgetMajor: string | number | null;
  currency: string;
  /** Write-context account currency — must match draft.currency. */
  accountCurrency: string;
  targeting: unknown;
  placements: unknown;
  destinationUrl: string | null;
  callToAction: string | null;
  primaryText: string | null;
  headline: string | null;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  /** Optional draft metadata.specialAdCategories — only [] allowed. */
  specialAdCategories?: unknown;
};

export type MetaTrafficCampaignParams = {
  name: string;
  objective: typeof META_ADS_CREATE_PAUSED_OBJECTIVE;
  status: "PAUSED";
  special_ad_categories: string; // JSON array string for form-urlencoded POST
  buying_type: "AUCTION";
};

export type MetaTrafficAdSetParams = {
  name: string;
  campaign_id: string;
  status: "PAUSED";
  daily_budget: number;
  billing_event: "IMPRESSIONS";
  optimization_goal: "LINK_CLICKS";
  bid_strategy: "LOWEST_COST_WITHOUT_CAP";
  targeting: string; // JSON
  start_time?: string;
  end_time?: string;
};

export type MetaTrafficCreativeParams = {
  name: string;
  object_story_spec: string; // JSON
};

export type MetaTrafficAdParams = {
  name: string;
  adset_id: string;
  creative: string; // JSON { creative_id }
  status: "PAUSED";
};

function requireNonEmpty(value: string | null | undefined, code: MetaAdsCreatePausedMapErrorCode, msg: string): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) throw new MetaAdsCreatePausedMapError(code, msg);
  return v;
}

function resolveSpecialAdCategories(raw: unknown): string[] {
  if (raw === undefined || raw === null) {
    return [...META_ADS_CREATE_PAUSED_SPECIAL_AD_CATEGORIES];
  }
  if (!Array.isArray(raw)) {
    throw new MetaAdsCreatePausedMapError(
      "unsupported_special_ad_categories",
      "special_ad_categories must be an array. First release supports only []."
    );
  }
  if (raw.length === 0) return [];
  // Allow explicit ["NONE"] as equivalent empty declaration (secondary sources).
  if (
    raw.length === 1 &&
    typeof raw[0] === "string" &&
    raw[0].toUpperCase() === "NONE"
  ) {
    return [];
  }
  throw new MetaAdsCreatePausedMapError(
    "unsupported_special_ad_categories",
    "First-release create-paused only supports non-special ad categories ([]). Regulated categories are not supported."
  );
}

/**
 * Map SkalX placements to Meta targeting publisher fields.
 * Automatic → omit platform restrictions (Meta automatic placements).
 * facebook_feed → publisher_platforms facebook + facebook_positions feed.
 *
 * Unverified: exact Advantage+ / automatic placement field expectations on staging.
 */
export function mapPlacementsToMetaTargetingExtras(
  placements: MetaAdsDraftPlacements
): Record<string, unknown> {
  if (placements.mode === "automatic") {
    return {};
  }
  return {
    publisher_platforms: ["facebook"],
    facebook_positions: ["feed"],
  };
}

export function mapTargetingToMeta(
  targeting: MetaAdsDraftTargeting,
  placements: MetaAdsDraftPlacements
): Record<string, unknown> {
  return {
    geo_locations: {
      countries: [...targeting.geoCountries],
    },
    age_min: targeting.ageMin,
    age_max: targeting.ageMax,
    ...mapPlacementsToMetaTargetingExtras(placements),
  };
}

export function assertTrafficCreatePausedDraft(
  draft: MetaAdsCreatePausedDraftFields
): {
  name: string;
  targeting: MetaAdsDraftTargeting;
  placements: MetaAdsDraftPlacements;
  destinationUrl: string;
  callToAction: MetaAdsDraftCta;
  primaryText: string;
  headline: string;
  dailyBudgetMinor: number;
  specialAdCategories: string[];
  scheduleStart: string | null;
  scheduleEnd: string | null;
} {
  const objective = (draft.objective || "").trim();
  if (objective !== META_ADS_CREATE_PAUSED_OBJECTIVE) {
    throw new MetaAdsCreatePausedMapError(
      "unsupported_objective",
      `Create-paused supports only ${META_ADS_CREATE_PAUSED_OBJECTIVE}. Awareness and Engagement are not enabled.`
    );
  }

  if (
    String(draft.currency || "").toUpperCase() !==
    String(draft.accountCurrency || "").toUpperCase()
  ) {
    throw new MetaAdsCreatePausedMapError(
      "currency_mismatch",
      "Draft currency does not match the selected ad account currency."
    );
  }

  const name = requireNonEmpty(
    draft.name,
    "missing_name",
    "Campaign name is required before create-paused."
  );

  if (draft.dailyBudgetMajor == null || draft.dailyBudgetMajor === "") {
    throw new MetaAdsCreatePausedMapError(
      "missing_budget",
      "Daily budget is required before create-paused. Account minimums are not invented locally — Meta may still reject below-min budgets."
    );
  }

  let dailyBudgetMinor: number;
  try {
    dailyBudgetMinor = majorToMetaBudgetMinor(
      draft.dailyBudgetMajor,
      draft.accountCurrency
    );
  } catch (e) {
    throw new MetaAdsCreatePausedMapError(
      "invalid_budget",
      e instanceof Error ? e.message : "Invalid daily budget."
    );
  }

  const targeting = parseMetaAdsDraftTargeting(draft.targeting);
  if (!targeting) {
    throw new MetaAdsCreatePausedMapError(
      "missing_targeting",
      "First-release targeting (countries + age range) is required."
    );
  }

  const placements = parseMetaAdsDraftPlacements(draft.placements);
  if (!placements) {
    throw new MetaAdsCreatePausedMapError(
      "missing_placements",
      "Placements must be automatic or Facebook Feed only."
    );
  }

  const destinationUrl = requireNonEmpty(
    draft.destinationUrl,
    "missing_destination",
    "Destination URL is required."
  );
  if (!isPublicHttpsUrl(destinationUrl)) {
    throw new MetaAdsCreatePausedMapError(
      "invalid_destination",
      "Destination URL must be public https://."
    );
  }

  const ctaRaw = requireNonEmpty(
    draft.callToAction,
    "missing_cta",
    "Call to action is required."
  );
  if (!isMetaAdsDraftCta(ctaRaw)) {
    throw new MetaAdsCreatePausedMapError(
      "invalid_cta",
      "Call to action is not in the first-release allowlist."
    );
  }

  const primaryText = requireNonEmpty(
    draft.primaryText,
    "missing_primary_text",
    "Primary text is required."
  );
  const headline = requireNonEmpty(
    draft.headline,
    "missing_headline",
    "Headline is required."
  );

  const specialAdCategories = resolveSpecialAdCategories(
    draft.specialAdCategories
  );

  const start =
    draft.scheduleStart && String(draft.scheduleStart).trim()
      ? String(draft.scheduleStart).trim()
      : null;
  const end =
    draft.scheduleEnd && String(draft.scheduleEnd).trim()
      ? String(draft.scheduleEnd).trim()
      : null;
  if (start && Number.isNaN(Date.parse(start))) {
    throw new MetaAdsCreatePausedMapError(
      "invalid_schedule",
      "Schedule start is invalid."
    );
  }
  if (end && Number.isNaN(Date.parse(end))) {
    throw new MetaAdsCreatePausedMapError(
      "invalid_schedule",
      "Schedule end is invalid."
    );
  }
  if (start && end && Date.parse(end) < Date.parse(start)) {
    throw new MetaAdsCreatePausedMapError(
      "invalid_schedule",
      "Schedule end must be on or after start."
    );
  }

  return {
    name,
    targeting,
    placements,
    destinationUrl,
    callToAction: ctaRaw,
    primaryText,
    headline,
    dailyBudgetMinor,
    specialAdCategories,
    scheduleStart: start,
    scheduleEnd: end,
  };
}

export function buildTrafficCampaignParams(
  mapped: ReturnType<typeof assertTrafficCreatePausedDraft>
): MetaTrafficCampaignParams {
  return {
    name: mapped.name,
    objective: META_ADS_CREATE_PAUSED_OBJECTIVE,
    status: "PAUSED",
    special_ad_categories: JSON.stringify(mapped.specialAdCategories),
    buying_type: "AUCTION",
  };
}

export function buildTrafficAdSetParams(
  mapped: ReturnType<typeof assertTrafficCreatePausedDraft>,
  campaignId: string
): MetaTrafficAdSetParams {
  const targeting = mapTargetingToMeta(mapped.targeting, mapped.placements);
  const params: MetaTrafficAdSetParams = {
    name: `${mapped.name} — Ad set`,
    campaign_id: campaignId,
    status: "PAUSED",
    daily_budget: mapped.dailyBudgetMinor,
    billing_event: "IMPRESSIONS",
    optimization_goal: "LINK_CLICKS",
    // Secondary sources: common for traffic without bid cap. Unverified on staging.
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: JSON.stringify(targeting),
  };
  if (mapped.scheduleStart) params.start_time = mapped.scheduleStart;
  if (mapped.scheduleEnd) params.end_time = mapped.scheduleEnd;
  return params;
}

export function buildTrafficCreativeParams(opts: {
  name: string;
  pageId: string;
  destinationUrl: string;
  imageHash: string;
  primaryText: string;
  headline: string;
  callToAction: MetaAdsDraftCta;
}): MetaTrafficCreativeParams {
  const pageId = requireNonEmpty(
    opts.pageId,
    "missing_page_id",
    "Trusted Page id is required for Page-backed creatives."
  );
  const imageHash = requireNonEmpty(
    opts.imageHash,
    "missing_image_hash",
    "Meta image hash is required before creative creation."
  );
  const object_story_spec = {
    page_id: pageId,
    link_data: {
      link: opts.destinationUrl,
      message: opts.primaryText,
      name: opts.headline,
      image_hash: imageHash,
      call_to_action: {
        type: opts.callToAction,
        value: { link: opts.destinationUrl },
      },
    },
  };
  return {
    name: `${opts.name} — Creative`,
    object_story_spec: JSON.stringify(object_story_spec),
  };
}

export function buildTrafficAdParams(opts: {
  name: string;
  adsetId: string;
  creativeId: string;
}): MetaTrafficAdParams {
  return {
    name: `${opts.name} — Ad`,
    adset_id: opts.adsetId,
    creative: JSON.stringify({ creative_id: opts.creativeId }),
    status: "PAUSED",
  };
}
