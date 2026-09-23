/**
 * Phase 7 Poster QC tests (mocked vision evaluator).
 * Run: node --import tsx lib/creative-studio/poster-generation/qc/qc.test.ts
 */

import sharp from "sharp";
import type {
  CreativeBrief,
  CreativeConcept,
  CreativeDNA,
  GenerationSpecification,
  MarketingStrategy,
  PosterGeneratedAsset,
  PosterGenerationSession,
} from "../types";
import {
  PosterGenerationSessionService,
  type PosterGenerationSessionRepository,
} from "../session";
import { buildGenerationSpecification } from "../generation/specification-builder";
import { strategistInputFromBrief } from "../strategy/from-brief";
import { runDeterministicPosterQc } from "./deterministic-checks";
import { buildPosterQcResult } from "./qc-normalizer";
import { runPosterQc } from "./qc-engine";
import { runPosterQcForSession } from "./run-for-session";
import type { PosterQcEvaluator, PosterQcVisionEvaluation } from "./vision-evaluator";
import type { PosterQcInput } from "./qc-input";

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

async function makePngDataUrl(width: number, height: number): Promise<string> {
  const buf = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 240, g: 240, b: 235 },
    },
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function makeBrief(): CreativeBrief {
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
    },
    product: {
      source: "catalog",
      name: "Dark Chocolate Protein Oats",
      factualClaims: ["26g protein"],
      benefits: [],
      features: [],
      emotionalAngles: [],
      useCases: [],
      images: [{ url: "https://cdn.example.com/oats.png" }],
    },
    userInstruction: "Launch poster",
    visualDirection: "premium",
    aspectRatio: "4:5",
    variantCount: 1,
    constraints: [],
    productReferences: [
      {
        id: "pref",
        role: "product_packshot",
        image: { url: "https://cdn.example.com/oats.png" },
      },
    ],
    designReferences: [],
    supportingReferences: [],
  };
}

function makeStrategy(): MarketingStrategy {
  return {
    id: "strat_1",
    briefId: "brief_1",
    createdAt: new Date().toISOString(),
    objective: "product_launch",
    audience: "Breakfast consumers",
    primaryMessage: "A convenient high-protein breakfast option",
    communicationAngle: "discovery",
    valueProposition: "26g protein",
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
    forbiddenClaims: ["Clinically proven"],
    restrictedClaims: [],
    requiredDisclaimers: [],
    userOverrides: {},
  };
}

function makeConcept(): CreativeConcept {
  return {
    id: "concept_1",
    briefId: "brief_1",
    strategyId: "strat_1",
    createdAt: new Date().toISOString(),
    name: "Morning Ritual",
    description: "Lifestyle breakfast ritual with the product integrated.",
    territory: "lifestyle",
    rationale: "Everyday relevance",
    visualStory: "Hands prepare breakfast with product in scene",
    composition: "Asymmetric lifestyle",
    subjectTreatment: "Human ritual",
    productTreatment: "integrated",
    environment: "Kitchen morning",
    humanPresence: "hands only",
    emotionalExpression: "Calm",
    cameraDirection: "Overhead",
    typographyTreatment: "Editorial headline",
    colorTreatment: "Warm",
    graphicLanguage: "Minimal",
    supportingElements: "Bowl",
    copyHierarchy: "Headline → product → CTA",
    ctaTreatment: "Quiet",
    visualDirectionExpression: "Premium restraint",
    differentiation: "Lifestyle",
  };
}

function makeDna(): CreativeDNA {
  return {
    id: "dna_concept_1",
    conceptId: "concept_1",
    visualTerritory: "lifestyle",
    composition: "Asymmetric lifestyle",
    subjectTreatment: "Hands",
    productTreatment: "integrated",
    photographyStyle: "Natural light",
    lighting: "Window soft",
    colorStrategy: "Warm",
    typographyStrategy: "Editorial headline",
    graphicLanguage: "Minimal",
    humanPresence: "hands only",
    environment: "Kitchen",
    mood: "Calm",
    hierarchy: "Story → product → type",
    visualRhythm: "Steady",
    aspectAwareNotes: "4:5",
  };
}

function makeAsset(imageUrl: string, overrides: Partial<PosterGeneratedAsset> = {}): PosterGeneratedAsset {
  return {
    id: "gen_1",
    sessionId: "sess_qc",
    generationId: "gen_1",
    variantId: "var_001",
    variantIndex: 0,
    conceptId: "concept_1",
    dnaId: "dna_concept_1",
    specificationId: "spec_1",
    imageUrl,
    provider: "mock",
    model: "mock",
    creditsConsumed: 1,
    status: "generated",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function passCheck(summary = "OK"): PosterQcVisionEvaluation["checks"]["productFidelity"] {
  return { status: "pass", severity: "none", summary };
}

function failCheck(
  summary: string,
  expected?: string,
  observed?: string
): NonNullable<PosterQcVisionEvaluation["checks"]["productFidelity"]> {
  return {
    status: "fail",
    severity: "high",
    summary,
    expected,
    observed,
  };
}

class MockEvaluator implements PosterQcEvaluator {
  readonly id = "mock_qc";
  constructor(private readonly response: PosterQcVisionEvaluation) {}
  async evaluate(_input: PosterQcInput): Promise<PosterQcVisionEvaluation> {
    return this.response;
  }
}

function visionPass(): PosterQcVisionEvaluation {
  return {
    available: true,
    failureType: "none",
    summary: "Poster matches approved creative plan",
    confidence: 0.92,
    checks: {
      productFidelity: passCheck("Correct product"),
      copyAccuracy: passCheck("Copy exact"),
      visualHierarchy: passCheck("Hierarchy ok"),
      composition: passCheck("Composition matches DNA"),
      conceptExecution: passCheck("Lifestyle executed"),
      strategyAlignment: passCheck("Strategy aligned"),
      brandCompliance: passCheck("Brand ok"),
      referenceCompliance: passCheck("Refs ok"),
      artifactDetection: passCheck("No artifacts"),
      claimSafety: passCheck("Claims safe"),
    },
    issues: [],
    warnings: [],
  };
}

async function buildInput(imageUrl: string): Promise<{
  input: PosterQcInput;
  spec: GenerationSpecification;
}> {
  const brief = makeBrief();
  const strategy = makeStrategy();
  const concept = makeConcept();
  const dna = makeDna();
  const ctx = strategistInputFromBrief(brief);
  const spec = buildGenerationSpecification({
    sessionId: "sess_qc",
    brief,
    strategy,
    concept,
    dna,
    product: ctx.product,
    brand: ctx.brand,
    references: ctx.references,
    variantIndex: 0,
    generationId: "gen_1",
    specificationId: "spec_1",
    variantId: "var_001",
  });
  const asset = makeAsset(imageUrl);
  return {
    spec,
    input: {
      sessionId: "sess_qc",
      brief,
      strategy,
      concept,
      dna,
      specification: spec,
      asset,
      product: ctx.product,
      brand: ctx.brand,
      references: ctx.references,
      imageUrl,
      productReferenceUrls: ["https://cdn.example.com/oats.png"],
    },
  };
}

async function run() {
  const png45 = await makePngDataUrl(800, 1000); // 4:5

  // Deterministic PASS
  const techOk = await runDeterministicPosterQc({
    imageUrl: png45,
    expectedAspect: "4:5",
    assetStatus: "generated",
  });
  assert(techOk.passed, "deterministic pass");
  assert(!techOk.skipVision, "vision not skipped");

  // Deterministic technical failure
  const techFail = await runDeterministicPosterQc({
    imageUrl: "",
    expectedAspect: "4:5",
    assetStatus: "failed",
  });
  assert(!techFail.passed && techFail.skipVision, "tech fail skips vision");

  // Aspect warning
  const square = await makePngDataUrl(800, 800);
  const aspectWarn = await runDeterministicPosterQc({
    imageUrl: square,
    expectedAspect: "4:5",
    assetStatus: "generated",
  });
  assert(aspectWarn.passed, "aspect mismatch is warning not hard fail");
  assert(aspectWarn.warnings.some((w) => w.code === "ASPECT_MISMATCH"), "aspect warn");

  // PASS end-to-end
  const { input } = await buildInput(png45);
  const pass = await runPosterQc(input, {
    evaluator: new MockEvaluator(visionPass()),
  });
  assert(pass.passed && pass.status === "pass", "pass status");
  assert(pass.recommendedAction === "accept", "accept");
  assert(pass.failureType === "none", "no failure");
  assert(pass.score === null, "no user score");

  // Product failure
  const productFail = await runPosterQc(input, {
    evaluator: new MockEvaluator({
      available: true,
      failureType: "generation_execution",
      summary: "Wrong packaging",
      confidence: 0.88,
      checks: {
        ...visionPass().checks,
        productFidelity: failCheck(
          "Packaging does not match product reference",
          "FuelCo oats pack",
          "Generic cereal box"
        ),
      },
      issues: [
        {
          id: "prod1",
          category: "product",
          severity: "critical",
          code: "WRONG_PRODUCT",
          message: "Generated product packaging does not match reference",
          expected: "FuelCo oats",
          observed: "Generic cereal",
          actionable: true,
          recommendedFix: "Regenerate with product reference emphasis",
        },
      ],
      warnings: [],
    }),
  });
  assert(productFail.status === "fail" || productFail.status === "regenerate", "product fail");
  assert(productFail.passed === false, "not passed");
  assert(productFail.checks.productFidelity.status === "fail", "product check fail");

  // Copy failure
  const copyFail = await runPosterQc(input, {
    evaluator: new MockEvaluator({
      available: true,
      failureType: "generation_execution",
      summary: "Headline number wrong",
      confidence: 0.9,
      checks: {
        ...visionPass().checks,
        copyAccuracy: failCheck("Headline says 25g", "26G PROTEIN", "25G PROTEIN"),
      },
      issues: [
        {
          id: "copy1",
          category: "copy",
          severity: "high",
          code: "COPY_MISMATCH",
          message: "Headline protein amount incorrect",
          expected: "26G PROTEIN",
          observed: "25G PROTEIN",
          actionable: true,
          recommendedFix: "Regenerate with exact approved copy",
        },
      ],
      warnings: [],
    }),
  });
  assert(copyFail.status === "regenerate", "copy → regenerate");
  assert(copyFail.checks.copyAccuracy.observed === "25G PROTEIN", "observed copy");

  // Concept failure (lifestyle → generic hero)
  const conceptFail = await runPosterQc(input, {
    evaluator: new MockEvaluator({
      available: true,
      failureType: "generation_execution",
      summary: "Concept not executed",
      confidence: 0.85,
      checks: {
        ...visionPass().checks,
        conceptExecution: failCheck(
          "Expected lifestyle kitchen ritual",
          "Lifestyle breakfast with hands",
          "Centered product on plain gradient"
        ),
        composition: failCheck("Composition diverged from DNA"),
      },
      issues: [
        {
          id: "concept1",
          category: "concept",
          severity: "high",
          code: "CONCEPT_MISS",
          message: "Output is generic product hero, not lifestyle ritual",
          expected: "Lifestyle breakfast",
          observed: "Centered gradient hero",
          actionable: true,
          recommendedFix: "Regenerate following CreativeDNA",
        },
      ],
      warnings: [],
    }),
  });
  assert(conceptFail.status === "regenerate", "concept regenerate");
  assert(conceptFail.failureType === "generation_execution", "execution failure");

  // Brand failure
  const brandFail = await runPosterQc(input, {
    evaluator: new MockEvaluator({
      available: true,
      failureType: "generation_execution",
      summary: "Logo distorted",
      confidence: 0.8,
      checks: {
        ...visionPass().checks,
        brandCompliance: failCheck("Logo malformed"),
      },
      issues: [
        {
          id: "brand1",
          category: "brand",
          severity: "high",
          code: "LOGO_DISTORT",
          message: "Brand logo appears distorted",
          actionable: true,
        },
      ],
      warnings: [],
    }),
  });
  assert(brandFail.passed === false, "brand fail");

  // Claim failure
  const claimFail = await runPosterQc(input, {
    evaluator: new MockEvaluator({
      available: true,
      failureType: "generation_execution",
      summary: "Unsupported claim appeared",
      confidence: 0.9,
      checks: {
        ...visionPass().checks,
        claimSafety: failCheck(
          "Clinically proven appeared",
          "No medical claims",
          "Clinically proven"
        ),
      },
      issues: [
        {
          id: "claim1",
          category: "claim",
          severity: "critical",
          code: "UNSUPPORTED_CLAIM",
          message: "Poster shows forbidden claim text",
          expected: "No clinically proven",
          observed: "Clinically proven",
          actionable: true,
        },
      ],
      warnings: [],
    }),
  });
  assert(
    claimFail.status === "fail" || claimFail.status === "regenerate",
    "claim fail"
  );

  // Artifact failure
  const artifactFail = await runPosterQc(input, {
    evaluator: new MockEvaluator({
      available: true,
      failureType: "generation_execution",
      summary: "Malformed packaging",
      confidence: 0.87,
      checks: {
        ...visionPass().checks,
        artifactDetection: failCheck("Warped pack geometry"),
      },
      issues: [
        {
          id: "art1",
          category: "artifact",
          severity: "high",
          code: "WARPED_PRODUCT",
          message: "Product packaging geometry is warped",
          actionable: true,
        },
      ],
      warnings: [],
    }),
  });
  assert(artifactFail.passed === false, "artifact fail");

  // Specification vs generation failure
  const specFail = buildPosterQcResult({
    generationId: "gen_1",
    assetId: "gen_1",
    deterministic: techOk,
    vision: {
      available: true,
      failureType: "specification",
      summary:
        "Image faithfully executed a product-hero gradient plan that conflicts with lifestyle strategy",
      confidence: 0.8,
      checks: {
        ...visionPass().checks,
        conceptExecution: passCheck("Matched the (wrong) specification"),
      },
      issues: [
        {
          id: "spec1",
          category: "strategy",
          severity: "high",
          code: "SPEC_MISALIGN",
          message: "Specification itself diverged from strategy/concept",
          actionable: false,
        },
      ],
      warnings: [],
    },
  });
  assert(specFail.failureType === "specification", "spec failure type");
  assert(specFail.recommendedAction === "review", "review not blind regenerate");

  // Session persistence + partial QC
  const repo = new MemoryRepo();
  const service = new PosterGenerationSessionService(repo);
  await service.createSession({ userId: "user_1", id: "sess_qc" });
  const brief = makeBrief();
  await service.updateBrief("sess_qc", "user_1", brief);
  await service.updateStrategy("sess_qc", "user_1", makeStrategy());
  const concept = makeConcept();
  await service.setConcepts("sess_qc", "user_1", [concept], {
    concept_1: makeDna(),
  });
  const ctx = strategistInputFromBrief(brief);
  const spec = buildGenerationSpecification({
    sessionId: "sess_qc",
    brief,
    strategy: makeStrategy(),
    concept,
    dna: makeDna(),
    product: ctx.product,
    brand: ctx.brand,
    references: ctx.references,
    variantIndex: 0,
    generationId: "gen_1",
    specificationId: "spec_1",
  });
  await service.addGenerationSpecification("sess_qc", "user_1", spec);
  await service.startGeneration("sess_qc", "user_1");
  await service.addGeneratedAsset(
    "sess_qc",
    "user_1",
    makeAsset(png45, { specificationId: spec.id, generationId: spec.generationId, id: spec.generationId })
  );

  const sessionQc = await runPosterQcForSession({
    sessionId: "sess_qc",
    userId: "user_1",
    generationId: spec.generationId,
    sessionService: service,
    evaluator: new MockEvaluator(visionPass()),
  });
  assert(sessionQc.creditsCharged === 0, "0 credits");
  assert(sessionQc.qc.passed, "session qc pass");
  assert(sessionQc.session.assets[0].qc?.passed === true, "qc persisted on asset");
  assert(sessionQc.session.status === "ready", "ready after pass");

  // Second variant fail → stay qc / partial representable
  const concept2 = {
    ...makeConcept(),
    id: "concept_2",
    name: "Hero",
    territory: "product_hero" as const,
  };
  // Can't easily re-set concepts after strategy clear — add asset for same concept
  const gen2 = "gen_2";
  const spec2 = { ...spec, id: "spec_2", generationId: gen2, variantId: "var_002", variantIndex: 1 };
  await service.addGenerationSpecification("sess_qc", "user_1", spec2);
  await service.addGeneratedAsset(
    "sess_qc",
    "user_1",
    makeAsset(png45, {
      id: gen2,
      generationId: gen2,
      variantId: "var_002",
      variantIndex: 1,
      specificationId: "spec_2",
    })
  );
  const failQc = await runPosterQcForSession({
    sessionId: "sess_qc",
    userId: "user_1",
    generationId: gen2,
    sessionService: service,
    evaluator: new MockEvaluator({
      available: true,
      failureType: "generation_execution",
      summary: "Copy wrong",
      confidence: 0.9,
      checks: {
        ...visionPass().checks,
        copyAccuracy: failCheck("bad copy", "26G", "25G"),
      },
      issues: [
        {
          id: "c",
          category: "copy",
          severity: "high",
          code: "COPY",
          message: "wrong",
          actionable: true,
        },
      ],
      warnings: [],
    }),
  });
  assert(failQc.qc.passed === false, "variant 2 fail");
  assert(failQc.session.assets.some((a) => a.qc?.passed), "variant 1 still pass");
  assert(failQc.session.assets.some((a) => a.qc && !a.qc.passed), "variant 2 fail persisted");
  assert(failQc.session.status === "qc", "partial stays qc");
  assert(failQc.creditsCharged === 0, "still 0 credits");

  // No automatic regeneration — engine only evaluates
  assert(
    failQc.qc.recommendedAction === "regenerate" ||
      failQc.qc.recommendedAction === "local_fix" ||
      failQc.qc.recommendedAction === "review",
    "recommendation recorded only"
  );

  console.log("poster-generation qc.test.ts: PASS");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
