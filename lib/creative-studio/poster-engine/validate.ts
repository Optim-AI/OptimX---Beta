/**
 * Lightweight pre-generation validation for PosterCreativeSpec.
 * No recursive QC, no diversity engines, no scoring loops.
 */

import {
  CREATIVE_MECHANISMS,
  PRODUCT_ROLES,
  type PosterCreativeSpec,
  type CreativeMechanism,
  type ProductRole,
} from "./types";

const GENERIC_COPY = [
  "experience the difference",
  "elevate your lifestyle",
  "made for you",
  "your everyday essential",
  "shop now",
  "discover more",
  "premium quality",
  "unlock your potential",
];

const THEME_TEMPLATE_PHRASES = [
  "product center",
  "headline top",
  "cta bottom",
  "dark background with gold",
  "centered product on gradient",
  "diagonal product",
  "decorations everywhere",
];

export function isValidMechanism(v: unknown): v is CreativeMechanism {
  return typeof v === "string" && (CREATIVE_MECHANISMS as readonly string[]).includes(v);
}

export function isValidProductRole(v: unknown): v is ProductRole {
  return typeof v === "string" && (PRODUCT_ROLES as readonly string[]).includes(v);
}

export function validateCreativeSpec(spec: PosterCreativeSpec): {
  ok: boolean;
  notes: string[];
} {
  const notes: string[] = [];

  if (!spec.concept?.trim() || spec.concept.length < 20) {
    notes.push("concept missing or too vague");
  }
  if (/promote the product|attractive product advertisement|beautiful background/i.test(spec.concept || "")) {
    notes.push("concept is generic marketing filler");
  }
  if (!spec.visualStory?.trim()) notes.push("visualStory missing");
  if (!spec.composition?.trim() || spec.composition.length < 30) {
    notes.push("composition missing or too short — need a natural description");
  }
  if (!isValidProductRole(spec.productRole)) notes.push("productRole invalid");
  if (!isValidMechanism(spec.mechanism)) notes.push("mechanism invalid");
  if (!spec.copy?.headline?.trim()) notes.push("headline missing");

  const copyBlob = [spec.copy?.headline, spec.copy?.supporting, spec.copy?.cta]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  for (const g of GENERIC_COPY) {
    if (copyBlob.includes(g) && copyBlob.split(/\s+/).length < 8) {
      notes.push(`copy looks generic ("${g}")`);
      break;
    }
  }

  const themeLower = (spec.themeExpression || "").toLowerCase();
  const compLower = (spec.composition || "").toLowerCase();
  for (const phrase of THEME_TEMPLATE_PHRASES) {
    if (themeLower.includes(phrase) || compLower.includes(phrase)) {
      notes.push("theme/composition may be acting as a layout template");
      break;
    }
  }

  return { ok: notes.length === 0, notes };
}

export function normalizeSpec(raw: any, fallbackTheme?: string | null): PosterCreativeSpec | null {
  if (!raw || typeof raw !== "object") return null;

  const mechanism = isValidMechanism(raw.mechanism)
    ? raw.mechanism
    : "PRODUCT_HERO";
  const productRole = isValidProductRole(raw.productRole)
    ? raw.productRole
    : "hero";

  const copy =
    raw.copy && typeof raw.copy === "object"
      ? {
          headline: String(raw.copy.headline || "").trim() || "Untitled",
          supporting: raw.copy.supporting
            ? String(raw.copy.supporting).trim()
            : null,
          cta: raw.copy.cta ? String(raw.copy.cta).trim() : null,
        }
      : {
          headline: String(raw.headline || "").trim() || "Untitled",
          supporting: null,
          cta: null,
        };

  const concept = String(raw.concept || "").trim();
  if (!concept) return null;

  return {
    concept,
    mechanism,
    message: String(raw.message || concept).trim(),
    visualStory: String(raw.visualStory || "").trim() || concept,
    composition:
      String(raw.composition || "").trim() ||
      "Compose the scene naturally around the advertising idea with clear hierarchy and breathing room for type.",
    productRole,
    typography:
      String(raw.typography || "").trim() ||
      "Typographic hierarchy that serves the concept — not a default headline/sub/CTA stack.",
    graphicLanguage:
      String(raw.graphicLanguage || "").trim() ||
      "Only purposeful graphics that reinforce the idea.",
    imageTreatment:
      String(raw.imageTreatment || "").trim() ||
      "Art-directed lighting and materials matching the concept.",
    copy,
    themeExpression:
      String(raw.themeExpression || "").trim() ||
      (fallbackTheme
        ? `Express the "${fallbackTheme}" theme as art direction only — not as a layout template.`
        : "Theme is art direction only."),
    brandIntegration:
      String(raw.brandIntegration || "").trim() ||
      "Integrate brand identity intelligently — colors and logo where they belong, not forced fills.",
    referenceInfluence:
      String(raw.referenceInfluence || "").trim() ||
      "No reference poster — original design.",
    variantLabel: raw.variantLabel ? String(raw.variantLabel).trim() : undefined,
  };
}
