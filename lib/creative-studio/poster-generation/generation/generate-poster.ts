/**
 * Poster generation service — Phase 6.
 * Session → spec → provider → asset. Credits only on successful images.
 */

import { CreditsDAO } from "@/database/models/Credits.dao";
import type { ImageGenerationProvider } from "../types";
import type {
  CreativeConcept,
  CreativeDNA,
  GenerationSpecification,
  PosterGeneratedAsset,
  PosterGenerationSession,
} from "../types";
import {
  createPosterGenerationSessionService,
  type PosterGenerationSessionService,
} from "../session";
import { strategistInputFromBrief } from "../strategy/from-brief";
import { buildGenerationSpecification } from "./specification-builder";
import { assertValidGenerationSpecification } from "./specification-validation";
import { buildImageGenerationRequest } from "./nano-banana-prompt";
import { getDefaultPosterImageProvider } from "./provider-router";
import { storePosterGeneratedImage } from "./storage";
import { PosterGenerationError } from "./generation-errors";
import { isPosterAspectSupported } from "./nano-banana-provider";
import {
  releaseGenerationLock,
  tryAcquireGenerationLock,
} from "../concurrency";
import { publicErrorMessage } from "../production-safety";

export type GeneratePostersOptions = {
  sessionId: string;
  userId: string;
  /** Specific concept; otherwise selectedConceptIds / all concepts */
  conceptId?: string | null;
  /** How many images to generate (defaults to selected/all concepts length, max 3) */
  variantCount?: number | null;
  forceRegenerate?: boolean;
  provider?: ImageGenerationProvider;
  sessionService?: PosterGenerationSessionService;
  /** Inject storage for tests */
  storeImage?: typeof storePosterGeneratedImage;
  /** Inject credits for tests */
  credits?: {
    getBalance: (userId: string) => Promise<number>;
    deduct: (userId: string, amount: number) => Promise<boolean>;
  };
  /** Outer provider failure retries per variant (not billable extras) */
  maxProviderRetries?: number;
  /** Skip live provider — tests only */
  skipStorage?: boolean;
};

export type VariantGenerationOutcome = {
  variantId: string;
  variantIndex: number;
  conceptId: string;
  generationId: string;
  specification: GenerationSpecification;
  asset: PosterGeneratedAsset;
  success: boolean;
  attempts: number;
};

export type GeneratePostersResult = {
  session: PosterGenerationSession;
  outcomes: VariantGenerationOutcome[];
  requestedVariants: number;
  successfulVariants: number;
  failedVariants: number;
  actualAttempts: number;
  creditsCharged: number;
  partial: boolean;
  reused: boolean;
};

function clampVariants(n: number): number {
  if (n < 1) return 1;
  if (n > 3) return 3;
  return Math.floor(n);
}

function resolveConcepts(
  session: PosterGenerationSession,
  conceptId: string | null | undefined,
  variantCount: number
): CreativeConcept[] {
  if (conceptId) {
    const c = session.concepts.find((x) => x.id === conceptId);
    if (!c) {
      throw new PosterGenerationError({
        code: "MISSING_CONCEPT",
        message: `Concept not found on session: ${conceptId}`,
        stage: "resolveConcepts",
      });
    }
    // Same concept, N variants (usually 1)
    return Array.from({ length: variantCount }, () => c);
  }

  const selected = session.selectedConceptIds.length
    ? session.concepts.filter((c) =>
        session.selectedConceptIds.includes(c.id)
      )
    : session.concepts;

  if (!selected.length) {
    throw new PosterGenerationError({
      code: "MISSING_CONCEPT",
      message:
        "No concepts available. Generate concepts and select at least one before generating posters.",
      stage: "resolveConcepts",
    });
  }

  return selected.slice(0, variantCount);
}

async function defaultGetBalance(userId: string): Promise<number> {
  const balance = await CreditsDAO.getFullBalance(userId);
  return balance?.imageCredits.total ?? 0;
}

async function defaultDeduct(userId: string, amount: number): Promise<boolean> {
  const result = await CreditsDAO.deductImageCredits(userId, amount);
  return !!result.success;
}

export async function generatePostersForSession(
  options: GeneratePostersOptions
): Promise<GeneratePostersResult> {
  if (!tryAcquireGenerationLock(options.sessionId)) {
    throw new PosterGenerationError({
      code: "CONFLICT",
      message: "A poster is already being generated for this session. Please wait.",
      stage: "concurrency",
      retryable: true,
    });
  }

  try {
    return await generatePostersForSessionUnlocked(options);
  } finally {
    releaseGenerationLock(options.sessionId);
  }
}

async function generatePostersForSessionUnlocked(
  options: GeneratePostersOptions
): Promise<GeneratePostersResult> {
  const sessions =
    options.sessionService ?? createPosterGenerationSessionService();
  const provider = options.provider ?? getDefaultPosterImageProvider();
  const storeImage = options.storeImage ?? storePosterGeneratedImage;
  const getBalance = options.credits?.getBalance ?? defaultGetBalance;
  const deduct = options.credits?.deduct ?? defaultDeduct;
  const maxRetries = options.maxProviderRetries ?? 1;

  let session = await sessions.getSession(options.sessionId, options.userId);

  if (!session.brief) {
    throw new PosterGenerationError({
      code: "MISSING_BRIEF",
      message: "CreativeBrief required before generation",
      stage: "generatePostersForSession",
    });
  }
  if (!session.strategy) {
    throw new PosterGenerationError({
      code: "MISSING_STRATEGY",
      message: "MarketingStrategy required before generation",
      stage: "generatePostersForSession",
    });
  }
  if (session.strategy.briefId !== session.brief.id) {
    throw new PosterGenerationError({
      code: "STALE_STRATEGY",
      message: "Strategy does not match current brief",
      stage: "generatePostersForSession",
    });
  }
  if (!isPosterAspectSupported(session.brief.aspectRatio)) {
    throw new PosterGenerationError({
      code: "VALIDATION",
      message: `Unsupported aspect ratio: ${session.brief.aspectRatio}`,
      stage: "generatePostersForSession",
    });
  }

  const requestedVariants = clampVariants(
    options.variantCount ??
      (options.conceptId
        ? 1
        : session.selectedConceptIds.length ||
          session.concepts.length ||
          session.brief.variantCount ||
          1)
  );

  const concepts = resolveConcepts(
    session,
    options.conceptId,
    requestedVariants
  );

  // Idempotency: reuse successful assets for these concept IDs unless forced
  if (!options.forceRegenerate) {
    const conceptIds = new Set(concepts.map((c) => c.id));
    const existing = session.assets.filter(
      (a) => a.status === "generated" && conceptIds.has(a.conceptId)
    );
    if (existing.length >= requestedVariants) {
      return {
        session,
        outcomes: existing.slice(0, requestedVariants).map((asset) => {
          const specification =
            session.specifications.find((s) => s.id === asset.specificationId) ||
            ({
              id: asset.specificationId,
              sessionId: session.id,
              generationId: asset.generationId,
              variantId: asset.variantId,
            } as GenerationSpecification);
          return {
            variantId: asset.variantId,
            variantIndex: asset.variantIndex,
            conceptId: asset.conceptId,
            generationId: asset.generationId,
            specification,
            asset,
            success: true,
            attempts: asset.attemptCount || 1,
          };
        }),
        requestedVariants,
        successfulVariants: requestedVariants,
        failedVariants: 0,
        actualAttempts: 0,
        creditsCharged: 0,
        partial: false,
        reused: true,
      };
    }
  }

  const availability = await provider.checkAvailability();
  if (!availability.available) {
    throw new PosterGenerationError({
      code: "PROVIDER_UNAVAILABLE",
      message: publicErrorMessage("PROVIDER_UNAVAILABLE"),
      stage: "checkAvailability",
      retryable: true,
    });
  }

  const balance = await getBalance(options.userId);
  if (balance < requestedVariants) {
    throw new PosterGenerationError({
      code: "INSUFFICIENT_CREDITS",
      message: publicErrorMessage("INSUFFICIENT_CREDITS"),
      stage: "credits",
      retryable: false,
    });
  }

  const contexts = strategistInputFromBrief(session.brief);
  session = await sessions.startGeneration(options.sessionId, options.userId);

  const outcomes: VariantGenerationOutcome[] = [];
  let creditsCharged = 0;
  let actualAttempts = 0;

  for (let i = 0; i < concepts.length; i++) {
    const concept = concepts[i];
    const dna: CreativeDNA | undefined = session.dnaByConceptId[concept.id];
    if (!dna) {
      throw new PosterGenerationError({
        code: "MISSING_DNA",
        message: `CreativeDNA missing for concept ${concept.id}`,
        stage: "generatePostersForSession",
      });
    }

    const spec = buildGenerationSpecification({
      sessionId: session.id,
      brief: session.brief!,
      strategy: session.strategy!,
      concept,
      dna,
      product: contexts.product,
      brand: contexts.brand,
      references: contexts.references,
      variantIndex: i,
    });

    assertValidGenerationSpecification(spec, session.strategy!);

    session = await sessions.addGenerationSpecification(
      options.sessionId,
      options.userId,
      spec
    );

    let attempts = 0;
    let lastError: string | null = null;
    let lastErrorCode: string | null = null;
    let successAsset: PosterGeneratedAsset | null = null;
    let durationMs = 0;

    while (attempts <= maxRetries && !successAsset) {
      attempts += 1;
      actualAttempts += 1;

      const request = buildImageGenerationRequest({
        specification: spec,
        userId: options.userId,
      });

      // Persist compiled prompt on spec for debug
      session = await sessions.addGenerationSpecification(
        options.sessionId,
        options.userId,
        { ...spec, compiledPrompt: request.prompt }
      );

      const result = await provider.generate(request);
      durationMs = result.durationMs || 0;

      if (!result.ok || !result.imageDataUrl) {
        console.error("[posterGenerate] provider failed", {
          generationId: spec.generationId,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
        });
        lastError = publicErrorMessage(
          result.errorCode || "PROVIDER_FAILED"
        );
        lastErrorCode = result.errorCode || "PROVIDER_FAILED";
        continue;
      }

      let imageUrl = result.imageDataUrl;
      let storagePath: string | null = null;

      if (!options.skipStorage && result.imageBuffer) {
        try {
          const stored = await storeImage({
            userId: options.userId,
            sessionId: session.id,
            generationId: spec.generationId,
            buffer: result.imageBuffer,
          });
          imageUrl = stored.publicUrl;
          storagePath = stored.storagePath;
        } catch (e) {
          // Fall back to data URL — still a successful generation
          console.warn("[posterGenerate] storage failed, using data URL", e);
        }
      }

      // Charge only after successful image — never give free images
      const deducted = await deduct(options.userId, 1);
      if (!deducted) {
        console.error(
          "[posterGenerate] credit deduct failed after successful generation — not releasing asset as billed success",
          { userId: options.userId, generationId: spec.generationId }
        );
        lastError = publicErrorMessage("INSUFFICIENT_CREDITS");
        lastErrorCode = "INSUFFICIENT_CREDITS";
        continue;
      }
      creditsCharged += 1;

      successAsset = {
        id: spec.generationId,
        sessionId: session.id,
        generationId: spec.generationId,
        variantId: spec.variantId,
        variantIndex: i,
        conceptId: concept.id,
        dnaId: dna.id,
        specificationId: spec.id,
        imageUrl,
        storagePath,
        provider: result.provider,
        model: result.model,
        creditsConsumed: 1,
        status: "generated",
        attemptCount: attempts,
        durationMs,
        createdAt: new Date().toISOString(),
      };
    }

    if (successAsset) {
      session = await sessions.addGeneratedAsset(
        options.sessionId,
        options.userId,
        successAsset
      );
      outcomes.push({
        variantId: spec.variantId,
        variantIndex: i,
        conceptId: concept.id,
        generationId: spec.generationId,
        specification: { ...spec, compiledPrompt: spec.compiledPrompt },
        asset: successAsset,
        success: true,
        attempts,
      });
    } else {
      const failedAsset: PosterGeneratedAsset = {
        id: spec.generationId,
        sessionId: session.id,
        generationId: spec.generationId,
        variantId: spec.variantId,
        variantIndex: i,
        conceptId: concept.id,
        dnaId: dna.id,
        specificationId: spec.id,
        imageUrl: "",
        provider: provider.id,
        model: (provider as { modelId?: string }).modelId || "unknown",
        creditsConsumed: 0,
        status: "failed",
        attemptCount: attempts,
        durationMs,
        errorCode: lastErrorCode,
        errorMessage: lastError,
        createdAt: new Date().toISOString(),
      };
      session = await sessions.addGeneratedAsset(
        options.sessionId,
        options.userId,
        failedAsset
      );
      outcomes.push({
        variantId: spec.variantId,
        variantIndex: i,
        conceptId: concept.id,
        generationId: spec.generationId,
        specification: spec,
        asset: failedAsset,
        success: false,
        attempts,
      });
    }
  }

  const successfulVariants = outcomes.filter((o) => o.success).length;
  const failedVariants = outcomes.filter((o) => !o.success).length;
  const partial = successfulVariants > 0 && failedVariants > 0;

    if (successfulVariants === 0) {
    session = await sessions.failSession(options.sessionId, options.userId, {
      code: "PROVIDER_FAILED",
      stage: "generate",
      message: "All poster variants failed to generate",
      retryable: true,
    });
  } else {
    // Phase 7: successful assets already moved session to `qc` via addGeneratedAsset.
    // Do not auto-complete — Poster QC must evaluate first.
    session = await sessions.getSession(options.sessionId, options.userId);
  }

  return {
    session,
    outcomes,
    requestedVariants,
    successfulVariants,
    failedVariants,
    actualAttempts,
    creditsCharged,
    partial,
    reused: false,
  };
}
