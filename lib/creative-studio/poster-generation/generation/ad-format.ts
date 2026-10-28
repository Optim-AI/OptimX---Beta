/**
 * Ad format per objective — what kind of ad this poster is, and what that
 * format needs to work: CTA style, how loud the offer/proof badge is, format
 * labels (Before/After) and a one-line layout rule.
 *
 * Learned from the poster eval: one "restrained" treatment for every objective
 * made sale ads hide the offer, social-proof ads shrink the rating and
 * before/after ads drop their labels.
 */

import type { CreativeBrief, CreativeConcept, MarketingStrategy } from "../types";

export type AdFormatKind =
  | "offer"
  | "social_proof"
  | "before_after"
  | "feature"
  | "launch"
  | "festive"
  | "awareness"
  | "general";

export type AdFormat = {
  kind: AdFormatKind;
  /** How the CTA should look when the poster has one */
  ctaGuidance: string;
  /** Keep the strategy CTA even when the copy budget would drop it */
  ctaRequired: boolean;
  /** How the first badge (offer, rating, proof) should be treated */
  badgeGuidance: string;
  /** The first badge is a hero element (offer, rating) */
  heroBadge: boolean;
  /** Short format labels that become approved copy, e.g. Before / After */
  labels: string[];
  /** One-sentence layout rule for this format */
  layoutRule: string;
};

const OFFER_OBJECTIVES = new Set(["sale", "limited_time_offer"]);
const LAUNCH_OBJECTIVES = new Set(["product_launch", "announcement"]);
const FEATURE_OBJECTIVES = new Set(["product_feature", "product_benefit", "education"]);
const FESTIVE_OBJECTIVES = new Set(["seasonal_campaign", "event_promotion"]);
const AWARENESS_OBJECTIVES = new Set(["awareness", "brand_awareness", "social_engagement", "recruitment"]);

const BEFORE_AFTER = /\bbefore\s*(?:and|&|\/|-|→|to|vs\.?)?\s*after\b/i;
const PROOF = /\b(rated|rating|reviews?|testimonial|stars?|★|customers? love|loved by|\d[\d,.]*\+?\s*(?:customers|buyers|reviews|users))\b/i;

const GOAL_FORMAT: Record<NonNullable<CreativeBrief["adGoal"]>, AdFormatKind> = {
  launch: "launch",
  offer: "offer",
  festive: "festive",
  feature: "feature",
  before_after: "before_after",
  social_proof: "social_proof",
  awareness: "awareness",
};

const BUTTON_CTA =
  "a solid, high-contrast button (brand primary or accent fill, text centred) — clearly tappable, smaller than the headline";

export function resolveAdFormat(options: {
  brief: Pick<CreativeBrief, "userInstruction" | "offerHint" | "visualDirection"> &
    Partial<Pick<CreativeBrief, "adGoal" | "proofHint" | "transformationHint" | "occasionHint">>;
  strategy: Pick<MarketingStrategy, "objective" | "userOverrides" | "copy">;
  concept: Pick<CreativeConcept, "territory" | "description" | "visualStory" | "composition">;
}): AdFormat {
  const { brief, strategy, concept } = options;
  const objective = (strategy.objective || "").toLowerCase();
  const instruction = brief.userInstruction || "";
  const conceptText = [concept.description, concept.visualStory, concept.composition].join(" ");
  const hasOffer = !!(brief.offerHint?.trim() || strategy.userOverrides?.offer?.trim());
  const premium = brief.visualDirection === "premium";
  // The user's explicit goal decides the format; otherwise infer from objective and wording.
  const goal = brief.adGoal ?? null;
  const is = (kind: AdFormatKind, inferred: boolean) => (goal ? GOAL_FORMAT[goal] === kind : inferred);
  const cta = premium
    ? "a refined pill button (solid or outlined in a brand colour) — clearly visible and tappable, never lost in the image"
    : BUTTON_CTA;

  if (is("before_after", BEFORE_AFTER.test(instruction) || BEFORE_AFTER.test(conceptText))) {
    return {
      kind: "before_after",
      ctaGuidance: cta,
      ctaRequired: false,
      badgeGuidance: "a compact tag",
      heroBadge: false,
      labels: ["Before", "After"],
      layoutRule:
        "Split the frame into two clearly divided halves showing the same subject before and after, each half labelled; the product sits on the 'After' side or below the split, never covering the result.",
    };
  }
  if (is("offer", OFFER_OBJECTIVES.has(objective) || (hasOffer && objective === "product_promotion"))) {
    return {
      kind: "offer",
      ctaGuidance: BUTTON_CTA,
      ctaRequired: true,
      badgeGuidance:
        "the offer badge — the second focal point after the headline: large, bold and high-contrast (a burst, seal or solid block)",
      heroBadge: true,
      labels: [],
      layoutRule:
        "Make the offer unmissable: the discount or offer is one of the two largest elements, and the product is large and complete, not a small cut-out.",
    };
  }
  if (is("social_proof", concept.territory === "social_proof" || PROOF.test(instruction))) {
    return {
      kind: "social_proof",
      ctaGuidance: cta,
      ctaRequired: true,
      badgeGuidance:
        "the proof badge — a large rating seal or review card (with stars where a rating is given), the second focal point after the headline",
      heroBadge: true,
      labels: [],
      layoutRule: "Make the proof (rating, reviews, customers) the hero device, placed next to the product.",
    };
  }
  if (is("festive", FESTIVE_OBJECTIVES.has(objective) || brief.visualDirection === "festive")) {
    return {
      kind: "festive",
      ctaGuidance: cta,
      ctaRequired: true,
      badgeGuidance: "a decorative seal or tag that fits the occasion",
      heroBadge: false,
      labels: [],
      layoutRule:
        "Make the occasion unmistakable with tasteful, purposeful festive cues around the product (for example lights, diyas or rangoli for Diwali) and present the product as a gift.",
    };
  }
  if (is("launch", LAUNCH_OBJECTIVES.has(objective))) {
    return {
      kind: "launch",
      ctaGuidance: cta,
      ctaRequired: true,
      badgeGuidance: "a crisp tag",
      heroBadge: false,
      labels: [],
      layoutRule: "Reveal the product as the hero — large, well lit and unmistakably new.",
    };
  }
  if (is("feature", FEATURE_OBJECTIVES.has(objective))) {
    return {
      kind: "feature",
      ctaGuidance: cta,
      ctaRequired: false,
      badgeGuidance: "a bold callout tied to the feature",
      heroBadge: false,
      labels: [],
      layoutRule: "Prove the feature visually (show it in use or with a clear visual cue), not just in words.",
    };
  }
  if (is("awareness", AWARENESS_OBJECTIVES.has(objective))) {
    return {
      kind: "awareness",
      ctaGuidance: "a clear pill or outlined button — visible, secondary to the headline",
      ctaRequired: false,
      badgeGuidance: "a compact tag",
      heroBadge: false,
      labels: [],
      layoutRule: "One striking, memorable image that carries the brand; keep the message to the headline.",
    };
  }
  return {
    kind: "general",
    ctaGuidance: cta,
    ctaRequired: false,
    badgeGuidance: "a compact tag",
    heroBadge: false,
    labels: [],
    layoutRule: "",
  };
}
