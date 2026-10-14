/**
 * Browser-safe carousel payloads. No specifications, compiled prompts, storage
 * paths, raw asset URLs, provider/model ids, lease tokens or user ids. Images are
 * served only through the authenticated slide image route.
 */

import { publicErrorMessage } from "../production-safety";
import type { PosterQcIssue, PosterQcResult } from "../types";
import { isExportableSlide } from "./export";
import { effectiveSlideStatus, needsInitialGeneration } from "./transitions";
import type {
  CarouselCampaignCheck,
  CarouselCampaignWithSlides,
  CarouselSlide,
  CarouselSlideStatus,
} from "./types";

export type PublicCarouselQcIssue = {
  category: string;
  severity: string;
  message: string;
};

export type PublicCarouselQc = {
  passed: boolean;
  status: string;
  summary: string;
  issues: PublicCarouselQcIssue[];
  warnings: PublicCarouselQcIssue[];
  recommendedFixes: string[];
};

export type PublicCarouselSlide = {
  slideId: string;
  index: number;
  slideNumber: number;
  role: string;
  roleLabel: string;
  objective: string;
  copy: CarouselSlide["copy"];
  conceptTitle: string;
  conceptSummary: string;
  status: CarouselSlideStatus;
  hasImage: boolean;
  /** Changes on every new version — use as an image cache buster */
  imageVersion: string | null;
  versionNumber: number;
  previousVersions: number;
  qc: PublicCarouselQc | null;
  error: { code: string; message: string; retryable: boolean } | null;
  lastEdit: { request: string; summary: string } | null;
  canRetry: boolean;
  canIterate: boolean;
};

export type PublicCarouselCampaign = {
  id: string;
  sessionId: string;
  status: string;
  slideCount: number;
  aspectRatio: string;
  story: {
    objective: string;
    audience: string;
    coreMessage: string;
    narrativeStructure: string;
    narrativeRationale: string;
    copyProgression: string;
    ctaIntent: string;
  };
  visualSystem: {
    palette: string;
    typography: string;
    photographyStyle: string;
    graphicLanguage: string;
    mood: string;
    recurringElements: string[];
  };
  checks: CarouselCampaignCheck[];
  progress: {
    total: number;
    finished: number;
    generating: number;
    pending: number;
    failed: number;
    unbilled: number;
  };
  lastExport: { exportedAt: string; complete: boolean; includedCount: number } | null;
  createdAt: string;
  updatedAt: string;
  slides: PublicCarouselSlide[];
};

function publicIssue(i: PosterQcIssue): PublicCarouselQcIssue {
  return { category: i.category, severity: i.severity, message: i.message };
}

function publicQc(qc: PosterQcResult | null): PublicCarouselQc | null {
  if (!qc) return null;
  return {
    passed: qc.passed,
    status: qc.status,
    summary: qc.summary,
    issues: (qc.issues || []).map(publicIssue),
    warnings: (qc.warnings || []).map(publicIssue),
    recommendedFixes: [...(qc.recommendedFixes || [])],
  };
}

export function serializeCarouselSlide(slide: CarouselSlide, nowMs = Date.now()): PublicCarouselSlide {
  const status = effectiveSlideStatus(slide, nowMs);
  const hasImage = isExportableSlide(slide);
  return {
    slideId: slide.slideId,
    index: slide.index,
    slideNumber: slide.index + 1,
    role: slide.role,
    roleLabel: slide.roleLabel,
    objective: slide.objective,
    copy: { ...slide.copy, badges: [...slide.copy.badges] },
    conceptTitle: slide.concept.name,
    conceptSummary: slide.concept.description,
    status,
    hasImage,
    imageVersion: hasImage ? slide.generationId : null,
    versionNumber: slide.versionNumber,
    previousVersions: slide.history.filter((h) => h.asset?.status === "generated").length,
    qc: publicQc(slide.qc),
    error: slide.error
      ? {
          code: slide.error.code,
          message: publicErrorMessage(slide.error.code, slide.error.message),
          retryable: slide.error.retryable,
        }
      : null,
    lastEdit: slide.iteration
      ? {
          request: slide.iteration.request.userInstruction,
          summary: slide.iteration.userFacingSummary || "",
        }
      : null,
    canRetry: ["failed", "unbilled", "ready", "needs_review"].includes(status),
    canIterate: hasImage && (status === "ready" || status === "needs_review"),
  };
}

export function serializeCarouselCampaign(
  data: CarouselCampaignWithSlides,
  nowMs = Date.now()
): PublicCarouselCampaign {
  const { campaign } = data;
  const slides = [...data.slides].sort((a, b) => a.index - b.index);
  const statuses = slides.map((s) => effectiveSlideStatus(s, nowMs));
  const d = campaign.sharedDNA;
  return {
    id: campaign.id,
    sessionId: campaign.sessionId,
    status: campaign.status,
    slideCount: campaign.slideCount,
    aspectRatio: campaign.aspectRatio,
    story: {
      objective: campaign.story.objective,
      audience: campaign.story.audience,
      coreMessage: campaign.story.coreMessage,
      narrativeStructure: campaign.story.narrativeStructure,
      narrativeRationale: campaign.story.narrativeRationale,
      copyProgression: campaign.story.copyProgression,
      ctaIntent: campaign.story.ctaIntent,
    },
    visualSystem: {
      palette: d.palette,
      typography: d.typography,
      photographyStyle: d.photographyStyle,
      graphicLanguage: d.graphicLanguage,
      mood: d.mood,
      recurringElements: [...d.recurringElements],
    },
    checks: campaign.campaignChecks.map((c) => ({ ...c, slideIds: c.slideIds ? [...c.slideIds] : undefined })),
    progress: {
      total: slides.length,
      finished: statuses.filter((s) => s === "ready" || s === "needs_review").length,
      generating: statuses.filter((s) => s === "generating" || s === "qc_pending").length,
      pending: slides.filter((s) => needsInitialGeneration(s, nowMs)).length,
      failed: statuses.filter((s) => s === "failed").length,
      unbilled: statuses.filter((s) => s === "unbilled").length,
    },
    lastExport: campaign.lastExport
      ? {
          exportedAt: campaign.lastExport.exportedAt,
          complete: campaign.lastExport.complete,
          includedCount: campaign.lastExport.includedSlideIds.length,
        }
      : null,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    slides: slides.map((s) => serializeCarouselSlide(s, nowMs)),
  };
}
