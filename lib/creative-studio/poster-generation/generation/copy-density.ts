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

/** Words a trimmed phrase must not end on ("Glowing skin in just" → "Glowing skin"). */
const DANGLING_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "nor", "of", "to", "in", "on", "at",
  "for", "with", "by", "from", "into", "onto", "your", "our", "their", "its",
  "my", "this", "that", "these", "those", "is", "are", "be", "just", "so",
  "as", "than", "&", "-", "–", "—",
]);

/** Soft-trim long strategy copy for poster rendering (never invents new words). */
export function trimPosterPhrase(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  const kept = words.slice(0, maxWords);
  while (
    kept.length > 1 &&
    DANGLING_WORDS.has(kept[kept.length - 1].toLowerCase().replace(/[^\p{L}\p{N}&–—-]/gu, ""))
  ) {
    kept.pop();
  }
  return kept.join(" ").replace(/[,;:–—-]+$/, "").trim();
}

function normalizeCopy(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * Drop copy that repeats an earlier line — exact repeats (case/punctuation-insensitive)
 * or a later line whose words are all contained in an earlier one
 * (e.g. badge "26g protein" under headline "26G PROTEIN").
 */
export function dedupeCopyLines<T extends { text: string }>(lines: T[]): T[] {
  const kept: T[] = [];
  for (const line of lines) {
    const norm = normalizeCopy(line.text);
    if (!norm) continue;
    const repeats = kept.some((k) => {
      const prev = normalizeCopy(k.text);
      return prev === norm || ` ${prev} `.includes(` ${norm} `);
    });
    if (!repeats) kept.push(line);
  }
  return kept;
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

  // The user's own offer text is never trimmed or dropped for length.
  const shortBadges = (max: number, maxWords: number) =>
    badges
      .map((b) => (b === offerBadge ? b : trimPosterPhrase(b, maxWords)))
      .filter(
        (b) => b === offerBadge || (wordCount(b) > 0 && wordCount(b) <= maxWords + 1)
      )
      .slice(0, max);

  const headline = (maxWords: number) =>
    hasHeadlineOverride ? headlineRaw : trimPosterPhrase(headlineRaw, maxWords);

  switch (density) {
    case "punchline":
      return {
        density,
        headline: headline(8),
        // A supporting line the user wrote themselves always renders.
        supporting: overrideSupporting,
        productLine: null,
        cta: overrideCta ? overrideCta : null,
        badges: shortBadges(1, 3),
        textBudgetRule:
          "TEXT BUDGET = PUNCHLINE. Render ONLY the primary headline (plus at most one short tag if listed). No paragraphs, captions, arrows with body copy, product-name footers, or decorative subheads. Prefer big type + product visual.",
      };
    case "tags":
      return {
        density,
        headline: headline(8),
        // A supporting line the user wrote themselves always renders.
        supporting: overrideSupporting,
        productLine: productLine ? trimPosterPhrase(productLine, 6) : null,
        cta: overrideCta ? overrideCta : null,
        badges: shortBadges(2, 3),
        textBudgetRule:
          "TEXT BUDGET = TAGS. Headline + up to two short tags/badges. No supporting paragraph, no multi-line captions, no arrow callouts with sentences.",
      };
    case "informative":
      return {
        density,
        headline: headline(10),
        supporting:
          overrideSupporting ||
          trimPosterPhrase(strategySupporting || "", 14) ||
          null,
        productLine: productLine ? trimPosterPhrase(productLine, 6) : null,
        cta:
          overrideCta ||
          (strategyCta ? trimPosterPhrase(strategyCta, 5) : "") ||
          null,
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
          supporting: overrideSupporting
            ? overrideSupporting
            : supporting
              ? trimPosterPhrase(supporting, 12)
              : null,
          productLine:
            !supporting && productLine
              ? trimPosterPhrase(productLine, 6)
              : null,
          cta: overrideCta
            ? overrideCta
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
