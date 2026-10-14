/**
 * Lightweight campaign-level checks. These complement — never replace — per-slide QC.
 */

import {
  findContradictions,
  findRepeatedSlidePairs,
} from "./story-validation";
import type {
  CarouselCampaign,
  CarouselCampaignCheck,
  CarouselSlide,
} from "./types";
import { CAROUSEL_SUCCESS_STATUSES } from "./types";

export function runCarouselCampaignChecks(
  campaign: Pick<CarouselCampaign, "slideCount" | "story" | "sharedDNA" | "aspectRatio">,
  slides: CarouselSlide[],
  options: { afterGeneration: boolean }
): CarouselCampaignCheck[] {
  const checks: CarouselCampaignCheck[] = [];
  const ordered = [...slides].sort((a, b) => a.index - b.index);

  const orderOk =
    ordered.length === campaign.slideCount &&
    ordered.every((s, i) => s.index === i) &&
    new Set(ordered.map((s) => s.slideId)).size === ordered.length;
  checks.push({
    code: "slide_order",
    status: orderOk ? "pass" : "fail",
    message: orderOk
      ? `${ordered.length} slides in a stable order`
      : "Slide order or slide identities are inconsistent",
  });

  const roles = ordered.map((s) => s.role);
  const distinctRoles = new Set(roles).size === roles.length;
  checks.push({
    code: "narrative_continuity",
    status: distinctRoles && ordered.every((s) => s.objective.trim()) ? "pass" : "fail",
    message: distinctRoles
      ? `Story: ${ordered.map((s) => s.roleLabel).join(" → ")}`
      : "Two or more slides share the same narrative role",
  });

  const repeats = findRepeatedSlidePairs(ordered);
  checks.push({
    code: "repeated_content",
    status: repeats.length ? "fail" : "pass",
    message: repeats.length
      ? `Repeated messaging between slides ${repeats.map(([a, b]) => `${a + 1}&${b + 1}`).join(", ")}`
      : "Each slide carries distinct copy",
    slideIds: repeats.flat().map((i) => ordered[i].slideId),
  });

  const contradictions = findContradictions(ordered);
  checks.push({
    code: "contradictory_messages",
    status: contradictions.length ? "fail" : "pass",
    message: contradictions.length ? contradictions.join("; ") : "No conflicting facts across slides",
  });

  const ctaSlides = ordered.filter((s) => !!s.copy.cta);
  const last = ordered[ordered.length - 1];
  const ctaOk =
    ctaSlides.every((s) => s.index === ordered.length - 1) &&
    (/^none$/i.test(campaign.story.ctaIntent.trim()) || !!last?.copy.cta);
  checks.push({
    code: "cta_consistency",
    status: ctaOk ? "pass" : "warn",
    message: ctaOk
      ? last?.copy.cta
        ? `Closing CTA: "${last.copy.cta}"`
        : "No CTA by design"
      : "CTA placement does not match the campaign CTA intent",
  });

  const visualOk = ordered.every(
    (s) =>
      s.dna.colorStrategy === campaign.sharedDNA.palette &&
      s.dna.photographyStyle === campaign.sharedDNA.photographyStyle &&
      s.dna.graphicLanguage === campaign.sharedDNA.graphicLanguage &&
      (!s.specification || s.specification.aspectRatio === campaign.aspectRatio)
  );
  const brandFails = ordered.filter(
    (s) => s.qc?.checks?.brandCompliance?.status === "fail"
  );
  checks.push({
    code: "visual_consistency",
    status: !visualOk ? "fail" : brandFails.length ? "warn" : "pass",
    message: !visualOk
      ? "A slide drifted from the shared visual system"
      : brandFails.length
        ? `Brand consistency flagged on slide(s) ${brandFails.map((s) => s.index + 1).join(", ")}`
        : "All slides share one visual system",
    slideIds: brandFails.map((s) => s.slideId),
  });

  if (options.afterGeneration) {
    const missing = ordered.filter((s) => !CAROUSEL_SUCCESS_STATUSES.includes(s.status));
    checks.push({
      code: "assets_present",
      status: missing.length ? "warn" : "pass",
      message: missing.length
        ? `Missing slide image(s): ${missing.map((s) => s.index + 1).join(", ")}`
        : "Every slide has a generated image",
      slideIds: missing.map((s) => s.slideId),
    });
    const review = ordered.filter((s) => s.status === "needs_review" || s.status === "qc_pending");
    checks.push({
      code: "slide_qc",
      status: review.length ? "warn" : missing.length ? "warn" : "pass",
      message: review.length
        ? `Slide(s) ${review.map((s) => s.index + 1).join(", ")} need review`
        : "All generated slides passed quality checks",
      slideIds: review.map((s) => s.slideId),
    });
  }

  return checks;
}
