/**
 * Session-aware Creative Concept service — Phase 5.
 * Persists via PosterGenerationSessionService. Zero image credits.
 */

import type { StructuredGenerator } from "@/lib/creative-studio/commercial-production/commercial-director/llm";
import type {
  CreativeConcept,
  CreativeDNA,
  PosterGenerationSession,
  PosterVariantCount,
} from "../types";
import {
  createPosterGenerationSessionService,
  type PosterGenerationSessionService,
} from "../session";
import { generateCreativeConcepts } from "./director";
import { directorInputFromSession } from "./from-session";
import { clampConceptCount } from "./concept-input";
import { PosterConceptError } from "./concept-errors";

export type RunCreativeConceptsOptions = {
  sessionId: string;
  userId: string;
  conceptCount?: number | PosterVariantCount | null;
  forceRegenerate?: boolean;
  generator?: StructuredGenerator;
  sessionService?: PosterGenerationSessionService;
  maxDiversityRetries?: number;
};

export type RunCreativeConceptsResult = {
  session: PosterGenerationSession;
  concepts: CreativeConcept[];
  dnaByConceptId: Record<string, CreativeDNA>;
  reused: boolean;
};

function conceptsMatchCurrentStrategy(
  session: PosterGenerationSession
): boolean {
  if (!session.strategy || !session.concepts.length) return false;
  return session.concepts.every((c) => c.strategyId === session.strategy!.id);
}

export async function runCreativeConceptsForSession(
  options: RunCreativeConceptsOptions
): Promise<RunCreativeConceptsResult> {
  const sessions =
    options.sessionService ?? createPosterGenerationSessionService();
  const session = await sessions.getSession(options.sessionId, options.userId);

  if (!session.brief) {
    throw new PosterConceptError({
      code: "MISSING_BRIEF",
      message:
        "Poster session has no CreativeBrief. Create/update the brief before generating concepts.",
      stage: "runCreativeConceptsForSession",
    });
  }
  if (!session.strategy) {
    throw new PosterConceptError({
      code: "MISSING_STRATEGY",
      message:
        "Poster session has no MarketingStrategy. Run the strategist before generating concepts.",
      stage: "runCreativeConceptsForSession",
    });
  }
  if (session.strategy.briefId !== session.brief.id) {
    throw new PosterConceptError({
      code: "STALE_STRATEGY",
      message: "Session strategy does not match the current brief",
      stage: "runCreativeConceptsForSession",
    });
  }

  const requestedCount =
    options.conceptCount != null
      ? clampConceptCount(options.conceptCount)
      : clampConceptCount(session.brief.variantCount);

  // Idempotency: reuse if concepts exist for this strategy and matching count
  if (
    !options.forceRegenerate &&
    conceptsMatchCurrentStrategy(session) &&
    session.concepts.length === requestedCount
  ) {
    const dna: Record<string, CreativeDNA> = {};
    for (const c of session.concepts) {
      if (session.dnaByConceptId[c.id]) {
        dna[c.id] = session.dnaByConceptId[c.id];
      }
    }
    return {
      session,
      concepts: session.concepts,
      dnaByConceptId: dna,
      reused: true,
    };
  }

  const input = directorInputFromSession({
    brief: session.brief,
    strategy: session.strategy,
    conceptCount: requestedCount,
  });

  const generated = await generateCreativeConcepts(input, {
    generator: options.generator,
    maxDiversityRetries: options.maxDiversityRetries,
  });

  const updated = await sessions.setConcepts(
    options.sessionId,
    options.userId,
    generated.concepts,
    generated.dnaByConceptId
  );

  return {
    session: updated,
    concepts: generated.concepts,
    dnaByConceptId: generated.dnaByConceptId,
    reused: false,
  };
}

export type SelectConceptOptions = {
  sessionId: string;
  userId: string;
  conceptIds: string | string[];
  sessionService?: PosterGenerationSessionService;
};

export async function selectConceptForSession(
  options: SelectConceptOptions
): Promise<PosterGenerationSession> {
  const sessions =
    options.sessionService ?? createPosterGenerationSessionService();
  return sessions.selectConcept(
    options.sessionId,
    options.userId,
    options.conceptIds
  );
}
