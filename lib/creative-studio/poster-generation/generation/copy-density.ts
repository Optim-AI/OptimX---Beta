/**
 * Poster copy-density policy — decide how much text a concept should carry.
 * Punchy heroes vs informative explainers share the same strategy copy pool;
 * density filters what actually gets rendered.
 */

import type { CreativeConcept, CreativeTerritory, MarketingStrategy } from "../types";

export type PosterCopyDensity =
  | "punchline"
  | "tags"
  | "balanced"
  | "informative";

const PUNCHLINE_TERRITORIES = new Set<CreativeTerritory>([
  "product_hero",
  "typography_led",
  "graphic",
  "conceptual_metaphor",
]);

const TAGS_TERRITORIES = new Set<CreativeTerritory>([
  "ingredient_feature",
  "seasonal",
]);

const INFORMATIVE_TERRITORIES = new Set<CreativeTerritory>([
  "demonstration",
  "social_proof",
]);

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Soft-trim long strategy copy for poster rendering (never invents new words). */
export function trimPosterPhrase(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ");
}

export function copyDensityForConcept(
  concept: Pick<
    CreativeConcept,
    "territory" | "typographyTreatment" | "copyHierarchy" | "ctaTreatment"
  >
): PosterCopyDensity {
  const hint = [
    concept.typographyTreatment,
    concept.copyHierarchy,
    concept.ctaTreatment,
  ]
    .join(" ")
    .toLowerCase();

  if (
    /\b(punchline|headline[- ]?only|minimal text|sparse typography|big type only)\b/.test(
      hint
    )
  ) {
    return "punchline";
  }
  if (/\b(tags? only|badge[- ]?led|label[- ]?led|chip[- ]?led)\b/.test(hint)) {
    return "tags";
  }
  if (
    /\b(informative|explainer|education|body copy|supporting paragraph)\b/.test(
      hint
    )
  ) {
    return "informative";
  }

  if (PUNCHLINE_TERRITORIES.has(concept.territory)) return "punchline";
  if (TAGS_TERRITORIES.has(concept.territory)) return "tags";
  if (INFORMATIVE_TERRITORIES.has(concept.territory)) return "informative";
  return "balanced";
}

export type DensityFilteredCopy = {
  density: PosterCopyDensity;
  headline: string;
  supporting: string | null;
  productLine: string | null;
  cta: string | null;
  badges: string[];
  /** Human instruction baked into the GenerationSpecification prompt */
  textBudgetRule: string;
};

/**
 * Filter strategy copy for a concept's text budget.
 * Preserves userOverrides when present. Never invents new copy.
 */
export function filterCopyForDensity(options: {
  strategy: MarketingStrategy;
  density: PosterCopyDensity;
}): DensityFilteredCopy {
  const { strategy, density } = options;
  const overrides = strategy.userOverrides || {};

  const hasHeadlineOverride = !!(overrides.headline && overrides.headline.trim());
  const headlineRaw =
    (overrides.headline && overrides.headline.trim()) ||
    strategy.copy.headline.trim();

  const overrideSupporting =
    overrides.message && overrides.message.trim()
      ? overrides.message.trim()
      : null;
  const strategySupporting = strategy.copy.supporting?.trim() || null;
  const productLine = strategy.copy.productLine?.trim() || null;
  const overrideCta =
    overrides.cta && overrides.cta.trim() ? overrides.cta.trim() : null;
  const strategyCta = strategy.copy.cta?.trim() || null;
  const offerBadge = overrides.offer?.trim() || null;
  const badges = [
    ...(offerBadge ? [offerBadge] : []),
    ...(strategy.copy.badges || []),
  ]
    .map((b) => b.trim())
    .filter(Boolean);

  const shortBadges = (max: number, maxWords: number) =>
    badges
      .map((b) => trimPosterPhrase(b, maxWords))
      .filter((b) => wordCount(b) > 0 && wordCount(b) <= maxWords + 1)
      .slice(0, max);

  const headline = (maxWords: number) =>
    hasHeadlineOverride ? headlineRaw : trimPosterPhrase(headlineRaw, maxWords);

  switch (density) {
    case "punchline":
      return {
        density,
        headline: headline(8),
        supporting: null,
        productLine: null,
        cta: overrideCta ? trimPosterPhrase(overrideCta, 4) : null,
        badges: shortBadges(1, 3),
        textBudgetRule:
          "TEXT BUDGET = PUNCHLINE. Render ONLY the primary headline (plus at most one short tag if listed). No paragraphs, captions, arrows with body copy, product-name footers, or decorative subheads. Prefer big type + product visual.",
      };
    case "tags":
      return {
        density,
        headline: headline(8),
        supporting: null,
        productLine: productLine ? trimPosterPhrase(productLine, 6) : null,
        cta: overrideCta ? trimPosterPhrase(overrideCta, 4) : null,
        badges: shortBadges(2, 3),
        textBudgetRule:
          "TEXT BUDGET = TAGS. Headline + up to two short tags/badges. No supporting paragraph, no multi-line captions, no arrow callouts with sentences.",
      };
    case "informative":
      return {
        density,
        headline: headline(10),
        supporting: trimPosterPhrase(
          overrideSupporting || strategySupporting || "",
          14
        ) || null,
        productLine: productLine ? trimPosterPhrase(productLine, 6) : null,
        cta: trimPosterPhrase(overrideCta || strategyCta || "", 5) || null,
        badges: shortBadges(2, 4),
        textBudgetRule:
          "TEXT BUDGET = INFORMATIVE but still poster-tight. Headline + one short supporting line max. No brochure paragraphs or stacked captions.",
      };
    case "balanced":
    default:
      // Prefer supporting OR product line — not both — to avoid stacked text
      {
        const supporting =
          overrideSupporting ||
          (strategySupporting && wordCount(strategySupporting) <= 14
            ? strategySupporting
            : null);
        return {
          density,
          headline: headline(9),
          supporting: supporting
            ? trimPosterPhrase(supporting, 12)
            : null,
          productLine:
            !supporting && productLine
              ? trimPosterPhrase(productLine, 6)
              : null,
          cta: overrideCta
            ? trimPosterPhrase(overrideCta, 4)
            : strategyCta && wordCount(strategyCta) <= 4
              ? strategyCta
              : null,
          badges: shortBadges(1, 3),
          textBudgetRule:
            "TEXT BUDGET = BALANCED. Headline is hero. At most one short secondary line OR product line — never both. Skip decorative captions and arrow callouts.",
        };
      }
  }
}

export function densityLabel(density: PosterCopyDensity): string {
  switch (density) {
    case "punchline":
      return "punchline / minimal text";
    case "tags":
      return "tags + punchline";
    case "informative":
      return "informative (still sparse)";
    default:
      return "balanced";
  }
}
