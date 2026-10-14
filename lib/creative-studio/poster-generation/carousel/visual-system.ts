/**
 * Shared campaign visual system → per-slide CreativeConcept, CreativeDNA and
 * GenerationSpecification. The specification stays the source of truth; the
 * Nano Banana prompt is still compiled from it by the existing adapter.
 */

import type { BrandContext } from "../context/brand-context";
import type { ProductContext } from "../context/product-context";
import type { ReferenceContext } from "../context/reference-context";
import { asTerritory } from "../concept/concept-validation";
import { buildGenerationSpecification } from "../generation/specification-builder";
import type {
  CreativeBrief,
  CreativeConcept,
  CreativeDNA,
  CreativeTerritory,
  GenerationSpecification,
  MarketingStrategy,
} from "../types";
import type {
  CarouselCampaign,
  CarouselCreativeDNA,
  CarouselSlide,
  CarouselSlideCopy,
} from "./types";

export const PRODUCT_IDENTITY_LOCK =
  "Every slide shows the SAME exact user-uploaded product (packaging, label, colors, proportions) from the PRODUCT reference — never a redesigned or lookalike pack. Design references guide visual language only and never replace the product.";

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

function strList(v: unknown, max = 8): string[] {
  return Array.isArray(v)
    ? v.map((x) => str(x)).filter(Boolean).slice(0, max)
    : [];
}

export type CampaignDirection = {
  concept: CreativeConcept;
  dna: CreativeDNA;
} | null;

export function buildSharedCarouselDNA(options: {
  raw: unknown;
  id: string;
  direction: CampaignDirection;
  brand: BrandContext;
}): CarouselCreativeDNA {
  const r = (options.raw && typeof options.raw === "object"
    ? options.raw
    : {}) as Record<string, unknown>;
  const d = options.direction?.dna;
  const palette = options.brand.identity.colors.palette;
  const brandName = options.brand.identity.name?.value;

  const productRepresentation = str(
    r.productRepresentation,
    d?.productTreatment || "Exact product packshot, consistently recognizable"
  );

  return {
    id: options.id,
    directionConceptId: options.direction?.concept.id ?? null,
    brandIdentity: str(
      r.brandIdentity,
      brandName
        ? `${brandName} brand marks used consistently and never redrawn`
        : "Consistent brand presence; never invent logos"
    ),
    palette: str(
      r.palette,
      d?.colorStrategy ||
        (palette.length ? `Brand palette: ${palette.join(", ")}` : "One restrained campaign palette")
    ),
    typography: str(r.typography, d?.typographyStrategy || "One typographic voice across slides"),
    photographyStyle: str(r.photographyStyle, d?.photographyStyle || "Consistent photographic treatment"),
    graphicLanguage: str(r.graphicLanguage, d?.graphicLanguage || "Shared restrained graphic language"),
    productRepresentation: productRepresentation.includes("SAME exact")
      ? productRepresentation
      : `${productRepresentation}. ${PRODUCT_IDENTITY_LOCK}`,
    mood: str(r.mood, d?.mood || options.direction?.concept.emotionalExpression || "Confident"),
    visualHierarchy: str(r.visualHierarchy, d?.hierarchy || "Headline first, product second, supporting copy third"),
    lighting: str(r.lighting, d?.lighting || "Consistent lighting family across slides"),
    recurringElements: strList(r.recurringElements),
    consistencyRules: (() => {
      const rules = strList(r.consistencyRules);
      return rules.length
        ? rules
        : [
            "Same palette, typography family, and photographic treatment on every slide",
            "Logo placement and size consistent across slides",
          ];
    })(),
    permittedVariation: (() => {
      const v = strList(r.permittedVariation);
      return v.length
        ? v
        : ["Composition", "Product scale and placement", "Environment", "Text hierarchy", "Visual focus"];
    })(),
  };
}

export type SlideConceptRaw = Record<string, unknown>;

/**
 * Slide concept: role-specific idea; inherits the campaign direction where the
 * planner left a field empty. Strategy/brief binding stays authoritative.
 */
export function buildSlideConcept(options: {
  raw: SlideConceptRaw;
  slideId: string;
  index: number;
  roleLabel: string;
  objective: string;
  briefId: string;
  strategyId: string;
  createdAt: string;
  direction: CampaignDirection;
  shared: CarouselCreativeDNA;
}): CreativeConcept {
  const r = options.raw || {};
  const base = options.direction?.concept;
  const fallbackTerritory: CreativeTerritory = base?.territory || "product_hero";
  const name = str(r.name, `${options.roleLabel} — slide ${options.index + 1}`);
  return {
    id: `concept_${options.slideId}`,
    briefId: options.briefId,
    strategyId: options.strategyId,
    createdAt: options.createdAt,
    name,
    description: str(r.description, `${options.roleLabel}: ${options.objective}`),
    territory: asTerritory(r.territory, fallbackTerritory),
    rationale: str(r.rationale, `Slide ${options.index + 1} — ${options.objective}`),
    visualStory: str(r.visualStory, options.objective),
    composition: str(r.composition, base?.composition || "Role-specific composition"),
    subjectTreatment: str(r.subjectTreatment, base?.subjectTreatment || "Product-led"),
    productTreatment: str(r.productTreatment, base?.productTreatment || "integrated"),
    environment: str(r.environment, base?.environment || "Context that explains the slide's role"),
    humanPresence: str(r.humanPresence, base?.humanPresence || "none"),
    emotionalExpression: str(r.emotionalExpression, options.shared.mood),
    cameraDirection: str(r.cameraDirection, base?.cameraDirection || "Viewpoint chosen for this slide's focus"),
    typographyTreatment: str(r.typographyTreatment, options.shared.typography),
    colorTreatment: options.shared.palette,
    graphicLanguage: options.shared.graphicLanguage,
    supportingElements: str(r.supportingElements, "Only elements that serve this slide's role"),
    copyHierarchy: str(r.copyHierarchy, options.shared.visualHierarchy),
    ctaTreatment: str(r.ctaTreatment, "CTA only on the closing slide"),
    visualDirectionExpression: str(
      r.visualDirectionExpression,
      base?.visualDirectionExpression || "Campaign theme applied consistently"
    ),
    differentiation: str(
      r.differentiation,
      `Distinct ${options.roleLabel.toLowerCase()} layout within the shared campaign system`
    ),
  };
}

/** Slide DNA = shared visual system (constant) + slide composition (variable). */
export function buildSlideDNA(options: {
  slideId: string;
  concept: CreativeConcept;
  shared: CarouselCreativeDNA;
  direction: CampaignDirection;
}): CreativeDNA {
  const { concept, shared } = options;
  return {
    id: `dna_${options.slideId}`,
    conceptId: concept.id,
    visualTerritory: concept.territory,
    composition: concept.composition,
    subjectTreatment: concept.subjectTreatment,
    productTreatment: `${concept.productTreatment}. ${shared.productRepresentation}`,
    photographyStyle: shared.photographyStyle,
    lighting: shared.lighting,
    colorStrategy: shared.palette,
    typographyStrategy: `${shared.typography}. Slide emphasis: ${concept.typographyTreatment}`,
    graphicLanguage: shared.graphicLanguage,
    humanPresence: concept.humanPresence,
    environment: concept.environment,
    mood: shared.mood,
    hierarchy: concept.copyHierarchy,
    visualRhythm:
      options.direction?.dna.visualRhythm || "Clear primary beat with restrained secondary accents",
    aspectAwareNotes:
      options.direction?.dna.aspectAwareNotes || "Compose natively for the campaign aspect ratio",
  };
}

/**
 * Strategy as seen by ONE slide: identical objective, message, audience and claim
 * policy; copy and user overrides scoped to the slide that carries them.
 */
export function slideStrategyView(
  strategy: MarketingStrategy,
  slide: { index: number; copy: CarouselSlideCopy },
  slideCount: number
): MarketingStrategy {
  const isFirst = slide.index === 0;
  const isLast = slide.index === slideCount - 1;
  return {
    ...strategy,
    copy: {
      headline: slide.copy.headline,
      supporting: slide.copy.supporting,
      productLine: isFirst || isLast ? strategy.copy.productLine ?? null : null,
      cta: slide.copy.cta,
      badges: [...slide.copy.badges],
    },
    userOverrides: {
      headline: isFirst ? strategy.userOverrides.headline ?? null : null,
      cta: isLast ? strategy.userOverrides.cta ?? null : null,
      audience: strategy.userOverrides.audience ?? null,
      message: null,
      offer: null,
    },
  };
}

function carouselOutputRequirements(options: {
  slide: CarouselSlide;
  campaign: Pick<CarouselCampaign, "slideCount" | "story" | "sharedDNA">;
}): string[] {
  const { slide, campaign } = options;
  const shared = campaign.sharedDNA;
  const n = campaign.slideCount;
  return [
    `CAROUSEL SLIDE ${slide.index + 1} OF ${n} — narrative role: ${slide.roleLabel}. Slide objective: ${slide.objective}.`,
    `Campaign core message (shared by all slides): ${campaign.story.coreMessage}`,
    `Campaign consistency (must match sibling slides): palette — ${shared.palette}; typography — ${shared.typography}; photography — ${shared.photographyStyle}; graphic language — ${shared.graphicLanguage}; lighting — ${shared.lighting}.`,
    ...shared.consistencyRules.map((r) => `Consistency rule: ${r}`),
    ...(shared.recurringElements.length
      ? [`Recurring campaign elements: ${shared.recurringElements.join("; ")}`]
      : []),
    `Permitted variation for this slide: ${shared.permittedVariation.join(", ")}. Use THIS slide's composition — do not default to a centered product hero unless the composition says so.`,
    PRODUCT_IDENTITY_LOCK,
    slide.index === n - 1
      ? "This is the closing slide of the carousel."
      : "This is not the closing slide — do not add a call-to-action that is not in the approved copy.",
  ];
}

export function buildSlideSpecification(options: {
  sessionId: string;
  brief: CreativeBrief;
  strategy: MarketingStrategy;
  campaign: Pick<CarouselCampaign, "slideCount" | "story" | "sharedDNA">;
  slide: CarouselSlide;
  product: ProductContext;
  brand: BrandContext;
  references: ReferenceContext;
  generationId: string;
}): { specification: GenerationSpecification; slideStrategy: MarketingStrategy } {
  const slideStrategy = slideStrategyView(
    options.strategy,
    options.slide,
    options.campaign.slideCount
  );
  const spec = buildGenerationSpecification({
    sessionId: options.sessionId,
    brief: options.brief,
    strategy: slideStrategy,
    concept: options.slide.concept,
    dna: options.slide.dna,
    product: options.product,
    brand: options.brand,
    references: options.references,
    variantIndex: options.slide.index,
    variantId: options.slide.slideId,
    generationId: options.generationId,
    specificationId: `spec_${options.generationId}`,
  });
  return {
    slideStrategy,
    specification: {
      ...spec,
      scene: {
        ...spec.scene,
        outputRequirements: [
          ...spec.scene.outputRequirements,
          ...carouselOutputRequirements(options),
        ],
      },
    },
  };
}
