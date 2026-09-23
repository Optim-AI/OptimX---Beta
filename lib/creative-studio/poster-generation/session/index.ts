/**
 * Poster Generation Session Service — Phase 2 state management only.
 * No LLM, no image generation, no credit deduction.
 */

import { randomUUID } from "crypto";
import {
  assertCreativeBriefShape,
  assertCreativeConceptShape,
  assertCreativeDnaShape,
  assertGenerationSpecificationShape,
  assertMarketingStrategyShape,
  assertPosterGeneratedAssetShape,
  assertPosterIterationRecordShape,
  assertPosterQcResultShape,
  assertPosterSessionErrorShape,
  createEmptyPosterSession,
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
  PosterQcResult,
  PosterSessionError as SessionErrorShape,
} from "../types";
import { PosterGenerationSessionError } from "./errors";
import {
  DrizzlePosterGenerationSessionRepository,
  type PosterGenerationSessionRepository,
} from "./repository";

export type CreatePosterSessionInput = {
  userId: string;
  studioSessionId?: string | null;
  brandId?: string | null;
  productId?: string | null;
  /** Optional initial brief — validated before persist */
  brief?: CreativeBrief | null;
  id?: string;
};

export type { PosterGenerationSessionRepository };

function touch(session: PosterGenerationSession): PosterGenerationSession {
  return { ...session, updatedAt: new Date().toISOString() };
}

export class PosterGenerationSessionService {
  constructor(
    private readonly repo: PosterGenerationSessionRepository
  ) {}

  async createSession(
    input: CreatePosterSessionInput
  ): Promise<PosterGenerationSession> {
    if (!input.userId) {
      throw new PosterGenerationSessionError({
        code: "VALIDATION",
        message: "userId is required",
        stage: "createSession",
      });
    }

    if (input.studioSessionId) {
      const existing = await this.repo.findByStudioSessionId(
        input.studioSessionId,
        input.userId
      );
      if (existing) return existing;
    }

    if (input.brief != null && !assertCreativeBriefShape(input.brief)) {
      throw new PosterGenerationSessionError({
        code: "VALIDATION",
        message: "Initial brief failed validation",
        stage: "createSession",
      });
    }

    const id = input.id || randomUUID();
    let session = createEmptyPosterSession({
      id,
      userId: input.userId,
      studioSessionId: input.studioSessionId,
      brandId: input.brandId,
      productId: input.productId,
    });

    if (input.brief) {
      session = {
        ...session,
        brief: input.brief,
        status: "brief_ready",
      };
    }

    return this.repo.insert(session);
  }

  async getSession(
    id: string,
    userId: string
  ): Promise<PosterGenerationSession> {
    const session = await this.repo.findByIdAndUserId(id, userId);
    if (!session) {
      throw new PosterGenerationSessionError({
        code: "NOT_FOUND",
        message: "Poster generation session not found",
        stage: "getSession",
      });
    }
    return session;
  }

  /**
   * Load by Brand Studio UI session id.
   * Returns null when no structured poster-generation session exists yet (legacy UI session).
   */
  async getSessionByStudioSessionId(
    studioSessionId: string,
    userId: string
  ): Promise<PosterGenerationSession | null> {
    return this.repo.findByStudioSessionId(studioSessionId, userId);
  }

  /**
   * Legacy compatibility: Brand Studio sessions without a linked poster-generation
   * row are not errors — callers should treat null as "not initialized".
   */
  async getOrDescribeLegacy(
    studioSessionId: string,
    userId: string
  ): Promise<
    | { kind: "structured"; session: PosterGenerationSession }
    | { kind: "legacy"; studioSessionId: string }
  > {
    const session = await this.repo.findByStudioSessionId(
      studioSessionId,
      userId
    );
    if (session) return { kind: "structured", session };
    return { kind: "legacy", studioSessionId };
  }

  private async loadOwned(
    sessionId: string,
    userId: string
  ): Promise<PosterGenerationSession> {
    return this.getSession(sessionId, userId);
  }

  private async persist(
    session: PosterGenerationSession
  ): Promise<PosterGenerationSession> {
    const expected = session.version;
    const next = touch(session);
    return this.repo.updateOptimistic(next, expected);
  }

  async updateBrief(
    sessionId: string,
    userId: string,
    brief: CreativeBrief
  ): Promise<PosterGenerationSession> {
    if (!assertCreativeBriefShape(brief)) {
      throw new PosterGenerationSessionError({
        code: "VALIDATION",
        message: "Creative brief failed validation",
        stage: "updateBrief",
      });
    }
    const session = await this.loadOwned(sessionId, userId);
    return this.persist({
      ...session,
      brief,
      status:
        session.status === "draft" || session.status === "brief_ready"
          ? "brief_ready"
          : session.status,
      error: null,
    });
  }

  async updateStrategy(
    sessionId: string,
    userId: string,
    strategy: MarketingStrategy
  ): Promise<PosterGenerationSession> {
    if (!assertMarketingStrategyShape(strategy)) {
      throw new PosterGenerationSessionError({
        code: "VALIDATION",
        message: "Marketing strategy failed validation",
        stage: "updateStrategy",
      });
    }
    const session = await this.loadOwned(sessionId, userId);
    // Strategy change invalidates concepts generated for a prior strategy
    const strategyChanged =
      !session.strategy || session.strategy.id !== strategy.id;
    return this.persist({
      ...session,
      strategy,
      ...(strategyChanged
        ? {
            concepts: [],
            selectedConceptIds: [],
            dnaByConceptId: {},
            status: "strategy_ready" as const,
          }
        : {
            status:
              session.status === "draft" ||
              session.status === "brief_ready" ||
              session.status === "strategy_ready"
                ? ("strategy_ready" as const)
                : session.status,
          }),
      error: null,
    });
  }

  async setConcepts(
    sessionId: string,
    userId: string,
    concepts: CreativeConcept[],
    dnaByConceptId?: Record<string, CreativeDNA>
  ): Promise<PosterGenerationSession> {
    for (const c of concepts) {
      if (!assertCreativeConceptShape(c)) {
        throw new PosterGenerationSessionError({
          code: "VALIDATION",
          message: "Creative concept failed validation",
          stage: "setConcepts",
        });
      }
    }
    const dna = dnaByConceptId || {};
    for (const [key, value] of Object.entries(dna)) {
      if (!assertCreativeDnaShape(value)) {
        throw new PosterGenerationSessionError({
          code: "VALIDATION",
          message: `Creative DNA for ${key} failed validation`,
          stage: "setConcepts",
        });
      }
    }

    const session = await this.loadOwned(sessionId, userId);
    const conceptIds = new Set(concepts.map((c) => c.id));
    const selectedConceptIds = session.selectedConceptIds.filter((id) =>
      conceptIds.has(id)
    );

    return this.persist({
      ...session,
      concepts,
      dnaByConceptId: dna,
      selectedConceptIds,
      status: concepts.length > 0 ? "concepts_ready" : session.status,
      error: null,
    });
  }

  async selectConcept(
    sessionId: string,
    userId: string,
    conceptIds: string | string[]
  ): Promise<PosterGenerationSession> {
    const ids = Array.isArray(conceptIds) ? conceptIds : [conceptIds];
    const session = await this.loadOwned(sessionId, userId);
    const known = new Set(session.concepts.map((c) => c.id));
    for (const id of ids) {
      if (!known.has(id)) {
        throw new PosterGenerationSessionError({
          code: "VALIDATION",
          message: `Concept not found on session: ${id}`,
          stage: "selectConcept",
        });
      }
    }
    return this.persist({
      ...session,
      selectedConceptIds: ids,
      error: null,
    });
  }

  async addGenerationSpecification(
    sessionId: string,
    userId: string,
    spec: GenerationSpecification
  ): Promise<PosterGenerationSession> {
    if (!assertGenerationSpecificationShape(spec)) {
      throw new PosterGenerationSessionError({
        code: "VALIDATION",
        message: "Generation specification failed validation",
        stage: "addGenerationSpecification",
      });
    }
    const session = await this.loadOwned(sessionId, userId);
    const existingIdx = session.specifications.findIndex((s) => s.id === spec.id);
    const specifications =
      existingIdx >= 0
        ? session.specifications.map((s, i) => (i === existingIdx ? spec : s))
        : [...session.specifications, spec];

    return this.persist({
      ...session,
      specifications,
      error: null,
    });
  }

  async startGeneration(
    sessionId: string,
    userId: string
  ): Promise<PosterGenerationSession> {
    const session = await this.loadOwned(sessionId, userId);
    return this.persist({
      ...session,
      status: "generating",
      error: null,
    });
  }

  async addGeneratedAsset(
    sessionId: string,
    userId: string,
    asset: PosterGeneratedAsset
  ): Promise<PosterGenerationSession> {
    if (!assertPosterGeneratedAssetShape(asset)) {
      throw new PosterGenerationSessionError({
        code: "VALIDATION",
        message: "Generated asset failed validation",
        stage: "addGeneratedAsset",
      });
    }
    const session = await this.loadOwned(sessionId, userId);
    const existingIdx = session.assets.findIndex((a) => a.id === asset.id);
    const assets =
      existingIdx >= 0
        ? session.assets.map((a, i) => (i === existingIdx ? asset : a))
        : [...session.assets, asset];

    const isNew = existingIdx < 0;
    return this.persist({
      ...session,
      assets,
      status: asset.status === "generated" ? "qc" : session.status,
      trace: {
        ...session.trace,
        lastProvider: asset.provider,
        lastModel: asset.model,
        generationCount:
          session.trace.generationCount +
          (isNew && asset.status === "generated" ? 1 : 0),
        totalCreditsConsumed:
          session.trace.totalCreditsConsumed +
          (isNew ? asset.creditsConsumed : 0),
        lastError:
          asset.status === "failed"
            ? asset.errorMessage || session.trace.lastError
            : session.trace.lastError,
        retryCount:
          session.trace.retryCount +
          (asset.status === "failed" ? asset.attemptCount || 0 : 0),
      },
      error: null,
    });
  }

  async addQcResult(
    sessionId: string,
    userId: string,
    qc: PosterQcResult,
    generationId?: string
  ): Promise<PosterGenerationSession> {
    if (!assertPosterQcResultShape(qc)) {
      throw new PosterGenerationSessionError({
        code: "VALIDATION",
        message: "QC result failed validation",
        stage: "addQcResult",
      });
    }
    const targetId = generationId || qc.generationId;
    const session = await this.loadOwned(sessionId, userId);
    const assetIdx = session.assets.findIndex((a) => a.id === targetId);
    if (assetIdx < 0) {
      throw new PosterGenerationSessionError({
        code: "VALIDATION",
        message: `No asset with id ${targetId} to attach QC`,
        stage: "addQcResult",
      });
    }

    const assets = session.assets.map((a, i) =>
      i === assetIdx ? { ...a, qc } : a
    );

    return this.persist({
      ...session,
      assets,
      status: qc.passed
        ? assets.every((a) => a.status !== "generated" || a.qc?.passed)
          ? "ready"
          : "qc"
        : "qc",
      error: null,
    });
  }

  async addIteration(
    sessionId: string,
    userId: string,
    iteration: PosterIterationRecord
  ): Promise<PosterGenerationSession> {
    if (!assertPosterIterationRecordShape(iteration)) {
      throw new PosterGenerationSessionError({
        code: "VALIDATION",
        message: "Iteration record failed validation",
        stage: "addIteration",
      });
    }
    const session = await this.loadOwned(sessionId, userId);
    const existingIdx = session.iterations.findIndex(
      (i) => i.id === iteration.id
    );
    const iterations =
      existingIdx >= 0
        ? session.iterations.map((i, idx) =>
            idx === existingIdx ? iteration : i
          )
        : [...session.iterations, iteration];

    return this.persist({
      ...session,
      iterations,
      status: "iterating",
      error: null,
    });
  }

  async completeSession(
    sessionId: string,
    userId: string
  ): Promise<PosterGenerationSession> {
    const session = await this.loadOwned(sessionId, userId);
    return this.persist({
      ...session,
      status: "ready",
      error: null,
    });
  }

  async failSession(
    sessionId: string,
    userId: string,
    error: SessionErrorShape
  ): Promise<PosterGenerationSession> {
    if (!assertPosterSessionErrorShape(error)) {
      throw new PosterGenerationSessionError({
        code: "VALIDATION",
        message: "Session error payload failed validation",
        stage: "failSession",
      });
    }
    const session = await this.loadOwned(sessionId, userId);
    return this.persist({
      ...session,
      status: "failed",
      error,
      trace: {
        ...session.trace,
        lastError: error.message,
        retryCount: session.trace.retryCount + (error.retryable ? 1 : 0),
      },
    });
  }

  async cancelSession(
    sessionId: string,
    userId: string
  ): Promise<PosterGenerationSession> {
    const session = await this.loadOwned(sessionId, userId);
    return this.persist({
      ...session,
      status: "cancelled",
    });
  }
}

export function createPosterGenerationSessionService(
  repo?: PosterGenerationSessionRepository
): PosterGenerationSessionService {
  return new PosterGenerationSessionService(
    repo ?? new DrizzlePosterGenerationSessionRepository()
  );
}
