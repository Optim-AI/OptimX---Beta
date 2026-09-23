/**
 * Build Creative Director input from session brief + strategy.
 */

import type { CreativeBrief, MarketingStrategy, PosterVariantCount } from "../types";
import { strategistInputFromBrief } from "../strategy/from-brief";
import {
  clampConceptCount,
  type CreativeDirectorInput,
} from "./concept-input";

export function directorInputFromSession(options: {
  brief: CreativeBrief;
  strategy: MarketingStrategy;
  conceptCount?: number | PosterVariantCount | null;
}): CreativeDirectorInput {
  const base = strategistInputFromBrief(options.brief);
  const count =
    options.conceptCount != null
      ? clampConceptCount(options.conceptCount)
      : clampConceptCount(options.brief.variantCount);

  return {
    brief: options.brief,
    strategy: options.strategy,
    product: base.product,
    brand: base.brand,
    references: base.references,
    conceptCount: count,
  };
}
