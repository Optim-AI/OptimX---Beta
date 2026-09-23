/**
 * Phase 8 — Run iteration for a PosterGenerationSession
 *
 * classify → plan → (optional) updated spec → one generation → QC
 * Credits only on successful image. No automatic regenerate loops.
 * Browser never supplies authoritative strategy/spec/concept.
 */

import { CreditsDAO } from "@/database/models/Credits.dao";
import type {
  ImageGenerationProvider,
  PosterGeneratedAsset,
  PosterGenerationSession,
  PosterIterationRecord,
  PosterQcResult,
} from "../types";
import {
  createPosterGenerationSessionService,
  type PosterGenerationSessionService,
} from "../session";
import { buildImageGenerationRequest } from "../generation/nano-banana-prompt";
import { assertValidGenerationSpecification } from "../generation/specification-validation";
import { assertGenerationSpecificationShape } from "../guards";
import { getDefaultPosterImageProvider } from "../generation/provider-router";
import { storePosterGeneratedImage } from "../generation/storage";
import { runPosterQcForSession } from "../qc/run-for-session";
import { classifyIterationRequest } from "./classifier";
import type { IterationClassifierInput } from "./classifier-input";
import { buildIterationPlan, type IterationPlan } from "./iteration-planner";
import {
  applyIterationToSpecification,
  assertPreservationInvariants,
} from "./specification-patcher";
import {
  iterationRecordFromPlan,
  validateIterationPlan,
} from "./iteration-validation";
import { PosterIterationError } from "./iteration-errors";
import {
  releaseIterationLock,
  tryAcquireIterationLock,
} from "../concurrency";
import { publicErrorMessage } from "../production-safety";

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

async function defaultGetBalance(userId: string): Promise<number> {
  const balance = await CreditsDAO.getFullBalance(userId);
  return balance?.imageCredits.total ?? 0;
}

async function defaultDeduct(userId: string, amount: number): Promise<boolean> {
  const result = await CreditsDAO.deductImageCredits(userId, amount);
  return !!result.success;
}

export type PlanPosterIterationOptions = {
  sessionId: string;
  userId: string;
  generationId: string;
  request: string;
  sessionService?: PosterGenerationSessionService;
  /** When true, persist planned iteration on session */
  persist?: boolean;
};

export type PlanPosterIterationResult = {
  session: PosterGenerationSession;
  plan: IterationPlan;
  iteration: PosterIterationRecord;
  creditsCharged: 0;
};

export type ExecutePosterIterationOptions = {
  sessionId: string;
  userId: string;
  /** Execute a previously planned iteration */
  iterationId?: string;
  /** Or plan+execute in one shot */
  generationId?: string;
  request?: string;
  sessionService?: PosterGenerationSessionService;
  provider?: ImageGenerationProvider;
  storeImage?: typeof storePosterGeneratedImage;
  credits?: {
    getBalance: (userId: string) => Promise<number>;
    deduct: (userId: string, amount: number) => Promise<boolean>;
  };
  skipStorage?: boolean;
  skipQc?: boolean;
};

export type ExecutePosterIterationResult = {
  session: PosterGenerationSession;
  plan: IterationPlan;
  iteration: PosterIterationRecord;
  specificationId: string;
  generationId: string;
  asset: PosterGeneratedAsset;
  qc: PosterQcResult | null;
  creditsCharged: number;
  providerPath: "edit" | "controlled_regeneration";
};

function loadClassifierInput(
  session: PosterGenerationSession,
  generationId: string,
  userRequest: string
): IterationClassifierInput {
  const parentAsset = session.assets.find(
    (a) => a.generationId === generationId || a.id === generationId
  );
  if (!parentAsset || parentAsset.status !== "generated" || !parentAsset.imageUrl) {
    throw new PosterIterationError({
      code: "MISSING_ASSET",
      message: "Generated poster not found for iteration",
      stage: "loadClassifierInput",
    });
  }

  const specification = session.specifications.find(
    (s) =>
      s.id === parentAsset.specificationId ||
      s.generationId === parentAsset.generationId
  );
  if (!specification) {
    throw new PosterIterationError({
      code: "MISSING_SPEC",
      message: "GenerationSpecification not found for parent poster",
      stage: "loadClassifierInput",
    });
  }

  if (!session.strategy) {
    throw new PosterIterationError({
      code: "MISSING_STRATEGY",
      message: "MarketingStrategy required for iteration",
      stage: "loadClassifierInput",
    });
  }

  const concept = session.concepts.find((c) => c.id === parentAsset.conceptId);
  if (!concept) {
    throw new PosterIterationError({
      code: "MISSING_CONCEPT",
      message: "CreativeConcept not found for parent poster",
      stage: "loadClassifierInput",
    });
  }

  const dna =
    session.dnaByConceptId[parentAsset.conceptId] ||
    session.dnaByConceptId[concept.id];
  if (!dna) {
    throw new PosterIterationError({
      code: "MISSING_DNA",
      message: "CreativeDNA not found for parent poster",
      stage: "loadClassifierInput",
    });
  }

  return {
    userRequest,
    specification,
    concept,
    dna,
    strategy: session.strategy,
    parentAsset,
  };
}

export async function planPosterIterationForSession(
  options: PlanPosterIterationOptions
): Promise<PlanPosterIterationResult> {
  const sessions =
    options.sessionService ?? createPosterGenerationSessionService();
  let session = await sessions.getSession(options.sessionId, options.userId);

  if (!session.brief) {
    throw new PosterIterationError({
      code: "MISSING_BRIEF",
      message: "CreativeBrief required",
      stage: "planPosterIterationForSession",
    });
  }

  const input = loadClassifierInput(
    session,
    options.generationId,
    options.request
  );
  const classification = classifyIterationRequest(input);
  const plan = buildIterationPlan({
    iterationId: newId("iter"),
    input,
    classification,
  });
  validateIterationPlan(plan);

  let iteration = iterationRecordFromPlan(plan, "planned");
  iteration = {
    ...iteration,
    request: {
      ...iteration.request,
      sessionId: session.id,
    },
  };

  if (options.persist !== false) {
    session = await sessions.addIteration(
      options.sessionId,
      options.userId,
      iteration
    );
  }

  return {
    session,
    plan,
    iteration,
    creditsCharged: 0,
  };
}

export async function executePosterIterationForSession(
  options: ExecutePosterIterationOptions
): Promise<ExecutePosterIterationResult> {
  const lockKey = `${options.sessionId}:${options.iterationId || options.generationId || "new"}`;
  if (!tryAcquireIterationLock(lockKey)) {
    throw new PosterIterationError({
      code: "CONFLICT",
      message: "An update is already in progress for this poster. Please wait.",
      stage: "concurrency",
      retryable: true,
    });
  }

  try {
    return await executePosterIterationForSessionUnlocked(options);
  } finally {
    releaseIterationLock(lockKey);
  }
}

async function executePosterIterationForSessionUnlocked(
  options: ExecutePosterIterationOptions
): Promise<ExecutePosterIterationResult> {
  const sessions =
    options.sessionService ?? createPosterGenerationSessionService();
  const provider = options.provider ?? getDefaultPosterImageProvider();
  const storeImage = options.storeImage ?? storePosterGeneratedImage;
  const getBalance = options.credits?.getBalance ?? defaultGetBalance;
  const deduct = options.credits?.deduct ?? defaultDeduct;

  let session = await sessions.getSession(options.sessionId, options.userId);

  let plan: IterationPlan;
  let iteration: PosterIterationRecord;

  if (options.iterationId) {
    const existing = session.iterations.find((i) => i.id === options.iterationId);
    if (!existing || !existing.locks || !existing.changes) {
      throw new PosterIterationError({
        code: "NOT_FOUND",
        message: "Planned iteration not found",
        stage: "executePosterIterationForSession",
      });
    }
    if (existing.status === "completed" && existing.resultingGenerationId) {
      // Idempotent replay — return existing child, no new charge
      const asset = session.assets.find(
        (a) => a.generationId === existing.resultingGenerationId
      );
      if (asset?.status === "generated" && asset.imageUrl) {
        return {
          session,
          plan: {
            iterationId: existing.id,
            parentGenerationId:
              existing.parentGenerationId || existing.request.targetGenerationId,
            sourceSpecificationId: existing.sourceSpecificationId || "",
            mode: existing.mode || "LOCAL",
            classification: existing.classification,
            classificationDetail: existing.classificationDetail || {
              target: existing.changes.target,
              rationale: existing.changes.summary,
              confidence: 0.8,
            },
            locks: existing.locks,
            changes: existing.changes,
            preservedDnaFields: existing.preservedDnaFields,
            changedDnaFields: existing.changedDnaFields,
            userFacingSummary:
              existing.userFacingSummary || existing.changes.summary,
            userRequest: existing.request.userInstruction,
          },
          iteration: existing,
          specificationId: asset.specificationId,
          generationId: asset.generationId,
          asset,
          qc: asset.qc || null,
          creditsCharged: 0,
          providerPath: "controlled_regeneration",
        };
      }
    }
    if (existing.status === "generating") {
      throw new PosterIterationError({
        code: "CONFLICT",
        message: "An update is already in progress for this poster. Please wait.",
        stage: "status",
        retryable: true,
      });
    }
    if (existing.status === "failed") {
      throw new PosterIterationError({
        code: "VALIDATION",
        message: "This edit already failed. Describe a new change to try again.",
        stage: "status",
      });
    }
    plan = {
      iterationId: existing.id,
      parentGenerationId:
        existing.parentGenerationId || existing.request.targetGenerationId,
      sourceSpecificationId: existing.sourceSpecificationId || "",
      mode: existing.mode || "LOCAL",
      classification: existing.classification,
      classificationDetail: existing.classificationDetail || {
        target: existing.changes.target,
        rationale: existing.changes.summary,
        confidence: 0.8,
      },
      locks: existing.locks,
      changes: existing.changes,
      preservedDnaFields: existing.preservedDnaFields,
      changedDnaFields: existing.changedDnaFields,
      userFacingSummary:
        existing.userFacingSummary || existing.changes.summary,
      userRequest: existing.request.userInstruction,
    };
    iteration = existing;
  } else {
    if (!options.generationId || !options.request?.trim()) {
      throw new PosterIterationError({
        code: "VALIDATION",
        message: "generationId and request are required when iterationId is omitted",
        stage: "executePosterIterationForSession",
      });
    }
    const planned = await planPosterIterationForSession({
      sessionId: options.sessionId,
      userId: options.userId,
      generationId: options.generationId,
      request: options.request,
      sessionService: sessions,
      persist: true,
    });
    session = planned.session;
    plan = planned.plan;
    iteration = planned.iteration;
  }

  validateIterationPlan(plan);

  const input = loadClassifierInput(
    session,
    plan.parentGenerationId,
    plan.userRequest
  );

  // Security: never accept browser strategy/spec — always use session artifacts
  const updatedSpec = applyIterationToSpecification({
    source: input.specification,
    plan,
  });
  assertPreservationInvariants({
    source: input.specification,
    updated: updatedSpec,
    plan,
  });

  // Copy-modify iterations intentionally diverge from strategy.userOverrides
  if (plan.locks.copy === "MODIFY") {
    if (!assertGenerationSpecificationShape(updatedSpec)) {
      throw new PosterIterationError({
        code: "PLAN_INVALID",
        message: "Updated specification failed shape validation",
        stage: "validateSpec",
      });
    }
  } else {
    assertValidGenerationSpecification(updatedSpec, session.strategy!);
  }

  const caps = provider.getCapabilities();
  const providerPath: "edit" | "controlled_regeneration" = caps.supportsEdit
    ? "edit"
    : "controlled_regeneration";

  if (!caps.supportsGenerate && !caps.supportsEdit) {
    throw new PosterIterationError({
      code: "PROVIDER_UNAVAILABLE",
      message: publicErrorMessage("PROVIDER_UNAVAILABLE"),
      stage: "capabilities",
      retryable: true,
    });
  }

  if (!caps.supportsEdit && !caps.supportsReferenceImages) {
    throw new PosterIterationError({
      code: "PROVIDER_UNAVAILABLE",
      message: publicErrorMessage("PROVIDER_UNAVAILABLE"),
      stage: "capabilities",
      retryable: false,
    });
  }

  const balance = await getBalance(options.userId);
  if (balance < 1) {
    throw new PosterIterationError({
      code: "INSUFFICIENT_CREDITS",
      message: publicErrorMessage("INSUFFICIENT_CREDITS"),
      stage: "credits",
    });
  }

  iteration = {
    ...iteration,
    status: "generating",
  };
  session = await sessions.addIteration(
    options.sessionId,
    options.userId,
    iteration
  );

  session = await sessions.addGenerationSpecification(
    options.sessionId,
    options.userId,
    updatedSpec
  );

  const request = buildImageGenerationRequest({
    specification: updatedSpec,
    userId: options.userId,
    mode: caps.supportsEdit ? "edit" : "generate",
    baseImageUrl: input.parentAsset.imageUrl,
  });

  session = await sessions.addGenerationSpecification(
    options.sessionId,
    options.userId,
    { ...updatedSpec, compiledPrompt: request.prompt }
  );

  const result = caps.supportsEdit
    ? await provider.edit(request)
    : await provider.generate(request);

  if (!result.ok || !result.imageDataUrl) {
    console.error("[posterIterate] provider failed", {
      iterationId: plan.iterationId,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    });
    iteration = {
      ...iteration,
      status: "failed",
      errorMessage: publicErrorMessage(
        result.errorCode || "PROVIDER_FAILED"
      ),
    };
    session = await sessions.addIteration(
      options.sessionId,
      options.userId,
      iteration
    );
    throw new PosterIterationError({
      code: "PROVIDER_FAILED",
      message: publicErrorMessage("PROVIDER_FAILED"),
      stage: "generate",
      retryable: true,
    });
  }

  let imageUrl = result.imageDataUrl;
  let storagePath: string | null = null;
  if (!options.skipStorage && result.imageBuffer) {
    try {
      const stored = await storeImage({
        userId: options.userId,
        sessionId: options.sessionId,
        generationId: updatedSpec.generationId,
        buffer: result.imageBuffer,
      });
      imageUrl = stored.publicUrl;
      storagePath = stored.storagePath;
    } catch (e) {
      console.warn("[posterIterate] storage failed, keeping data URL", e);
    }
  }

  const deducted = await deduct(options.userId, 1);
  if (!deducted) {
    console.error(
      "[posterIterate] credit deduct failed — not releasing child as success",
      { userId: options.userId, generationId: updatedSpec.generationId }
    );
    iteration = {
      ...iteration,
      status: "failed",
      errorMessage: publicErrorMessage("INSUFFICIENT_CREDITS"),
    };
    session = await sessions.addIteration(
      options.sessionId,
      options.userId,
      iteration
    );
    throw new PosterIterationError({
      code: "INSUFFICIENT_CREDITS",
      message: publicErrorMessage("INSUFFICIENT_CREDITS"),
      stage: "credits",
    });
  }
  const creditsCharged = 1;

  const parentVersion = input.parentAsset.versionNumber || 1;
  const asset: PosterGeneratedAsset = {
    id: updatedSpec.generationId,
    sessionId: session.id,
    generationId: updatedSpec.generationId,
    variantId: updatedSpec.variantId,
    variantIndex: updatedSpec.variantIndex,
    conceptId: updatedSpec.conceptId,
    dnaId: updatedSpec.dnaId,
    specificationId: updatedSpec.id,
    imageUrl,
    storagePath,
    provider: result.provider,
    model: result.model,
    creditsConsumed: 1,
    status: "generated",
    attemptCount: 1,
    durationMs: result.durationMs ?? null,
    createdAt: new Date().toISOString(),
    parentGenerationId: plan.parentGenerationId,
    iterationId: plan.iterationId,
    versionNumber: parentVersion + 1,
    isActive: true,
  };

  // Mark parent inactive (soft) — never delete/overwrite
  const parentUpdate: PosterGeneratedAsset = {
    ...input.parentAsset,
    isActive: false,
  };
  session = await sessions.addGeneratedAsset(
    options.sessionId,
    options.userId,
    parentUpdate
  );
  session = await sessions.addGeneratedAsset(
    options.sessionId,
    options.userId,
    asset
  );

  let qc: PosterQcResult | null = null;
  if (!options.skipQc) {
    try {
      const qcResult = await runPosterQcForSession({
        sessionId: options.sessionId,
        userId: options.userId,
        generationId: asset.generationId,
        sessionService: sessions,
      });
      session = qcResult.session;
      qc = qcResult.qc;
    } catch (e) {
      console.warn("[posterIterate] QC failed (non-fatal for iteration)", e);
    }
  }

  iteration = {
    ...iteration,
    status: "completed",
    resultingGenerationId: asset.generationId,
    resultingSpecificationId: updatedSpec.id,
    errorMessage: null,
  };
  session = await sessions.addIteration(
    options.sessionId,
    options.userId,
    iteration
  );

  return {
    session,
    plan,
    iteration,
    specificationId: updatedSpec.id,
    generationId: asset.generationId,
    asset,
    qc,
    creditsCharged,
    providerPath,
  };
}

/**
 * One-shot: plan + execute (used when UI confirms immediately).
 */
export async function runPosterIterationForSession(
  options: Omit<ExecutePosterIterationOptions, "iterationId"> & {
    generationId: string;
    request: string;
  }
): Promise<ExecutePosterIterationResult> {
  return executePosterIterationForSession(options);
}
