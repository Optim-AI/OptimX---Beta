/**
 * GenerationSpecification builder — Phase 6.
 * Translates strategy → concept → DNA into a structured, inspectable plan.
 * Does NOT invent marketing copy or creative strategy.
 */

import type { BrandContext } from "../context/brand-context";
import type { ProductContext } from "../context/product-context";
import type { ReferenceContext } from "../context/reference-context";
import type {
  CreativeBrief,
  CreativeConcept,
  CreativeDNA,
  GenerationCopySlot,
  GenerationSpecReference,
  GenerationSpecification,
  MarketingStrategy,
  PosterAspectRatio,
} from "../types";
import {
  formatThemeRecipeForGeneration,
  resolveThemeRecipe,
  type ThemeRecipe,
} from "../theme-recipes";
import { PosterGenerationError } from "./generation-errors";

function blendThemeField(
  themeLine: string,
  dnaOrConcept: string | null | undefined
): string {
  const base = (dnaOrConcept || "").trim();
  if (!base) return themeLine;
  if (base.toLowerCase().includes(themeLine.slice(0, 24).toLowerCase())) {
    return base;
  }
  return `${themeLine} | Concept/DNA: ${base}`;
}

function applyThemeToSceneFields(
  theme: ThemeRecipe,
  concept: CreativeConcept,
  dna: CreativeDNA
): {
  colorStrategy: string;
  typography: string;
  graphicLanguage: string;
  mood: string;
  lighting: string;
  visualRhythm: string;
  visualDirectionExpression: string;
  composition: string;
} {
  return {
    colorStrategy: blendThemeField(
      `THEME(${theme.label}): ${theme.colorStrategy}`,
      dna.colorStrategy || concept.colorTreatment
    ),
    typography: blendThemeField(
      `THEME(${theme.label}): ${theme.typography}`,
      dna.typographyStrategy || concept.typographyTreatment
    ),
    graphicLanguage: blendThemeField(
      `THEME(${theme.label}): ${theme.graphicLanguage}`,
      dna.graphicLanguage || concept.graphicLanguage
    ),
    mood: blendThemeField(
      `THEME(${theme.label}): ${theme.mood}`,
      dna.mood || concept.emotionalExpression
    ),
    lighting: blendThemeField(
      `THEME(${theme.label}): ${theme.lighting}`,
      dna.lighting
    ),
    visualRhythm: blendThemeField(
      `THEME(${theme.label}) density: ${theme.density}`,
      dna.visualRhythm
    ),
    visualDirectionExpression: [
      concept.visualDirectionExpression?.trim() || "",
      `${theme.label}: ${theme.summary}`,
    ]
      .filter(Boolean)
      .join(" — "),
    composition: blendThemeField(
      `THEME(${theme.label}): ${theme.compositionBias}`,
      dna.composition || concept.composition
    ),
  };
}

export type BuildGenerationSpecificationInput = {
  sessionId: string;
  brief: CreativeBrief;
  strategy: MarketingStrategy;
  concept: CreativeConcept;
  dna: CreativeDNA;
  product: ProductContext;
  brand: BrandContext;
  references: ReferenceContext;
  variantIndex: number;
  variantId?: string;
  generationId?: string;
  specificationId?: string;
};

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

function platformForAspect(aspect: PosterAspectRatio): string {
  switch (aspect) {
    case "1:1":
      return "Square social / feed";
    case "4:5":
      return "Instagram feed / portrait social";
    case "9:16":
      return "Stories / Reels / vertical";
    case "1.91:1":
      return "Landscape / link ad / wide feed";
    default:
      return "Social poster";
  }
}

function buildCopyHierarchy(
  strategy: MarketingStrategy
): { renderCopy: GenerationSpecification["renderCopy"]; copyHierarchy: GenerationCopySlot[] } {
  const overrides = strategy.userOverrides || {};
  const headline =
    (overrides.headline && overrides.headline.trim()) ||
    strategy.copy.headline.trim();
  if (!headline) {
    throw new PosterGenerationError({
      code: "VALIDATION",
      message:
        "Cannot build GenerationSpecification without approved headline copy from MarketingStrategy",
      stage: "buildCopy",
    });
  }

  const supporting =
    (overrides.message && overrides.message.trim()) ||
    strategy.copy.supporting ||
    null;
  const productLine = strategy.copy.productLine || null;
  const cta =
    (overrides.cta && overrides.cta.trim()) || strategy.copy.cta || null;
  const badges = [...(strategy.copy.badges || [])];
  if (overrides.offer?.trim() && !badges.includes(overrides.offer.trim())) {
    badges.unshift(overrides.offer.trim());
  }

  const copyHierarchy: GenerationCopySlot[] = [
    { role: "primary", text: headline, importance: "required" },
  ];
  if (productLine?.trim()) {
    copyHierarchy.push({
      role: "product_line",
      text: productLine.trim(),
      importance: "required",
    });
  }
  if (supporting?.trim()) {
    copyHierarchy.push({
      role: "secondary",
      text: supporting.trim(),
      importance: "optional",
    });
  }
  for (const badge of badges.slice(0, 3)) {
    copyHierarchy.push({
      role: "badge",
      text: badge,
      importance: "optional",
    });
  }
  if (cta?.trim()) {
    copyHierarchy.push({
      role: "cta",
      text: cta.trim(),
      importance: "optional",
    });
  }

  return {
    renderCopy: {
      headline,
      supporting,
      productLine,
      cta,
      badges,
    },
    copyHierarchy,
  };
}

function buildReferences(
  brief: CreativeBrief,
  brand: BrandContext,
  references: ReferenceContext,
  product: ProductContext
): GenerationSpecReference[] {
  const out: GenerationSpecReference[] = [];
  let idx = 0;
  const nextLabel = (kind: string) => {
    idx += 1;
    const letter = String.fromCharCode(64 + idx); // A, B, C...
    return `REFERENCE ${letter} — ${kind}`;
  };

  const seenProductUrls = new Set<string>();
  const pushProduct = (
    url: string | null | undefined,
    assetId: string,
    role: GenerationSpecReference["role"] = "product_packshot"
  ) => {
    const cleaned = typeof url === "string" ? url.trim() : "";
    if (!cleaned || seenProductUrls.has(cleaned)) return;
    seenProductUrls.add(cleaned);
    out.push({
      assetId,
      kind: "product",
      role,
      label: nextLabel(
        "PRODUCT (USER-UPLOADED — COMPOSITE EXACT PACKSHOT)"
      ),
      url: cleaned,
    });
  };

  // Product packshots always first — never let design/logo crowd them out
  for (const ref of references.productReferences) {
    pushProduct(ref.image?.url, ref.id, ref.role || "product_packshot");
  }
  for (const [i, img] of (product.images || []).entries()) {
    pushProduct(img?.url, `product_img_${i}`, "product_packshot");
  }
  if (product.primaryImage?.url) {
    pushProduct(product.primaryImage.url, "product_primary", "product_packshot");
  }
  for (const [i, img] of (brief.product?.images || []).entries()) {
    pushProduct(img?.url, `brief_product_${i}`, "product_packshot");
  }
  for (const [i, ref] of (brief.productReferences || []).entries()) {
    pushProduct(
      ref.image?.url,
      ref.id || `brief_product_ref_${i}`,
      ref.role || "product_packshot"
    );
  }

  const logo = brand.identity.logo || brief.brand?.logo;
  if (logo?.url) {
    out.push({
      assetId: "brand_logo",
      kind: "logo",
      role: "brand_logo",
      label: nextLabel("LOGO (BRAND MARK — DO NOT REDESIGN)"),
      url: logo.url,
    });
  }

  // Cap design refs so product slots stay available (provider max 4)
  for (const ref of references.designReferences.slice(0, 1)) {
    out.push({
      assetId: ref.id,
      kind: "design",
      role: ref.role,
      label: nextLabel("DESIGN (VISUAL INSPIRATION ONLY — DO NOT COPY)"),
      url: ref.image?.url || null,
    });
  }

  for (const ref of references.supportingReferences.slice(0, 1)) {
    out.push({
      assetId: ref.id,
      kind: "supporting",
      role: ref.role,
      label: nextLabel("SUPPORTING (OPTIONAL CONTEXT)"),
      url: ref.image?.url || null,
    });
  }

  return out;
}

function brandRequirements(brand: BrandContext, brief: CreativeBrief): string[] {
  const reqs: string[] = [];
  if (brand.identity.name?.value || brief.brand?.name) {
    reqs.push(
      `Brand name: ${brand.identity.name?.value || brief.brand?.name}`
    );
  }
  const colors =
    brand.identity.colors.palette?.length
      ? brand.identity.colors.palette
      : brief.brand?.primaryColors || [];
  if (colors.length) {
    reqs.push(
      `Approved brand colors available (use when DNA color strategy calls for them — do not force onto every surface): ${colors.join(", ")}`
    );
  }
  if (brand.identity.fonts?.value || brief.brand?.fonts) {
    reqs.push(
      `Brand font preference (best-effort; exact font fidelity not guaranteed): ${brand.identity.fonts?.value || brief.brand?.fonts}`
    );
  }
  if (brand.communication.tone?.value || brief.brand?.tone) {
    reqs.push(`Tone: ${brand.communication.tone?.value || brief.brand?.tone}`);
  }
  return reqs;
}

export function buildGenerationSpecification(
  input: BuildGenerationSpecificationInput
): GenerationSpecification {
  const {
    sessionId,
    brief,
    strategy,
    concept,
    dna,
    product,
    brand,
    references,
    variantIndex,
  } = input;

  if (!brief?.id) {
    throw new PosterGenerationError({
      code: "MISSING_BRIEF",
      message: "CreativeBrief required",
      stage: "buildGenerationSpecification",
    });
  }
  if (!strategy?.id) {
    throw new PosterGenerationError({
      code: "MISSING_STRATEGY",
      message: "MarketingStrategy required",
      stage: "buildGenerationSpecification",
    });
  }
  if (concept.strategyId !== strategy.id) {
    throw new PosterGenerationError({
      code: "STALE_STRATEGY",
      message: "Concept is not bound to the current strategy",
      stage: "buildGenerationSpecification",
    });
  }
  if (dna.conceptId !== concept.id) {
    throw new PosterGenerationError({
      code: "MISSING_DNA",
      message: "CreativeDNA does not match concept",
      stage: "buildGenerationSpecification",
    });
  }

  const generationId = input.generationId || newId("gen");
  const variantId =
    input.variantId ||
    `var_${String(variantIndex + 1).padStart(3, "0")}_${generationId.slice(-6)}`;
  const specId = input.specificationId || `spec_${generationId}`;

  const { renderCopy, copyHierarchy } = buildCopyHierarchy(strategy);
  const refs = buildReferences(brief, brand, references, product);
  const brandReqs = brandRequirements(brand, brief);
  const theme = resolveThemeRecipe(brief.visualDirection);
  const themeScene = applyThemeToSceneFields(theme, concept, dna);

  const productName =
    product.name?.value || brief.product?.name || "the product";
  const hasProductRef = refs.some((r) => r.kind === "product" && r.url);

  const spec: GenerationSpecification = {
    id: specId,
    sessionId,
    briefId: brief.id,
    strategyId: strategy.id,
    conceptId: concept.id,
    dnaId: dna.id,
    createdAt: new Date().toISOString(),
    generationId,
    variantId,
    variantIndex,
    aspectRatio: brief.aspectRatio,
    intendedPlatform: platformForAspect(brief.aspectRatio),
    renderCopy,
    copyHierarchy,
    strategyAlignment: {
      objective: strategy.objective,
      primaryMessage: strategy.primaryMessage,
      audience: strategy.audience,
      communicationAngle: strategy.communicationAngle,
      allowedClaims: [...strategy.allowedClaims],
      forbiddenClaims: [...strategy.forbiddenClaims],
      restrictedClaims: [...strategy.restrictedClaims],
    },
    scene: {
      visualTerritory: dna.visualTerritory || concept.territory,
      visualStory: concept.visualStory,
      composition: themeScene.composition,
      subjectTreatment: dna.subjectTreatment || concept.subjectTreatment,
      productRole: concept.productTreatment,
      productTreatment: [
        dna.productTreatment || concept.productTreatment,
        hasProductRef
          ? "COMPOSITE the exact user-uploaded product packshot from the PRODUCT reference image — do not redraw or invent packaging."
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      environment: dna.environment || concept.environment,
      humanPresence: dna.humanPresence || concept.humanPresence,
      lighting: themeScene.lighting,
      photographyStyle: dna.photographyStyle,
      colorStrategy: themeScene.colorStrategy,
      typography: themeScene.typography,
      graphicLanguage: themeScene.graphicLanguage,
      visualRhythm: themeScene.visualRhythm,
      mood: themeScene.mood,
      hierarchy: dna.hierarchy || concept.copyHierarchy,
      productFidelityRules: [
        `HARD PRODUCT LOCK: "${productName}" must appear as the EXACT user-uploaded product from the PRODUCT reference image(s).`,
        "Composite / place that packshot into the scene with natural perspective and lighting.",
        "Do NOT invent, redraw, regenerate, redesign, approximate, or swap packaging for a different SKU, brand, or lookalike.",
        "Packaging artwork, logo, colors, label text, proportions, and material finish must match the reference.",
        "Photorealistic placement is allowed; inventing a new product is forbidden.",
      ].join(" "),
      brandIntegration: [
        themeScene.visualDirectionExpression,
        brandReqs.length
          ? `Brand constraints: ${brandReqs.join("; ")}`
          : "No forced brand palette — follow theme + DNA color strategy.",
      ]
        .filter(Boolean)
        .join(" "),
      designReferenceInfluence:
        refs.some((r) => r.kind === "design")
          ? "Design references influence art direction, composition principles, typography character, and mood ONLY. Do NOT copy exact layout, text, decorative elements, or distinctive arrangement. Never replace the product with anything from a design reference. Theme lock still applies."
          : "No design reference attached.",
      visualDirectionExpression: themeScene.visualDirectionExpression,
      outputRequirements: [
        `Compose natively for aspect ratio ${brief.aspectRatio} (${platformForAspect(brief.aspectRatio)}).`,
        "Do not generate a generic canvas intended for later crop.",
        "Finished advertising poster ready for social use.",
        "Render ONLY the approved copy from the specification — do not invent or paraphrase required text.",
        hasProductRef
          ? "The featured product packaging must be recognizably identical to the attached PRODUCT reference."
          : "No product reference attached — do not invent branded packaging.",
        `THEME LOCK (${theme.label}): ${theme.summary}`,
        ...theme.must.map((m) => `Theme must: ${m}`),
        ...theme.avoid.map((a) => `Theme avoid: ${a}`),
        formatThemeRecipeForGeneration(theme),
        dna.aspectAwareNotes || "Respect aspect-aware composition notes from DNA.",
      ],
    },
    references: refs,
    attachedAssetIds: refs.map((r) => r.assetId),
    constraints: {
      productFidelity: hasProductRef
        ? "AUTHORITATIVE: The attached PRODUCT reference is the only allowed product. Place that exact uploaded packshot in the poster. Never generate substitute packaging."
        : "No product reference attached. Do not invent branded packaging or fake SKUs.",
      logoFidelity: "Do not redesign, distort, or invent logos.",
      copyFidelity:
        "Render approved copy exactly. Do not invent headlines, CTAs, claims, URLs, phones, or dates.",
      unsupportedClaims: [
        ...strategy.forbiddenClaims,
        ...strategy.restrictedClaims,
      ],
      referenceHandling:
        "PRODUCT references = exact user-uploaded product (composite, never reinvent). DESIGN references = inspiration only (never copy; never steal product). SUPPORTING = optional context. LOGO = brand mark fidelity.",
      brandRequirements: brandReqs,
    },
    userOverrides: { ...strategy.userOverrides },
    compiledPrompt: null,
  };

  return spec;
}
