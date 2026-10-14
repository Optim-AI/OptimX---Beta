/**
 * Carousel API handlers. Routes in pages/api/creative-studio/poster/carousel/*
 * are thin wrappers so handlers can be exercised with an injected service.
 *
 * Security: user id comes only from the auth cookie/header; campaigns are always
 * loaded by (id, userId); browser-supplied creative artifacts are rejected.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { sanitizeErrorForClient } from "../production-safety";
import { readJsonBody, readStringField } from "../read-json-body";
import { carouselErrorHttpStatus, isPosterCarouselError } from "./errors";
import { parseCarouselSlideCount } from "./guards";
import { serializeCarouselCampaign, serializeCarouselSlide } from "./serialize";
import {
  createPosterCarouselService,
  parseIdempotencyKey,
  type PosterCarouselService,
} from "./service";

export type CarouselApiDeps = {
  getUserId?: (req: NextApiRequest) => Promise<string | null>;
  service?: () => PosterCarouselService;
};

const FORBIDDEN_BODY_FIELDS = [
  "strategy",
  "specification",
  "concept",
  "concepts",
  "dna",
  "story",
  "slides",
  "sharedDNA",
  "product",
  "productFacts",
  "credits",
  "creditsCharged",
  "amount",
  "userId",
];

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

function fail(res: NextApiResponse, status: number, code: string, message: string) {
  return res.status(status).json({
    ok: false,
    error: sanitizeErrorForClient({ code, message, retryable: false }),
    creditsCharged: 0,
  });
}

function handleError(res: NextApiResponse, err: unknown, label: string) {
  if (isPosterCarouselError(err)) {
    return res.status(carouselErrorHttpStatus(err.code)).json({
      ok: false,
      error: err.toPublicJSON(),
      ...(err.issues && process.env.NODE_ENV !== "production" ? { issues: err.issues } : {}),
      creditsCharged: 0,
    });
  }
  console.error(`[posterCarousel:${label}] error`, err);
  return res.status(500).json({
    ok: false,
    error: sanitizeErrorForClient({ code: "INTERNAL", message: "Internal server error", retryable: true }),
    creditsCharged: 0,
  });
}

function rejectArtifacts(res: NextApiResponse, body: Record<string, unknown>): boolean {
  const bad = FORBIDDEN_BODY_FIELDS.filter((k) => body[k] != null);
  if (!bad.length) return false;
  fail(res, 400, "VALIDATION", "Do not submit strategy, story, concepts, DNA, product facts, credits or user ids from the browser.");
  return true;
}

function queryId(req: NextApiRequest, key: string): string | null {
  const v = req.query[key];
  const s = typeof v === "string" ? v.trim() : "";
  return ID_RE.test(s) ? s : null;
}

async function authed(
  req: NextApiRequest,
  res: NextApiResponse,
  method: string | string[],
  deps: CarouselApiDeps
): Promise<string | null> {
  const methods = Array.isArray(method) ? method : [method];
  if (!methods.includes(req.method || "")) {
    res.setHeader("Allow", methods.join(", "));
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return null;
  }
  const userId = await (deps.getUserId ?? getUserIdFromRequest)(req);
  if (!userId) {
    res.status(401).json({ ok: false, error: "Authentication required" });
    return null;
  }
  return userId;
}

function svc(deps: CarouselApiDeps): PosterCarouselService {
  return (deps.service ?? (() => createPosterCarouselService()))();
}

/** POST { sessionId, slideCount, conceptId?, regenerate? } */
export function createCarouselPlanHandler(deps: CarouselApiDeps = {}) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const userId = await authed(req, res, "POST", deps);
    if (!userId) return;
    const body = readJsonBody(req);
    if (rejectArtifacts(res, body)) return;
    const sessionId = readStringField(body, "sessionId");
    if (!sessionId || !ID_RE.test(sessionId)) {
      return fail(res, 400, "VALIDATION", "sessionId is required");
    }
    const count = parseCarouselSlideCount(body.slideCount);
    if (!count.ok) return fail(res, 400, "VALIDATION", count.message);
    const conceptId = readStringField(body, "conceptId");
    if (conceptId && !ID_RE.test(conceptId)) return fail(res, 400, "VALIDATION", "Invalid conceptId");
    try {
      const result = await svc(deps).plan({
        sessionId,
        userId,
        slideCount: count.value,
        conceptId,
        force: body.regenerate === true,
      });
      return res.status(200).json({
        ok: true,
        reused: result.reused,
        creditsCharged: 0,
        campaign: serializeCarouselCampaign(result.data),
      });
    } catch (err) {
      return handleError(res, err, "plan");
    }
  };
}

/** POST { campaignId } — starts or resumes generation within a time budget */
export function createCarouselGenerateHandler(deps: CarouselApiDeps = {}) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const userId = await authed(req, res, "POST", deps);
    if (!userId) return;
    const body = readJsonBody(req);
    if (rejectArtifacts(res, body)) return;
    const campaignId = readStringField(body, "campaignId");
    if (!campaignId || !ID_RE.test(campaignId)) return fail(res, 400, "VALIDATION", "campaignId is required");
    try {
      const result = await svc(deps).generate({ campaignId, userId });
      console.log("[posterCarousel:generate]", {
        userId,
        campaignId,
        attempted: result.attemptedSlides,
        remaining: result.remainingSlides,
        inFlight: result.inFlightSlides,
        creditsCharged: result.creditsCharged,
      });
      return res.status(200).json({
        ok: true,
        creditsCharged: result.creditsCharged,
        attemptedSlides: result.attemptedSlides,
        remainingSlides: result.remainingSlides,
        inFlightSlides: result.inFlightSlides,
        done: result.remainingSlides === 0 && result.inFlightSlides === 0,
        campaign: serializeCarouselCampaign(result.data),
      });
    } catch (err) {
      return handleError(res, err, "generate");
    }
  };
}

/** GET ?sessionId= — latest campaign for a session (restore after refresh) */
export function createCarouselLatestHandler(deps: CarouselApiDeps = {}) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const userId = await authed(req, res, "GET", deps);
    if (!userId) return;
    const sessionId = queryId(req, "sessionId");
    if (!sessionId) return fail(res, 400, "VALIDATION", "sessionId is required");
    try {
      const data = await svc(deps).getLatestForSession(sessionId, userId);
      return res.status(200).json({ ok: true, campaign: data ? serializeCarouselCampaign(data) : null });
    } catch (err) {
      return handleError(res, err, "latest");
    }
  };
}

/** GET /carousel/[id] */
export function createCarouselGetHandler(deps: CarouselApiDeps = {}) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const userId = await authed(req, res, "GET", deps);
    if (!userId) return;
    const campaignId = queryId(req, "id");
    if (!campaignId) return fail(res, 400, "VALIDATION", "Invalid carousel id");
    try {
      const data = await svc(deps).get(campaignId, userId);
      return res.status(200).json({ ok: true, campaign: serializeCarouselCampaign(data) });
    } catch (err) {
      return handleError(res, err, "get");
    }
  };
}

/** POST /carousel/[id]/slides/[slideId]/retry { requestId? } */
export function createCarouselRetryHandler(deps: CarouselApiDeps = {}) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const userId = await authed(req, res, "POST", deps);
    if (!userId) return;
    const body = readJsonBody(req);
    if (rejectArtifacts(res, body)) return;
    const campaignId = queryId(req, "id");
    const slideId = queryId(req, "slideId");
    if (!campaignId || !slideId) return fail(res, 400, "VALIDATION", "Invalid carousel or slide id");
    try {
      const requestId = parseIdempotencyKey(body.requestId);
      const result = await svc(deps).retrySlide({ campaignId, slideId, userId, requestId });
      return res.status(200).json({
        ok: true,
        replayed: result.replayed,
        creditsCharged: result.creditsCharged,
        slide: serializeCarouselSlide(result.slide),
        campaign: serializeCarouselCampaign(result.data),
      });
    } catch (err) {
      return handleError(res, err, "retry");
    }
  };
}

/** POST /carousel/[id]/slides/[slideId]/iterate { request, requestId? } */
export function createCarouselIterateHandler(deps: CarouselApiDeps = {}) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const userId = await authed(req, res, "POST", deps);
    if (!userId) return;
    const body = readJsonBody(req);
    if (rejectArtifacts(res, body)) return;
    const campaignId = queryId(req, "id");
    const slideId = queryId(req, "slideId");
    if (!campaignId || !slideId) return fail(res, 400, "VALIDATION", "Invalid carousel or slide id");
    const request = readStringField(body, "request");
    if (!request) return fail(res, 400, "VALIDATION", "Describe the change you want");
    try {
      const requestId = parseIdempotencyKey(body.requestId);
      const result = await svc(deps).iterateSlide({ campaignId, slideId, userId, request, requestId });
      return res.status(200).json({
        ok: true,
        replayed: result.replayed,
        summary: result.summary,
        creditsCharged: result.creditsCharged,
        slide: serializeCarouselSlide(result.slide),
        campaign: serializeCarouselCampaign(result.data),
      });
    } catch (err) {
      return handleError(res, err, "iterate");
    }
  };
}

/** GET /carousel/[id]/slides/[slideId]/image — authenticated PNG stream */
export function createCarouselSlideImageHandler(deps: CarouselApiDeps = {}) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const userId = await authed(req, res, "GET", deps);
    if (!userId) return;
    const campaignId = queryId(req, "id");
    const slideId = queryId(req, "slideId");
    if (!campaignId || !slideId) return fail(res, 400, "VALIDATION", "Invalid carousel or slide id");
    try {
      const { buffer, fileName } = await svc(deps).loadSlideImage({ campaignId, slideId, userId });
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "private, max-age=300");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader(
        "Content-Disposition",
        `${req.query.download === "1" ? "attachment" : "inline"}; filename="${fileName}"`
      );
      return res.status(200).send(buffer);
    } catch (err) {
      return handleError(res, err, "image");
    }
  };
}

/** GET /carousel/[id]/export — ZIP of successful slides + manifest.json */
export function createCarouselExportHandler(deps: CarouselApiDeps = {}) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const userId = await authed(req, res, "GET", deps);
    if (!userId) return;
    const campaignId = queryId(req, "id");
    if (!campaignId) return fail(res, 400, "VALIDATION", "Invalid carousel id");
    try {
      const result = await svc(deps).export({ campaignId, userId });
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
      res.setHeader("X-Carousel-Complete", result.manifest.complete ? "true" : "false");
      res.setHeader("X-Carousel-Included", String(result.manifest.includedCount));
      res.setHeader("X-Carousel-Total", String(result.manifest.slideCount));
      return res.status(200).send(result.zip);
    } catch (err) {
      return handleError(res, err, "export");
    }
  };
}
