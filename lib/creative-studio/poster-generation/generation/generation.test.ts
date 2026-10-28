/**
 * Phase 6 generation tests (mocked provider + credits + storage).
 * Run: node --import tsx lib/creative-studio/poster-generation/generation/generation.test.ts
 */

import type {
  CreativeBrief,
  CreativeConcept,
  CreativeDNA,
  ImageGenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
  MarketingStrategy,
  PosterGenerationSession,
  PosterProductContext,
} from "../types";
import {
  PosterGenerationSessionService,
  type PosterGenerationSessionRepository,
} from "../session";
import { buildGenerationSpecification } from "./specification-builder";
import { validateGenerationSpecification } from "./specification-validation";
import {
  compileNanoBananaPrompt,
  buildImageGenerationRequest,
} from "./nano-banana-prompt";
import { generatePostersForSession } from "./generate-poster";
import { PosterGenerationError } from "./generation-errors";
import { strategistInputFromBrief } from "../strategy/from-brief";
import { trimPosterPhrase } from "./copy-density";
import { EMPTY_IDENTITY } from "@/lib/brand-kit/types";
import { missingGoalDetails } from "../brief-options";
import { applyCopyEdits } from "../strategy/copy-edits";
import {
  detectImageMimeType,
  getPosterImageSize,
} from "@/lib/creative-studio/nano-banana/client";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

class MemoryRepo implements PosterGenerationSessionRepository {
  store = new Map<string, PosterGenerationSession>();
  async insert(s: PosterGenerationSession) {
    this.store.set(s.id, structuredClone(s));
    return structuredClone(s);
  }
  async findById(id: string) {
    const s = this.store.get(id);
    return s ? structuredClone(s) : null;
  }
  async findByIdAndUserId(id: string, userId: string) {
    const s = this.store.get(id);
    if (!s || s.userId !== userId) return null;
    return structuredClone(s);
  }
  async findByStudioSessionId() {
    return null;
  }
  async updateOptimistic(session: PosterGenerationSession, expectedVersion: number) {
    const cur = this.store.get(session.id);
    if (!cur || cur.version !== expectedVersion) throw new Error("conflict");
    const next = {
      ...structuredClone(session),
      version: expectedVersion + 1,
      updatedAt: new Date().toISOString(),
    };
    this.store.set(session.id, next);
    return structuredClone(next);
  }
}

class MockProvider implements ImageGenerationProvider {
  readonly id = "mock_provider";
  modelId = "mock-model";
  calls: ImageGenerationRequest[] = [];
  private queue: Array<Partial<ImageGenerationResult> | Error> = [];

  constructor(responses: Array<Partial<ImageGenerationResult> | Error>) {
    this.queue = [...responses];
  }

  getCapabilities() {
    return {
      supportsGenerate: true,
      supportsEdit: false,
      supportedAspectRatios: ["1:1", "4:5", "9:16", "1.91:1"] as Array<
        "1:1" | "4:5" | "9:16" | "1.91:1"
      >,
      maxReferenceImages: 4,
      supportsReferenceImages: true,
      supportsInpainting: false,
    };
  }

  async checkAvailability() {
    return { available: true };
  }

  estimateCost() {
    return 1;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    this.calls.push(request);
    const next = this.queue.shift();
    if (next === undefined) {
      return {
        ok: false,
        provider: this.id,
        model: this.modelId,
        estimatedCostCredits: 0,
        errorCode: "EMPTY",
        errorMessage: "No mock response",
      };
    }
    if (next instanceof Error) throw next;
    if (next.ok === false) {
      return {
        ok: false,
        provider: this.id,
        model: this.modelId,
        estimatedCostCredits: 0,
        errorCode: next.errorCode || "FAIL",
        errorMessage: next.errorMessage || "fail",
        durationMs: 10,
      };
    }
    return {
      ok: true,
      imageDataUrl: next.imageDataUrl || "data:image/png;base64,aaa",
      imageBuffer: next.imageBuffer || Buffer.from("png"),
      mimeType: "image/png",
      provider: this.id,
      model: this.modelId,
      durationMs: 12,
      estimatedCostCredits: 1,
      compiledPrompt: request.prompt,
    };
  }

  async edit(): Promise<ImageGenerationResult> {
    return {
      ok: false,
      provider: this.id,
      model: this.modelId,
      estimatedCostCredits: 0,
      errorCode: "UNSUPPORTED",
      errorMessage: "no edit",
    };
  }
}

function sampleProduct(): PosterProductContext {
  return {
    source: "catalog",
    name: "Dark Chocolate Protein Oats",
    description: "High-protein oats",
    shortBenefit: "26g protein",
    category: "Food",
    benefits: [],
    factualClaims: ["26g protein", "Dark chocolate"],
    features: [],
    emotionalAngles: [],
    useCases: [],
    images: [{ url: "https://cdn.example.com/oats.png" }],
    brandName: "FuelCo",
  };
}

function makeBrief(overrides: Partial<CreativeBrief> = {}): CreativeBrief {
  return {
    id: "brief_1",
    createdAt: new Date().toISOString(),
    brand: {
      snapshot: null,
      name: "FuelCo",
      primaryColors: ["#113"],
      aestheticTags: [],
      values: [],
      guidelinesApplied: false,
      logo: { url: "https://cdn.example.com/logo.png" },
    },
    product: sampleProduct(),
    userInstruction: "Create a product launch poster",
    visualDirection: "premium",
    aspectRatio: "4:5",
    variantCount: 1,
    constraints: [],
    productReferences: [
      {
        id: "pref_1",
        role: "product_packshot",
        image: { url: "https://cdn.example.com/oats.png" },
      },
    ],
    designReferences: [
      {
        id: "dref_1",
        role: "design_inspiration",
        image: { url: "https://cdn.example.com/ref.jpg" },
        designAnalysis: {
          composition: "asymmetric",
          layout: "type top",
          typography: "editorial",
          colorStrategy: "muted",
          imagery: "still life",
          graphicLanguage: "thin rules",
          hierarchy: "type then product",
          spacing: "generous",
          visualTreatment: "matte",
          designMechanism: "crop",
          avoid: ["exact copy"],
        },
      },
    ],
    supportingReferences: [],
    ...overrides,
  };
}

function makeStrategy(overrides: Partial<MarketingStrategy> = {}): MarketingStrategy {
  return {
    id: "strat_1",
    briefId: "brief_1",
    createdAt: new Date().toISOString(),
    objective: "product_launch",
    audience: "Active breakfast consumers",
    primaryMessage: "A convenient high-protein breakfast option",
    communicationAngle: "discovery",
    valueProposition: "26g protein oats",
    emotionalDirection: "confidence",
    rationale: "Lead with protein",
    supportingMessages: [],
    copy: {
      headline: "26G PROTEIN",
      supporting: "Dark Chocolate Protein Oats",
      productLine: "Dark Chocolate Protein Oats",
      cta: "Discover now",
      badges: ["26g protein"],
    },
    informationHierarchy: ["Benefit", "Product", "CTA"],
    allowedClaims: ["26g protein"],
    forbiddenClaims: ["Build muscle faster"],
    restrictedClaims: [],
    requiredDisclaimers: [],
    userOverrides: {},
    ...overrides,
  };
}

function makeConcept(id = "concept_1"): CreativeConcept {
  return {
    id,
    briefId: "brief_1",
    strategyId: "strat_1",
    createdAt: new Date().toISOString(),
    name: "Morning Ritual",
    description: "A real morning breakfast moment for the product.",
    territory: "lifestyle",
    rationale: "Makes protein benefit feel everyday",
    visualStory: "Hands prepare oats; product in scene",
    composition: "Asymmetric breakfast",
    subjectTreatment: "Hands focus",
    productTreatment: "integrated",
    environment: "Kitchen morning light",
    humanPresence: "hands only",
    emotionalExpression: "Calm confidence",
    cameraDirection: "Slight overhead",
    typographyTreatment: "Large editorial headline",
    colorTreatment: "Warm neutrals",
    graphicLanguage: "Minimal",
    supportingElements: "Bowl steam",
    copyHierarchy: "Headline → product → CTA",
    ctaTreatment: "Quiet CTA",
    visualDirectionExpression: "Premium as refined restraint",
    differentiation: "Lifestyle ritual",
  };
}

function makeDna(conceptId = "concept_1"): CreativeDNA {
  return {
    id: `dna_${conceptId}`,
    conceptId,
    visualTerritory: "lifestyle",
    composition: "Asymmetric breakfast",
    subjectTreatment: "Hands",
    productTreatment: "integrated",
    photographyStyle: "Natural light still life",
    lighting: "Window soft",
    colorStrategy: "Warm + brand accent",
    typographyStrategy: "Large editorial headline",
    graphicLanguage: "Minimal",
    humanPresence: "hands only",
    environment: "Kitchen",
    mood: "Calm confidence",
    hierarchy: "Story → product → type",
    visualRhythm: "Steady beat",
    aspectAwareNotes: "4:5 stack",
  };
}

async function seedSession(opts?: {
  concepts?: number;
  overrides?: Partial<MarketingStrategy>;
  brief?: Partial<CreativeBrief>;
  /** Applied to concept_1 */
  concept?: Partial<CreativeConcept>;
}) {
  const repo = new MemoryRepo();
  const service = new PosterGenerationSessionService(repo);
  await service.createSession({ userId: "user_1", id: "sess_gen" });
  const brief = makeBrief({
    variantCount: (opts?.concepts || 1) as 1 | 2 | 3,
    ...opts?.brief,
  });
  await service.updateBrief("sess_gen", "user_1", brief);
  const strategy = makeStrategy(opts?.overrides);
  await service.updateStrategy("sess_gen", "user_1", strategy);
  const n = opts?.concepts || 1;
  const concepts = Array.from({ length: n }, (_, i) =>
    makeConcept(`concept_${i + 1}`)
  );
  if (opts?.concept) concepts[0] = { ...concepts[0], ...opts.concept };
  // diversify territories for multi
  if (concepts[1]) {
    concepts[1] = {
      ...concepts[1],
      name: "Protein Hero",
      territory: "product_hero",
      differentiation: "Product hero",
      humanPresence: "none",
      productTreatment: "hero",
    };
  }
  if (concepts[2]) {
    concepts[2] = {
      ...concepts[2],
      name: "Editorial",
      territory: "editorial",
      differentiation: "Editorial type",
      typographyTreatment: "typography-led",
    };
  }
  const dna: Record<string, CreativeDNA> = {};
  for (const c of concepts) {
    dna[c.id] = {
      ...makeDna(c.id),
      visualTerritory: c.territory,
      humanPresence: c.humanPresence,
      productTreatment: c.productTreatment,
    };
  }
  await service.setConcepts("sess_gen", "user_1", concepts, dna);
  await service.selectConcept(
    "sess_gen",
    "user_1",
    concepts.map((c) => c.id)
  );
  return { repo, service, brief, strategy, concepts };
}

async function run() {
  const contexts = strategistInputFromBrief(makeBrief());
  const strategy = makeStrategy();
  const concept = makeConcept();
  const dna = makeDna();

  // 1–10 specification
  const spec = buildGenerationSpecification({
    sessionId: "sess_gen",
    brief: makeBrief(),
    strategy,
    concept,
    dna,
    product: contexts.product,
    brand: contexts.brand,
    references: contexts.references,
    variantIndex: 0,
  });
  assert(spec.renderCopy.headline === "26G PROTEIN", "headline from strategy");
  assert(
    spec.strategyAlignment.primaryMessage === strategy.primaryMessage,
    "strategy alignment"
  );
  assert(spec.conceptId === concept.id, "concept alignment");
  assert(spec.aspectRatio === "4:5", "aspect");
  assert(spec.references.some((r) => r.kind === "product"), "product ref");
  assert(spec.references.some((r) => r.kind === "design"), "design ref");
  assert(
    spec.references.find((r) => r.kind === "design")!.label.includes("INSPIRATION"),
    "design labeled inspiration"
  );
  assert(spec.copyHierarchy[0].text === "26G PROTEIN", "copy hierarchy");
  assert(spec.constraints.unsupportedClaims.includes("Build muscle faster"), "claims");
  const v = validateGenerationSpecification(spec, strategy);
  assert(v.ok, `spec valid: ${v.issues.join("; ")}`);

  // user overrides
  const overrideStrat = makeStrategy({
    userOverrides: { headline: "Fuel Your Morning", cta: "Try today" },
    copy: {
      headline: "WRONG",
      supporting: null,
      productLine: null,
      cta: "WRONG CTA",
      badges: [],
    },
  });
  const overrideSpec = buildGenerationSpecification({
    sessionId: "sess_gen",
    brief: makeBrief(),
    strategy: overrideStrat,
    concept: { ...concept, strategyId: overrideStrat.id },
    dna,
    product: contexts.product,
    brand: contexts.brand,
    references: contexts.references,
    variantIndex: 0,
  });
  assert(overrideSpec.renderCopy.headline === "Fuel Your Morning", "override headline");
  assert(overrideSpec.renderCopy.cta === "Try today", "override cta");

  // aspect ratios
  for (const aspect of ["1:1", "4:5", "9:16", "1.91:1"] as const) {
    const s = buildGenerationSpecification({
      sessionId: "sess_gen",
      brief: makeBrief({ aspectRatio: aspect }),
      strategy,
      concept,
      dna,
      product: contexts.product,
      brand: contexts.brand,
      references: contexts.references,
      variantIndex: 0,
    });
    assert(s.aspectRatio === aspect, `aspect ${aspect}`);
    assert(s.intendedPlatform.length > 0, `platform ${aspect}`);
  }

  // malformed — missing headline
  let malformed = false;
  try {
    buildGenerationSpecification({
      sessionId: "sess_gen",
      brief: makeBrief(),
      strategy: makeStrategy({
        copy: {
          headline: "",
          supporting: null,
          productLine: null,
          cta: null,
          badges: [],
        },
        userOverrides: {},
      }),
      concept,
      dna,
      product: contexts.product,
      brand: contexts.brand,
      references: contexts.references,
      variantIndex: 0,
    });
  } catch (e) {
    malformed = e instanceof PosterGenerationError;
  }
  assert(malformed, "empty headline fails");

  // 11–15 provider / prompt
  // Fresh posters compile to a concise art-director brief
  assert(spec.artDirection, "spec carries art direction");
  const prompt = compileNanoBananaPrompt(spec);
  assert(prompt.startsWith("Create a finished, professional advertising poster"), "brief opening");
  assert(prompt.includes('"26G PROTEIN"'), "exact copy in prompt");
  assert(prompt.includes("design reference sets mood and craft only"), "design handling");
  assert(prompt.includes("feature exactly this product as the hero"), "product fidelity");
  assert(prompt.includes("Look and feel — Premium"), "theme in brief");
  assert(prompt.includes("4:5"), "aspect in prompt");
  assert(prompt.includes("Do not state or imply: Build muscle faster"), "forbidden noted");
  assert(!/THEME\(|\| Concept\/DNA|LOCK/.test(prompt), "no blended theme strings or LOCK shouting");
  const words = prompt.split(/\s+/).length;
  assert(words < 600, `brief stays concise (${words} words)`);
  assert(
    (prompt.match(/"Dark Chocolate Protein Oats"/g) || []).length === 1,
    "duplicate copy line rendered once"
  );

  // Copy density + de-duplication: product line repeated as supporting copy and a badge
  // repeating the headline are dropped; the lifestyle concept uses the balanced budget.
  assert(spec.artDirection!.copyDensity === "balanced", "lifestyle → balanced density");
  const roles = spec.copyHierarchy.map((s) => s.role);
  assert(roles[0] === "primary", "headline first");
  assert(!roles.includes("badge"), "badge repeating headline dropped");
  assert(
    roles.filter((r) => r === "secondary" || r === "product_line").length === 1,
    "one secondary-or-product line"
  );
  const texts = spec.copyHierarchy.map((s) => s.text.toLowerCase());
  assert(new Set(texts).size === texts.length, "no duplicate copy slots");

  // Punchline concepts render the headline only (no strategy CTA)
  const punchSpec = buildGenerationSpecification({
    sessionId: "sess_gen",
    brief: makeBrief(),
    strategy,
    concept: { ...concept, territory: "product_hero" },
    dna,
    product: contexts.product,
    brand: contexts.brand,
    references: contexts.references,
    variantIndex: 0,
  });
  // Launch objective: punchline budget keeps only the headline plus the CTA the objective needs
  assert(
    punchSpec.copyHierarchy.map((s) => s.role).join(",") === "primary,cta",
    `punchline launch → headline + CTA (${punchSpec.copyHierarchy.map((s) => s.role).join(",")})`
  );
  const awarenessPunch = buildGenerationSpecification({
    sessionId: "sess_gen",
    brief: makeBrief(),
    strategy: makeStrategy({ objective: "brand_awareness" }),
    concept: { ...concept, territory: "product_hero" },
    dna,
    product: contexts.product,
    brand: contexts.brand,
    references: contexts.references,
    variantIndex: 0,
  });
  assert(
    awarenessPunch.copyHierarchy.length === 1 && awarenessPunch.copyHierarchy[0].role === "primary",
    "punchline awareness → headline only"
  );

  // A user's own CTA survives every budget, exactly as typed
  const ctaOverride = "Order your first box today and save";
  const overrideSpec2 = buildGenerationSpecification({
    sessionId: "sess_gen",
    brief: makeBrief(),
    strategy: makeStrategy({
      userOverrides: { cta: ctaOverride },
    }),
    concept: { ...concept, territory: "product_hero" },
    dna,
    product: contexts.product,
    brand: contexts.brand,
    references: contexts.references,
    variantIndex: 0,
  });
  assert(overrideSpec2.renderCopy.cta === ctaOverride, "user CTA kept exactly");
  assert(
    validateGenerationSpecification(overrideSpec2, makeStrategy({ userOverrides: { cta: ctaOverride } })).ok,
    "user CTA spec validates"
  );

  // Trimming never leaves a dangling word
  assert(
    trimPosterPhrase("Glowing skin in just seven days", 4) === "Glowing skin",
    "trim drops dangling words"
  );

  // Brand Kit: the brand's own system replaces the theme's colour/type guidance
  const kitSpec = buildGenerationSpecification({
    sessionId: "sess_gen",
    brief: makeBrief(),
    strategy,
    concept,
    dna,
    product: contexts.product,
    brand: contexts.brand,
    references: contexts.references,
    variantIndex: 0,
    brandKit: {
      id: "kit_1",
      name: "FuelCo",
      websiteUrl: "https://fuelco.test",
      isDefault: true,
      logo: { url: "https://cdn.fuelco.test/kit-logo.svg" },
      colors: [
        { hex: "#1f3a8a", role: "primary" },
        { hex: "#f59e0b", role: "accent" },
        { hex: "#ffffff", role: "background" },
      ],
      fonts: {
        heading: { family: "Playfair Display", source: "google" },
        body: { family: "Inter", source: "google" },
      },
      guidelines: { mustInclude: ["Logo in the top-left corner"], dos: ["Lots of white space"], donts: ["Gradients"] },
      identity: { ...EMPTY_IDENTITY },
      createdAt: "",
      updatedAt: "",
    },
  });
  const kitPrompt = compileNanoBananaPrompt(kitSpec);
  assert(kitPrompt.includes("Brand style — FuelCo"), "brand style section");
  assert(kitPrompt.includes("#1f3a8a (the main brand colour"), "palette with roles");
  assert(kitPrompt.includes("Set the headline in Playfair Display"), "kit heading font");
  assert(kitPrompt.includes("call to action in Inter"), "kit body font");
  assert(kitPrompt.includes("- Must include: Logo in the top-left corner"), "must-include rule");
  assert(kitPrompt.includes("- Lots of white space"), "do rule");
  assert(/Avoid gradients;/.test(kitPrompt), "don't rule added to avoid list");
  assert(!kitPrompt.includes("Restrained, sophisticated palette"), "theme colour guidance replaced by brand palette");
  assert(!kitPrompt.includes("Elegant hierarchy"), "theme typography replaced by brand fonts");
  assert(
    kitSpec.references.some((r) => r.kind === "logo" && r.url === "https://cdn.fuelco.test/kit-logo.svg"),
    "kit logo attached"
  );

  // Ad formats: the objective decides CTA, badge prominence and format labels
  const specFor = (strategyOverrides: Partial<MarketingStrategy>, briefOverrides: Partial<CreativeBrief> = {}, conceptOverrides: Partial<CreativeConcept> = {}) =>
    buildGenerationSpecification({
      sessionId: "sess_gen",
      brief: makeBrief(briefOverrides),
      strategy: makeStrategy(strategyOverrides),
      concept: { ...concept, ...conceptOverrides },
      dna,
      product: contexts.product,
      brand: contexts.brand,
      references: contexts.references,
      variantIndex: 0,
    });

  const saleSpec = specFor(
    { objective: "limited_time_offer", copy: { headline: "30% off this weekend", productLine: "Vitamin C Serum", cta: "Shop the sale", badges: ["Flat 30% off"] } },
    { visualDirection: "bold" },
    { territory: "product_hero" }
  );
  const salePrompt = compileNanoBananaPrompt(saleSpec);
  assert(saleSpec.artDirection?.adFormat?.kind === "offer", "sale → offer format");
  assert(saleSpec.copyHierarchy.some((s) => s.role === "cta"), "sale keeps its CTA under a punchline budget");
  assert(saleSpec.copyHierarchy.some((s) => s.role === "badge"), "sale keeps its offer badge");
  assert(salePrompt.includes("solid, high-contrast button"), "sale CTA is a button");
  assert(salePrompt.includes("the offer badge — the second focal point"), "offer badge is prominent");
  assert(salePrompt.includes("Make the offer unmissable"), "offer layout rule");
  assert(/Make the Bold direction unmistakable:/.test(salePrompt), "theme cues enforced");
  assert(!salePrompt.includes("small and understated"), "no understated CTA");

  const baSpec = specFor(
    { objective: "product_benefit", copy: { headline: "Frizz to smooth after one use", productLine: "Kesh Hair Oil", cta: null, badges: [] } },
    { userInstruction: "Before and after style ad: frizzy to smooth" }
  );
  const baLabels = baSpec.copyHierarchy.filter((s) => s.role === "label").map((s) => s.text);
  assert(baLabels.join(",") === "Before,After", `before/after labels approved even when the headline says "after" (${baLabels})`);
  assert(compileNanoBananaPrompt(baSpec).includes('"Before": a short format label'), "labels rendered in the brief");

  const proofSpec = specFor(
    { objective: "product_promotion", copy: { headline: "4.8★ from 12,000+ customers", productLine: "Wild Hive Honey", cta: "Taste it", badges: ["Rated 4.8/5 by 12,000+ customers"] } },
    { userInstruction: "Social proof poster using our 4.8 rating" },
    { territory: "product_hero" }
  );
  assert(proofSpec.artDirection?.adFormat?.kind === "social_proof", "rating brief → social proof format");
  assert(compileNanoBananaPrompt(proofSpec).includes("a large rating seal or review card"), "proof badge is the hero");

  // The user's goal decides the ad format, even when the objective/wording suggest otherwise
  const goalSpec = specFor(
    { objective: "product_promotion" },
    { adGoal: "before_after", userInstruction: "Show our oats", transformationHint: "sleepy to energised" }
  );
  assert(goalSpec.artDirection?.adFormat?.kind === "before_after", "explicit goal → before/after format");
  assert(goalSpec.copyHierarchy.some((s) => s.role === "label" && s.text === "Before"), "goal adds Before/After labels");
  const awarenessGoal = specFor({ objective: "limited_time_offer" }, { adGoal: "awareness" });
  assert(awarenessGoal.artDirection?.adFormat?.kind === "awareness", "goal wins over inferred offer");

  // A user-written supporting line renders even under a headline-only budget
  const userLine = specFor(
    { userOverrides: { message: "Ready in 3 minutes" } },
    {},
    { territory: "product_hero" }
  );
  assert(userLine.renderCopy.supporting === "Ready in 3 minutes", "user supporting line kept under punchline budget");

  // Required goal details
  assert(missingGoalDetails("offer", {}).join() === "Offer", "offer needs the offer text");
  assert(missingGoalDetails("offer", { offer: "30% off" }).length === 0, "offer satisfied");
  assert(missingGoalDetails("launch", {}).length === 0, "launch needs nothing extra");

  // Copy edits: saved as exact overrides; empty headline rejected
  const edited = applyCopyEdits(makeStrategy(), { headline: "  New.  Dark oats ", cta: "", supporting: "Ready in 3 minutes" });
  assert(edited.copy.headline === "New. Dark oats" && edited.userOverrides.headline === "New. Dark oats", "headline edit normalised + override");
  assert(edited.copy.cta === null && edited.userOverrides.cta === null, "cleared CTA removes the button");
  assert(edited.userOverrides.message === "Ready in 3 minutes", "supporting edit stored");
  assert(edited.id === makeStrategy().id, "same strategy id keeps concepts valid");
  let emptyRejected = false;
  try {
    applyCopyEdits(makeStrategy(), { headline: "   " });
  } catch (e) {
    emptyRejected = (e as { code?: string }).code === "VALIDATION";
  }
  assert(emptyRejected, "empty headline rejected");
  const editedSpec = buildGenerationSpecification({
    sessionId: "sess_gen",
    brief: makeBrief(),
    strategy: edited,
    concept,
    dna,
    product: contexts.product,
    brand: contexts.brand,
    references: contexts.references,
    variantIndex: 0,
  });
  assert(validateGenerationSpecification(editedSpec, edited).ok, "edited copy spec validates");
  assert(editedSpec.renderCopy.headline === "New. Dark oats", "edited headline rendered exactly");

  // Reference stills reach the brief as context, never as product
  const stillBrief = makeBrief({
    supportingReferences: [{ id: "still_0", role: "supporting_still", image: { url: "https://cdn.example.com/kitchen.jpg" } }],
  });
  const stillCtx = strategistInputFromBrief(stillBrief);
  const stillSpec = buildGenerationSpecification({
    sessionId: "sess_gen",
    brief: stillBrief,
    strategy,
    concept,
    dna,
    product: stillCtx.product,
    brand: stillCtx.brand,
    references: stillCtx.references,
    variantIndex: 0,
  });
  assert(
    stillSpec.references.some((r) => r.kind === "supporting" && r.url === "https://cdn.example.com/kitchen.jpg"),
    "still attached as supporting reference"
  );
  assert(
    !stillSpec.references.some((r) => r.kind === "product" && r.url === "https://cdn.example.com/kitchen.jpg"),
    "still never attached as product"
  );
  assert(compileNanoBananaPrompt(stillSpec).includes("it is not the product"), "brief explains the context photo");

  // Specs saved before artDirection existed still compile with the legacy prompt
  const legacyPrompt = compileNanoBananaPrompt({ ...spec, artDirection: null });
  assert(legacyPrompt.includes("=== ROLE ==="), "legacy fallback for old specs");

  // Concise per-image notes on fresh briefs
  const freshReq = buildImageGenerationRequest({ specification: spec, userId: "user_1" });
  const productRef = freshReq.referenceImages.find((r) => r.kind === "product");
  assert(
    productRef?.instruction === "Product photo: the real product to feature exactly as shown.",
    "concise product reference note"
  );

  // Output size + image type detection
  assert(getPosterImageSize() === "2K", "posters default to 2K");
  assert(
    detectImageMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])) === "image/jpeg",
    "JPEG detected"
  );
  assert(
    detectImageMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47])) === "image/png",
    "PNG detected"
  );

  const iterSpec = {
    ...spec,
    iterationId: "iter_test",
    parentGenerationId: "gen_parent",
    scene: {
      ...spec.scene,
      outputRequirements: [
        "PRIMARY EDIT TASK: Make the product larger",
        "CONTROLLED ITERATION (LOCAL) User request: Make the product larger Preserve locked layers.",
        ...(spec.scene.outputRequirements || []),
      ],
      productTreatment: `${spec.scene.productTreatment} ITERATION: Make the product visibly larger`,
    },
  };
  const iterPrompt = compileNanoBananaPrompt(iterSpec, { forIteration: true });
  assert(iterPrompt.includes("CONTROLLED EDIT"), "iteration edit mode");
  assert(iterPrompt.includes("Make the product larger"), "edit request in prompt");
  assert(!iterPrompt.includes("FINAL THEME LOCK"), "no fresh theme lock on edit");

  const iterReq = buildImageGenerationRequest({
    specification: iterSpec,
    userId: "user_1",
    baseImageUrl: "https://cdn.example.com/base.png",
  });
  assert(
    iterReq.referenceImages[0]?.label?.includes("BASE POSTER"),
    "base poster first on iteration"
  );
  assert(iterReq.prompt.includes("CONTROLLED EDIT"), "iter request prompt");

  const req = buildImageGenerationRequest({
    specification: spec,
    userId: "user_1",
  });
  assert(req.prompt === prompt || req.prompt.includes("26G PROTEIN"), "request prompt");
  assert(req.referenceImages.some((r) => r.kind === "product"), "labeled product refs");
  assert(
    req.referenceImages[0]?.kind === "product",
    "product reference must be first"
  );
  assert(
    /real product to feature exactly as shown/i.test(
      req.referenceImages[0]?.instruction || ""
    ),
    "product instruction"
  );
  assert(req.metadata.generationId === spec.generationId, "generation id in meta");

  // 16 one-variant generation
  const creditState = { balance: 5, deducted: 0 };
  const { service } = await seedSession({ concepts: 1 });
  const provider = new MockProvider([{ ok: true }]);
  const one = await generatePostersForSession({
    sessionId: "sess_gen",
    userId: "user_1",
    variantCount: 1,
    sessionService: service,
    provider,
    skipStorage: true,
    credits: {
      getBalance: async () => creditState.balance - creditState.deducted,
      deduct: async (_u, n) => {
        creditState.deducted += n;
        return true;
      },
    },
  });
  assert(one.successfulVariants === 1, "one success");
  assert(one.creditsCharged === 1, "1 credit");
  assert(one.session.status === "qc", "awaiting qc status");
  assert(one.outcomes[0].asset.status === "generated", "asset generated");
  assert(one.outcomes[0].generationId.startsWith("gen_"), "generation id");
  assert(one.outcomes[0].variantId.length > 0, "variant id");
  assert(one.session.specifications.length >= 1, "spec persisted");
  assert(provider.calls[0].prompt.includes("26G PROTEIN"), "provider got copy");

  // 17 multi-variant
  creditState.deducted = 0;
  creditState.balance = 10;
  const multiSeed = await seedSession({ concepts: 3 });
  // recreate session id conflict — use new id
  const repo2 = new MemoryRepo();
  const service2 = new PosterGenerationSessionService(repo2);
  await service2.createSession({ userId: "user_1", id: "sess_multi" });
  await service2.updateBrief("sess_multi", "user_1", makeBrief({ variantCount: 3 }));
  await service2.updateStrategy("sess_multi", "user_1", makeStrategy());
  const c1 = makeConcept("concept_1");
  const c2 = {
    ...makeConcept("concept_2"),
    name: "Hero",
    territory: "product_hero" as const,
    humanPresence: "none",
    productTreatment: "hero",
  };
  const c3 = {
    ...makeConcept("concept_3"),
    name: "Edit",
    territory: "editorial" as const,
  };
  await service2.setConcepts(
    "sess_multi",
    "user_1",
    [c1, c2, c3],
    {
      concept_1: makeDna("concept_1"),
      concept_2: { ...makeDna("concept_2"), visualTerritory: "product_hero" },
      concept_3: { ...makeDna("concept_3"), visualTerritory: "editorial" },
    }
  );
  await service2.selectConcept("sess_multi", "user_1", [
    "concept_1",
    "concept_2",
    "concept_3",
  ]);
  const multiProvider = new MockProvider([{ ok: true }, { ok: true }, { ok: true }]);
  const multi = await generatePostersForSession({
    sessionId: "sess_multi",
    userId: "user_1",
    variantCount: 3,
    sessionService: service2,
    provider: multiProvider,
    skipStorage: true,
    credits: {
      getBalance: async () => creditState.balance - creditState.deducted,
      deduct: async (_u, n) => {
        creditState.deducted += n;
        return true;
      },
    },
  });
  assert(multi.successfulVariants === 3, "3 success");
  assert(multi.creditsCharged === 3, "3 credits");
  assert(multi.session.assets.filter((a) => a.status === "generated").length === 3, "3 assets");

  // 17b three variants of a chosen direction = that concept first, then the other concepts
  const picked = await generatePostersForSession({
    sessionId: "sess_multi",
    userId: "user_1",
    conceptId: "concept_2",
    variantCount: 3,
    forceRegenerate: true,
    sessionService: service2,
    provider: new MockProvider([{ ok: true }, { ok: true }, { ok: true }]),
    skipStorage: true,
    credits: { getBalance: async () => 10, deduct: async () => true },
  });
  assert(
    picked.outcomes.map((o) => o.conceptId).join(",") === "concept_2,concept_1,concept_3",
    `chosen concept first, then siblings (${picked.outcomes.map((o) => o.conceptId).join(",")})`
  );

  // 17c same copy → posters reused; edited headline → regenerated, never stale
  const sameCopy = await generatePostersForSession({
    sessionId: "sess_multi",
    userId: "user_1",
    conceptId: "concept_2",
    variantCount: 1,
    sessionService: service2,
    provider: new MockProvider([{ ok: true }]),
    skipStorage: true,
    credits: { getBalance: async () => 10, deduct: async () => true },
  });
  assert(sameCopy.reused === true && sameCopy.creditsCharged === 0, "unchanged copy reuses posters");
  const sessNow = await service2.getSession("sess_multi", "user_1");
  await service2.updateStrategy(
    "sess_multi",
    "user_1",
    applyCopyEdits(sessNow.strategy!, { headline: "Breakfast, upgraded" })
  );
  const afterEdit = await generatePostersForSession({
    sessionId: "sess_multi",
    userId: "user_1",
    conceptId: "concept_2",
    variantCount: 1,
    sessionService: service2,
    provider: new MockProvider([{ ok: true }]),
    skipStorage: true,
    credits: { getBalance: async () => 10, deduct: async () => true },
  });
  assert(afterEdit.reused === false && afterEdit.creditsCharged === 1, "edited headline regenerates instead of reusing stale posters");
  assert(
    afterEdit.outcomes[0].specification.renderCopy.headline === "Breakfast, upgraded",
    "new poster uses the edited headline"
  );
  assert((await service2.getSession("sess_multi", "user_1")).concepts.length === 3, "copy edit kept the concepts");

  // 18 insufficient credits
  let insuf = false;
  try {
    await generatePostersForSession({
      sessionId: "sess_multi",
      userId: "user_1",
      forceRegenerate: true,
      variantCount: 3,
      sessionService: service2,
      provider: new MockProvider([{ ok: true }]),
      skipStorage: true,
      credits: {
        getBalance: async () => 2,
        deduct: async () => true,
      },
    });
  } catch (e) {
    insuf =
      e instanceof PosterGenerationError && e.code === "INSUFFICIENT_CREDITS";
  }
  assert(insuf, "insufficient credits");

  // 19–20 provider failure + bounded retry
  const repo3 = new MemoryRepo();
  const service3 = new PosterGenerationSessionService(repo3);
  await service3.createSession({ userId: "user_1", id: "sess_fail" });
  await service3.updateBrief("sess_fail", "user_1", makeBrief());
  await service3.updateStrategy("sess_fail", "user_1", makeStrategy());
  await service3.setConcepts(
    "sess_fail",
    "user_1",
    [makeConcept()],
    { concept_1: makeDna() }
  );
  await service3.selectConcept("sess_fail", "user_1", "concept_1");
  const failProvider = new MockProvider([
    { ok: false, errorMessage: "boom" },
    { ok: false, errorMessage: "boom2" },
  ]);
  const failed = await generatePostersForSession({
    sessionId: "sess_fail",
    userId: "user_1",
    variantCount: 1,
    sessionService: service3,
    provider: failProvider,
    skipStorage: true,
    maxProviderRetries: 1,
    credits: {
      getBalance: async () => 5,
      deduct: async () => true,
    },
  });
  assert(failed.successfulVariants === 0, "all failed");
  assert(failed.creditsCharged === 0, "no credits on failure");
  assert(failed.session.status === "failed", "session failed");
  assert(failed.actualAttempts === 2, "bounded retry attempts");
  assert(failed.outcomes[0].asset.status === "failed", "failed asset record");

  // 21 partial generation
  const repo4 = new MemoryRepo();
  const service4 = new PosterGenerationSessionService(repo4);
  await service4.createSession({ userId: "user_1", id: "sess_partial" });
  await service4.updateBrief(
    "sess_partial",
    "user_1",
    makeBrief({ variantCount: 2 })
  );
  await service4.updateStrategy("sess_partial", "user_1", makeStrategy());
  await service4.setConcepts(
    "sess_partial",
    "user_1",
    [
      makeConcept("concept_1"),
      {
        ...makeConcept("concept_2"),
        name: "Hero",
        territory: "product_hero",
      },
    ],
    {
      concept_1: makeDna("concept_1"),
      concept_2: { ...makeDna("concept_2"), visualTerritory: "product_hero" },
    }
  );
  await service4.selectConcept("sess_partial", "user_1", [
    "concept_1",
    "concept_2",
  ]);
  let deductedPartial = 0;
  const partial = await generatePostersForSession({
    sessionId: "sess_partial",
    userId: "user_1",
    variantCount: 2,
    sessionService: service4,
    provider: new MockProvider([
      { ok: true },
      { ok: false, errorMessage: "fail2" },
      { ok: false, errorMessage: "fail2b" },
    ]),
    skipStorage: true,
    maxProviderRetries: 1,
    credits: {
      getBalance: async () => 5,
      deduct: async () => {
        deductedPartial += 1;
        return true;
      },
    },
  });
  assert(partial.partial === true, "partial flag");
  assert(partial.successfulVariants === 1, "1 success kept");
  assert(partial.failedVariants === 1, "1 fail recorded");
  assert(partial.creditsCharged === 1, "only success charged");
  assert(partial.session.status === "qc", "partial awaiting qc");
  assert(
    partial.session.assets.some((a) => a.status === "generated") &&
      partial.session.assets.some((a) => a.status === "failed"),
    "both asset statuses"
  );

  // 25–27 idempotency
  const again = await generatePostersForSession({
    sessionId: "sess_partial",
    userId: "user_1",
    variantCount: 1,
    sessionService: service4,
    provider: new MockProvider([{ ok: true }]),
    skipStorage: true,
    credits: {
      getBalance: async () => 5,
      deduct: async () => true,
    },
  });
  assert(again.reused === true, "idempotent reuse");
  assert(again.creditsCharged === 0, "no credit on reuse");

  const forced = await generatePostersForSession({
    sessionId: "sess_partial",
    userId: "user_1",
    conceptId: "concept_1",
    variantCount: 1,
    forceRegenerate: true,
    sessionService: service4,
    provider: new MockProvider([{ ok: true }]),
    skipStorage: true,
    credits: {
      getBalance: async () => 5,
      deduct: async () => true,
    },
  });
  assert(forced.reused === false, "force regenerate");
  assert(forced.creditsCharged === 1, "charged on force");

  // strategy rewrite detection
  const badAlign = validateGenerationSpecification(
    { ...spec, strategyAlignment: { ...spec.strategyAlignment, primaryMessage: "Nope" } },
    strategy
  );
  assert(!badAlign.ok, "strategy rewrite fails validation");

  // ── Template path (POSTER_TEMPLATES) ─────────────────────────
  {
    const sharpLib = (await import("sharp")).default;
    const { loadFont } = await import("@/lib/creative-studio/poster-templates/fonts");
    const { buildPalette } = await import("@/lib/creative-studio/poster-templates/palette");
    const offline = async () => ({ ok: false, text: async () => "", arrayBuffer: async () => new ArrayBuffer(0) });
    const font = await loadFont("Test Font", 700, offline);
    const cutoutPng = await sharpLib({ create: { width: 300, height: 500, channels: 4, background: { r: 30, g: 60, b: 160, alpha: 1 } } }).png().toBuffer();
    const scenePng = await sharpLib({ create: { width: 800, height: 1000, channels: 3, background: "#e9dcc8" } }).jpeg().toBuffer();
    const productOnly: Partial<CreativeConcept> = {
      territory: "product_hero",
      humanPresence: "none",
      productTreatment: "hero packshot on a stone plinth",
      visualStory: "The pack stands alone, catching morning light",
    };
    const templateDeps = {
      templates: true,
      getCutout: async () => ({ ok: true, png: cutoutPng, url: "https://cdn.example.com/cut.png", provider: "mock", quality: null, cached: false }),
      loadBrandAssets: async () => ({ palette: buildPalette(null), fonts: { heading: font, body: font }, logo: null }),
      skipStorage: true,
      credits: { getBalance: async () => 10, deduct: async () => true },
    };

    // Launch → product hero scene: one text-free scene call, product + copy composited in code
    const { service: launchSvc } = await seedSession({ brief: { adGoal: "launch" }, concept: productOnly });
    const sceneProvider = new MockProvider([{ ok: true, imageBuffer: scenePng }]);
    const launch = await generatePostersForSession({ sessionId: "sess_gen", userId: "user_1", variantCount: 1, sessionService: launchSvc, provider: sceneProvider, ...templateDeps });
    const launchAsset = launch.outcomes[0].asset;
    assert(launch.successfulVariants === 1 && launch.creditsCharged === 1, "template poster costs 1 credit");
    assert(launchAsset.template?.id === "split-panel", `product-hero concept → split panel (${launchAsset.template?.id})`);
    assert(launchAsset.template?.manifest.copy.headline === "26G PROTEIN", "template renders the approved headline");
    assert(launchAsset.template?.cutoutUrl === "https://cdn.example.com/cut.png", "cut-out recorded on the asset");
    // Scene call, then the harmonize pass (its mock answer is unusable, so the plain composite is kept)
    assert(sceneProvider.calls.length === 2, `scene + harmonize calls (${sceneProvider.calls.length})`);
    assert(sceneProvider.calls[1].referenceImages[0].label.startsWith("BASE POSTER"), "harmonize edits the composite");
    assert(launchAsset.template?.manifest.harmonized === false, "unusable harmonize result is discarded");
    const sceneCall = sceneProvider.calls[0];
    assert(sceneCall.prompt.includes("NO text") && !sceneCall.prompt.includes("26G PROTEIN"), "scene prompt is text-free");
    assert(!sceneCall.referenceImages.some((r) => r.kind === "product" || r.kind === "logo"), "no product/logo refs for the scene");
    assert(launchAsset.imageUrl.startsWith("data:image/png"), "composited PNG");

    // Offer → offer hero on the brand colour: no image-model call at all
    const { service: offerSvc } = await seedSession({ brief: { adGoal: "offer" }, concept: productOnly });
    const unusedProvider = new MockProvider([]);
    const offer = await generatePostersForSession({ sessionId: "sess_gen", userId: "user_1", variantCount: 1, sessionService: offerSvc, provider: unusedProvider, ...templateDeps });
    assert(offer.outcomes[0].asset.template?.id === "offer-hero", "offer uses the offer hero");
    assert(unusedProvider.calls.length === 0, "brand-fill template needs no AI call");

    // A concept with people in it can't be a template → full-AI path for that variant
    const { service: handsSvc } = await seedSession({ brief: { adGoal: "launch" } });
    const handsProvider = new MockProvider([{ ok: true }]);
    const hands = await generatePostersForSession({ sessionId: "sess_gen", userId: "user_1", variantCount: 1, sessionService: handsSvc, provider: handsProvider, ...templateDeps });
    assert(!hands.outcomes[0].asset.template, "people-led concept uses the full-AI path");
    assert(handsProvider.calls[0].prompt.startsWith("Create a finished"), "full poster prompt for people-led concept");

    // No clean cut-out → the current full-AI path, unchanged
    const { service: fallbackSvc } = await seedSession({ brief: { adGoal: "launch" }, concept: productOnly });
    const fullProvider = new MockProvider([{ ok: true }]);
    const fallback = await generatePostersForSession({
      sessionId: "sess_gen", userId: "user_1", variantCount: 1, sessionService: fallbackSvc, provider: fullProvider, ...templateDeps,
      getCutout: async () => ({ ok: false, png: null, url: null, provider: "none", quality: null, cached: false, error: "off" }),
    });
    assert(fallback.successfulVariants === 1 && !fallback.outcomes[0].asset.template, "falls back without a cut-out");
    assert(fullProvider.calls[0].prompt.startsWith("Create a finished, professional advertising poster"), "fallback uses the poster prompt");

    // Flag off → template code never runs
    const { service: offSvc } = await seedSession({ brief: { adGoal: "launch" }, concept: productOnly });
    let cutoutAsked = false;
    await generatePostersForSession({
      sessionId: "sess_gen", userId: "user_1", variantCount: 1, sessionService: offSvc, provider: new MockProvider([{ ok: true }]), ...templateDeps,
      templates: false,
      getCutout: async () => { cutoutAsked = true; throw new Error("should not run"); },
    });
    assert(!cutoutAsked, "flag off skips cut-outs");
  }

  console.log("poster-generation generation.test.ts: PASS");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
