// Brand Studio Shared Utilities
// Extracted from pages/creative-studio.tsx for modularity

import type { BrandSnapshot, PosterConfig, AdSetup, CreativeFormat, HookType } from './types';
import { authFetch } from '@/lib/utils';
import { normalizeCampaignDuration } from "@/lib/creative-studio/commercial-production/campaign/campaign-duration";
import {
  buildFallbackSpec,
} from "@/lib/creative-studio/poster-engine/fallback";
import { compilePosterPrompt } from "@/lib/creative-studio/poster-engine/compile";
import { normalizePosterInput } from "@/lib/creative-studio/poster-engine/normalize";

/** Save brand snapshot to DB via API */
export async function saveBrandSnapshot(snapshot: BrandSnapshot): Promise<void> {
  await authFetch("/api/brand/snapshot", {
    method: "PUT",
    body: JSON.stringify({ brandSnapshot: snapshot }),
  });
}

/** Map creative intelligence brand data to BrandSnapshot */
export function mapCreativeIntelligenceBrandToSnapshot(
  brand: any,
  brandUrl: string
): BrandSnapshot {
  const raw = brand?.rawAnalysis || {};
  let domain = "Brand";
  try {
    domain = new URL(brandUrl).hostname.replace("www.", "").split(".")[0];
    domain = domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    // ignore
  }
  const name = raw.product_name || domain;
  return {
    name,
    description: brand?.productSummary || raw.current_positioning_statement || "",
    audience: raw.primary_target_audience || brand?.targetPersonaGuess || "",
    offering: brand?.productSummary || raw.product_category || "",
    tone: raw.brand_tone || brand?.emotionalTone || "professional",
    logo: raw.logo,
    logoUrl: raw.logoUrl,
    primaryColors: raw.primaryColors || [],
    fontStyles: raw.fontStyles,
    coreValueProp: raw.core_value_prop,
    productCategory: raw.product_category,
    pricePositioning: raw.price_positioning,
  };
}

/** Map fullAnalyze API result to BrandSnapshot (Brand Kit format) */
export function mapFullAnalyzeToBrandSnapshot(result: any): BrandSnapshot {
  const primaryColors = result.primaryColors || [];
  const colorsObj = result.colors
    ? {
        primary: result.colors.primary ?? primaryColors[0],
        secondary: result.colors.secondary ?? primaryColors[1],
        accent: result.colors.accent ?? primaryColors[2],
        neutral: primaryColors[3] || result.colors.neutral,
      }
    : primaryColors.length
      ? {
          primary: primaryColors[0],
          secondary: primaryColors[1],
          accent: primaryColors[2],
          neutral: primaryColors[3],
        }
      : undefined;

  return {
    name: result.facts?.company_name || 'Unknown Brand',
    description: result.positioning?.primary_value_proposition || '',
    audience: Array.isArray(result.facts?.who_it_is_for)
      ? result.facts.who_it_is_for.join(', ')
      : (result.facts?.who_it_is_for as string) || '',
    offering: Array.isArray(result.facts?.what_they_sell)
      ? result.facts.what_they_sell.join(', ')
      : (result.facts?.what_they_sell as string) || '',
    tone: result.brandVoice || result.personality || 'professional',
    logo: result.logo,
    logoUrl: result.logoUrl,
    primaryColors,
    fontStyles: result.fontStyles,
    primaryFont: result.primaryFont,
    brandVoice: result.brandVoice,
    coreValueProp: result.coreValueProp,
    ctaPatterns: result.ctaPatterns,
    productCategory: result.productCategory,
    pricePositioning: result.pricePositioning,
    personality: result.personality,
    colors: colorsObj,
    tagline: result.tagline,
    brand_aesthetic: result.brand_aesthetic,
    brand_tone: result.brand_tone,
    brand_values: result.brand_values,
    business_overview: result.business_overview,
    website_url: result.website_url,
    productImages: Array.isArray(result.product_images)
      ? result.product_images
          .filter((u: unknown): u is string => typeof u === 'string' && u.length > 0)
          .slice(0, 6)
      : undefined,
  };
}

/**
 * Theme art-direction hints for UI labels.
 * Theme is an art-direction modifier — the Poster Engine decides composition.
 */
export const THEME_CONFIG: Record<string, {
  visualStyle: string;
  colorPalette: string;
  typography: string;
  composition: string;
  lighting: string;
  textures: string;
  negativeSpace: string;
}> = {
  minimal: {
    visualStyle: "Restrained, geometric calm, functional clarity — not a fixed Bauhaus template",
    colorPalette: "Limited palette (2-3 colors), high contrast when needed, quiet fields",
    typography: "Thin/clean sans-serif tendency, minimal text, generous letter spacing",
    composition: "Prefer fewer elements and large quiet regions — composition emerges from the idea, not a centered template",
    lighting: "Even soft or gentle directional light",
    textures: "Matte, smooth, untextured fields",
    negativeSpace: "Intentional emptiness as a design decision"
  },
  professional: {
    visualStyle: "Credible, structured, trustworthy — real-world clarity over spectacle",
    colorPalette: "Restrained trust-building tones; brand colors when provided",
    typography: "Clean sans-serif, clear hierarchy, highly legible",
    composition: "Readable hierarchy and organized visual zones — NOT a mandatory grid template or fixed logo/product slots",
    lighting: "Clean studio or neutral daylight",
    textures: "Clean materials, restrained surfaces",
    negativeSpace: "Organized breathing room for legibility"
  },
  commercial: {
    visualStyle: "Mass-market stop-power via a creative mechanism — NEVER black void + centered packshot + CTA",
    colorPalette: "High contrast and brand-led saturation when appropriate; retail visibility without forcing red/yellow defaults if brand differs; backgrounds from product world / lifestyle — not automatic black",
    typography: "Bold readable headline presence when the idea needs it — not mandatory uppercase badges",
    composition: "One scroll-stopping hero idea. Product participates in the idea. Composition may be scene-led, still-life-led, or asymmetric — NEVER force logo-top / headline-center / pack-bottom template",
    lighting: "Bright commercial or warm practical light that serves the idea",
    textures: "Category-true surfaces (food, pack sheen, home, etc.)",
    negativeSpace: "Controlled breathing room for hierarchy — not rigid section slots"
  },
  premium: {
    visualStyle: "Craft, rarity, refined desire — sculptural product presence; NOT generic black luxury",
    colorPalette: "Cream, stone, deep green, burgundy, navy, warm grey, soft white, or deep fields WHEN earned — never automatic black",
    typography: "Elegant refined letterforms; restraint over shouting",
    composition: "Elegance through restraint and negative space — not a classical centered template",
    lighting: "Soft directional or chiaroscuro as the idea requires",
    textures: "Fine materials — glass, stone, silk, craft packaging",
    negativeSpace: "Generous quiet as luxury"
  },
  bold: {
    visualStyle: "Graphic force, hard contrast, decisive cropping — typography as graphic element",
    colorPalette: "High-contrast blocking when it serves impact",
    typography: "Oversized type as shape when earned — not merely bold fonts on a packshot",
    composition: "Make one decision loudly; crop with intent — do not default to centered packshot",
    lighting: "Hard light / graphic shadow when useful",
    textures: "Flat graphic or strong material contrast",
    negativeSpace: "Strategic emptiness to amplify impact"
  },
  playful: {
    visualStyle: "Warmth, wit, kinetic joy — one playful idea, not sticker clutter",
    colorPalette: "Bright accents and friendly combinations",
    typography: "Rounded/friendly letterforms when on-brand",
    composition: "Unexpected scale or interaction — wit over decoration",
    lighting: "Soft colorful or sunny practical light",
    textures: "Tactile, friendly surfaces",
    negativeSpace: "Playful breathing room — not chaotic fill"
  },
  trendy: {
    visualStyle: "Contemporary editorial sharpness without trend pastiche",
    colorPalette: "Current accents guided by brand",
    typography: "Modern editorial type",
    composition: "Editorial off-center framing — avoid last-year aesthetic clichés and forced claymorphism",
    lighting: "Natural contemporary daylight or soft flash feel",
    textures: "Real modern environments",
    negativeSpace: "Fresh editorial breathing room"
  },
  festive: {
    visualStyle: "Celebration and gathering energy — occasion is the idea, not confetti fill",
    colorPalette: "Warm occasion-rich tones",
    typography: "Celebratory but readable",
    composition: "Ritual/gathering composition that fits the product — avoid generic party stock templates",
    lighting: "Warm festive practical light",
    textures: "Shared table / fabric / occasion materials",
    negativeSpace: "Keep hierarchy readable amid celebration"
  },
  dynamic: {
    visualStyle: "Momentum, kinetic tension, directional force",
    colorPalette: "Energetic brand-led palettes",
    typography: "Movement-oriented letterforms when useful",
    composition: "Eye travels along a force line; product can be mid-action or stillness in motion — avoid static shelf packshot default",
    lighting: "High-energy contrast or edge light",
    textures: "Active surfaces when relevant",
    negativeSpace: "Space that amplifies direction and speed"
  }
};

/**
 * Aspect-ratio format principles for UI / docs.
 * Composition is decided by the Poster Engine creative planner.
 */
export function getCompositionRules(ratio: "1:1" | "4:5" | "9:16" | "1.91:1"): string {
  const rules: Record<string, string> = {
    "1:1":
      "Square social format. Prefer compact, decisive compositions — centered OR asymmetric as the idea requires. Do NOT force a centered packshot template. Keep essential type away from extreme corners.",
    "4:5":
      "Portrait feed format. Vertical hierarchy is available, but placement is idea-driven — not a fixed top-60% / bottom-40% template. Co-design product, type, and CTA regions. Leave breathing room near edges.",
    "9:16":
      "Vertical story/Reels format. Design top-to-bottom flow for the idea. CRITICAL SAFE ZONES: keep essential copy/logo out of the top ~12% and bottom ~15% (UI chrome). Middle band carries the primary idea. Do NOT simply crop a square layout.",
    "1.91:1":
      "Wide landscape / banner format. Prefer cinematic or editorial horizontal flow. Do NOT simply letterbox a square composition. Keep top/bottom edges cleaner for overlays when needed.",
  };

  return rules[ratio] || rules["1:1"];
}

/**
 * Map brand attributes to the most appropriate poster theme.
 * Ensures posters complement the brand instead of defaulting to commercial.
 */
export function getThemeForBrand(
  brand: BrandSnapshot | null,
  angle?: { title?: string } | null
): string {
  // Ad angle override: clinical/science angles → professional
  if (angle?.title && /clinical|proven|science|lab|performance/i.test(angle.title)) {
    return "professional";
  }

  if (!brand) return "professional";

  const voice = (brand.brandVoice || "").toLowerCase();
  const tone = (brand.tone || brand.personality || "").toLowerCase();
  const industry = (brand.industry || brand.offering || "").toLowerCase();

  // 1. Brand voice (strongest signal)
  if (voice === "professional") return "professional";
  if (voice === "minimalist") return "minimal";
  if (voice === "playful") return "playful";
  if (voice === "bold") return "bold";

  // 2. Tone/personality
  if (/professional|corporate|trustworthy|formal|clean/i.test(tone)) return "professional";
  if (/minimal|clean|simple|modern|understated/i.test(tone)) return "minimal";
  if (/playful|fun|energetic|casual|friendly|youthful/i.test(tone)) return "playful";
  if (/premium|luxury|sophisticated|refined|elegant/i.test(tone)) return "premium";
  if (/bold|disruptive|confident|loud/i.test(tone)) return "bold";
  if (/trendy|modern|contemporary|fresh/i.test(tone)) return "trendy";
  if (/festive|celebratory|joyful/i.test(tone)) return "festive";
  if (/dynamic|energetic|sport/i.test(tone)) return "dynamic";

  // 3. Price positioning
  if (brand.pricePositioning === "premium") return "premium";

  // 4. Industry/offering
  if (/luxury|fashion|jewelry|premium|cosmetics|beauty/i.test(industry)) return "premium";
  if (/finance|b2b|corporate|saas|software|consulting/i.test(industry)) return "professional";
  if (/tech|startup|app/i.test(industry)) return "trendy";
  if (/sport|fitness|outdoor|active/i.test(industry)) return "dynamic";
  if (/kids|toys|children/i.test(industry)) return "playful";
  if (/food|beverage|fmcg|retail|consumer/i.test(industry)) return "commercial";

  // 5. Default: professional (softer than commercial)
  return "professional";
}

/**
 * Client emergency fallback when the Poster Engine plan API is unreachable.
 * Uses the SAME fallback compiler as the server — not a second creative architecture.
 */
export function buildPosterPrompt(options: {
  userRequest: string;
  theme: string;
  aspectRatio: "1:1" | "4:5" | "9:16" | "1.91:1";
  brand: BrandSnapshot | null;
  hasProductImage: boolean;
  variant?: number; // 1, 2, or 3 for generating variants
  productName?: string;
  productDescription?: string;
  productBenefits?: string[];
}): string {
  const input = normalizePosterInput({
    brandSnapshot: options.brand,
    userRequest: options.userRequest,
    theme: options.theme,
    aspectRatio: options.aspectRatio,
    variantCount: 1,
    hasProductImage: options.hasProductImage,
    product: options.productName
      ? {
          name: options.productName,
          description: options.productDescription,
          benefits: options.productBenefits,
        }
      : undefined,
  });
  const idx = Math.max(0, Math.min(2, (options.variant || 1) - 1));
  const spec = buildFallbackSpec(input, idx);
  return compilePosterPrompt(spec, input);
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}

/**
 * Convert File to data URL
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert data URL back to File
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  if (arr.length < 2 || !arr[1]) {
    throw new Error('Invalid data URL: expected "data:<mime>;base64,<data>" format');
  }
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Generate a unique ID for messages/sessions
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Default Ad Builder Data
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
  },
  onScreenText: {
    enabled: true,
    textStyle: "animated_effects" as const,
    textPosition: "lower_third" as const,
    alignBrand: true,
  },
};

/**
 * Default poster config
 */
export const DEFAULT_POSTER_CONFIG: PosterConfig = {
  theme: "",
  aspectRatio: "1:1",
  variantCount: 3, // Default to 3 variants
};

/** Base path for theme example images (served from public) */
export const THEME_IMAGES_BASE = "/images/posters/themes";

/**
 * Available poster themes — UI labels.
 * Theme flavors art direction inside the Poster Engine; it is not a layout template.
 */
export const POSTER_THEMES = [
  {
    id: "minimal",
    label: "Minimal",
    description: "Clean, simple, modern",
    note: "Visual language of restraint and clarity. SkalX invents a unique concept for your product — not a fixed white-space template.",
    previewStyle: "linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)",
    exampleImage: `${THEME_IMAGES_BASE}/theme-minimal.png`,
  },
  {
    id: "professional",
    label: "Professional",
    description: "Corporate, trustworthy",
    note: "Credibility and clarity as creative language. Composition is decided for your product — not a corporate grid template.",
    previewStyle: "linear-gradient(135deg, #1e3a5f 0%, #3b82f6 50%, #f8fafc 100%)",
    exampleImage: `${THEME_IMAGES_BASE}/theme-professional.png`,
  },
  {
    id: "commercial",
    label: "Commercial",
    description: "FMCG, retail-ready",
    note: "Mass-market impact and appetite as language. Same theme produces different ideas for different products — never a fixed packshot recipe.",
    previewStyle: "linear-gradient(135deg, #dc2626 0%, #f59e0b 50%, #fbbf24 100%)",
    exampleImage: `${THEME_IMAGES_BASE}/theme-commercial.png`,
  },
  {
    id: "premium",
    label: "Premium",
    description: "High-end, refined",
    note: "Craft and desire as language. Art direction adapts to your product — not a gold-gradient template.",
    previewStyle: "linear-gradient(135deg, #0f0f0f 0%, #8b7355 50%, #d4af37 100%)",
    exampleImage: `${THEME_IMAGES_BASE}/theme-premium.png`,
  },
  {
    id: "bold",
    label: "Bold",
    description: "Strong, impactful",
    note: "Graphic force and contrast as language. Cropping and hierarchy are concept-driven.",
    previewStyle: "linear-gradient(135deg, #000000 0%, #fbbf24 50%, #ef4444 100%)",
    exampleImage: `${THEME_IMAGES_BASE}/theme-bold.png`,
  },
  {
    id: "playful",
    label: "Playful",
    description: "Fun, energetic",
    note: "Wit and warmth as language — one playful idea, not sticker clutter.",
    previewStyle: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #06b6d4 100%)",
    exampleImage: `${THEME_IMAGES_BASE}/theme-playful.png`,
  },
  {
    id: "trendy",
    label: "Trendy",
    description: "Modern, contemporary",
    note: "Contemporary editorial language — interpreted for your product, not a trend pastiche.",
    previewStyle: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
    exampleImage: `${THEME_IMAGES_BASE}/theme-trendy.png`,
  },
  {
    id: "festive",
    label: "Festive",
    description: "Celebratory, joyful",
    note: "Occasion and gathering as language — not generic confetti templates.",
    previewStyle: "linear-gradient(135deg, #dc2626 0%, #f59e0b 50%, #fbbf24 100%)",
    exampleImage: `${THEME_IMAGES_BASE}/theme-festive.png`,
  },
  {
    id: "dynamic",
    label: "Dynamic",
    description: "Motion, energy",
    note: "Momentum and force as language — composition follows the idea's direction.",
    previewStyle: "linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)",
    exampleImage: `${THEME_IMAGES_BASE}/theme-dynamic.png`,
  },
];

/**
 * Available aspect ratios with visual dimensions for UI display
 * width/height used to render proportional shape preview
 */
export const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1", description: "Instagram feed, Facebook", width: 1, height: 1 },
  { id: "4:5", label: "4:5", description: "Instagram feed optimal", width: 4, height: 5 },
  { id: "9:16", label: "9:16", description: "Instagram/FB Stories, Reels", width: 9, height: 16 },
  { id: "1.91:1", label: "1.91:1", description: "Facebook/LinkedIn banner", width: 1.91, height: 1 },
] as const;

/**
 * Creative formats — visual execution (how the ad looks)
 */
export const CREATIVE_FORMATS = [
  "UGC",
  "Commercial",
  "Lifestyle",
  "Product Showcase",
  "Motion Graphics",
  "Cinematic",
] as const;

/**
 * Hook types — marketing mechanism (why people stop scrolling)
 */
export const HOOK_TYPES = [
  "Auto",
  "Curiosity Hook",
  "Before & After",
  "Social Proof",
  "Contrarian",
  "Problem Agitation",
  "Founder Story",
  "Testimonial",
  "Product Demonstration",
] as const;

export const CAMPAIGN_GOALS = [
  "Drive Sales",
  "Generate Leads",
  "Product Launch",
  "Build Awareness",
  "Retarget Visitors",
] as const;

export const AUDIENCE_TYPES = [
  "Auto",
  "Consumers",
  "Businesses",
  "Startup Founders",
  "Enterprise Teams",
  "Marketers",
] as const;

/** Map legacy visual style values to new creative formats */
const LEGACY_STYLE_TO_FORMAT: Record<string, CreativeFormat> = {
  Hook: "Commercial",
  "UGC Style": "UGC",
  "Product Close-up": "Product Showcase",
  Commercial: "Commercial",
  Lifestyle: "Lifestyle",
  Cinematic: "Cinematic",
  Luxury: "Cinematic",
  Minimalist: "Product Showcase",
  "Bold & Energetic": "Commercial",
  "2D Animation": "Motion Graphics",
  "Motion Graphics": "Motion Graphics",
  Retro: "Cinematic",
  UGC: "UGC",
  "Product Showcase": "Product Showcase",
};

/** Normalize ad setup from saved sessions (legacy `style` field) */
export function normalizeAdSetup(
  adSetup: Partial<AdSetup> & { style?: string }
): AdSetup {
  const legacyStyle = adSetup.style?.trim();
  const fromLegacy = legacyStyle ? LEGACY_STYLE_TO_FORMAT[legacyStyle] : undefined;
  const fromField =
    adSetup.creativeFormat &&
    (CREATIVE_FORMATS as readonly string[]).includes(adSetup.creativeFormat)
      ? adSetup.creativeFormat
      : undefined;
  const creativeFormat: CreativeFormat = fromField || fromLegacy || "Commercial";

  let hookType: HookType = adSetup.hookType || "Auto";
  if (legacyStyle === "Hook" && hookType === "Auto") {
    hookType = "Curiosity Hook";
  }

  return {
    creativeFormat,
    hookType,
    campaignGoal: adSetup.campaignGoal || "Drive Sales",
    audience: adSetup.audience || "Auto",
    duration: normalizeCampaignDuration(adSetup.duration),
    platform: adSetup.platform || "Instagram Reels / TikTok",
    aspect_ratio: adSetup.aspect_ratio || "9:16",
    quality: adSetup.quality,
  };
}

/** @deprecated Use CREATIVE_FORMATS */
export const VIDEO_STYLES = CREATIVE_FORMATS;

/**
 * Video durations
 */
export const VIDEO_DURATIONS = [15, 30] as const;

/**
 * Video platforms
 */
export const VIDEO_PLATFORMS = [
  "Instagram Reels / TikTok",
  "YouTube Shorts",
  "Instagram Feed",
  "YouTube Ad",
] as const;

/**
 * Video aspect ratios
 */
export const VIDEO_ASPECT_RATIOS = ["9:16", "1:1", "16:9", "4:5"] as const;

/**
 * On-screen text styles for video (kinetic, animated, captions, etc.)
 */
export const VIDEO_TEXT_STYLES = [
  { id: "kinetic", label: "Kinetic Typography", description: "Dynamic, moving text that adds energy" },
  { id: "animated_titles", label: "Animated Titles", description: "Typewriter, glitch, or bouncing" },
  { id: "subtitles_captions", label: "Subtitles / Captions", description: "Karaoke-style, accessibility-friendly" },
  { id: "specialized", label: "Specialized", description: "Meme-style, testimonial, or countdown" },
  { id: "animated_effects", label: "Animated Effects", description: "Fade-in, drop, or sliding" },
] as const;

/**
 * On-screen text positions (lower third recommended)
 */
export const VIDEO_TEXT_POSITIONS = [
  { id: "lower_third", label: "Lower Third", description: "Does not obstruct key visuals" },
  { id: "center", label: "Center", description: "Prominent, center screen" },
  { id: "top_third", label: "Top Third", description: "Upper area" },
  { id: "full_width", label: "Full Width", description: "Caption bar style" },
] as const;

/** Client: request Poster Engine creative plans + compiled prompts */
export type PosterDirectorVariantClient = {
  routeId: string;
  routeLabel: string;
  mechanism?: string;
  blueprint: Record<string, unknown> | null;
  spec?: Record<string, unknown> | null;
  prompt: string;
};

export async function fetchPosterCreativeDirectorVariants(options: {
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  userRequest: string;
  theme: string;
  aspectRatio: "1:1" | "4:5" | "9:16" | "1.91:1";
  brand: BrandSnapshot | null;
  variantCount: 1 | 2 | 3;
  hasProductImage: boolean;
  hasLogo: boolean;
  productName?: string;
  productDescription?: string;
  productBenefits?: string[];
  audience?: string;
  campaignObjective?: string;
  creativeBrief?: string;
  platform?: string;
  referencePosterAnalysis?: Record<string, unknown> | null;
  hasReferencePoster?: boolean;
  referenceInfluence?: "subtle" | "balanced" | "strong";
}): Promise<{
  usedDirector: boolean;
  usedFallback: boolean;
  selectedConcept: string | null;
  variants: PosterDirectorVariantClient[];
  prompts: string[];
}> {
  try {
    const res = await options.authFetch("/api/creative-studio/poster-creative-director", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userRequest: options.userRequest,
        theme: options.theme,
        aspectRatio: options.aspectRatio,
        brandSnapshot: options.brand,
        variantCount: options.variantCount,
        hasProductImage: options.hasProductImage,
        hasLogo: options.hasLogo,
        hasReferencePoster: !!options.hasReferencePoster || !!options.referencePosterAnalysis,
        referencePosterAnalysis: options.referencePosterAnalysis || null,
        referenceInfluence: options.referenceInfluence || "balanced",
        product: options.productName
          ? {
              name: options.productName,
              description: options.productDescription,
              benefits: options.productBenefits,
            }
          : undefined,
        audience: options.audience || options.brand?.audience,
        campaignObjective: options.campaignObjective,
        creativeBrief: options.creativeBrief,
        platform: options.platform,
      }),
    });
    const data = await res.json();
    if (data?.ok && Array.isArray(data.prompts) && data.prompts.length > 0) {
      return {
        usedDirector: true,
        usedFallback: !!data.usedFallback,
        selectedConcept: data.selectedConcept || null,
        variants: (data.variants || []).map((v: any) => ({
          routeId: v.routeId,
          routeLabel: v.routeLabel,
          mechanism: v.mechanism,
          blueprint: null,
          spec: v.spec || null,
          prompt: v.prompt,
        })),
        prompts: data.prompts,
      };
    }
  } catch (err) {
    console.warn("[posterEngine] client plan fetch failed — using engine fallback prompts", err);
  }
  return {
    usedDirector: false,
    usedFallback: false,
    selectedConcept: null,
    variants: [],
    prompts: [],
  };
}
