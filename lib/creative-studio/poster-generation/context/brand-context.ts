/**
 * Canonical BrandContext — Phase 3.
 * Separates identity / communication / visual — does not invent guidelines.
 */

import type { BrandSnapshot } from "@/app/web/src/components/creative-studio/types";
import type { PosterImageRef } from "../types";
import type { ContextCompleteness, ProvenancedValue } from "./provenance";

export type BrandColorSet = {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
  background?: string | null;
  text?: string | null;
  /** Flat list when only primaryColors[] exists */
  palette: string[];
};

export type BrandIdentity = {
  name: ProvenancedValue<string> | null;
  logo: PosterImageRef | null;
  colors: BrandColorSet;
  fonts: ProvenancedValue<string> | null;
};

export type BrandCommunication = {
  tone: ProvenancedValue<string> | null;
  voice: ProvenancedValue<string> | null;
  audience: ProvenancedValue<string> | null;
  industry: ProvenancedValue<string> | null;
  tagline: ProvenancedValue<string> | null;
  coreValueProp: ProvenancedValue<string> | null;
  description: ProvenancedValue<string> | null;
  offering: ProvenancedValue<string> | null;
  values: string[];
  ctaPatterns: string[];
};

export type BrandVisual = {
  aestheticTags: string[];
  toneTags: string[];
  pricePositioning: ProvenancedValue<string> | null;
  productCategory: ProvenancedValue<string> | null;
};

export type BrandContext = {
  brandId?: string | null;
  identity: BrandIdentity;
  communication: BrandCommunication;
  visual: BrandVisual;
  guidelinesApplied: boolean;
  completeness: ContextCompleteness;
  /** Original snapshot for traceability — not for strategist to scrape ad-hoc */
  snapshot: BrandSnapshot | null;
  sourceMetadata: {
    notes: string[];
  };
};

export function emptyBrandContext(): BrandContext {
  return {
    brandId: null,
    identity: {
      name: null,
      logo: null,
      colors: { palette: [] },
      fonts: null,
    },
    communication: {
      tone: null,
      voice: null,
      audience: null,
      industry: null,
      tagline: null,
      coreValueProp: null,
      description: null,
      offering: null,
      values: [],
      ctaPatterns: [],
    },
    visual: {
      aestheticTags: [],
      toneTags: [],
      pricePositioning: null,
      productCategory: null,
    },
    guidelinesApplied: false,
    completeness: "none",
    snapshot: null,
    sourceMetadata: { notes: [] },
  };
}

export function computeBrandCompleteness(ctx: BrandContext): ContextCompleteness {
  const hasName = !!ctx.identity.name?.value?.trim();
  const hasColors = ctx.identity.colors.palette.length > 0;
  const hasLogo = !!ctx.identity.logo?.url;
  const hasTone =
    !!ctx.communication.tone?.value || !!ctx.communication.voice?.value;
  const hasAudience = !!ctx.communication.audience?.value;

  if (!hasName && !hasColors && !hasLogo) return "none";
  if (hasName && hasColors && (hasLogo || hasTone) && hasAudience) {
    return "complete";
  }
  if (hasName && (hasColors || hasTone || hasLogo)) return "partial";
  if (hasName) return "minimal";
  return "none";
}
