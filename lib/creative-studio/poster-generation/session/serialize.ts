/**
 * Explicit serialization / deserialization for PosterGenerationSession JSON columns.
 * Never blind-cast JSON.parse results.
 */

import {
  assertCreativeBriefShape,
  assertCreativeConceptShape,
  assertCreativeDnaShape,
  assertGenerationSpecificationShape,
  assertMarketingStrategyShape,
  assertPosterGeneratedAssetShape,
  assertPosterIterationRecordShape,
  assertPosterSessionErrorShape,
  isPosterSessionStatus,
} from "../guards";
import type {
  CreativeBrief,
  CreativeConcept,
  CreativeDNA,
  GenerationSpecification,
  MarketingStrategy,
  PosterGeneratedAsset,
  PosterGenerationSession,
  PosterIterationRecord,
  PosterSessionError as SessionErrorShape,
  PosterSessionStatus,
} from "../types";
import { PosterGenerationSessionError } from "./errors";

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function parseBrief(raw: unknown): CreativeBrief | null {
  if (raw == null) return null;
  if (!assertCreativeBriefShape(raw)) {
    throw new PosterGenerationSessionError({
      code: "MALFORMED_PERSISTED_DATA",
      stage: "deserialize.brief",
      message: "Persisted creative brief failed validation",
    });
  }
  return raw;
}

export function parseStrategy(raw: unknown): MarketingStrategy | null {
  if (raw == null) return null;
  if (!assertMarketingStrategyShape(raw)) {
    throw new PosterGenerationSessionError({
      code: "MALFORMED_PERSISTED_DATA",
      stage: "deserialize.strategy",
      message: "Persisted marketing strategy failed validation",
    });
  }
  return raw;
}

export function parseConcepts(raw: unknown): CreativeConcept[] {
  const arr = asArray(raw);
  const out: CreativeConcept[] = [];
  for (const item of arr) {
    if (!assertCreativeConceptShape(item)) {
      throw new PosterGenerationSessionError({
        code: "MALFORMED_PERSISTED_DATA",
        stage: "deserialize.concepts",
        message: "Persisted creative concept failed validation",
      });
    }
    out.push(item);
  }
  return out;
}

export function parseDnaByConceptId(raw: unknown): Record<string, CreativeDNA> {
  const rec = asRecord(raw);
  const out: Record<string, CreativeDNA> = {};
  for (const [key, value] of Object.entries(rec)) {
    if (!assertCreativeDnaShape(value)) {
      throw new PosterGenerationSessionError({
        code: "MALFORMED_PERSISTED_DATA",
        stage: "deserialize.dna",
        message: `Persisted Creative DNA for concept ${key} failed validation`,
      });
    }
    out[key] = value;
  }
  return out;
}

export function parseSpecifications(raw: unknown): GenerationSpecification[] {
  const arr = asArray(raw);
  const out: GenerationSpecification[] = [];
  for (const item of arr) {
    if (!assertGenerationSpecificationShape(item)) {
      throw new PosterGenerationSessionError({
        code: "MALFORMED_PERSISTED_DATA",
        stage: "deserialize.specifications",
        message: "Persisted generation specification failed validation",
      });
    }
    out.push(item);
  }
  return out;
}

export function parseAssets(raw: unknown): PosterGeneratedAsset[] {
  const arr = asArray(raw);
  const out: PosterGeneratedAsset[] = [];
  for (const item of arr) {
    if (!assertPosterGeneratedAssetShape(item)) {
      throw new PosterGenerationSessionError({
        code: "MALFORMED_PERSISTED_DATA",
        stage: "deserialize.assets",
        message: "Persisted generated asset failed validation",
      });
    }
    out.push(item);
  }
  return out;
}

export function parseIterations(raw: unknown): PosterIterationRecord[] {
  const arr = asArray(raw);
  const out: PosterIterationRecord[] = [];
  for (const item of arr) {
    if (!assertPosterIterationRecordShape(item)) {
      throw new PosterGenerationSessionError({
        code: "MALFORMED_PERSISTED_DATA",
        stage: "deserialize.iterations",
        message: "Persisted iteration record failed validation",
      });
    }
    out.push(item);
  }
  return out;
}

export function parseSessionError(raw: unknown): SessionErrorShape | null {
  if (raw == null) return null;
  if (!assertPosterSessionErrorShape(raw)) {
    throw new PosterGenerationSessionError({
      code: "MALFORMED_PERSISTED_DATA",
      stage: "deserialize.error",
      message: "Persisted session error failed validation",
    });
  }
  return raw;
}

export function parseTrace(
  raw: unknown
): PosterGenerationSession["trace"] {
  const rec = asRecord(raw);
  return {
    lastProvider:
      typeof rec.lastProvider === "string" ? rec.lastProvider : null,
    lastModel: typeof rec.lastModel === "string" ? rec.lastModel : null,
    totalCreditsConsumed:
      typeof rec.totalCreditsConsumed === "number"
        ? rec.totalCreditsConsumed
        : 0,
    generationCount:
      typeof rec.generationCount === "number" ? rec.generationCount : 0,
    retryCount: typeof rec.retryCount === "number" ? rec.retryCount : 0,
    lastError: typeof rec.lastError === "string" ? rec.lastError : null,
  };
}

export function parseSelectedConceptIds(raw: unknown): string[] {
  const arr = asArray(raw);
  return arr.filter((x): x is string => typeof x === "string");
}

export function parseStatus(raw: unknown): PosterSessionStatus {
  if (!isPosterSessionStatus(raw)) {
    throw new PosterGenerationSessionError({
      code: "MALFORMED_PERSISTED_DATA",
      stage: "deserialize.status",
      message: `Invalid session status: ${String(raw)}`,
    });
  }
  return raw;
}

/** Row shape produced by the repository / DAO */
export type PosterGenerationSessionRow = {
  id: string;
  userId: string;
  studioSessionId: string | null;
  brandId: string | null;
  productId: string | null;
  status: string;
  version: number;
  brief: unknown;
  strategy: unknown;
  concepts: unknown;
  selectedConceptIds: unknown;
  dnaByConceptId: unknown;
  specifications: unknown;
  assets: unknown;
  iterations: unknown;
  trace: unknown;
  error: unknown;
  createdAt: string;
  updatedAt: string;
};

export function rowToSession(
  row: PosterGenerationSessionRow
): PosterGenerationSession {
  return {
    id: row.id,
    userId: row.userId,
    studioSessionId: row.studioSessionId,
    brandId: row.brandId,
    productId: row.productId,
    status: parseStatus(row.status),
    version: typeof row.version === "number" ? row.version : 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    brief: parseBrief(row.brief),
    strategy: parseStrategy(row.strategy),
    concepts: parseConcepts(row.concepts),
    selectedConceptIds: parseSelectedConceptIds(row.selectedConceptIds),
    dnaByConceptId: parseDnaByConceptId(row.dnaByConceptId),
    specifications: parseSpecifications(row.specifications),
    assets: parseAssets(row.assets),
    iterations: parseIterations(row.iterations),
    error: parseSessionError(row.error),
    trace: parseTrace(row.trace),
  };
}

export function sessionToRowPayload(session: PosterGenerationSession): {
  studioSessionId: string | null;
  brandId: string | null;
  productId: string | null;
  status: string;
  version: number;
  brief: CreativeBrief | null;
  strategy: MarketingStrategy | null;
  concepts: CreativeConcept[];
  selectedConceptIds: string[];
  dnaByConceptId: Record<string, CreativeDNA>;
  specifications: GenerationSpecification[];
  assets: PosterGeneratedAsset[];
  iterations: PosterIterationRecord[];
  trace: PosterGenerationSession["trace"];
  error: SessionErrorShape | null;
} {
  return {
    studioSessionId: session.studioSessionId ?? null,
    brandId: session.brandId ?? null,
    productId: session.productId ?? null,
    status: session.status,
    version: session.version,
    brief: session.brief,
    strategy: session.strategy,
    concepts: session.concepts,
    selectedConceptIds: session.selectedConceptIds,
    dnaByConceptId: session.dnaByConceptId,
    specifications: session.specifications,
    assets: session.assets,
    iterations: session.iterations,
    trace: session.trace,
    error: session.error ?? null,
  };
}
