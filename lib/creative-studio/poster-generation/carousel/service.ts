/**
 * Carousel campaign service — plan → per-slide spec → existing provider → storage
 * → atomic commit+charge → existing Poster QC. Slide iteration reuses the Phase 8
 * pure iteration functions.
 *
 * Concurrency model: slides are claimed with a DB-persisted lease (row lock), so
 * multiple server instances / tabs cannot generate the same slide concurrently.
 * Each request works within a time budget; the client re-calls generate to resume.
 */

import { randomUUID } from "crypto";
import { CreditsDAO } from "@/database/models/Credits.dao";
import type { StructuredGenerator } from "@/lib/creative-studio/commercial-production/commercial-director/llm";
import { buildImageGenerationRequest } from "../generation/nano-banana-prompt";
import { isPosterAspectSupported } from "../generation/nano-banana-provider";
import { getDefaultPosterImageProvider } from "../generation/provider-router";
import { assertValidGenerationSpecification } from "../generation/specification-validation";
import { storePosterGeneratedImage } from "../generation/storage";
import { assertGenerationSpecificationShape } from "../guards";
import { classifyIterationRequest } from "../iteration/classifier";
import { buildIterationPlan } from "../iteration/iteration-planner";
import {
  iterationRecordFromPlan,
  validateIterationPlan,
} from "../iteration/iteration-validation";
import {
  applyIterationToSpecification,
  assertPreservationInvariants,
} from "../iteration/specification-patcher";
import { publicErrorMessage } from "../production-safety";
import { runPosterQc } from "../qc/qc-engine";
import type { PosterQcInput } from "../qc/qc-input";
import { strategistInputFromBrief } from "../strategy/from-brief";
import type {
  GenerationSpecification,
  ImageGenerationProvider,
  PosterGeneratedAsset,
  PosterGenerationSession,
  PosterIterationRecord,
  PosterQcResult,
} from "../types";
import { runCarouselCampaignChecks } from "./campaign-checks";
import { PosterCarouselError } from "./errors";
import {
  buildCarouselExport,
  defaultSlideImageLoader,
  isExportableSlide,
  type SlideImageLoader,
} from "./export";
import {
  DrizzleCarouselRepository,
  type CarouselRepository,
} from "./repository";
import { planCarouselStory } from "./story-planner";
import { groundingCorpusFor } from "./story-validation";
import { findUnsupportedClaims } from "./text-analysis";
import {
  claimSlide,
  commitGenerated,
  effectiveSlideStatus,
  failAttempt,
  needsInitialGeneration,
  reconcileCampaignStatus,
  recordQc,
  settleUnbilled,
  type ClaimInput,
} from "./transitions";
import type {
  CarouselCampaign,
  CarouselCampaignWithSlides,
  CarouselLeaseKind,
  CarouselSlide,
  CarouselSlideError,
  CarouselSlideStatus,
} from "./types";
import { CAROUSEL_SUCCESS_STATUSES } from "./types";
import {
  buildSlideSpecification,
  slideStrategyView,
  type CampaignDirection,
} from "./visual-system";

export type CarouselSessionReader = {
  getSession(sessionId: string, userId: string): Promise<PosterGenerationSession>;
};

export type CarouselServiceDeps = {
  repo: CarouselRepository;
  sessions: CarouselSessionReader;
  provider: ImageGenerationProvider;
  generator?: StructuredGenerator;
  runQc: (input: PosterQcInput) => Promise<PosterQcResult>;
  storeImage: typeof storePosterGeneratedImage;
  loadImage: SlideImageLoader;
  getBalance: (userId: string) => Promise<number>;
  /** Parallel provider calls per request (default 2) */
  concurrency?: number;
  /** Lease length; must exceed one provider+storage+commit cycle (default 6 min) */
  leaseMs?: number;
  /** Stop starting new slides after this long; client resumes (default 200s) */
  timeBudgetMs?: number;
  now?: () => number;
  newId?: (prefix: string) => string;
};

export type CarouselGenerateResult = {
  data: CarouselCampaignWithSlides;
  creditsCharged: number;
  attemptedSlides: number;
  /** Slides still waiting for a first generation after this request */
  remainingSlides: number;
  /** Slides currently generating in another request */
  inFlightSlides: number;
};

export type CarouselSlideActionResult = {
  data: CarouselCampaignWithSlides;
  slide: CarouselSlide;
  creditsCharged: number;
  replayed: boolean;
};

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function parseIdempotencyKey(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string" || !IDEMPOTENCY_KEY_RE.test(raw)) {
    throw new PosterCarouselError({
      code: "VALIDATION",
      message: "requestId must be 8–64 characters (letters, digits, - or _)",
      stage: "idempotency",
    });
  }
  return raw;
}

function defaultNewId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function slideError(code: string, retryable = true): CarouselSlideError {
  return { code, message: publicErrorMessage(code), retryable };
}

async function withOneRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return fn();
  }
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

type SessionContext = {
  session: PosterGenerationSession;
  brief: NonNullable<PosterGenerationSession["brief"]>;
  strategy: NonNullable<PosterGenerationSession["strategy"]>;
  contexts: ReturnType<typeof strategistInputFromBrief>;
};

export class PosterCarouselService {
  private readonly deps: Required<
    Omit<CarouselServiceDeps, "generator">
  > & { generator?: StructuredGenerator };

  constructor(deps: CarouselServiceDeps) {
    this.deps = {
      concurrency: 2,
      leaseMs: 6 * 60_000,
      timeBudgetMs: 200_000,
      now: () => Date.now(),
      newId: defaultNewId,
      ...deps,
    };
  }

  private nowMs(): number {
    return this.deps.now();
  }

  private iso(): string {
    return new Date(this.nowMs()).toISOString();
  }

  // ── Session (authoritative strategy / brief / product facts) ──────────

  private async loadSessionContext(sessionId: string, userId: string): Promise<SessionContext> {
    let session: PosterGenerationSession;
    try {
      session = await this.deps.sessions.getSession(sessionId, userId);
    } catch (err) {
      if ((err as { code?: string })?.code === "NOT_FOUND") {
        throw new PosterCarouselError({ code: "NOT_FOUND", message: "Session not found", stage: "session" });
      }
      throw err;
    }
    if (!session.brief) {
      throw new PosterCarouselError({ code: "MISSING_BRIEF", message: "CreativeBrief required", stage: "session" });
    }
    if (!session.strategy) {
      throw new PosterCarouselError({ code: "MISSING_STRATEGY", message: "MarketingStrategy required", stage: "session" });
    }
    if (session.strategy.briefId !== session.brief.id) {
      throw new PosterCarouselError({ code: "STALE_STRATEGY", message: "Strategy does not match the current brief", stage: "session" });
    }
    if (!isPosterAspectSupported(session.brief.aspectRatio)) {
      throw new PosterCarouselError({ code: "VALIDATION", message: `Unsupported aspect ratio: ${session.brief.aspectRatio}`, stage: "session" });
    }
    return {
      session,
      brief: session.brief,
      strategy: session.strategy,
      contexts: strategistInputFromBrief(session.brief),
    };
  }

  private assertCampaignMatchesSession(campaign: CarouselCampaign, ctx: SessionContext): void {
    if (campaign.strategyId !== ctx.strategy.id || campaign.briefId !== ctx.brief.id) {
      throw new PosterCarouselError({
        code: "STALE_STRATEGY",
        message: "The campaign strategy changed since this carousel was planned. Plan the carousel again.",
        stage: "campaign",
      });
    }
  }

  private resolveDirection(ctx: SessionContext, conceptId: string | null): CampaignDirection {
    const id = conceptId || ctx.session.selectedConceptIds[0] || null;
    if (!id) return null;
    const concept = ctx.session.concepts.find((c) => c.id === id);
    const dna = concept ? ctx.session.dnaByConceptId[concept.id] : undefined;
    if (!concept || !dna) {
      throw new PosterCarouselError({ code: "MISSING_CONCEPT", message: "Creative direction not found on session", stage: "direction" });
    }
    if (concept.strategyId !== ctx.strategy.id) {
      throw new PosterCarouselError({ code: "STALE_STRATEGY", message: "Creative direction belongs to an older strategy", stage: "direction" });
    }
    return { concept, dna };
  }

  private async mustFind(campaignId: string, userId: string): Promise<CarouselCampaignWithSlides> {
    const data = await this.deps.repo.findCampaign(campaignId, userId);
    if (!data) {
      throw new PosterCarouselError({ code: "NOT_FOUND", message: "Carousel not found", stage: "campaign" });
    }
    return data;
  }

  // ── Planning (0 credits) ──────────────────────────────────────────────

  async plan(input: {
    sessionId: string;
    userId: string;
    slideCount: number;
    conceptId?: string | null;
    /** Regenerate the story even when a matching plan exists */
    force?: boolean;
  }): Promise<{ data: CarouselCampaignWithSlides; reused: boolean }> {
    const ctx = await this.loadSessionContext(input.sessionId, input.userId);
    const direction = this.resolveDirection(ctx, input.conceptId ?? null);
    const existing = await this.deps.repo.findLatestForSession(input.sessionId, input.userId);

    const matches =
      existing &&
      existing.campaign.strategyId === ctx.strategy.id &&
      existing.campaign.briefId === ctx.brief.id &&
      existing.campaign.slideCount === input.slideCount &&
      existing.campaign.sharedDNA.directionConceptId === (direction?.concept.id ?? null);
    if (existing && matches && !input.force) {
      return { data: existing, reused: true };
    }

    const notStarted =
      !!existing &&
      ["planning", "ready"].includes(existing.campaign.status) &&
      existing.slides.every((s) => s.status === "planned");
    const campaignId = existing && notStarted ? existing.campaign.id : randomUUID();

    const draft = await planCarouselStory(
      {
        campaignId,
        slideCount: input.slideCount,
        brief: ctx.brief,
        strategy: ctx.strategy,
        product: ctx.contexts.product,
        brand: ctx.contexts.brand,
        references: ctx.contexts.references,
        direction,
      },
      { generator: this.deps.generator, now: () => this.iso() }
    );

    const at = this.iso();
    const campaign: CarouselCampaign = {
      id: campaignId,
      sessionId: input.sessionId,
      userId: input.userId,
      status: "ready",
      version: existing && notStarted ? existing.campaign.version : 1,
      slideCount: input.slideCount,
      aspectRatio: ctx.brief.aspectRatio,
      briefId: ctx.brief.id,
      strategyId: ctx.strategy.id,
      story: draft.story,
      sharedDNA: draft.sharedDNA,
      campaignChecks: [],
      lastExport: null,
      generationStartedAt: null,
      createdAt: existing && notStarted ? existing.campaign.createdAt : at,
      updatedAt: at,
    };
    campaign.campaignChecks = runCarouselCampaignChecks(campaign, draft.slides, { afterGeneration: false });

    const data =
      existing && notStarted
        ? await this.deps.repo.replacePlan({
            userId: input.userId,
            expectedVersion: existing.campaign.version,
            campaign,
            slides: draft.slides,
          })
        : await this.deps.repo.createCampaign({ campaign, slides: draft.slides });
    return { data, reused: false };
  }

  async get(campaignId: string, userId: string): Promise<CarouselCampaignWithSlides> {
    return this.mustFind(campaignId, userId);
  }

  async getLatestForSession(sessionId: string, userId: string): Promise<CarouselCampaignWithSlides | null> {
    return this.deps.repo.findLatestForSession(sessionId, userId);
  }

  // ── Generation / resume ───────────────────────────────────────────────

  async generate(input: { campaignId: string; userId: string }): Promise<CarouselGenerateResult> {
    const startMs = this.nowMs();
    const initial = await this.mustFind(input.campaignId, input.userId);
    const ctx = await this.loadSessionContext(initial.campaign.sessionId, input.userId);
    this.assertCampaignMatchesSession(initial.campaign, ctx);

    const now = this.nowMs();
    const pending = initial.slides.filter((s) => needsInitialGeneration(s, now));
    const qcBacklog = initial.slides.filter((s) => effectiveSlideStatus(s, now) === "qc_pending");
    let creditsCharged = 0;
    let attempted = 0;

    if (pending.length) {
      await this.assertProviderReady();
      const balance = await this.deps.getBalance(input.userId);
      if (balance < pending.length) {
        throw new PosterCarouselError({
          code: "INSUFFICIENT_CREDITS",
          message: `This carousel needs ${pending.length} image credit${pending.length === 1 ? "" : "s"} for the remaining slides; you have ${balance}.`,
          stage: "credits",
        });
      }
      if (!initial.campaign.generationStartedAt) {
        await this.deps.repo.updateCampaignMeta(input.campaignId, input.userId, {
          generationStartedAt: this.iso(),
          status: "generating",
        });
      }
    }

    // QC recovery for slides committed by a request that ended before QC.
    for (const slide of qcBacklog) {
      await this.runSlideQc(initial.campaign, slide, ctx, input.userId);
    }

    await runPool(pending, this.deps.concurrency, async (slide) => {
      if (this.nowMs() - startMs > this.deps.timeBudgetMs) return;
      attempted += 1;
      const outcome = await this.generateSlide({
        campaign: initial.campaign,
        slide,
        ctx,
        userId: input.userId,
        kind: "generate",
        allowedStatuses: ["planned"],
        generationId: this.deps.newId("gen"),
      });
      creditsCharged += outcome.charged;
    });

    const data = await this.finalize(input.campaignId, input.userId);
    const after = this.nowMs();
    return {
      data,
      creditsCharged,
      attemptedSlides: attempted,
      remainingSlides: data.slides.filter((s) => needsInitialGeneration(s, after)).length,
      inFlightSlides: data.slides.filter((s) => s.status === "generating" && effectiveSlideStatus(s, after) === "generating").length,
    };
  }

  private async assertProviderReady(): Promise<void> {
    const availability = await this.deps.provider.checkAvailability();
    if (!availability.available) {
      throw new PosterCarouselError({
        code: "PROVIDER_UNAVAILABLE",
        message: publicErrorMessage("PROVIDER_UNAVAILABLE"),
        stage: "checkAvailability",
        retryable: true,
      });
    }
  }

  private async assertBalance(userId: string, needed: number): Promise<void> {
    const balance = await this.deps.getBalance(userId);
    if (balance < needed) {
      throw new PosterCarouselError({
        code: "INSUFFICIENT_CREDITS",
        message: publicErrorMessage("INSUFFICIENT_CREDITS"),
        stage: "credits",
      });
    }
  }

  /**
   * One leased provider attempt for one slide. Returns credits charged (0 or 1).
   * Never throws for provider/storage failures — they are persisted on the slide.
   */
  private async generateSlide(options: {
    campaign: CarouselCampaign;
    slide: CarouselSlide;
    ctx: SessionContext;
    userId: string;
    kind: CarouselLeaseKind;
    allowedStatuses: CarouselSlideStatus[];
    generationId: string;
    specification?: GenerationSpecification;
    iteration?: PosterIterationRecord | null;
    baseImageUrl?: string | null;
  }): Promise<{ charged: number; claimed: boolean }> {
    const { campaign, slide, ctx, userId } = options;
    let specification: GenerationSpecification;
    try {
      specification =
        options.specification ??
        (() => {
          const built = buildSlideSpecification({
            sessionId: campaign.sessionId,
            brief: ctx.brief,
            strategy: ctx.strategy,
            campaign,
            slide,
            product: ctx.contexts.product,
            brand: ctx.contexts.brand,
            references: ctx.contexts.references,
            generationId: options.generationId,
          });
          assertValidGenerationSpecification(built.specification, built.slideStrategy);
          return built.specification;
        })();
    } catch (e) {
      console.error("[posterCarousel] slide specification invalid", {
        campaignId: campaign.id,
        slideId: slide.slideId,
        e,
      });
      if (options.kind !== "generate") {
        throw new PosterCarouselError({ code: "PLAN_INVALID", message: "This slide's setup is invalid.", stage: "specification" });
      }
      // No provider call happened; mark failed (0 credits) so resume loops terminate.
      const res = await this.deps.repo.mutateSlide({
        campaignId: campaign.id,
        slideId: slide.slideId,
        userId,
        mutate: (s) => {
          const st = effectiveSlideStatus(s, this.nowMs());
          if (!options.allowedStatuses.includes(st)) return null;
          return {
            next: {
              ...s,
              status: "failed",
              lease: null,
              error: slideError("MALFORMED_SPEC", false),
              updatedAt: this.iso(),
            },
          };
        },
      });
      return { charged: 0, claimed: res.applied };
    }

    const token = randomUUID();
    const claimInput: ClaimInput = {
      allowedStatuses: options.allowedStatuses,
      kind: options.kind,
      token,
      leaseMs: this.deps.leaseMs,
      generationId: options.generationId,
      specification,
      iteration: options.iteration ?? null,
      nowMs: this.nowMs(),
    };
    const claim = await this.deps.repo.mutateSlide({
      campaignId: campaign.id,
      slideId: slide.slideId,
      userId,
      mutate: (s) => {
        const next = claimSlide(s, { ...claimInput, nowMs: this.nowMs() });
        return next ? { next } : null;
      },
    });
    if (!claim.applied || !claim.slide) return { charged: 0, claimed: false };

    const startedAt = this.nowMs();
    const baseAsset = {
      id: options.generationId,
      sessionId: campaign.sessionId,
      generationId: options.generationId,
      variantId: slide.slideId,
      variantIndex: slide.index,
      conceptId: specification.conceptId,
      dnaId: specification.dnaId,
      specificationId: specification.id,
      parentGenerationId:
        options.kind === "generate" ? null : claim.slide.generationId,
      iterationId: options.iteration?.id ?? null,
    };

    const fail = async (code: string, attempts: number) => {
      const failedAsset: PosterGeneratedAsset = {
        ...baseAsset,
        imageUrl: "",
        storagePath: null,
        provider: this.deps.provider.id,
        model: (this.deps.provider as { modelId?: string }).modelId || "unknown",
        creditsConsumed: 0,
        status: "failed",
        attemptCount: attempts,
        durationMs: this.nowMs() - startedAt,
        errorCode: code,
        errorMessage: publicErrorMessage(code),
        createdAt: this.iso(),
      };
      await this.deps.repo.mutateSlide({
        campaignId: campaign.id,
        slideId: slide.slideId,
        userId,
        mutate: (s) => {
          const next = failAttempt(s, token, failedAsset, slideError(code), this.nowMs());
          return next ? { next } : null;
        },
      });
      return { charged: 0, claimed: true };
    };

    try {
      const request = buildImageGenerationRequest({
        specification,
        userId,
        ...(options.baseImageUrl ? { baseImageUrl: options.baseImageUrl } : {}),
      });

      let result = await this.deps.provider.generate(request);
      let attempts = 1;
      if ((!result.ok || !result.imageDataUrl) && result.errorCode !== "RATE_LIMITED") {
        attempts = 2;
        result = await this.deps.provider.generate(request);
      }
      if (!result.ok || !result.imageDataUrl || !result.imageBuffer) {
        console.error("[posterCarousel] provider failed", {
          campaignId: campaign.id,
          slideId: slide.slideId,
          generationId: options.generationId,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
        });
        return fail(result.errorCode === "RATE_LIMITED" ? "RATE_LIMITED" : "PROVIDER_FAILED", attempts);
      }

      let stored: { publicUrl: string; storagePath: string };
      try {
        const buffer = result.imageBuffer;
        stored = await withOneRetry(() =>
          this.deps.storeImage({
            userId,
            sessionId: campaign.sessionId,
            generationId: options.generationId,
            buffer,
          })
        );
      } catch (e) {
        console.error("[posterCarousel] storage failed", { generationId: options.generationId, e });
        return fail("STORAGE_FAILED", attempts);
      }

      const asset: PosterGeneratedAsset = {
        ...baseAsset,
        imageUrl: stored.publicUrl,
        storagePath: stored.storagePath,
        provider: result.provider,
        model: result.model,
        creditsConsumed: 1,
        status: "generated",
        attemptCount: attempts,
        durationMs: result.durationMs ?? this.nowMs() - startedAt,
        createdAt: this.iso(),
      };

      const committed = await this.deps.repo.mutateSlide({
        campaignId: campaign.id,
        slideId: slide.slideId,
        userId,
        mutate: (s) => {
          const r = commitGenerated(s, token, asset, this.nowMs());
          return r
            ? {
                next: r.charged,
                charge: {
                  amount: 1,
                  ifInsufficient: r.unbilled,
                  metadata: {
                    campaignId: campaign.id,
                    slideId: slide.slideId,
                    generationId: options.generationId,
                    kind: options.kind,
                  },
                },
              }
            : null;
        },
      });
      if (!committed.applied || !committed.slide) {
        console.warn("[posterCarousel] lease lost before commit — image not billed", {
          campaignId: campaign.id,
          slideId: slide.slideId,
          generationId: options.generationId,
          storagePath: stored.storagePath,
        });
        return { charged: 0, claimed: true };
      }
      if (committed.slide.status === "qc_pending") {
        await this.runSlideQc(campaign, committed.slide, ctx, userId);
      }
      return { charged: committed.charged, claimed: true };
    } catch (e) {
      console.error("[posterCarousel] slide attempt crashed", {
        campaignId: campaign.id,
        slideId: slide.slideId,
        generationId: options.generationId,
        e,
      });
      try {
        return await fail("INTERNAL", 1);
      } catch (inner) {
        // Lease expiry restores the slide to its previous status.
        console.error("[posterCarousel] could not record failure", inner);
        return { charged: 0, claimed: true };
      }
    }
  }

  /** Existing Poster QC engine on one slide (0 credits). Never regenerates. */
  private async runSlideQc(
    campaign: CarouselCampaign,
    slide: CarouselSlide,
    ctx: SessionContext,
    userId: string
  ): Promise<void> {
    if (!slide.asset || !slide.specification || !slide.generationId) return;
    const generationId = slide.generationId;
    let qc: PosterQcResult | null = null;
    try {
      const productReferenceUrls = [
        ...ctx.contexts.references.productReferences
          .map((r) => r.image?.url)
          .filter((u): u is string => !!u),
        ...slide.specification.references
          .filter((r) => r.kind === "product" && r.url)
          .map((r) => r.url as string),
      ];
      qc = await this.deps.runQc({
        sessionId: campaign.sessionId,
        brief: ctx.brief,
        strategy: slideStrategyView(ctx.strategy, slide, campaign.slideCount),
        concept: slide.concept,
        dna: slide.dna,
        specification: slide.specification,
        asset: slide.asset,
        product: ctx.contexts.product,
        brand: ctx.contexts.brand,
        references: ctx.contexts.references,
        imageUrl: slide.asset.imageUrl,
        productReferenceUrls: [...new Set(productReferenceUrls)],
      });
    } catch (e) {
      console.warn("[posterCarousel] QC failed", { generationId, e });
    }
    await this.deps.repo.mutateSlide({
      campaignId: campaign.id,
      slideId: slide.slideId,
      userId,
      mutate: (s) => {
        const next = recordQc(s, generationId, qc, this.nowMs());
        return next ? { next } : null;
      },
    });
  }

  private async finalize(campaignId: string, userId: string): Promise<CarouselCampaignWithSlides> {
    const data = await this.mustFind(campaignId, userId);
    const status = reconcileCampaignStatus(
      data.slides,
      !!data.campaign.generationStartedAt,
      this.nowMs()
    );
    const checks = runCarouselCampaignChecks(data.campaign, data.slides, {
      afterGeneration: !!data.campaign.generationStartedAt,
    });
    const campaign = await this.deps.repo.updateCampaignMeta(campaignId, userId, {
      status,
      campaignChecks: checks,
    });
    return { campaign: campaign ?? data.campaign, slides: data.slides };
  }

  private findSlide(data: CarouselCampaignWithSlides, slideId: string): CarouselSlide {
    const slide = data.slides.find((s) => s.slideId === slideId);
    if (!slide) {
      throw new PosterCarouselError({ code: "NOT_FOUND", message: "Slide not found", stage: "slide" });
    }
    return slide;
  }

  private hasGeneration(slide: CarouselSlide, generationId: string): boolean {
    return (
      slide.generationId === generationId ||
      slide.lease?.generationId === generationId ||
      slide.history.some((h) => h.generationId === generationId)
    );
  }

  // ── Retry / regenerate one slide ──────────────────────────────────────

  async retrySlide(input: {
    campaignId: string;
    slideId: string;
    userId: string;
    requestId?: string | null;
  }): Promise<CarouselSlideActionResult> {
    const data = await this.mustFind(input.campaignId, input.userId);
    const slide = this.findSlide(data, input.slideId);
    const generationId = input.requestId ? `gen_r_${input.requestId}` : this.deps.newId("gen");

    if (input.requestId && this.hasGeneration(slide, generationId)) {
      return { data, slide, creditsCharged: 0, replayed: true };
    }

    const status = effectiveSlideStatus(slide, this.nowMs());
    if (status === "unbilled") {
      return this.settleSlide(data, slide, input.userId);
    }
    if (status === "generating" || status === "qc_pending") {
      throw new PosterCarouselError({ code: "CONFLICT", message: "This slide is already being generated.", stage: "retry", retryable: true });
    }
    if (status === "planned") {
      throw new PosterCarouselError({ code: "NOT_ELIGIBLE", message: "Generate the carousel first.", stage: "retry" });
    }

    const ctx = await this.loadSessionContext(data.campaign.sessionId, input.userId);
    this.assertCampaignMatchesSession(data.campaign, ctx);
    await this.assertProviderReady();
    await this.assertBalance(input.userId, 1);

    const kind: CarouselLeaseKind = status === "failed" ? "generate" : "rerun";
    const outcome = await this.generateSlide({
      campaign: data.campaign,
      slide,
      ctx,
      userId: input.userId,
      kind,
      allowedStatuses: kind === "generate" ? ["failed"] : ["ready", "needs_review"],
      generationId,
    });
    if (!outcome.claimed) {
      throw new PosterCarouselError({ code: "CONFLICT", message: "This slide is already being generated.", stage: "retry", retryable: true });
    }
    const after = await this.finalize(input.campaignId, input.userId);
    return { data: after, slide: this.findSlide(after, input.slideId), creditsCharged: outcome.charged, replayed: false };
  }

  /** Charge-only recovery for an image generated while the wallet was empty. */
  private async settleSlide(
    data: CarouselCampaignWithSlides,
    slide: CarouselSlide,
    userId: string
  ): Promise<CarouselSlideActionResult> {
    const settled = await this.deps.repo.mutateSlide({
      campaignId: data.campaign.id,
      slideId: slide.slideId,
      userId,
      mutate: (s) => {
        const next = settleUnbilled(s, this.nowMs());
        return next
          ? {
              next,
              charge: {
                amount: 1,
                ifInsufficient: s,
                metadata: {
                  campaignId: data.campaign.id,
                  slideId: s.slideId,
                  generationId: s.generationId,
                  kind: "settle",
                },
              },
            }
          : null;
      },
    });
    if (!settled.charged) {
      throw new PosterCarouselError({
        code: "INSUFFICIENT_CREDITS",
        message: publicErrorMessage("INSUFFICIENT_CREDITS"),
        stage: "settle",
      });
    }
    if (settled.slide?.status === "qc_pending") {
      const ctx = await this.loadSessionContext(data.campaign.sessionId, userId);
      await this.runSlideQc(data.campaign, settled.slide, ctx, userId);
    }
    const after = await this.finalize(data.campaign.id, userId);
    return { data: after, slide: this.findSlide(after, slide.slideId), creditsCharged: settled.charged, replayed: false };
  }

  // ── Iterate one slide (Phase 8 pure functions) ────────────────────────

  async iterateSlide(input: {
    campaignId: string;
    slideId: string;
    userId: string;
    request: string;
    requestId?: string | null;
  }): Promise<CarouselSlideActionResult & { summary: string }> {
    const userRequest = input.request.trim();
    if (!userRequest || userRequest.length > 500) {
      throw new PosterCarouselError({ code: "VALIDATION", message: "Describe the change in 1–500 characters.", stage: "iterate" });
    }
    const data = await this.mustFind(input.campaignId, input.userId);
    const slide = this.findSlide(data, input.slideId);
    const iterationId = input.requestId ? `iter_${input.requestId}` : this.deps.newId("iter");
    const generationId = input.requestId ? `gen_i_${input.requestId}` : this.deps.newId("gen");

    if (input.requestId && this.hasGeneration(slide, generationId)) {
      return {
        data,
        slide,
        creditsCharged: 0,
        replayed: true,
        summary: slide.iteration?.userFacingSummary || "",
      };
    }

    const status = effectiveSlideStatus(slide, this.nowMs());
    if (!["ready", "needs_review"].includes(status) || !isExportableSlide(slide) || !slide.specification) {
      throw new PosterCarouselError({ code: "NOT_ELIGIBLE", message: "Only finished slides can be edited.", stage: "iterate" });
    }

    const ctx = await this.loadSessionContext(data.campaign.sessionId, input.userId);
    this.assertCampaignMatchesSession(data.campaign, ctx);
    const slideStrategy = slideStrategyView(ctx.strategy, slide, data.campaign.slideCount);
    const parentAsset = slide.asset!;

    let specification: GenerationSpecification;
    let iteration: PosterIterationRecord;
    try {
      const classifierInput = {
        userRequest,
        specification: slide.specification,
        concept: slide.concept,
        dna: slide.dna,
        strategy: slideStrategy,
        parentAsset,
      };
      const classification = classifyIterationRequest(classifierInput);
      const plan = buildIterationPlan({ iterationId, input: classifierInput, classification });
      validateIterationPlan(plan);
      specification = applyIterationToSpecification({
        source: slide.specification,
        plan,
        generationId,
        specificationId: `spec_${generationId}`,
        variantId: slide.slideId,
      });
      assertPreservationInvariants({ source: slide.specification, updated: specification, plan });
      if (plan.locks.copy === "MODIFY") {
        if (!assertGenerationSpecificationShape(specification)) {
          throw new PosterCarouselError({ code: "PLAN_INVALID", message: "Updated specification failed validation", stage: "iterate" });
        }
        const corpus = groundingCorpusFor({
          slideCount: data.campaign.slideCount,
          strategy: ctx.strategy,
          brief: ctx.brief,
          product: ctx.contexts.product,
        });
        const rc = specification.renderCopy;
        const unsupported = findUnsupportedClaims(
          [rc.headline, rc.supporting, rc.cta, ...rc.badges].filter(Boolean).join(" \n "),
          corpus
        );
        if (unsupported.length) {
          throw new PosterCarouselError({
            code: "VALIDATION",
            message: "That copy change adds claims that aren't supported by your product facts.",
            stage: "iterate",
          });
        }
      } else {
        assertValidGenerationSpecification(specification, slideStrategy);
      }
      iteration = {
        ...iterationRecordFromPlan(plan, "generating"),
        request: {
          id: `req_${iterationId}`,
          sessionId: data.campaign.sessionId,
          targetGenerationId: parentAsset.generationId,
          userInstruction: userRequest,
          classification: plan.classification,
          createdAt: this.iso(),
        },
      };
    } catch (err) {
      if (err instanceof PosterCarouselError) throw err;
      const code = (err as { code?: string })?.code;
      throw new PosterCarouselError({
        code: code === "VALIDATION" ? "VALIDATION" : "PLAN_INVALID",
        message: (err as Error)?.message || "Could not plan that change",
        stage: "iterate",
      });
    }

    const caps = this.deps.provider.getCapabilities();
    if (!caps.supportsGenerate || !caps.supportsReferenceImages) {
      throw new PosterCarouselError({ code: "PROVIDER_UNAVAILABLE", message: publicErrorMessage("PROVIDER_UNAVAILABLE"), stage: "capabilities" });
    }
    await this.assertProviderReady();
    await this.assertBalance(input.userId, 1);

    const outcome = await this.generateSlide({
      campaign: data.campaign,
      slide,
      ctx,
      userId: input.userId,
      kind: "iterate",
      allowedStatuses: ["ready", "needs_review"],
      generationId,
      specification,
      iteration,
      baseImageUrl: parentAsset.imageUrl,
    });
    if (!outcome.claimed) {
      throw new PosterCarouselError({ code: "CONFLICT", message: "This slide is already being updated.", stage: "iterate", retryable: true });
    }
    const after = await this.finalize(input.campaignId, input.userId);
    const updated = this.findSlide(after, input.slideId);
    return {
      data: after,
      slide: updated,
      creditsCharged: outcome.charged,
      replayed: false,
      summary: iteration.userFacingSummary || "",
    };
  }

  // ── Export / download ─────────────────────────────────────────────────

  async export(input: { campaignId: string; userId: string }) {
    const data = await this.mustFind(input.campaignId, input.userId);
    if (!data.slides.some(isExportableSlide)) {
      throw new PosterCarouselError({ code: "EXPORT_EMPTY", message: publicErrorMessage("EXPORT_EMPTY"), stage: "export" });
    }
    const result = await buildCarouselExport(data, this.deps.loadImage);
    if (!result.includedSlideIds.length) {
      throw new PosterCarouselError({ code: "EXPORT_EMPTY", message: publicErrorMessage("EXPORT_EMPTY"), stage: "export" });
    }
    await this.deps.repo.updateCampaignMeta(input.campaignId, input.userId, {
      lastExport: {
        exportedAt: this.iso(),
        includedSlideIds: result.includedSlideIds,
        missingSlideIds: result.missingSlideIds,
        complete: result.manifest.complete,
        fileName: result.fileName,
      },
    });
    return result;
  }

  async loadSlideImage(input: { campaignId: string; slideId: string; userId: string }): Promise<{ buffer: Buffer; fileName: string }> {
    const data = await this.mustFind(input.campaignId, input.userId);
    const slide = this.findSlide(data, input.slideId);
    if (!isExportableSlide(slide)) {
      throw new PosterCarouselError({ code: "NOT_ELIGIBLE", message: "This slide has no finished image yet.", stage: "image" });
    }
    const raw = await this.deps.loadImage(slide.asset!);
    if (!raw) {
      throw new PosterCarouselError({ code: "NOT_FOUND", message: "Slide image unavailable", stage: "image" });
    }
    const { ensurePng, slideFileName } = await import("./export");
    return { buffer: await ensurePng(raw), fileName: slideFileName(slide) };
  }
}

async function defaultGetBalance(userId: string): Promise<number> {
  const balance = await CreditsDAO.getFullBalance(userId);
  return balance?.imageCredits.total ?? 0;
}

export function createPosterCarouselService(overrides: Partial<CarouselServiceDeps> = {}): PosterCarouselService {
  return new PosterCarouselService({
    repo: overrides.repo ?? new DrizzleCarouselRepository(),
    sessions:
      overrides.sessions ??
      {
        async getSession(sessionId, userId) {
          const { createPosterGenerationSessionService } = await import("../session");
          return createPosterGenerationSessionService().getSession(sessionId, userId);
        },
      },
    provider: overrides.provider ?? getDefaultPosterImageProvider(),
    generator: overrides.generator,
    runQc: overrides.runQc ?? ((input) => runPosterQc(input)),
    storeImage: overrides.storeImage ?? storePosterGeneratedImage,
    loadImage: overrides.loadImage ?? defaultSlideImageLoader,
    getBalance: overrides.getBalance ?? defaultGetBalance,
    ...overrides,
  } as CarouselServiceDeps);
}

export { CAROUSEL_SUCCESS_STATUSES };
