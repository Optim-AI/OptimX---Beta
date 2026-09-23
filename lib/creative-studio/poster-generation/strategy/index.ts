/**
 * Phase 4 — Marketing Strategist public exports.
 */

export { generateMarketingStrategy } from "./strategist";
export type { GenerateMarketingStrategyOptions } from "./strategist";

export {
  detectUserOverrides,
  formatProductFactsForStrategist,
  formatBrandForStrategist,
  type MarketingStrategistInput,
  type DetectedUserOverrides,
} from "./strategy-input";

export {
  normalizeStrategyRaw,
  validateMarketingStrategy,
  repairStrategyClaims,
} from "./strategy-validation";

export {
  PosterStrategyError,
  isPosterStrategyError,
  type PosterStrategyErrorCode,
} from "./strategy-errors";

export {
  strategistInputFromBrief,
  productContextFromBriefProduct,
  brandContextFromBrief,
  referenceContextFromBrief,
} from "./from-brief";

export {
  runMarketingStrategyForSession,
  type RunMarketingStrategyOptions,
  type RunMarketingStrategyResult,
} from "./run-for-session";
