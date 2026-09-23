/**
 * Phase 8 — Classifier input (authoritative session artifacts only)
 */

import type {
  CreativeConcept,
  CreativeDNA,
  GenerationSpecification,
  MarketingStrategy,
  PosterGeneratedAsset,
} from "../types";

export type IterationClassifierInput = {
  userRequest: string;
  specification: GenerationSpecification;
  concept: CreativeConcept;
  dna: CreativeDNA;
  strategy: MarketingStrategy;
  /** Parent asset being edited — never trust browser-supplied specs */
  parentAsset: PosterGeneratedAsset;
};
