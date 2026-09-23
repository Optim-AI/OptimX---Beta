/**
 * In-memory repository + Phase 2 session service unit tests.
 * Run: node --import tsx lib/creative-studio/poster-generation/session/session.service.test.ts
 *
 * No Supabase / no image generation / no credits.
 */

import { createEmptyPosterSession } from "../guards";
import type {
  CreativeBrief,
  CreativeConcept,
  CreativeDNA,
  GenerationSpecification,
  MarketingStrategy,
  PosterGeneratedAsset,
  PosterGenerationSession,
  PosterIterationRecord,
  PosterQcResult,
} from "../types";
import { PosterGenerationSessionError } from "./errors";
import type { PosterGenerationSessionRepository } from "./repository";
import { rowToSession } from "./serialize";
import { PosterGenerationSessionService } from "./index";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

class MemoryRepo implements PosterGenerationSessionRepository {
  store = new Map<string, PosterGenerationSession>();

  async insert(session: PosterGenerationSession) {
    this.store.set(session.id, structuredClone(session));
    return structuredClone(session);
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

  async findByStudioSessionId(studioSessionId: string, userId: string) {
    for (const s of this.store.values()) {
      if (s.studioSessionId === studioSessionId && s.userId === userId) {
        return structuredClone(s);
      }
    }
    return null;
  }

  async updateOptimistic(
    session: PosterGenerationSession,
    expectedVersion: number
  ) {
    const current = this.store.get(session.id);
    if (!current || current.version !== expectedVersion) {
      throw new PosterGenerationSessionError({
        code: "CONFLICT",
        message: "version conflict",
        stage: "memory.updateOptimistic",
        retryable: true,
      });
    }
    const next = {
      ...structuredClone(session),
      version: expectedVersion + 1,
      updatedAt: new Date().toISOString(),
    };
    this.store.set(session.id, next);
    return structuredClone(next);
  }
}

function sampleBrief(overrides?: Partial<CreativeBrief>): CreativeBrief {
  return {
    id: "brief_1",
    createdAt: new Date().toISOString(),
    brand: {
      snapshot: null,
      primaryColors: [],
      aestheticTags: [],
      values: [],
      guidelinesApplied: false,
    },
    product: null,
    userInstruction: "Create a product launch poster",
    visualDirection: "commercial",
    aspectRatio: "4:5",
    variantCount: 3,
    constraints: [],
    productReferences: [],
    designReferences: [],
    supportingReferences: [],
    ...overrides,
  };
}

function sampleStrategy(): MarketingStrategy {
  return {
    id: "strat_1",
    briefId: "brief_1",
    createdAt: new Date().toISOString(),
    objective: "Product launch",
    audience: "Fitness adults",
    primaryMessage: "High-protein breakfast",
    communicationAngle: "Morning ritual",
    valueProposition: "26g protein",
    emotionalDirection: "Energetic calm",
    rationale: "Lead with the supported protein differentiator for launch.",
    supportingMessages: ["Dark chocolate flavor"],
    copy: {
      headline: "26G PROTEIN. START STRONG.",
      supporting: "Dark Chocolate Protein Oats",
      cta: "Try it today",
      badges: ["26g Protein"],
    },
    informationHierarchy: ["headline", "product", "cta"],
    allowedClaims: ["26g protein"],
    forbiddenClaims: ["Clinically proven"],
    restrictedClaims: [],
    requiredDisclaimers: [],
    userOverrides: {},
  };
}

function sampleConcept(id = "concept_1"): CreativeConcept {
  return {
    id,
    briefId: "brief_1",
    strategyId: "strat_1",
    createdAt: new Date().toISOString(),
    name: "Morning Ritual",
    description:
      "A real morning breakfast moment where the product naturally belongs in the scene.",
    territory: "lifestyle",
    rationale: "Everyday breakfast as protein ritual",
    visualStory: "Person → bowl → product",
    composition: "Bowl foreground, product midground",
    subjectTreatment: "Hands preparing breakfast as the narrative focus",
    productTreatment: "Accurate packshot integrated",
    environment: "Kitchen morning light",
    humanPresence: "Hands only",
    emotionalExpression: "Calm morning confidence",
    cameraDirection: "Slight overhead",
    typographyTreatment: "Bold condensed headline",
    colorTreatment: "Warm neutrals + brand accent",
    graphicLanguage: "Minimal supporting marks",
    supportingElements: "Steam, oats",
    copyHierarchy: "Headline then product line",
    ctaTreatment: "Small lower CTA",
    visualDirectionExpression: "Commercial stop-power without packshot template",
    differentiation: "Human-centered lifestyle storytelling",
  };
}

function sampleDna(conceptId = "concept_1"): CreativeDNA {
  return {
    id: `dna_${conceptId}`,
    conceptId,
    visualTerritory: "lifestyle",
    composition: "Foreground bowl",
    subjectTreatment: "Hands interacting",
    productTreatment: "True pack",
    photographyStyle: "Natural light still life",
    lighting: "Window soft light",
    colorStrategy: "Warm + brand green",
    typographyStrategy: "Headline upper quiet zone",
    graphicLanguage: "Minimal",
    humanPresence: "Partial",
    environment: "Kitchen",
    mood: "Awake calm",
    hierarchy: "Story → product → type",
    visualRhythm: "Steady left-to-right breakfast beat",
    aspectAwareNotes: "4:5 portrait stack",
  };
}

function sampleSpec(id = "spec_1"): GenerationSpecification {
  return {
    id,
    sessionId: "sess_1",
    briefId: "brief_1",
    strategyId: "strat_1",
    conceptId: "concept_1",
    dnaId: "dna_concept_1",
    createdAt: new Date().toISOString(),
    generationId: "gen_001",
    variantId: "var_001",
    variantIndex: 0,
    aspectRatio: "4:5",
    intendedPlatform: "Instagram feed / portrait social",
    renderCopy: {
      headline: "26G PROTEIN. START STRONG.",
      supporting: "Dark Chocolate Protein Oats",
      productLine: "Dark Chocolate Protein Oats",
      cta: "Try it today",
      badges: [],
    },
    copyHierarchy: [
      { role: "primary", text: "26G PROTEIN. START STRONG.", importance: "required" },
      { role: "product_line", text: "Dark Chocolate Protein Oats", importance: "required" },
      { role: "cta", text: "Try it today", importance: "optional" },
    ],
    strategyAlignment: {
      objective: "product_launch",
      primaryMessage: "A convenient high-protein breakfast option",
      audience: "Active breakfast consumers",
      communicationAngle: "discovery",
      allowedClaims: ["26g protein"],
      forbiddenClaims: ["Build muscle faster"],
      restrictedClaims: [],
    },
    scene: {
      visualTerritory: "lifestyle",
      visualStory: "Morning ritual",
      composition: "Bowl foreground",
      subjectTreatment: "Hands preparing breakfast",
      productRole: "integrated",
      productTreatment: "Accurate packshot integrated",
      environment: "Kitchen",
      humanPresence: "Hands only",
      lighting: "Soft window",
      photographyStyle: "Still life",
      colorStrategy: "Warm neutrals + brand accent",
      typography: "Bold headline",
      graphicLanguage: "Minimal",
      visualRhythm: "Steady breakfast beat",
      mood: "Awake calm",
      hierarchy: "Story → product → type",
      productFidelityRules: "Preserve packaging exactly",
      brandIntegration: "Accent colors",
      designReferenceInfluence: "none",
      visualDirectionExpression: "Commercial art direction",
      outputRequirements: ["Finished advertising poster"],
    },
    references: [],
    attachedAssetIds: [],
    constraints: {
      productFidelity: "Exact product packaging must appear",
      logoFidelity: "Do not redesign brand marks",
      copyFidelity: "Render exact approved copy only",
      unsupportedClaims: ["Build muscle faster"],
      referenceHandling: "Product refs are authoritative; design refs are inspiration only",
      brandRequirements: [],
    },
    userOverrides: {},
  };
}

function sampleAsset(id = "gen_001"): PosterGeneratedAsset {
  return {
    id,
    sessionId: "sess_1",
    generationId: id,
    variantId: "var_001",
    variantIndex: 0,
    conceptId: "concept_1",
    dnaId: "dna_concept_1",
    specificationId: "spec_1",
    imageUrl: "https://example.com/poster.png",
    provider: "nano_banana",
    model: "gemini-3.1-flash-image",
    creditsConsumed: 1,
    status: "generated",
    createdAt: new Date().toISOString(),
  };
}

function sampleQc(generationId = "gen_001"): PosterQcResult {
  const passCheck = {
    status: "pass" as const,
    severity: "none" as const,
    summary: "OK",
  };
  return {
    id: "qc_1",
    generationId,
    assetId: generationId,
    createdAt: new Date().toISOString(),
    passed: true,
    decision: "pass",
    status: "pass",
    recommendedAction: "accept",
    summary: "Poster matches approved creative plan",
    confidence: 0.9,
    failureType: "none",
    checks: {
      productFidelity: passCheck,
      copyAccuracy: passCheck,
      visualHierarchy: passCheck,
      composition: passCheck,
      conceptExecution: passCheck,
      strategyAlignment: passCheck,
      brandCompliance: passCheck,
      referenceCompliance: passCheck,
      technicalQuality: passCheck,
      artifactDetection: passCheck,
      claimSafety: passCheck,
    },
    score: null,
    issues: [],
    warnings: [],
    recommendedFixes: [],
  };
}

function sampleIteration(): PosterIterationRecord {
  return {
    id: "iter_1",
    request: {
      id: "iter_req_1",
      sessionId: "sess_1",
      targetGenerationId: "gen_001",
      userInstruction: "Make the headline larger",
      createdAt: new Date().toISOString(),
    },
    classification: "LOCAL_EDIT",
    resultingGenerationId: null,
    preservedDnaFields: ["composition", "environment"],
    changedDnaFields: ["typographyStrategy"],
  };
}

async function run() {
  const repo = new MemoryRepo();
  const service = new PosterGenerationSessionService(repo);

  // 1. create
  const created = await service.createSession({
    userId: "user_1",
    studioSessionId: "studio_1",
    brandId: "brand_yoga",
    productId: "prod_oats",
  });
  assert(created.status === "draft", "create draft");
  assert(created.version === 1, "version 1");
  assert(created.studioSessionId === "studio_1", "studio link");

  // idempotent create by studioSessionId
  const again = await service.createSession({
    userId: "user_1",
    studioSessionId: "studio_1",
  });
  assert(again.id === created.id, "idempotent create");

  // 2. get
  const got = await service.getSession(created.id, "user_1");
  assert(got.id === created.id, "get session");

  // legacy
  const legacy = await service.getOrDescribeLegacy("studio_missing", "user_1");
  assert(legacy.kind === "legacy", "legacy studio session");

  // 3. update brief
  let session = await service.updateBrief(
    created.id,
    "user_1",
    sampleBrief()
  );
  assert(session.status === "brief_ready", "brief_ready");
  assert(session.brief?.userInstruction.includes("launch"), "brief stored");
  assert(session.version === 2, "version bumped");

  // 4. strategy
  session = await service.updateStrategy(created.id, "user_1", sampleStrategy());
  assert(session.status === "strategy_ready", "strategy_ready");

  // 5. concepts
  session = await service.setConcepts(
    created.id,
    "user_1",
    [sampleConcept("concept_1"), sampleConcept("concept_2")],
    {
      concept_1: sampleDna("concept_1"),
      concept_2: sampleDna("concept_2"),
    }
  );
  assert(session.concepts.length === 2, "2 concepts");
  assert(session.status === "concepts_ready", "concepts_ready");

  // 6. select
  session = await service.selectConcept(created.id, "user_1", [
    "concept_1",
    "concept_2",
  ]);
  assert(session.selectedConceptIds.length === 2, "selected concepts");

  // 7. specification + idempotency
  const spec = { ...sampleSpec("spec_1"), sessionId: created.id };
  session = await service.addGenerationSpecification(
    created.id,
    "user_1",
    spec
  );
  session = await service.addGenerationSpecification(
    created.id,
    "user_1",
    { ...spec, compiledPrompt: "updated" }
  );
  assert(session.specifications.length === 1, "spec idempotent by id");
  assert(
    session.specifications[0].compiledPrompt === "updated",
    "spec replaced"
  );

  // 8. start generation
  session = await service.startGeneration(created.id, "user_1");
  assert(session.status === "generating", "generating");

  // 9. asset + idempotency
  const asset = {
    ...sampleAsset("gen_001"),
    sessionId: created.id,
    variantId: "var_001",
  };
  session = await service.addGeneratedAsset(created.id, "user_1", asset);
  session = await service.addGeneratedAsset(created.id, "user_1", asset);
  assert(session.assets.length === 1, "asset idempotent");
  assert(session.trace.generationCount === 1, "generation counted once");
  assert(session.assets[0].variantId === "var_001", "stable variant id");

  // 10. QC
  session = await service.addQcResult(
    created.id,
    "user_1",
    sampleQc("gen_001")
  );
  assert(session.assets[0].qc?.passed === true, "qc attached");

  // 11. iteration
  session = await service.addIteration(
    created.id,
    "user_1",
    sampleIteration()
  );
  assert(session.iterations.length === 1, "iteration stored");
  assert(session.status === "iterating", "iterating");

  // 12. complete
  session = await service.completeSession(created.id, "user_1");
  assert(session.status === "ready", "ready/complete");

  // 13. fail
  const failTarget = await service.createSession({
    userId: "user_1",
    studioSessionId: "studio_fail",
  });
  const failed = await service.failSession(failTarget.id, "user_1", {
    code: "PROVIDER_DOWN",
    stage: "generate",
    message: "Provider unavailable",
    retryable: true,
  });
  assert(failed.status === "failed", "failed status");
  assert(failed.error?.retryable === true, "structured error");

  // 14. malformed persisted JSON
  let malformedCaught = false;
  try {
    rowToSession({
      id: "x",
      userId: "u",
      studioSessionId: null,
      brandId: null,
      productId: null,
      status: "draft",
      version: 1,
      brief: { bad: true },
      strategy: null,
      concepts: [],
      selectedConceptIds: [],
      dnaByConceptId: {},
      specifications: [],
      assets: [],
      iterations: [],
      trace: {},
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    malformedCaught =
      e instanceof PosterGenerationSessionError && e.code === "MALFORMED_PERSISTED_DATA";
  }
  assert(malformedCaught, "malformed brief throws");

  // 15. missing optional fields — empty session ok
  const empty = createEmptyPosterSession({
    id: "e1",
    userId: "u1",
  });
  assert(empty.brief === null, "optional brief null");
  assert(empty.version === 1, "default version");

  // 16. invalid brief update
  let validationCaught = false;
  try {
    await service.updateBrief(created.id, "user_1", { nope: true } as any);
  } catch (e) {
    validationCaught =
      e instanceof PosterGenerationSessionError && e.code === "VALIDATION";
  }
  assert(validationCaught, "invalid brief rejected");

  // conflict: stale version
  const conflictRepo = new MemoryRepo();
  const conflictService = new PosterGenerationSessionService(conflictRepo);
  const c = await conflictService.createSession({
    userId: "user_1",
    studioSessionId: "studio_conflict",
  });
  const stale = await conflictService.getSession(c.id, "user_1");
  // Advance version in the store (simulates concurrent writer)
  await conflictRepo.updateOptimistic(
    { ...stale, status: "brief_ready" },
    stale.version
  );
  let conflictCaught = false;
  try {
    // Retry with the original stale version token
    await conflictRepo.updateOptimistic(
      { ...stale, status: "ready" },
      stale.version
    );
  } catch (e) {
    conflictCaught = e instanceof PosterGenerationSessionError && e.code === "CONFLICT";
  }
  assert(conflictCaught, "optimistic concurrency conflict");

  console.log("poster-generation session.service.test.ts: PASS");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
