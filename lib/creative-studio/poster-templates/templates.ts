/**
 * Phase 1 template library: Offer Hero, Product Hero Scene, Split Panel.
 * Boxes are fractions of the canvas (see CANVAS_SIZES for pixel sizes);
 * badge boxes are sized so they come out square in pixels.
 * 9:16 layouts keep text out of the top 14% and bottom 20% (Story/Reel UI).
 */

import type { AdFormatKind } from "../poster-generation/generation/ad-format";
import type { PosterAspectRatio } from "../poster-generation/types";
import type { PosterTemplate } from "./types";

const head = { fontRole: "heading", color: "text", lineHeight: 1.05, valign: "center" } as const;
const body = { fontRole: "body", color: "text", maxLines: 2, lineHeight: 1.3, valign: "top" } as const;
const ctaBase = { fontRole: "heading", color: "background", style: "solid", fill: "accent", maxLines: 1, valign: "center" } as const;

export const OFFER_HERO: PosterTemplate = {
  id: "offer-hero",
  version: 1,
  label: "Offer hero",
  goals: ["offer", "festive", "general"],
  background: "brand_solid",
  productMode: "cutout",
  fill: "primary",
  layouts: {
    "4:5": {
      calmAreas: [],
      logo: { x: 0.07, y: 0.045, w: 0.24, h: 0.055 },
      headline: { ...head, box: { x: 0.07, y: 0.12, w: 0.86, h: 0.19 }, align: "center", minSize: 0.04, maxSize: 0.085, maxLines: 3, color: "background" },
      supporting: { ...body, box: { x: 0.12, y: 0.32, w: 0.76, h: 0.07 }, align: "center", minSize: 0.018, maxSize: 0.026, color: "background" },
      product: { box: { x: 0.16, y: 0.41, w: 0.68, h: 0.44 }, anchor: "bottom" },
      badge: { ...head, box: { x: 0.66, y: 0.39, w: 0.27, h: 0.216 }, align: "center", shape: "burst", fill: "accent", color: "background", minSize: 0.022, maxSize: 0.05, maxLines: 3, lineHeight: 1.0, uppercase: true },
      cta: { ...ctaBase, box: { x: 0.15, y: 0.885, w: 0.7, h: 0.065 }, align: "center", minSize: 0.02, maxSize: 0.03 },
      safeArea: { x: 0.05, y: 0.03, w: 0.9, h: 0.94 },
    },
    "1:1": {
      calmAreas: [],
      logo: { x: 0.06, y: 0.05, w: 0.2, h: 0.06 },
      headline: { ...head, box: { x: 0.06, y: 0.13, w: 0.88, h: 0.19 }, align: "center", minSize: 0.045, maxSize: 0.09, maxLines: 2, color: "background" },
      supporting: { ...body, box: { x: 0.14, y: 0.345, w: 0.72, h: 0.06 }, align: "center", minSize: 0.02, maxSize: 0.028, maxLines: 1, color: "background" },
      product: { box: { x: 0.24, y: 0.42, w: 0.52, h: 0.42 }, anchor: "bottom" },
      badge: { ...head, box: { x: 0.7, y: 0.42, w: 0.24, h: 0.24 }, align: "center", shape: "burst", fill: "accent", color: "background", minSize: 0.024, maxSize: 0.055, maxLines: 3, lineHeight: 1.0, uppercase: true },
      cta: { ...ctaBase, box: { x: 0.25, y: 0.87, w: 0.5, h: 0.075 }, align: "center", minSize: 0.022, maxSize: 0.034 },
      safeArea: { x: 0.04, y: 0.04, w: 0.92, h: 0.92 },
    },
    "9:16": {
      calmAreas: [],
      logo: { x: 0.08, y: 0.145, w: 0.3, h: 0.04 },
      headline: { ...head, box: { x: 0.07, y: 0.2, w: 0.86, h: 0.16 }, align: "center", minSize: 0.03, maxSize: 0.06, maxLines: 3, color: "background" },
      supporting: { ...body, box: { x: 0.1, y: 0.365, w: 0.8, h: 0.055 }, align: "center", minSize: 0.014, maxSize: 0.02, color: "background" },
      product: { box: { x: 0.1, y: 0.43, w: 0.8, h: 0.31 }, anchor: "bottom" },
      badge: { ...head, box: { x: 0.62, y: 0.4, w: 0.32, h: 0.18 }, align: "center", shape: "burst", fill: "accent", color: "background", minSize: 0.016, maxSize: 0.034, maxLines: 3, lineHeight: 1.0, uppercase: true },
      cta: { ...ctaBase, box: { x: 0.15, y: 0.755, w: 0.7, h: 0.045 }, align: "center", minSize: 0.015, maxSize: 0.022 },
      safeArea: { x: 0.06, y: 0.14, w: 0.88, h: 0.66 },
    },
  },
};

export const PRODUCT_HERO_SCENE: PosterTemplate = {
  id: "product-hero-scene",
  version: 1,
  label: "Product hero scene",
  goals: ["launch", "feature", "awareness", "social_proof", "festive", "general"],
  background: "scene",
  productMode: "cutout",
  fill: "background",
  layouts: {
    "4:5": {
      calmAreas: [{ x: 0, y: 0, w: 1, h: 0.36 }, { x: 0, y: 0.86, w: 1, h: 0.14 }],
      logo: { x: 0.07, y: 0.045, w: 0.22, h: 0.05 },
      headline: { ...head, box: { x: 0.07, y: 0.11, w: 0.74, h: 0.17 }, align: "left", minSize: 0.038, maxSize: 0.075, maxLines: 3 },
      supporting: { ...body, box: { x: 0.07, y: 0.29, w: 0.62, h: 0.06 }, align: "left", minSize: 0.017, maxSize: 0.024 },
      product: { box: { x: 0.22, y: 0.38, w: 0.56, h: 0.47 }, anchor: "bottom" },
      badge: { ...head, box: { x: 0.73, y: 0.37, w: 0.2, h: 0.16 }, align: "center", shape: "seal", fill: "accent", color: "background", minSize: 0.016, maxSize: 0.032, maxLines: 3, lineHeight: 1.0, uppercase: true },
      cta: { ...ctaBase, box: { x: 0.07, y: 0.885, w: 0.5, h: 0.06 }, align: "left", minSize: 0.019, maxSize: 0.027 },
      safeArea: { x: 0.05, y: 0.03, w: 0.9, h: 0.94 },
    },
    "1:1": {
      calmAreas: [{ x: 0, y: 0, w: 0.5, h: 1 }],
      logo: { x: 0.06, y: 0.06, w: 0.2, h: 0.06 },
      headline: { ...head, box: { x: 0.06, y: 0.2, w: 0.42, h: 0.36 }, align: "left", minSize: 0.04, maxSize: 0.075, maxLines: 4 },
      supporting: { ...body, box: { x: 0.06, y: 0.58, w: 0.4, h: 0.12 }, align: "left", minSize: 0.018, maxSize: 0.026, maxLines: 3 },
      product: { box: { x: 0.5, y: 0.14, w: 0.44, h: 0.74 }, anchor: "bottom" },
      badge: { ...head, box: { x: 0.78, y: 0.06, w: 0.16, h: 0.16 }, align: "center", shape: "seal", fill: "accent", color: "background", minSize: 0.016, maxSize: 0.03, maxLines: 3, lineHeight: 1.0, uppercase: true },
      cta: { ...ctaBase, box: { x: 0.06, y: 0.79, w: 0.4, h: 0.075 }, align: "left", minSize: 0.02, maxSize: 0.03 },
      safeArea: { x: 0.04, y: 0.04, w: 0.92, h: 0.92 },
    },
    "9:16": {
      calmAreas: [{ x: 0, y: 0.12, w: 1, h: 0.28 }, { x: 0, y: 0.72, w: 1, h: 0.1 }],
      logo: { x: 0.08, y: 0.145, w: 0.28, h: 0.035 },
      headline: { ...head, box: { x: 0.08, y: 0.195, w: 0.84, h: 0.13 }, align: "left", minSize: 0.028, maxSize: 0.052, maxLines: 3 },
      supporting: { ...body, box: { x: 0.08, y: 0.33, w: 0.76, h: 0.05 }, align: "left", minSize: 0.013, maxSize: 0.018 },
      product: { box: { x: 0.14, y: 0.4, w: 0.72, h: 0.31 }, anchor: "bottom" },
      badge: { ...head, box: { x: 0.68, y: 0.39, w: 0.26, h: 0.146 }, align: "center", shape: "seal", fill: "accent", color: "background", minSize: 0.012, maxSize: 0.024, maxLines: 3, lineHeight: 1.0, uppercase: true },
      cta: { ...ctaBase, box: { x: 0.08, y: 0.735, w: 0.6, h: 0.045 }, align: "left", minSize: 0.014, maxSize: 0.02 },
      safeArea: { x: 0.06, y: 0.14, w: 0.88, h: 0.66 },
    },
  },
};

export const SPLIT_PANEL: PosterTemplate = {
  id: "split-panel",
  version: 1,
  label: "Split panel",
  goals: ["feature", "launch", "social_proof", "offer", "general"],
  background: "split",
  productMode: "cutout",
  fill: "primary",
  layouts: {
    "4:5": {
      sceneBox: { x: 0, y: 0, w: 1, h: 0.6 },
      panel: { x: 0, y: 0.6, w: 1, h: 0.4 },
      calmAreas: [{ x: 0, y: 0, w: 1, h: 0.1 }],
      logo: { x: 0.07, y: 0.035, w: 0.22, h: 0.05 },
      product: { box: { x: 0.24, y: 0.12, w: 0.52, h: 0.52 }, anchor: "bottom" },
      headline: { ...head, box: { x: 0.08, y: 0.665, w: 0.84, h: 0.135 }, align: "center", minSize: 0.034, maxSize: 0.064, maxLines: 2, color: "background" },
      supporting: { ...body, box: { x: 0.12, y: 0.805, w: 0.76, h: 0.06 }, align: "center", minSize: 0.016, maxSize: 0.023, color: "background" },
      badge: { ...head, box: { x: 0.6, y: 0.05, w: 0.34, h: 0.055 }, align: "center", shape: "pill", fill: "accent", color: "background", minSize: 0.014, maxSize: 0.026, maxLines: 1, lineHeight: 1.0, uppercase: true },
      cta: { ...ctaBase, box: { x: 0.25, y: 0.885, w: 0.5, h: 0.06 }, align: "center", minSize: 0.018, maxSize: 0.026 },
      safeArea: { x: 0.05, y: 0.03, w: 0.9, h: 0.94 },
    },
    "1:1": {
      sceneBox: { x: 0.45, y: 0, w: 0.55, h: 1 },
      panel: { x: 0, y: 0, w: 0.45, h: 1 },
      calmAreas: [],
      logo: { x: 0.06, y: 0.06, w: 0.2, h: 0.06 },
      product: { box: { x: 0.36, y: 0.16, w: 0.56, h: 0.7 }, anchor: "bottom" },
      headline: { ...head, box: { x: 0.06, y: 0.2, w: 0.34, h: 0.36 }, align: "left", minSize: 0.036, maxSize: 0.07, maxLines: 4, color: "background" },
      supporting: { ...body, box: { x: 0.06, y: 0.58, w: 0.33, h: 0.13 }, align: "left", minSize: 0.017, maxSize: 0.024, maxLines: 3, color: "background" },
      badge: { ...head, box: { x: 0.64, y: 0.06, w: 0.3, h: 0.065 }, align: "center", shape: "pill", fill: "accent", color: "background", minSize: 0.014, maxSize: 0.028, maxLines: 1, lineHeight: 1.0, uppercase: true },
      cta: { ...ctaBase, box: { x: 0.06, y: 0.8, w: 0.34, h: 0.075 }, align: "left", minSize: 0.018, maxSize: 0.028 },
      safeArea: { x: 0.04, y: 0.04, w: 0.92, h: 0.92 },
    },
    "9:16": {
      sceneBox: { x: 0, y: 0, w: 1, h: 0.58 },
      panel: { x: 0, y: 0.58, w: 1, h: 0.42 },
      calmAreas: [{ x: 0, y: 0.12, w: 1, h: 0.08 }],
      logo: { x: 0.08, y: 0.145, w: 0.28, h: 0.035 },
      product: { box: { x: 0.18, y: 0.22, w: 0.64, h: 0.39 }, anchor: "bottom" },
      headline: { ...head, box: { x: 0.08, y: 0.63, w: 0.84, h: 0.08 }, align: "center", minSize: 0.024, maxSize: 0.044, maxLines: 2, color: "background" },
      supporting: { ...body, box: { x: 0.1, y: 0.71, w: 0.8, h: 0.04 }, align: "center", minSize: 0.012, maxSize: 0.017, color: "background" },
      badge: { ...head, box: { x: 0.56, y: 0.145, w: 0.36, h: 0.032 }, align: "center", shape: "pill", fill: "accent", color: "background", minSize: 0.01, maxSize: 0.016, maxLines: 1, lineHeight: 1.0, uppercase: true },
      cta: { ...ctaBase, box: { x: 0.2, y: 0.755, w: 0.6, h: 0.042 }, align: "center", minSize: 0.013, maxSize: 0.019 },
      safeArea: { x: 0.06, y: 0.14, w: 0.88, h: 0.66 },
    },
  },
};

export const POSTER_TEMPLATES: PosterTemplate[] = [OFFER_HERO, PRODUCT_HERO_SCENE, SPLIT_PANEL];

/** Preferred template order per ad format; variants rotate through it. */
const ORDER: Record<AdFormatKind, string[]> = {
  offer: ["offer-hero", "split-panel", "product-hero-scene"],
  festive: ["product-hero-scene", "offer-hero", "split-panel"],
  launch: ["product-hero-scene", "split-panel", "offer-hero"],
  feature: ["split-panel", "product-hero-scene", "offer-hero"],
  social_proof: ["product-hero-scene", "split-panel", "offer-hero"],
  awareness: ["product-hero-scene", "split-panel", "offer-hero"],
  before_after: [],
  general: ["product-hero-scene", "split-panel", "offer-hero"],
};

/** What a concept needs from the layout, read from its own fields. */
export type ConceptFit = {
  /** False when only the full-AI path can show the idea (people, product in use, sequences, metaphors) */
  suitable: boolean;
  reason: string | null;
  /** Template ids that suit the concept, best first */
  preferred: string[];
};

const TERRITORY_PREFERENCE: Record<string, string[]> = {
  product_hero: ["split-panel", "product-hero-scene"],
  ingredient_feature: ["split-panel", "product-hero-scene"],
  lifestyle: ["product-hero-scene"],
  social_ritual: ["product-hero-scene"],
  environment_story: ["product-hero-scene"],
  seasonal: ["product-hero-scene", "offer-hero"],
  editorial: ["product-hero-scene", "split-panel"],
  typography_led: ["offer-hero", "split-panel"],
  graphic: ["offer-hero", "split-panel"],
  social_proof: ["product-hero-scene", "offer-hero"],
};

const NO_PEOPLE = /^\s*(none|no\b|n\/a|absent|not\b|without\b|product only|no human)/i;
const IN_USE = /\b(in hand|hands? (?:holding|pouring|applying|opening)|being (?:poured|applied|used|worn|eaten|opened)|in use|applying|pouring|unboxing|wearing|worn by)\b/i;
const SEQUENCE = /\b(triptych|sequence|sequential|step[- ]by[- ]step|steps|before\s*(?:and|&|\/)\s*after|split[- ]screen|collage|grid of|multiple panels|storyboard)\b/i;

export function conceptTemplateFit(concept: {
  territory: string;
  humanPresence?: string | null;
  productTreatment?: string | null;
  composition?: string | null;
  visualStory?: string | null;
}): ConceptFit {
  const preferred = TERRITORY_PREFERENCE[concept.territory] ?? [];
  if (concept.territory === "demonstration" || concept.territory === "conceptual_metaphor") {
    return { suitable: false, reason: `${concept.territory} concepts need the product staged inside the image`, preferred };
  }
  if (concept.humanPresence && !NO_PEOPLE.test(concept.humanPresence)) {
    return { suitable: false, reason: "the concept features people", preferred };
  }
  if (IN_USE.test(concept.productTreatment || "")) {
    return { suitable: false, reason: "the product is shown in use", preferred };
  }
  if (SEQUENCE.test(`${concept.composition || ""} ${concept.visualStory || ""}`)) {
    return { suitable: false, reason: "the concept is a multi-panel or sequence layout", preferred };
  }
  return { suitable: true, reason: null, preferred };
}

const FORMAT_LEAD: Partial<Record<AdFormatKind, string>> = { offer: "offer-hero" };

/**
 * Pick the template for one variant, or null when no template fits (the
 * poster then uses the full-AI path). The ad format sets the candidate order,
 * the concept's territory picks among them, and templates already used by
 * earlier variants are skipped so the set stays varied.
 */
export function selectTemplate(opts: {
  kind: AdFormatKind;
  aspect: PosterAspectRatio;
  variantIndex: number;
  hasCutout: boolean;
  concept?: Parameters<typeof conceptTemplateFit>[0] | null;
  /** Template ids used by earlier variants of this run */
  used?: string[];
}): PosterTemplate | null {
  const fit = opts.concept ? conceptTemplateFit(opts.concept) : null;
  if (fit && !fit.suitable) return null;
  const candidates = ORDER[opts.kind]
    .map((id) => POSTER_TEMPLATES.find((t) => t.id === id)!)
    .filter((t) => t.layouts[opts.aspect] && (t.productMode !== "cutout" || opts.hasCutout));
  if (!candidates.length) return null;
  if (!fit) return candidates[opts.variantIndex % candidates.length];
  const used = new Set(opts.used ?? []);
  // Formats with a dedicated template lead with it (an offer ad sells the deal first).
  const lead = FORMAT_LEAD[opts.kind];
  const leadTemplate = lead && !used.has(lead) ? candidates.find((t) => t.id === lead) : undefined;
  if (leadTemplate) return leadTemplate;
  const fresh = candidates.filter((t) => !used.has(t.id));
  const pool = fresh.length ? fresh : candidates;
  const rank = (t: PosterTemplate) => {
    const i = fit.preferred.indexOf(t.id);
    return i === -1 ? fit.preferred.length : i;
  };
  // Stable sort: concept preference first, ad-format order breaks ties.
  return [...pool].sort((a, b) => rank(a) - rank(b))[0];
}
