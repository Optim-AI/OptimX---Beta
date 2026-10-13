/**
 * First-release Meta Ads draft contract (PR W2.2).
 *
 * Narrow enums the wizard may offer and the API will accept.
 * Unsupported values are rejected — do not silently persist arbitrary JSON.
 * Local drafts are never Meta campaigns.
 */

export const META_ADS_DRAFT_OBJECTIVES = [
  "OUTCOME_AWARENESS",
  "OUTCOME_TRAFFIC",
  "OUTCOME_ENGAGEMENT",
] as const;

export type MetaAdsDraftObjective = (typeof META_ADS_DRAFT_OBJECTIVES)[number];

export const META_ADS_DRAFT_OBJECTIVE_LABELS: Record<
  MetaAdsDraftObjective,
  { title: string; description: string }
> = {
  OUTCOME_AWARENESS: {
    title: "Awareness",
    description: "Reach people likely to remember your brand.",
  },
  OUTCOME_TRAFFIC: {
    title: "Traffic",
    description: "Send people to a destination URL.",
  },
  OUTCOME_ENGAGEMENT: {
    title: "Engagement",
    description: "Get more post interactions and engagement.",
  },
};

export const META_ADS_DRAFT_CTAS = [
  "LEARN_MORE",
  "SHOP_NOW",
  "SIGN_UP",
  "CONTACT_US",
  "GET_QUOTE",
] as const;

export type MetaAdsDraftCta = (typeof META_ADS_DRAFT_CTAS)[number];

export const META_ADS_DRAFT_CTA_LABELS: Record<MetaAdsDraftCta, string> = {
  LEARN_MORE: "Learn more",
  SHOP_NOW: "Shop now",
  SIGN_UP: "Sign up",
  CONTACT_US: "Contact us",
  GET_QUOTE: "Get quote",
};

/** Curated ISO country codes for first-release geo targeting. */
export const META_ADS_DRAFT_COUNTRIES = [
  "US",
  "IN",
  "GB",
  "CA",
  "AU",
  "AE",
  "SG",
  "DE",
  "FR",
  "BR",
] as const;

export type MetaAdsDraftCountry = (typeof META_ADS_DRAFT_COUNTRIES)[number];

export const META_ADS_DRAFT_COUNTRY_LABELS: Record<MetaAdsDraftCountry, string> =
  {
    US: "United States",
    IN: "India",
    GB: "United Kingdom",
    CA: "Canada",
    AU: "Australia",
    AE: "United Arab Emirates",
    SG: "Singapore",
    DE: "Germany",
    FR: "France",
    BR: "Brazil",
  };

export type MetaAdsDraftPlacements =
  | { mode: "automatic" }
  | { mode: "manual"; positions: ["facebook_feed"] };

export type MetaAdsDraftTargeting = {
  geoCountries: MetaAdsDraftCountry[];
  ageMin: number;
  ageMax: number;
};

export function isMetaAdsDraftObjective(
  v: unknown
): v is MetaAdsDraftObjective {
  return (
    typeof v === "string" &&
    (META_ADS_DRAFT_OBJECTIVES as readonly string[]).includes(v)
  );
}

export function isMetaAdsDraftCta(v: unknown): v is MetaAdsDraftCta {
  return (
    typeof v === "string" &&
    (META_ADS_DRAFT_CTAS as readonly string[]).includes(v)
  );
}

export function isMetaAdsDraftCountry(v: unknown): v is MetaAdsDraftCountry {
  return (
    typeof v === "string" &&
    (META_ADS_DRAFT_COUNTRIES as readonly string[]).includes(v)
  );
}

/** Public HTTPS URL suitable for future Meta creative / destination. */
export function isPublicHttpsUrl(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseMetaAdsDraftPlacements(
  raw: unknown
): MetaAdsDraftPlacements | null {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.mode === "automatic") {
    return { mode: "automatic" };
  }
  if (
    o.mode === "manual" &&
    Array.isArray(o.positions) &&
    o.positions.length === 1 &&
    o.positions[0] === "facebook_feed"
  ) {
    return { mode: "manual", positions: ["facebook_feed"] };
  }
  return null;
}

export function parseMetaAdsDraftTargeting(
  raw: unknown
): MetaAdsDraftTargeting | null {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.geoCountries) || o.geoCountries.length === 0) return null;
  if (!o.geoCountries.every(isMetaAdsDraftCountry)) return null;
  const ageMin = Number(o.ageMin);
  const ageMax = Number(o.ageMax);
  if (!Number.isInteger(ageMin) || !Number.isInteger(ageMax)) return null;
  if (ageMin < 18 || ageMax > 65 || ageMin > ageMax) return null;
  return {
    geoCountries: o.geoCountries as MetaAdsDraftCountry[],
    ageMin,
    ageMax,
  };
}

export type MetaAdsDraftStatusUi =
  | "draft"
  | "validating"
  | "creating"
  | "created_paused"
  | "partial_failure"
  | "failed"
  | "archived";

/**
 * Explicit labels that never imply the draft is a live Meta campaign
 * unless status is created_paused with Meta ids (W2.3+).
 */
export function metaAdsDraftStatusLabel(
  status: string,
  opts?: { onMeta?: boolean; metaCampaignId?: string | null }
): string {
  if (status === "archived") return "Archived";
  if (status === "failed") return "Failed — needs attention";
  if (status === "created_paused" && (opts?.onMeta || opts?.metaCampaignId)) {
    return "Created on Meta (paused)";
  }
  if (status === "creating") return "Creating on Meta…";
  if (status === "partial_failure") return "Partial failure — needs attention";
  if (status === "validating") return "Validating";
  return "Draft — not on Meta";
}

export function defaultMetaAdsDraftTargeting(): MetaAdsDraftTargeting {
  return { geoCountries: ["US"], ageMin: 18, ageMax: 65 };
}

export function defaultMetaAdsDraftPlacements(): MetaAdsDraftPlacements {
  return { mode: "automatic" };
}
