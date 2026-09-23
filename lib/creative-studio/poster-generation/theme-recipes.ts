/**
 * Hard visual-direction (theme chip) recipes.
 * These make Festive / Minimal / Bold etc. readable in the final poster —
 * Creative Direction still owns messaging/scene; theme owns look & feel.
 */

import type { PosterVisualDirection } from "./types";
import { POSTER_VISUAL_DIRECTIONS } from "./types";

export type ThemeRecipe = {
  id: PosterVisualDirection;
  label: string;
  /** One-line lock for prompts */
  summary: string;
  mood: string;
  colorStrategy: string;
  typography: string;
  graphicLanguage: string;
  compositionBias: string;
  lighting: string;
  density: string;
  /** Concrete do / don't so the image model can execute */
  must: string[];
  avoid: string[];
};

const RECIPES: Record<PosterVisualDirection, ThemeRecipe> = {
  minimal: {
    id: "minimal",
    label: "Minimal",
    summary:
      "Sparse, calm, high negative space — one idea, almost no decoration.",
    mood: "Quiet confidence; uncluttered; breathable",
    colorStrategy:
      "Limited palette (1–2 accents max). Prefer soft neutrals + one product-led accent. No rainbow gradients.",
    typography:
      "Few words, generous tracking/leading, restrained weight contrast. Large quiet type, not shouty.",
    graphicLanguage:
      "Almost no ornaments. Thin rules or none. No stickers, bursts, confetti, or floating icons.",
    compositionBias:
      "Asymmetric or centered with lots of empty space. Product + one headline dominate.",
    lighting: "Soft, even, natural; low drama",
    density: "Very low — leave large empty regions",
    must: [
      "Keep large empty regions in the frame",
      "Limit supporting elements to what the story needs",
      "Let negative space be a design feature",
    ],
    avoid: [
      "Busy backgrounds",
      "Multiple competing graphic shapes",
      "Decorative particles, ribbons, or badge stacks",
    ],
  },
  professional: {
    id: "professional",
    label: "Professional",
    summary:
      "Clean, credible, structured commercial craft — polished without flash.",
    mood: "Trustworthy, composed, business-ready",
    colorStrategy:
      "Controlled brand/product colors; balanced contrast; avoid neon or party palettes.",
    typography:
      "Clear hierarchy, crisp sans or editorial restraint; aligned columns of meaning.",
    graphicLanguage:
      "Precise edges, subtle geometry, tidy frames. Supporting graphics serve clarity.",
    compositionBias:
      "Ordered layout, readable zones, deliberate alignment",
    lighting: "Clean studio or soft daylight; flattering and even",
    density: "Medium-low — tidy, not sparse-for-its-own-sake",
    must: [
      "Look boardroom- and marketplace-credible",
      "Keep information hierarchy crystal clear",
      "Prefer craft over spectacle",
    ],
    avoid: [
      "Gimmicky stickers or meme aesthetics",
      "Overly playful cartoon shapes",
      "Chaotic overlapping layers",
    ],
  },
  commercial: {
    id: "commercial",
    label: "Commercial",
    summary:
      "Retail stop-power — product-forward, clear offer, high readability at a glance.",
    mood: "Persuasive, energetic-but-clear, shoppable",
    colorStrategy:
      "Strong contrast for headline vs ground; product colors can lead; keep CTAs readable.",
    typography:
      "Bold merchandising hierarchy: headline punches, secondary supports, CTA clear if present.",
    graphicLanguage:
      "Merchandising clarity — accent shapes only if they guide the eye to product/offer.",
    compositionBias:
      "Product hero or offer-first; quick read from thumb-scroll distance",
    lighting: "Bright commercial product lighting; crisp edges",
    density: "Medium — filled enough to sell, not cluttered",
    must: [
      "Read as a selling poster in under 2 seconds",
      "Keep product and primary message unmistakable",
      "Use contrast for stop-power",
    ],
    avoid: [
      "Vague artistic fog that hides the offer",
      "Typographic whisper when the brief wants launch energy",
    ],
  },
  premium: {
    id: "premium",
    label: "Premium",
    summary:
      "Refined restraint and elevated craft — quiet luxury, not costume gold.",
    mood: "Elevated, considered, exclusive-feeling without snobbery",
    colorStrategy:
      "Restrained, sophisticated palette derived from product/brand. Avoid automatic black+gold cliché.",
    typography:
      "Elegant hierarchy; refined weight; never shouty condensed scream type.",
    graphicLanguage:
      "Subtle materials, soft gradients or matte fields, precise spacing — no chrome excess.",
    compositionBias:
      "Editorial breathing room; product presented with dignity",
    lighting: "Soft directional, flattering highlights, controlled contrast",
    density: "Low–medium; every element earns its place",
    must: [
      "Feel elevated and intentional",
      "Prefer restraint over decoration",
      "Treat product like a hero object, not a sticker",
    ],
    avoid: [
      "Default black background + gold foil cliché",
      "Loud sale-burst graphics",
      "Cheap glitter or lens-flare luxury tropes",
    ],
  },
  bold: {
    id: "bold",
    label: "Bold",
    summary:
      "High-impact scale and contrast — oversized type, strong shapes, unmissable.",
    mood: "Confident, loud-in-a-good-way, decisive",
    colorStrategy:
      "High contrast blocks; saturated accents OK; avoid muddy midtones.",
    typography:
      "Oversized primary type, heavy weights, short punchy lines that dominate the frame.",
    graphicLanguage:
      "Strong geometric blocks, hard cuts, poster-like graphic force.",
    compositionBias:
      "Aggressive scale relationships; type or product massively present",
    lighting: "Punchy contrast; graphic rather than soft lifestyle haze",
    density: "Medium-high graphic impact, still one clear idea",
    must: [
      "Make scale feel brave (big type or big product presence)",
      "Use strong contrast as a primary tool",
      "Commit to one dominant graphic move",
    ],
    avoid: [
      "Timid small type in the corner",
      "Washed-out low-contrast looks",
      "Too many competing bold elements",
    ],
  },
  playful: {
    id: "playful",
    label: "Playful",
    summary:
      "Warm, lively, approachable energy — friendly motion and soft graphic joy.",
    mood: "Fun, inviting, light-hearted without childish chaos",
    colorStrategy:
      "Cheerful product-led accents; warm highlights; avoid sterile grey corporate look.",
    typography:
      "Friendly personality; rounded or lively rhythm; still readable.",
    graphicLanguage:
      "Soft shapes, gentle bounce, optional simple motifs that support the product story.",
    compositionBias:
      "Dynamic but friendly asymmetry; smiling energy in the scene",
    lighting: "Bright, warm, inviting",
    density: "Medium — lively supporting cues, not a sticker dump",
    must: [
      "Feel approachable and energetic",
      "Allow a few joyful supporting elements that serve the story",
      "Keep product still exact and readable",
    ],
    avoid: [
      "Cold corporate sterility",
      "Random emoji/sticker clutter",
      "Childish chaos that hurts brand clarity",
    ],
  },
  trendy: {
    id: "trendy",
    label: "Trendy",
    summary:
      "Contemporary social-first aesthetic — sharp crop, current graphic language.",
    mood: "Now, scroll-native, culturally current",
    colorStrategy:
      "Current contrast recipes; product-led accents; avoid dated stock-photo beige.",
    typography:
      "Modern social hierarchy; tight stacks or stylish short lines; platform-native feel.",
    graphicLanguage:
      "Contemporary treatments (clean overlays, sharp crops, modern graphic accents) — not 2015 tropes.",
    compositionBias:
      "Phone-first framing, intentional crop, modern poster grammar",
    lighting: "Crisp contemporary; lifestyle-real or graphic-flat as the concept dictates",
    density: "Medium — stylish but not noisy",
    must: [
      "Feel current for social feeds",
      "Use modern composition/crop language",
      "Avoid dated template looks",
    ],
    avoid: [
      "Generic stock catalog layouts",
      "Overused gradient mesh + floating orbs cliché unless concept demands it",
      "Outdated clipart energy",
    ],
  },
  festive: {
    id: "festive",
    label: "Festive",
    summary:
      "Celebratory warmth and occasion energy — joyful accents without burying the product.",
    mood: "Celebratory, seasonal joy, upbeat occasion",
    colorStrategy:
      "Richer festive accents alongside product colors (warm golds, deep celebration hues, or bright occasion accents). Still keep product packshot exact.",
    typography:
      "Upbeat, occasion-ready hierarchy; headline can feel celebratory while staying readable.",
    graphicLanguage:
      "Tasteful celebration cues (ribbons, soft sparkle, seasonal motifs, confetti used sparingly) that support — not smother — the product.",
    compositionBias:
      "Product still hero; celebration frames or accents around the story",
    lighting: "Warm, glowing, inviting occasion light",
    density: "Medium–high festive energy, but one clear focal product",
    must: [
      "Read as celebratory / occasion-driven at a glance",
      "Include visible festive graphic or lighting cues",
      "Keep the uploaded product exact and primary",
    ],
    avoid: [
      "Looking like a plain everyday commercial with zero celebration cues",
      "Covering the packshot with clutter",
      "Generic party chaos that hides the message",
    ],
  },
  dynamic: {
    id: "dynamic",
    label: "Dynamic",
    summary:
      "Motion energy and directional tension — active composition, forward thrust.",
    mood: "Kinetic, propelled, alive",
    colorStrategy:
      "Active contrast; directional color blocks; avoid static flat grey fields.",
    typography:
      "Angled or high-energy hierarchy; lines that feel in motion (without illegibility).",
    graphicLanguage:
      "Diagonals, speed cues, implied motion, active crop — purposeful energy lines.",
    compositionBias:
      "Diagonal tension, offset balance, sense of movement through the frame",
    lighting: "Directional, high-energy; rim or streak cues if they help motion",
    density: "Medium — motion cues present, still readable",
    must: [
      "Feel like the frame has momentum",
      "Use diagonal or directional composition language",
      "Avoid static centered catalog calm unless concept overrides carefully",
    ],
    avoid: [
      "Static centered product-on-table with no energy",
      "Motion blur that destroys product fidelity",
      "Random streaks that don't support the story",
    ],
  },
};

export function isPosterVisualDirection(
  value: unknown
): value is PosterVisualDirection {
  return (
    typeof value === "string" &&
    (POSTER_VISUAL_DIRECTIONS as readonly string[]).includes(value)
  );
}

export function resolveThemeRecipe(
  direction: PosterVisualDirection | string | null | undefined
): ThemeRecipe {
  const key = (direction || "commercial").toLowerCase();
  if (isPosterVisualDirection(key)) return RECIPES[key];
  return RECIPES.commercial;
}

/** Compact block for LLM concept / strategy context. */
export function formatThemeRecipeForDirector(recipe: ThemeRecipe): string {
  return [
    `=== VISUAL DIRECTION THEME LOCK: ${recipe.label.toUpperCase()} (REQUIRED LOOK & FEEL) ===`,
    `Summary: ${recipe.summary}`,
    `Mood: ${recipe.mood}`,
    `Color strategy: ${recipe.colorStrategy}`,
    `Typography: ${recipe.typography}`,
    `Graphic language: ${recipe.graphicLanguage}`,
    `Composition bias: ${recipe.compositionBias}`,
    `Lighting: ${recipe.lighting}`,
    `Density: ${recipe.density}`,
    `MUST: ${recipe.must.join("; ")}`,
    `AVOID: ${recipe.avoid.join("; ")}`,
    "Apply this theme into EVERY concept's visualDirectionExpression AND into DNA fields (colorStrategy, typographyStrategy, graphicLanguage, mood, lighting, visualRhythm).",
    "Creative territories may differ; the theme look must still be clearly recognizable in all of them.",
  ].join("\n");
}

/** Hard lock block for the image-generation prompt. */
export function formatThemeRecipeForGeneration(recipe: ThemeRecipe): string {
  return [
    `THEME LOCK — ${recipe.label.toUpperCase()} (must be visually obvious in the finished poster)`,
    recipe.summary,
    `Mood: ${recipe.mood}`,
    `Color: ${recipe.colorStrategy}`,
    `Typography feel: ${recipe.typography}`,
    `Graphics: ${recipe.graphicLanguage}`,
    `Composition: ${recipe.compositionBias}`,
    `Lighting: ${recipe.lighting}`,
    `Density: ${recipe.density}`,
    `Required: ${recipe.must.join(" | ")}`,
    `Forbidden for this theme: ${recipe.avoid.join(" | ")}`,
    "If the poster could pass as a different theme chip (e.g. Minimal when Festive was selected), you have failed the theme lock.",
  ].join("\n");
}
