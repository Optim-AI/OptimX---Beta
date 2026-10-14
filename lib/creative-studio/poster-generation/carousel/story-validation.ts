/**
 * Carousel story validation + deterministic repair.
 * Planning cost: 0 image credits.
 */

import type { ProductContext } from "../context/product-context";
import { fingerprintConcept } from "../concept/diversity";
import type { CreativeBrief, MarketingStrategy } from "../types";
import {
  buildGroundingCorpus,
  containsPhrase,
  findUnsupportedClaims,
  hasProofEvidence,
  quantifiedValuesByUnit,
  textSimilarity,
  type GroundingCorpus,
} from "./text-analysis";
import type {
  CarouselCreativeDNA,
  CarouselSlide,
  CarouselStory,
} from "./types";
import { PRODUCT_IDENTITY_LOCK } from "./visual-system";

export type CarouselPlanDraft = {
  story: CarouselStory;
  sharedDNA: CarouselCreativeDNA;
  slides: CarouselSlide[];
};

export type CarouselValidationContext = {
  slideCount: number;
  strategy: MarketingStrategy;
  brief: CreativeBrief;
  product: ProductContext;
};

export type CarouselValidationResult = {
  ok: boolean;
  issues: string[];
  repairs: string[];
  draft: CarouselPlanDraft;
};

const GENERIC_ROLES = /^(slide|slide_\d+|page|panel|card|content|misc|other)$/;
const PROOF_ROLE = /(proof|testimonial|review|social_proof|endorse)/;
const REPEAT_THRESHOLD = 0.6;

export function groundingCorpusFor(ctx: CarouselValidationContext): GroundingCorpus {
  const p = ctx.product;
  return buildGroundingCorpus([
    ...ctx.strategy.allowedClaims,
    ...(p.factualClaims.value || []),
    ...(p.benefits.value || []),
    ...(p.features?.value || []),
    p.name?.value,
    p.description?.value,
    p.shortDescription?.value,
    p.price?.value,
    ctx.brief.userInstruction,
    ctx.brief.offerHint,
    ctx.strategy.userOverrides.offer,
    ctx.strategy.userOverrides.headline,
    ctx.strategy.userOverrides.cta,
    ctx.strategy.userOverrides.message,
    ctx.strategy.copy.cta,
    ctx.strategy.copy.productLine,
    ...ctx.strategy.copy.badges,
  ]);
}

export function slideCopyText(s: CarouselSlide): string {
  return [s.copy.headline, s.copy.supporting, s.copy.cta, ...s.copy.badges]
    .filter(Boolean)
    .join(" \n ");
}

function ctaExpected(story: CarouselStory, strategy: MarketingStrategy): boolean {
  if (strategy.userOverrides.cta || strategy.copy.cta) return true;
  return !/^(none|no|n\/a|no cta)$/i.test(story.ctaIntent.trim());
}

/** Pure repairs that never invent facts: overrides, CTA placement, claim lists. */
export function repairCarouselDraft(
  draft: CarouselPlanDraft,
  ctx: CarouselValidationContext
): { draft: CarouselPlanDraft; repairs: string[] } {
  const repairs: string[] = [];
  const allowed = ctx.strategy.allowedClaims;
  const allowedLower = new Set(allowed.map((c) => c.toLowerCase()));
  const overrides = ctx.strategy.userOverrides;
  const n = draft.slides.length;

  const slides = draft.slides.map((s, i) => {
    const copy = { ...s.copy, badges: [...s.copy.badges] };
    let claimsUsed = s.claimsUsed.filter((c) => allowedLower.has(c.toLowerCase()));
    if (claimsUsed.length !== s.claimsUsed.length) {
      repairs.push(`slide ${i + 1}: dropped claims not in the approved strategy`);
    }
    const badges = copy.badges.filter((b) =>
      allowed.some((a) => containsPhrase(a, b) || containsPhrase(b, a)) ||
      (overrides.offer && containsPhrase(b, overrides.offer))
    );
    if (badges.length !== copy.badges.length) {
      repairs.push(`slide ${i + 1}: dropped badges that are not approved claims`);
      copy.badges = badges;
    }
    if (i === 0 && overrides.headline && copy.headline !== overrides.headline) {
      copy.headline = overrides.headline;
      repairs.push("slide 1: applied the user's required headline");
    }
    if (i < n - 1 && copy.cta) {
      copy.cta = null;
      repairs.push(`slide ${i + 1}: removed CTA (only the closing slide carries the CTA)`);
    }
    if (i === n - 1) {
      if (overrides.cta && copy.cta !== overrides.cta) {
        copy.cta = overrides.cta;
        repairs.push("closing slide: applied the user's required CTA");
      } else if (!copy.cta && ctaExpected(draft.story, ctx.strategy) && ctx.strategy.copy.cta) {
        copy.cta = ctx.strategy.copy.cta;
        repairs.push("closing slide: applied the strategy CTA");
      }
    }
    claimsUsed = [...new Set(claimsUsed)];
    return { ...s, index: i, copy, claimsUsed };
  });

  if (overrides.offer) {
    const offer = overrides.offer;
    const present = slides.some((s) => containsPhrase(slideCopyText(s), offer));
    if (!present && slides.length) {
      const last = slides[slides.length - 1];
      last.copy = { ...last.copy, badges: [offer, ...last.copy.badges].slice(0, 3) };
      repairs.push("closing slide: added the user's offer");
    }
  }

  const sharedDNA = draft.sharedDNA.productRepresentation.includes("SAME exact")
    ? draft.sharedDNA
    : {
        ...draft.sharedDNA,
        productRepresentation: `${draft.sharedDNA.productRepresentation}. ${PRODUCT_IDENTITY_LOCK}`,
      };

  const story: CarouselStory = {
    ...draft.story,
    slideRoles: slides.map((s) => s.role),
    strategyConstraints: {
      allowedClaims: [...ctx.strategy.allowedClaims],
      forbiddenClaims: [...ctx.strategy.forbiddenClaims],
      requiredDisclaimers: [...ctx.strategy.requiredDisclaimers],
    },
  };

  return { draft: { story, sharedDNA, slides }, repairs };
}

export function findRepeatedSlidePairs(slides: CarouselSlide[]): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < slides.length; i++) {
    for (let j = i + 1; j < slides.length; j++) {
      const a = `${slides[i].copy.headline} ${slides[i].copy.supporting || ""}`;
      const b = `${slides[j].copy.headline} ${slides[j].copy.supporting || ""}`;
      if (
        slides[i].copy.headline.trim().toLowerCase() ===
          slides[j].copy.headline.trim().toLowerCase() ||
        textSimilarity(a, b) >= REPEAT_THRESHOLD
      ) {
        pairs.push([i, j]);
      }
    }
  }
  return pairs;
}

/** Same unit, different values across slides (e.g. "26g" vs "30g") */
export function findContradictions(slides: CarouselSlide[]): string[] {
  const seen = new Map<string, Map<string, number>>();
  for (const s of slides) {
    for (const [unit, values] of quantifiedValuesByUnit(slideCopyText(s))) {
      if (!seen.has(unit)) seen.set(unit, new Map());
      for (const v of values) {
        if (!seen.get(unit)!.has(v)) seen.get(unit)!.set(v, s.index);
      }
    }
  }
  const out: string[] = [];
  for (const [unit, values] of seen) {
    if (values.size > 1) {
      out.push(
        `conflicting "${unit}" values across slides: ${[...values.keys()].join(" vs ")}`
      );
    }
  }
  return out;
}

export function findVisualTemplateCollapse(slides: CarouselSlide[]): string[] {
  const issues: string[] = [];
  const fps = slides.map((s) => fingerprintConcept(s.concept));
  for (let i = 1; i < fps.length; i++) {
    const a = fps[i - 1];
    const b = fps[i];
    if (
      a.composition === b.composition &&
      a.product === b.product &&
      a.human === b.human &&
      a.environment === b.environment
    ) {
      issues.push(
        `slides ${i} and ${i + 1} reuse the same layout (composition, product treatment, human presence, environment)`
      );
    }
  }
  if (slides.length >= 3) {
    const allSame = fps.every(
      (f) => f.composition === fps[0].composition && f.product === fps[0].product
    );
    if (allSame) {
      issues.push(
        "every slide uses the same composition and product treatment — vary layouts across the story"
      );
    }
  }
  return issues;
}

export function validateCarouselDraft(
  input: CarouselPlanDraft,
  ctx: CarouselValidationContext
): CarouselValidationResult {
  const { draft, repairs } = repairCarouselDraft(input, ctx);
  const issues: string[] = [];
  const { slides, story, sharedDNA } = draft;
  const n = ctx.slideCount;

  if (slides.length !== n) {
    issues.push(`expected exactly ${n} slides, got ${slides.length}`);
  }

  const ids = new Set<string>();
  slides.forEach((s, i) => {
    if (!s.slideId || ids.has(s.slideId)) issues.push(`slide ${i + 1}: missing or duplicate slideId`);
    ids.add(s.slideId);
    if (s.index !== i) issues.push(`slide ${i + 1}: index out of order`);
    if (!s.role || GENERIC_ROLES.test(s.role)) {
      issues.push(`slide ${i + 1}: needs a meaningful narrative role (got "${s.role}")`);
    }
    if (!s.objective || s.objective.trim().length < 8) {
      issues.push(`slide ${i + 1}: objective is missing or too thin`);
    }
    if (!s.copy.headline.trim()) issues.push(`slide ${i + 1}: headline is required`);
  });

  const roleSeen = new Map<string, number>();
  slides.forEach((s, i) => {
    const prev = roleSeen.get(s.role);
    if (prev != null) {
      issues.push(`slides ${prev + 1} and ${i + 1} share the role "${s.role}" — each slide needs a distinct contribution`);
    } else {
      roleSeen.set(s.role, i);
    }
  });

  for (const [a, b] of findRepeatedSlidePairs(slides)) {
    issues.push(`slides ${a + 1} and ${b + 1} repeat the same message — copy must progress`);
  }
  issues.push(...findContradictions(slides));

  const corpus = groundingCorpusFor(ctx);
  const forbidden = [...ctx.strategy.forbiddenClaims];
  slides.forEach((s, i) => {
    const text = slideCopyText(s);
    for (const f of forbidden) {
      if (f && containsPhrase(text, f)) {
        issues.push(`slide ${i + 1}: uses forbidden claim "${f}"`);
      }
    }
    for (const reason of findUnsupportedClaims(text, corpus)) {
      issues.push(`slide ${i + 1}: ${reason}`);
    }
    if (PROOF_ROLE.test(s.role) && !hasProofEvidence(corpus)) {
      issues.push(`slide ${i + 1}: social-proof role without genuine evidence in the product data`);
    }
  });

  const last = slides[slides.length - 1];
  if (last && ctaExpected(story, ctx.strategy) && !last.copy.cta) {
    issues.push("closing slide needs a CTA that follows the campaign CTA intent");
  }

  const sharedFields: Array<keyof CarouselCreativeDNA> = [
    "palette",
    "typography",
    "photographyStyle",
    "graphicLanguage",
    "productRepresentation",
    "mood",
  ];
  for (const f of sharedFields) {
    if (!String(sharedDNA[f] || "").trim()) issues.push(`shared visual system missing ${f}`);
  }
  if (!sharedDNA.consistencyRules.length) {
    issues.push("shared visual system needs at least one consistency rule");
  }
  if (!story.coreMessage.trim()) issues.push("story core message is required");

  issues.push(...findVisualTemplateCollapse(slides));

  return { ok: issues.length === 0, issues: [...new Set(issues)], repairs, draft };
}
