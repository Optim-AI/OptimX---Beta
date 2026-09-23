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
  const prompt = compileNanoBananaPrompt(spec);
  assert(prompt.includes("GenerationSpecification"), "role section");
  assert(prompt.includes("26G PROTEIN"), "exact copy in prompt");
  assert(prompt.includes("INSPIRATION ONLY"), "design handling");
  assert(prompt.includes("HARD PRODUCT LOCK"), "product hard lock");
  assert(prompt.includes("THEME LOCK"), "theme lock section");
  assert(
    /THEME\(Premium\)|Premium:|premium/i.test(prompt),
    "theme recipe blended into prompt"
  );
  assert(prompt.includes("4:5"), "aspect in prompt");
  assert(!prompt.includes("Build muscle faster") || prompt.includes("Forbidden"), "forbidden noted");

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
    /exact user-uploaded product|USER-UPLOADED PRODUCT/i.test(
      req.referenceImages[0]?.instruction || ""
    ),
    "strong product instruction"
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

  console.log("poster-generation generation.test.ts: PASS");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
