/**
 * Poster templates — proven ad layouts rendered in code (see
 * docs/POSTER_TEMPLATES_DESIGN.md). Coordinates are fractions of the canvas.
 */

import type { PosterAspectRatio } from "../poster-generation/types";
import type { AdFormatKind } from "../poster-generation/generation/ad-format";

export type Box = { x: number; y: number; w: number; h: number };

export type PaletteRole = "primary" | "secondary" | "accent" | "background" | "text";

export type TextSlot = {
  box: Box;
  align: "left" | "center" | "right";
  /** Vertical placement of the text block inside its box */
  valign?: "top" | "center" | "bottom";
  fontRole: "heading" | "body";
  /** Preferred colour; the renderer falls back to whatever is readable */
  color: PaletteRole;
  /** Font size bounds as a fraction of canvas height */
  minSize: number;
  maxSize: number;
  maxLines: number;
  lineHeight?: number;
  uppercase?: boolean;
  tracking?: number;
};

export type BadgeSlot = TextSlot & { shape: "burst" | "seal" | "pill"; fill: PaletteRole };
export type CtaSlot = TextSlot & { style: "solid" | "outline"; fill: PaletteRole };

export type TemplateLayout = {
  /** Solid brand panel for split layouts (the rest of the canvas is the scene) */
  panel?: Box;
  /** Where the scene image goes (defaults to the full canvas) */
  sceneBox?: Box;
  product?: { box: Box; anchor: "bottom" | "center" };
  /** Regions the scene must keep calm and empty (text sits there) */
  calmAreas: Box[];
  headline: TextSlot;
  supporting?: TextSlot;
  labels?: TextSlot[];
  badge?: BadgeSlot;
  cta?: CtaSlot;
  logo?: Box;
  /** Nothing important outside this box (Story/Reel UI) */
  safeArea: Box;
};

export type PosterTemplate = {
  id: string;
  version: number;
  label: string;
  goals: AdFormatKind[];
  background: "scene" | "brand_solid" | "split";
  productMode: "cutout" | "in_scene" | "none";
  /** Background colour role for solid fills and split panels */
  fill: PaletteRole;
  layouts: Partial<Record<PosterAspectRatio, TemplateLayout>>;
};

export type Palette = Record<PaletteRole, string>;

export type RenderCopy = {
  headline: string;
  /** Product name line, e.g. "Wild Hive Raw Forest Honey 500g" */
  productLine?: string | null;
  supporting?: string | null;
  cta?: string | null;
  badge?: string | null;
  labels?: string[];
};

export type ManifestLayer =
  | { kind: "background"; fill?: string; sceneBox?: Box }
  | { kind: "product"; box: Box; width: number; height: number }
  | { kind: "scrim"; box: Box; color: string; opacity: number }
  | { kind: "text"; slot: string; box: Box; lines: string[]; fontSize: number; color: string; font: string }
  | { kind: "badge" | "cta"; box: Box; lines: string[]; fontSize: number; color: string; fill: string; font: string }
  | { kind: "logo"; box: Box };

/** Everything needed to re-render the poster without AI (text edits, recolours). */
export type CompositionManifest = {
  templateId: string;
  templateVersion: number;
  aspect: PosterAspectRatio;
  canvas: { width: number; height: number };
  palette: Palette;
  fonts: { heading: string; body: string };
  copy: RenderCopy;
  layers: ManifestLayer[];
  warnings: string[];
  /** The product was relit/grounded by the harmonize pass */
  harmonized?: boolean;
};
