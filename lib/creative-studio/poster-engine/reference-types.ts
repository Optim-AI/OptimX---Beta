/**
 * Reference Poster — design inspiration types.
 * Never conflate with PRODUCT or BRAND ASSET images.
 */

export type ReferenceInfluenceLevel = "subtle" | "balanced" | "strong";

export type ReferencePosterSource = "upload" | "url";

export type ReferencePosterAnalysis = {
  composition: string;
  layout: string;
  typography: string;
  colorStrategy: string;
  imagery: string;
  graphicLanguage: string;
  hierarchy: string;
  spacing: string;
  visualTreatment: string;
  designMechanism: string;
  avoid: string[];
  styleTags?: string[];
  suggestedTheme?: string | null;
  summary?: string;
};

export type ReferencePosterAsset = {
  imageUrl?: string;
  dataUrl?: string;
  storagePath?: string;
  source?: ReferencePosterSource;
  contentHash?: string;
  analysis?: ReferencePosterAnalysis | null;
  analyzing?: boolean;
  analyzedAt?: string;
  influence?: ReferenceInfluenceLevel;
};

export function formatReferenceForPlanner(
  analysis: ReferencePosterAnalysis,
  influence: ReferenceInfluenceLevel = "balanced"
): string {
  const lines = [
    "REFERENCE POSTER — DESIGN INSPIRATION ONLY",
    `Influence level: ${influence}`,
    "",
    "Use ONLY as visual design inspiration (composition, typography hierarchy,",
    "layout, graphic language, spacing, color relationships, lighting,",
    "visual treatment, information hierarchy).",
    "",
    "DO NOT reproduce the original brand, logo, text, product, characters,",
    "artwork, or exact composition. Create an original composition for the",
    "user's brand and product.",
    "",
    `Composition: ${analysis.composition}`,
    `Layout: ${analysis.layout}`,
    `Typography: ${analysis.typography}`,
    `Color strategy: ${analysis.colorStrategy}`,
    `Imagery: ${analysis.imagery}`,
    `Graphic language: ${analysis.graphicLanguage}`,
    `Hierarchy: ${analysis.hierarchy}`,
    `Spacing: ${analysis.spacing}`,
    `Visual treatment: ${analysis.visualTreatment}`,
    `Design mechanism: ${analysis.designMechanism}`,
  ];
  if (analysis.avoid?.length) {
    lines.push("", "Avoid copying from reference:");
    for (const a of analysis.avoid) lines.push(`- ${a}`);
  }
  if (analysis.styleTags?.length) {
    lines.push(`Style tags: ${analysis.styleTags.join(", ")}`);
  }
  return lines.join("\n");
}
