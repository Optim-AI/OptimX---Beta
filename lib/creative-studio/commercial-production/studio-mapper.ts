/**
 * Map Brand Studio / Commercial Studio UI state → CampaignBrief.
 * Phase 9 — frontend integration. Does not call providers.
 */

import type { CampaignBrief, CommercialAspectRatio, CommercialPlatform } from "./campaign/types";
import {
  isCampaignDurationSeconds,
  type CampaignDurationSeconds,
} from "./campaign/campaign-duration";
import type { StoredAssetRef } from "./assets";
import type { AvailableCampaignAssets } from "./reference-engine/types";

/** Minimal UI shape — avoids importing React UI modules into the production lib. */
export interface StudioFormProduct {
  product_name: string;
  brand_name?: string;
  product_images?: string[];
  hero_image?: string | null;
  brand_logo?: string | null;
  category?: string;
  product_url?: string;
}

export interface StudioFormAdSetup {
  duration: number;
  aspect_ratio: string;
  platform?: string;
  campaignGoal?: string;
  hookType?: string;
  audience?: string;
  creativeFormat?: string;
}

export interface StudioFormBrand {
  name?: string;
  description?: string;
  audience?: string;
  tone?: string;
  personality?: string;
  brandVoice?: string;
  logo?: string;
  logoUrl?: string;
  primaryColors?: string[];
  website_url?: string;
  tagline?: string;
  offering?: string;
}

export interface StudioFormInput {
  campaignId: string;
  userId?: string;
  product: StudioFormProduct;
  adSetup: StudioFormAdSetup;
  brand?: StudioFormBrand | null;
  /** Creative Direction textarea */
  userDescription?: string;
  voiceoverCta?: string;
  voiceoverKeyMessage?: string;
  offer?: string;
  creativeStrategy?: CampaignBrief["creativeStrategy"];
  selectedConcept?: CampaignBrief["selectedConcept"];
  /** Extra stills that are NOT the canonical product (optional). */
  creativeReferenceUrls?: string[];
}

export interface StudioNativeRequestInvariant {
  campaignDuration: CampaignDurationSeconds;
  generationMode: "native_continuous";
  model: "seedance2_5";
  providerSubmissionsExpected: 1;
}

function mapPlatform(platform?: string, aspect?: string): CommercialPlatform {
  switch (platform) {
    case "YouTube Shorts":
      return "youtube_shorts";
    case "Instagram Feed":
      return "instagram_feed";
    case "YouTube Ad":
      return "youtube_ad";
    case "Instagram Reels / TikTok":
    default:
      if (aspect === "16:9") return "youtube_ad";
      return "instagram_reels";
  }
}

function mapAspectRatio(aspect: string): CommercialAspectRatio {
  const allowed: CommercialAspectRatio[] = [
    "9:16",
    "16:9",
    "1:1",
    "4:5",
    "4:3",
    "3:4",
  ];
  if ((allowed as string[]).includes(aspect)) {
    return aspect as CommercialAspectRatio;
  }
  return "9:16";
}

function urlToAsset(
  url: string,
  id: string,
  kind: StoredAssetRef["kind"]
): StoredAssetRef | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (
    !trimmed.startsWith("http") &&
    !trimmed.startsWith("data:") &&
    !trimmed.startsWith("/")
  ) {
    return null;
  }
  const mimeType = trimmed.startsWith("data:")
    ? trimmed.slice(5, trimmed.indexOf(";")) || "image/jpeg"
    : "image/jpeg";
  return { id, kind, url: trimmed, mimeType };
}

/**
 * Canonical product image: hero first, else first product_images entry.
 */
export function resolveCanonicalProductImage(
  product: StudioFormProduct
): string | null {
  if (product.hero_image?.trim()) return product.hero_image.trim();
  const first = product.product_images?.find((u) => u?.trim());
  return first?.trim() || null;
}

/**
 * Hard frontend invariant: selected duration must equal the brief duration
 * and imply exactly ONE native continuous generation.
 */
export function assertNativeDurationInvariant(
  selectedDuration: number,
  briefDuration: number
): StudioNativeRequestInvariant {
  if (!isCampaignDurationSeconds(selectedDuration)) {
    throw new Error(`Invalid campaign duration: ${selectedDuration}. Use 15 or 30.`);
  }
  if (selectedDuration !== briefDuration) {
    throw new Error(
      `Duration mismatch: UI selected ${selectedDuration}s but brief has ${briefDuration}s`
    );
  }
  return {
    campaignDuration: selectedDuration,
    generationMode: "native_continuous",
    model: "seedance2_5",
    providerSubmissionsExpected: 1,
  };
}

/**
 * Map Commercial Studio form state → CampaignBrief for POST /api/commercial/generate.
 */
export function mapStudioFormToCampaignBrief(input: StudioFormInput): CampaignBrief {
  if (!input.campaignId?.trim()) {
    throw new Error("campaignId is required");
  }
  if (!input.product?.product_name?.trim()) {
    throw new Error("Product name is required");
  }
  if (!isCampaignDurationSeconds(input.adSetup.duration)) {
    throw new Error("Duration must be 15 or 30 seconds");
  }

  const duration = input.adSetup.duration;
  const aspectRatio = mapAspectRatio(input.adSetup.aspect_ratio || "9:16");

  assertNativeDurationInvariant(duration, duration);

  const canonical = resolveCanonicalProductImage(input.product);
  const productImages: StoredAssetRef[] = [];
  if (canonical) {
    const asset = urlToAsset(canonical, "product-canonical", "product_image");
    if (asset) productImages.push(asset);
  }
  // Only the selected/canonical product still — not the full gallery.

  const brandLogo =
    input.brand?.logo ||
    input.brand?.logoUrl ||
    input.product.brand_logo ||
    undefined;
  const logoAsset = brandLogo
    ? urlToAsset(brandLogo, "brand-logo", "brand_logo")
    : null;

  const creativeReferences = (input.creativeReferenceUrls || [])
    .map((url, i) => urlToAsset(url, `creative-ref-${i + 1}`, "creative_reference"))
    .filter((a): a is StoredAssetRef => Boolean(a));

  const brandName =
    input.brand?.name?.trim() ||
    input.product.brand_name?.trim() ||
    "Brand";

  const brief: CampaignBrief = {
    campaignId: input.campaignId,
    userId: input.userId,
    brand: {
      name: brandName,
      personality: input.brand?.personality,
      tone: input.brand?.tone || input.brand?.brandVoice,
      voice: input.brand?.brandVoice,
      logo: logoAsset || undefined,
      primaryColors: input.brand?.primaryColors,
      websiteUrl: input.brand?.website_url,
      tagline: input.brand?.tagline,
      visualPreferences: input.brand?.description,
    },
    product: {
      name: input.product.product_name.trim(),
      description: input.userDescription?.trim() || undefined,
      category: input.product.category,
      images: productImages,
      offer: input.offer || input.voiceoverKeyMessage,
    },
    targetAudience:
      input.adSetup.audience && input.adSetup.audience !== "Auto"
        ? input.adSetup.audience
        : input.brand?.audience,
    marketingObjective: input.adSetup.campaignGoal || "Drive Sales",
    campaignMessage:
      input.voiceoverKeyMessage ||
      input.userDescription?.trim() ||
      undefined,
    offer: input.offer || input.voiceoverCta,
    platform: mapPlatform(input.adSetup.platform, aspectRatio),
    aspectRatio,
    campaignDuration: duration,
    creativeReferences: creativeReferences.length ? creativeReferences : undefined,
    userConcept: input.userDescription?.trim() || undefined,
    hookType:
      input.adSetup.hookType && input.adSetup.hookType !== "Auto"
        ? input.adSetup.hookType
        : undefined,
    creativeStrategy: input.creativeStrategy,
    selectedConcept: input.selectedConcept,
  };

  return brief;
}

/**
 * Build AvailableCampaignAssets from the selected/canonical product image only.
 * Gallery thumbnails that are not selected must not be sent to Runway.
 */
export function buildStudioAvailableAssets(
  product: StudioFormProduct
): AvailableCampaignAssets {
  const images: StoredAssetRef[] = [];
  const canonical = resolveCanonicalProductImage(product);
  if (canonical) {
    const a = urlToAsset(canonical, "product-canonical", "product_image");
    if (a) images.push(a);
  }
  const logo = product.brand_logo
    ? urlToAsset(product.brand_logo, "brand-logo", "brand_logo")
    : null;
  return {
    productImages: images,
    brandLogo: logo || undefined,
  };
}

/** Frontend-safe creative plan summary (no raw blueprint JSON). */
export interface CreativePlanSummary {
  conceptTitle: string;
  conceptPitch: string;
  visualDirection: string;
  storyBeats: Array<{ index: number; label: string; intent: string }>;
}

export function buildCreativePlanSummary(blueprint: {
  selectedConcept?: { title?: string; oneLinePitch?: string; coreIdea?: string };
  visualTreatment?: { visualStyle?: string; lighting?: string; environment?: string };
  visualBeats?: Array<{ zone?: string; purpose?: string; intent?: string }>;
}): CreativePlanSummary {
  const concept = blueprint.selectedConcept || {};
  const treatment = blueprint.visualTreatment || {};
  const beats = (blueprint.visualBeats || []).map((b, i) => ({
    index: i + 1,
    label: (b.zone || b.purpose || `Beat ${i + 1}`).replace(/_/g, " "),
    intent: b.intent || b.purpose || "",
  }));
  return {
    conceptTitle: concept.title || "Creative concept",
    conceptPitch: concept.oneLinePitch || concept.coreIdea || "",
    visualDirection: [treatment.visualStyle, treatment.lighting, treatment.environment]
      .filter(Boolean)
      .join(" — "),
    storyBeats: beats,
  };
}
