/**
 * Phase 8 iteration tests — classifier, locks, preservation, execute (mocked).
 * Run: node --import tsx lib/creative-studio/poster-generation/iteration/iteration.test.ts
 */

import type {
  CreativeBrief,
  CreativeConcept,
  CreativeDNA,
  GenerationSpecification,
  ImageGenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
  MarketingStrategy,
  PosterGeneratedAsset,
  PosterGenerationSession,
} from "../types";
import {
  PosterGenerationSessionService,
  type PosterGenerationSessionRepository,
} from "../session";
import { classifyIterationRequest } from "./classifier";
import { buildIterationPlan, locksForMode } from "./iteration-planner";
import {
  applyIterationToSpecification,
  assertPreservationInvariants,
} from "./specification-patcher";
import {
  executePosterIterationForSession,
  planPosterIterationForSession,
} from "./run-for-session";

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
  readonly id = "mock";
  calls: ImageGenerationRequest[] = [];
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
  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    this.calls.push(req);
    return {
      ok: true,
      imageDataUrl: "data:image/png;base64,aaa",
      imageBuffer: Buffer.from("fake"),
      mimeType: "image/png",
      provider: this.id,
      model: "mock",
      estimatedCostCredits: 1,
      durationMs: 5,
    };
  }
  async edit(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    return this.generate(req);
  }
}

function sampleStrategy(): MarketingStrategy {
  return {
    id: "strat_1",
    briefId: "brief_1",
    createdAt: new Date().toISOString(),
    objective: "Drive awareness",
    audience: "Busy professionals",
    primaryMessage: "26g High Protein",
    communicationAngle: "Morning fuel",
    valueProposition: "Protein that fits your morning",
    emotionalDirection: "Confident",
    rationale: "Lead with protein differentiator",
    supportingMessages: ["Fuel your day"],
    copy: {
      headline: "Start Strong",
      supporting: "Fuel your day",
      productLine: "26g High Protein",
      cta: "Shop Now",
      badges: [],
    },
    informationHierarchy: ["headline", "product", "cta"],
    allowedClaims: ["26g protein"],
    forbiddenClaims: [],
    restrictedClaims: [],
    requiredDisclaimers: [],
    userOverrides: {},
  };
}

function sampleConcept(): CreativeConcept {
  return {
    id: "concept_1",
    briefId: "brief_1",
    strategyId: "strat_1",
    createdAt: new Date().toISOString(),
    name: "Morning Energy",
    description: "Breakfast with product",
    territory: "lifestyle",
    visualStory: "Product on a sunny breakfast table",
    composition: "Centered product hero",
    subjectTreatment: "Product-led",
    productTreatment: "Hero packshot ~0.65 scale",
    humanPresence: "none",
    environment: "Kitchen table",
    emotionalExpression: "Warm",
    rationale: "Fits morning routine",
    differentiation: "Warm vs clinical",
    cameraDirection: "Eye level",
    typographyTreatment: "Clean sans",
    colorTreatment: "Warm neutrals",
    graphicLanguage: "Minimal",
    supportingElements: "none",
    copyHierarchy: "Headline then CTA",
    ctaTreatment: "Lower CTA",
    visualDirectionExpression: "commercial",
  };
}

function sampleDna(): CreativeDNA {
  return {
    id: "dna_1",
    conceptId: "concept_1",
    visualTerritory: "lifestyle",
    composition: "Centered product hero",
    subjectTreatment: "Product-led",
    productTreatment: "Hero packshot",
    photographyStyle: "Lifestyle commercial",
    lighting: "Soft morning light",
    colorStrategy: "Warm neutrals",
    typographyStrategy: "Clean sans",
    graphicLanguage: "Minimal",
    humanPresence: "none",
    environment: "Kitchen table",
    mood: "Optimistic",
    hierarchy: "Headline > product > CTA",
    visualRhythm: "Calm",
    aspectAwareNotes: "4:5 feed",
  };
}

function sampleSpec(): GenerationSpecification {
  return {
    id: "spec_1",
    sessionId: "sess_1",
    briefId: "brief_1",
    strategyId: "strat_1",
    conceptId: "concept_1",
    dnaId: "dna_1",
    createdAt: new Date().toISOString(),
    generationId: "gen_001",
    variantId: "var_1",
    variantIndex: 0,
    aspectRatio: "4:5",
    intendedPlatform: "instagram_feed",
    renderCopy: {
      headline: "Start Strong",
      supporting: "Fuel your day",
      productLine: "26g High Protein",
      cta: "Shop Now",
      badges: [],
    },
    copyHierarchy: [
      { role: "primary", text: "Start Strong", importance: "required" },
      { role: "cta", text: "Shop Now", importance: "required" },
    ],
    strategyAlignment: {
      objective: "Drive awareness",
      primaryMessage: "26g High Protein",
      audience: "Busy professionals",
      communicationAngle: "Morning fuel",
      allowedClaims: ["26g protein"],
      forbiddenClaims: [],
      restrictedClaims: [],
    },
    scene: {
      visualTerritory: "lifestyle",
      visualStory: "Product on a sunny breakfast table",
      composition: "Centered product hero",
      subjectTreatment: "Product-led",
      productRole: "hero",
      productTreatment: "Hero packshot ~0.65 scale",
      environment: "Kitchen table",
      humanPresence: "none",
      lighting: "Soft morning light",
      photographyStyle: "Lifestyle commercial",
      colorStrategy: "Warm neutrals",
      typography: "Clean sans",
      graphicLanguage: "Minimal",
      visualRhythm: "Calm",
      mood: "Optimistic",
      hierarchy: "Headline > product > CTA",
      productFidelityRules: "Exact packaging from product reference",
      brandIntegration: "Brand colors and logo preserved",
      designReferenceInfluence: "none",
      visualDirectionExpression: "commercial",
      outputRequirements: ["Finished poster"],
    },
    references: [],
    attachedAssetIds: [],
    constraints: {
      productFidelity: "Exact product",
      logoFidelity: "Exact logo",
      copyFidelity: "Exact approved copy",
      unsupportedClaims: [],
      referenceHandling: "product required",
      brandRequirements: [],
    },
    userOverrides: {},
    compiledPrompt: null,
  };
}

function sampleAsset(): PosterGeneratedAsset {
  return {
    id: "gen_001",
    sessionId: "sess_1",
    generationId: "gen_001",
    variantId: "var_1",
    variantIndex: 0,
    conceptId: "concept_1",
    dnaId: "dna_1",
    specificationId: "spec_1",
    imageUrl: "https://cdn.example/poster-v1.png",
    provider: "mock",
    model: "mock",
    creditsConsumed: 1,
    status: "generated",
    createdAt: new Date().toISOString(),
    versionNumber: 1,
    isActive: true,
  };
}

function sampleBrief(): CreativeBrief {
  return {
    id: "brief_1",
    createdAt: new Date().toISOString(),
    brand: {
      snapshot: null,
      primaryColors: [],
      aestheticTags: [],
      values: [],
      guidelinesApplied: true,
    },
    product: {
      source: "upload",
      name: "Protein Bar",
      description: null,
      shortBenefit: null,
      category: null,
      benefits: [],
      factualClaims: [],
      features: [],
      emotionalAngles: [],
      useCases: [],
      images: [{ url: "https://cdn.example/product.png" }],
      brandName: "Acme",
      price: null,
      targetAudience: null,
      catalogProduct: null,
    },
    userInstruction: "Morning energy poster",
    visualDirection: "commercial",
    aspectRatio: "4:5",
    variantCount: 1,
    constraints: [],
    productReferences: [],
    designReferences: [],
    supportingReferences: [],
  } as CreativeBrief;
}

async function seedSession(repo: MemoryRepo) {
  const service = new PosterGenerationSessionService(repo);
  const session = await service.createSession({
    userId: "user_1",
    studioSessionId: "studio_1",
  });
  let s = await service.updateBrief(session.id, "user_1", sampleBrief());
  s = await service.updateStrategy(session.id, "user_1", sampleStrategy());
  s = await service.setConcepts(session.id, "user_1", [sampleConcept()], {
    concept_1: sampleDna(),
  });
  s = await service.selectConcept(session.id, "user_1", ["concept_1"]);
  s = await service.addGenerationSpecification(
    session.id,
    "user_1",
    sampleSpec()
  );
  s = await service.addGeneratedAsset(session.id, "user_1", sampleAsset());
  return { service, session: s };
}

function classifierInput(request: string) {
  return {
    userRequest: request,
    specification: sampleSpec(),
    concept: sampleConcept(),
    dna: sampleDna(),
    strategy: sampleStrategy(),
    parentAsset: sampleAsset(),
  };
}

function testClassifier() {
  const cases: Array<[string, string]> = [
    ["Make the product bigger", "LOCAL"],
    ["Move the CTA lower", "LOCAL"],
    ["Make this more premium", "DESIGN"],
    ["Show a person using the product instead", "CREATIVE"],
    ["Give me a completely different ad", "FULL"],
    ['Change the headline to "Protein That Fits Your Morning."', "LOCAL"],
    ["Make it premium and show someone drinking it", "CREATIVE"],
  ];

  for (const [req, expected] of cases) {
    const result = classifyIterationRequest(classifierInput(req));
    assert(result.mode === expected, `${req} → expected ${expected}, got ${result.mode}`);
  }

  const copy = classifyIterationRequest(
    classifierInput('Change the headline to "Protein That Fits Your Morning."')
  );
  assert(copy.signals.wantsCopyChange, "copy signal");
  assert(
    copy.signals.copyHeadline?.includes("Protein That Fits"),
    "extract headline"
  );

  console.log("✓ classifier modes");
}

function testLocks() {
  const local = locksForMode("LOCAL");
  assert(local.strategy === "LOCKED", "local strategy");
  assert(local.concept === "LOCKED", "local concept");
  assert(local.copy === "LOCKED", "local copy");
  assert(local.composition === "MODIFY", "local composition");

  const design = locksForMode("DESIGN");
  assert(design.visualTreatment === "MODIFY", "design visual");
  assert(design.concept === "LOCKED", "design concept");

  const creative = locksForMode("CREATIVE");
  assert(creative.strategy === "LOCKED", "creative strategy");
  assert(creative.concept === "MODIFY", "creative concept");

  const full = locksForMode("FULL");
  assert(full.product === "LOCKED", "full product still locked");
  assert(full.concept === "MODIFY", "full concept");

  console.log("✓ locks");
}

function testPreservationLocal() {
  const input = classifierInput("Make the product larger");
  const classification = classifyIterationRequest(input);
  assert(classification.mode === "LOCAL", "local mode");
  const plan = buildIterationPlan({
    iterationId: "iter_test",
    input,
    classification,
  });
  const updated = applyIterationToSpecification({
    source: input.specification,
    plan,
  });
  assertPreservationInvariants({
    source: input.specification,
    updated,
    plan,
  });

  assert(
    updated.strategyAlignment.primaryMessage ===
      input.specification.strategyAlignment.primaryMessage,
    "strategy message preserved"
  );
  assert(
    updated.renderCopy.headline === input.specification.renderCopy.headline,
    "copy preserved"
  );
  assert(
    updated.renderCopy.cta === input.specification.renderCopy.cta,
    "cta preserved"
  );
  assert(updated.id !== input.specification.id, "new spec id");
  assert(
    updated.generationId !== input.specification.generationId,
    "new generation id"
  );
  assert(
    /larger|bigger|scale/i.test(updated.scene.productTreatment),
    "product treatment updated"
  );
  assert(
    updated.scene.visualStory === input.specification.scene.visualStory ||
      updated.scene.visualStory.includes(input.specification.scene.visualStory),
    "visual story not rewritten for LOCAL"
  );

  console.log("✓ LOCAL preservation");
}

function testPreservationDesign() {
  const input = classifierInput("Make it more premium");
  const classification = classifyIterationRequest(input);
  assert(classification.mode === "DESIGN", "design mode");
  const plan = buildIterationPlan({
    iterationId: "iter_design",
    input,
    classification,
  });
  const updated = applyIterationToSpecification({
    source: input.specification,
    plan,
  });
  assertPreservationInvariants({
    source: input.specification,
    updated,
    plan,
  });
  assert(
    updated.renderCopy.headline === "Start Strong",
    "copy locked on design"
  );
  assert(
    updated.strategyAlignment.objective === "Drive awareness",
    "strategy locked"
  );
  assert(
    updated.scene.mood !== input.specification.scene.mood ||
      /premium|ITERATION/i.test(updated.scene.mood),
    "visual mood updated"
  );
  console.log("✓ DESIGN preservation");
}

function testPreservationCreative() {
  const input = classifierInput(
    "Instead of a product hero, show someone drinking it after a workout"
  );
  const classification = classifyIterationRequest(input);
  assert(classification.mode === "CREATIVE", "creative mode");
  const plan = buildIterationPlan({
    iterationId: "iter_creative",
    input,
    classification,
  });
  const updated = applyIterationToSpecification({
    source: input.specification,
    plan,
  });
  assert(
    updated.strategyAlignment.primaryMessage === "26g High Protein",
    "strategy message"
  );
  assert(updated.renderCopy.headline === "Start Strong", "copy locked");
  assert(/ITERATION|workout|human/i.test(updated.scene.visualStory), "story changed");
  assert(plan.locks.concept === "MODIFY", "concept modify");
  console.log("✓ CREATIVE preservation");
}

function testCopyLocal() {
  const input = classifierInput(
    'Change the headline to "Protein That Fits Your Morning."'
  );
  const classification = classifyIterationRequest(input);
  const plan = buildIterationPlan({
    iterationId: "iter_copy",
    input,
    classification,
  });
  assert(plan.locks.copy === "MODIFY", "copy modify");
  const updated = applyIterationToSpecification({
    source: input.specification,
    plan,
  });
  assert(
    updated.renderCopy.headline === "Protein That Fits Your Morning.",
    "headline changed"
  );
  assert(updated.renderCopy.cta === "Shop Now", "cta unchanged");
  console.log("✓ copy LOCAL");
}

async function testPlanAndExecute() {
  const repo = new MemoryRepo();
  const { service, session } = await seedSession(repo);
  const provider = new MockProvider();
  let credits = 5;
  let deducted = 0;

  const planned = await planPosterIterationForSession({
    sessionId: session.id,
    userId: "user_1",
    generationId: "gen_001",
    request: "Make the product bigger",
    sessionService: service,
  });
  assert(planned.creditsCharged === 0, "plan is free");
  assert(planned.plan.mode === "LOCAL", "planned LOCAL");
  assert(planned.iteration.status === "planned", "status planned");

  const executed = await executePosterIterationForSession({
    sessionId: session.id,
    userId: "user_1",
    iterationId: planned.plan.iterationId,
    sessionService: service,
    provider,
    skipStorage: true,
    skipQc: true,
    credits: {
      getBalance: async () => credits,
      deduct: async (_u, n) => {
        credits -= n;
        deducted += n;
        return true;
      },
    },
  });

  assert(executed.creditsCharged === 1, "1 credit on success");
  assert(deducted === 1, "deducted once");
  assert(executed.asset.parentGenerationId === "gen_001", "parent link");
  assert(executed.asset.versionNumber === 2, "version 2");
  assert(executed.generationId !== "gen_001", "new generation");
  assert(
    executed.session.assets.some((a) => a.generationId === "gen_001"),
    "parent preserved"
  );
  assert(
    executed.session.assets.some((a) => a.generationId === executed.generationId),
    "child stored"
  );
  assert(provider.calls.length === 1, "one provider call");
  assert(
    provider.calls[0].referenceImages.some((r) =>
      r.label.includes("BASE POSTER")
    ),
    "base poster reference attached"
  );
  assert(executed.providerPath === "controlled_regeneration", "path");

  // Security: plan must not accept phantom browser strategy — already enforced in API;
  // here ensure execute reloads session artifacts
  assert(
    executed.session.specifications.length >= 2,
    "original + updated specs"
  );

  console.log("✓ plan + execute + credits + versioning");
}

async function testFailedGenerationNoCredit() {
  const repo = new MemoryRepo();
  const { service, session } = await seedSession(repo);
  let deducted = 0;
  const failProvider: ImageGenerationProvider = {
    id: "fail",
    getCapabilities: () => ({
      supportsGenerate: true,
      supportsEdit: false,
      supportedAspectRatios: ["4:5"] as any,
      maxReferenceImages: 4,
      supportsReferenceImages: true,
      supportsInpainting: false,
    }),
    checkAvailability: async () => ({ available: true }),
    estimateCost: () => 1,
    generate: async () => ({
      ok: false,
      provider: "fail",
      model: "fail",
      estimatedCostCredits: 0,
      errorCode: "PROVIDER_FAILED",
      errorMessage: "boom",
    }),
    edit: async () => ({
      ok: false,
      provider: "fail",
      model: "fail",
      estimatedCostCredits: 0,
      errorCode: "UNSUPPORTED",
      errorMessage: "no",
    }),
  };

  let threw = false;
  try {
    await executePosterIterationForSession({
      sessionId: session.id,
      userId: "user_1",
      generationId: "gen_001",
      request: "Make the product bigger",
      sessionService: service,
      provider: failProvider,
      skipStorage: true,
      skipQc: true,
      credits: {
        getBalance: async () => 10,
        deduct: async () => {
          deducted += 1;
          return true;
        },
      },
    });
  } catch {
    threw = true;
  }
  assert(threw, "should throw on provider fail");
  assert(deducted === 0, "no credits on failure");
  console.log("✓ failed generation charges 0");
}

async function run() {
  testClassifier();
  testLocks();
  testPreservationLocal();
  testPreservationDesign();
  testPreservationCreative();
  testCopyLocal();
  await testPlanAndExecute();
  await testFailedGenerationNoCredit();
  console.log("poster-generation iteration.test.ts: PASS");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
