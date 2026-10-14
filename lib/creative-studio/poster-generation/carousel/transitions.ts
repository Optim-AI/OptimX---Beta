/**
 * Pure slide state transitions. Repositories apply them inside a row lock, so the
 * same rules hold for in-memory tests and Postgres.
 */

import type {
  GenerationSpecification,
  PosterGeneratedAsset,
  PosterIterationRecord,
  PosterQcResult,
} from "../types";
import type {
  CarouselCampaignStatus,
  CarouselLeaseKind,
  CarouselSlide,
  CarouselSlideError,
  CarouselSlideStatus,
  CarouselSlideVersion,
} from "./types";

export function leaseExpired(slide: CarouselSlide, nowMs: number): boolean {
  return (
    slide.status === "generating" &&
    (!slide.lease || Date.parse(slide.lease.expiresAt) <= nowMs)
  );
}

/** Status as it should be treated now — an expired lease falls back to its previous status. */
export function effectiveSlideStatus(slide: CarouselSlide, nowMs: number): CarouselSlideStatus {
  if (!leaseExpired(slide, nowMs)) return slide.status;
  return slide.lease?.previousStatus || "planned";
}

/** Slides a "generate/resume" run should pick up (never failed or finished slides) */
export function needsInitialGeneration(slide: CarouselSlide, nowMs: number): boolean {
  return effectiveSlideStatus(slide, nowMs) === "planned";
}

function archive(slide: CarouselSlide, at: string): CarouselSlideVersion[] {
  if (!slide.generationId && !slide.asset) return slide.history;
  return [
    ...slide.history,
    {
      generationId: slide.generationId || "",
      specification: slide.specification,
      asset: slide.asset,
      qc: slide.qc,
      status: slide.status === "generating" ? slide.lease?.previousStatus || "failed" : slide.status,
      error: slide.error,
      iteration: slide.iteration,
      archivedAt: at,
    },
  ];
}

export type ClaimInput = {
  allowedStatuses: CarouselSlideStatus[];
  kind: CarouselLeaseKind;
  token: string;
  leaseMs: number;
  generationId: string;
  specification: GenerationSpecification;
  iteration?: PosterIterationRecord | null;
  nowMs: number;
};

/** Returns the claimed slide, or null when another worker owns it / not eligible. */
export function claimSlide(slide: CarouselSlide, input: ClaimInput): CarouselSlide | null {
  const expired = leaseExpired(slide, input.nowMs);
  if (slide.status === "generating" && !expired) return null;
  const effectiveStatus: CarouselSlideStatus = expired
    ? slide.lease?.previousStatus || "planned"
    : slide.status;
  if (!input.allowedStatuses.includes(effectiveStatus)) return null;
  const at = new Date(input.nowMs).toISOString();
  return {
    ...slide,
    status: "generating",
    attemptCount: slide.attemptCount + 1,
    lease: {
      token: input.token,
      expiresAt: new Date(input.nowMs + input.leaseMs).toISOString(),
      previousStatus: effectiveStatus,
      kind: input.kind,
      generationId: input.generationId,
      specification: input.specification,
      iteration: input.iteration ?? null,
    },
    updatedAt: at,
  };
}

function ownsLease(slide: CarouselSlide, token: string): boolean {
  return slide.status === "generating" && slide.lease?.token === token;
}

/**
 * Successful generation committed together with its credit charge.
 * `charged` is the post-charge state; `unbilled` is used when the charge fails.
 */
export function commitGenerated(
  slide: CarouselSlide,
  token: string,
  asset: PosterGeneratedAsset,
  nowMs: number
): { charged: CarouselSlide; unbilled: CarouselSlide } | null {
  if (!ownsLease(slide, token) || !slide.lease) return null;
  const at = new Date(nowMs).toISOString();
  const lease = slide.lease;
  const isNewVersion = lease.kind !== "generate" && !!slide.asset && slide.asset.status === "generated";
  const versionNumber = isNewVersion ? slide.versionNumber + 1 : slide.versionNumber;
  const history = archive(slide, at);
  const spec = lease.specification;
  const base: CarouselSlide = {
    ...slide,
    generationId: lease.generationId,
    specification: spec,
    copy: {
      headline: spec.renderCopy.headline,
      supporting: spec.renderCopy.supporting ?? null,
      cta: spec.renderCopy.cta ?? null,
      badges: [...spec.renderCopy.badges],
    },
    qc: null,
    history,
    versionNumber,
    iteration: lease.iteration
      ? { ...lease.iteration, status: "completed", resultingGenerationId: lease.generationId, resultingSpecificationId: spec.id }
      : null,
    lease: null,
    updatedAt: at,
  };
  const finalAsset: PosterGeneratedAsset = { ...asset, versionNumber, isActive: true };
  return {
    charged: {
      ...base,
      status: "qc_pending",
      asset: { ...finalAsset, creditsConsumed: 1 },
      error: null,
      creditsCharged: slide.creditsCharged + 1,
    },
    unbilled: {
      ...base,
      status: "unbilled",
      asset: { ...finalAsset, creditsConsumed: 0 },
      error: {
        code: "INSUFFICIENT_CREDITS",
        message: "Generated, but your credits ran out before this slide could be charged.",
        retryable: true,
      },
    },
  };
}

/** Provider / storage failure for the leased attempt. 0 credits. */
export function failAttempt(
  slide: CarouselSlide,
  token: string,
  failedAsset: PosterGeneratedAsset,
  error: CarouselSlideError,
  nowMs: number
): CarouselSlide | null {
  if (!ownsLease(slide, token) || !slide.lease) return null;
  const at = new Date(nowMs).toISOString();
  const lease = slide.lease;
  const attempt: CarouselSlideVersion = {
    generationId: lease.generationId,
    specification: lease.specification,
    asset: failedAsset,
    qc: null,
    status: "failed",
    error,
    iteration: lease.iteration ? { ...lease.iteration, status: "failed", errorMessage: error.message } : null,
    archivedAt: at,
  };
  if (lease.kind === "generate") {
    return {
      ...slide,
      status: "failed",
      history: archive(slide, at),
      generationId: lease.generationId,
      specification: lease.specification,
      asset: failedAsset,
      qc: null,
      error,
      lease: null,
      updatedAt: at,
    };
  }
  // Rerun / iteration failure: previous successful version stays current.
  return {
    ...slide,
    status: lease.previousStatus,
    history: [...slide.history, attempt],
    error,
    lease: null,
    updatedAt: at,
  };
}

/** Charge-only recovery for an unbilled slide (no provider call). */
export function settleUnbilled(slide: CarouselSlide, nowMs: number): CarouselSlide | null {
  if (slide.status !== "unbilled" || !slide.asset) return null;
  return {
    ...slide,
    status: "qc_pending",
    asset: { ...slide.asset, creditsConsumed: 1 },
    error: null,
    creditsCharged: slide.creditsCharged + 1,
    updatedAt: new Date(nowMs).toISOString(),
  };
}

export function recordQc(
  slide: CarouselSlide,
  generationId: string,
  qc: PosterQcResult | null,
  nowMs: number
): CarouselSlide | null {
  if (slide.generationId !== generationId) return null;
  if (!["qc_pending", "ready", "needs_review"].includes(slide.status)) return null;
  return {
    ...slide,
    qc,
    asset: slide.asset ? { ...slide.asset, qc } : slide.asset,
    status: qc?.passed ? "ready" : "needs_review",
    error: qc
      ? null
      : { code: "QC_INCOMPLETE", message: "Quality check could not complete. Review this slide.", retryable: true },
    updatedAt: new Date(nowMs).toISOString(),
  };
}

export function reconcileCampaignStatus(
  slides: CarouselSlide[],
  generationStarted: boolean,
  nowMs: number
): CarouselCampaignStatus {
  if (!slides.length) return "planning";
  const live = slides.some(
    (s) => (s.status === "generating" && !leaseExpired(s, nowMs)) || s.status === "qc_pending"
  );
  if (live) return "generating";
  const statuses = slides.map((s) => effectiveSlideStatus(s, nowMs));
  const pending = statuses.filter((s) => s === "planned").length;
  if (pending === slides.length) return generationStarted ? "generating" : "ready";
  const done = statuses.filter((s) => s === "ready" || s === "needs_review").length;
  if (done === slides.length) return "completed";
  if (pending > 0) return "generating";
  if (done === 0 && !statuses.includes("unbilled")) return "failed";
  return "partial";
}
