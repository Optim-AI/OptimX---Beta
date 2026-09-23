/**
 * Phase 7 LIVE QC smoke — ONE image, ONE QC call, 0 image credits.
 * Run: node --import tsx --env-file=.env.local lib/creative-studio/poster-generation/qc/smoke-live.ts
 */

import sharp from "sharp";
import {
  PosterGenerationSessionService,
  type PosterGenerationSessionRepository,
} from "../session";
import type {
  CreativeBrief,
  CreativeConcept,
  CreativeDNA,
  MarketingStrategy,
  PosterGenerationSession,
} from "../types";
import { buildGenerationSpecification } from "../generation/specification-builder";
import { strategistInputFromBrief } from "../strategy/from-brief";
import { runPosterQcForSession } from "./run-for-session";
import { createGeminiPosterQcEvaluator } from "./vision-evaluator";

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

async function main() {
  const userId = "smoke_qc_phase7";
  // Simple 4:5 poster-like PNG (not a real ad — QC should still return structured result)
  const buf = await sharp({
    create: {
      width: 800,
      height: 1000,
      channels: 3,
      background: { r: 245, g: 240, b: 230 },
    },
  })
    .png()
    .toBuffer();
  const imageUrl = `data:image/png;base64,${buf.toString("base64")}`;

  const brief: CreativeBrief = {
    id: "brief_qc_smoke",
    createdAt: new Date().toISOString(),
    brand: {
      snapshot: null,
      name: "SmokeCo",
      primaryColors: ["#222"],
      aestheticTags: [],
      values: [],
      guidelinesApplied: false,
    },
    product: {
      source: "manual",
      name: "Protein Oats",
      factualClaims: ["20g protein"],
      benefits: [],
      features: [],
      emotionalAngles: [],
      useCases: [],
      images: [],
    },
    userInstruction: "Clean product launch poster",
    visualDirection: "minimal",
    aspectRatio: "4:5",
    variantCount: 1,
    constraints: [],
    productReferences: [],
    designReferences: [],
    supportingReferences: [],
  };

  const strategy: MarketingStrategy = {
    id: "strat_qc_smoke",
    briefId: "brief_qc_smoke",
    createdAt: new Date().toISOString(),
    objective: "product_launch",
    audience: "Breakfast consumers",
    primaryMessage: "Convenient high-protein breakfast",
    communicationAngle: "discovery",
    valueProposition: "20g protein oats",
    emotionalDirection: "confidence",
    rationale: "Lead with protein",
    supportingMessages: [],
    copy: {
      headline: "20G PROTEIN",
      supporting: "Protein Oats",
      productLine: "Protein Oats",
      cta: "Discover now",
      badges: ["20g protein"],
    },
    informationHierarchy: ["Benefit", "Product", "CTA"],
    allowedClaims: ["20g protein"],
    forbiddenClaims: ["Clinically proven"],
    restrictedClaims: [],
    requiredDisclaimers: [],
    userOverrides: {},
  };

  const concept: CreativeConcept = {
    id: "concept_qc_smoke",
    briefId: "brief_qc_smoke",
    strategyId: "strat_qc_smoke",
    createdAt: new Date().toISOString(),
    name: "Quiet Product Hero",
    description: "Clean product-hero launch with restrained type.",
    territory: "product_hero",
    rationale: "Clear product focus for launch",
    visualStory: "Product dominates calm field",
    composition: "Centered hero with negative space",
    subjectTreatment: "Product primary",
    productTreatment: "hero",
    environment: "Simple studio field",
    humanPresence: "none",
    emotionalExpression: "Clean confidence",
    cameraDirection: "Straight-on",
    typographyTreatment: "Large restrained headline",
    colorTreatment: "Neutral",
    graphicLanguage: "Minimal",
    supportingElements: "None",
    copyHierarchy: "Headline → product → CTA",
    ctaTreatment: "Quiet",
    visualDirectionExpression: "Minimal restraint",
    differentiation: "Product hero",
  };

  const dna: CreativeDNA = {
    id: "dna_concept_qc_smoke",
    conceptId: "concept_qc_smoke",
    visualTerritory: "product_hero",
    composition: "Centered hero with negative space",
    subjectTreatment: "Product primary",
    productTreatment: "hero",
    photographyStyle: "Clean commercial",
    lighting: "Soft studio",
    colorStrategy: "Neutral",
    typographyStrategy: "Large restrained headline",
    graphicLanguage: "Minimal",
    humanPresence: "none",
    environment: "Simple studio field",
    mood: "Clean confidence",
    hierarchy: "Headline → product → CTA",
    visualRhythm: "Quiet",
    aspectAwareNotes: "4:5",
  };

  const repo = new MemoryRepo();
  const service = new PosterGenerationSessionService(repo);
  await service.createSession({ userId, id: "sess_qc_smoke" });
  await service.updateBrief("sess_qc_smoke", userId, brief);
  await service.updateStrategy("sess_qc_smoke", userId, strategy);
  await service.setConcepts("sess_qc_smoke", userId, [concept], {
    concept_qc_smoke: dna,
  });

  const ctx = strategistInputFromBrief(brief);
  const spec = buildGenerationSpecification({
    sessionId: "sess_qc_smoke",
    brief,
    strategy,
    concept,
    dna,
    product: ctx.product,
    brand: ctx.brand,
    references: ctx.references,
    variantIndex: 0,
    generationId: "gen_qc_smoke",
    specificationId: "spec_qc_smoke",
  });
  await service.addGenerationSpecification("sess_qc_smoke", userId, spec);
  await service.startGeneration("sess_qc_smoke", userId);
  await service.addGeneratedAsset("sess_qc_smoke", userId, {
    id: "gen_qc_smoke",
    sessionId: "sess_qc_smoke",
    generationId: "gen_qc_smoke",
    variantId: "var_001",
    variantIndex: 0,
    conceptId: concept.id,
    dnaId: dna.id,
    specificationId: spec.id,
    imageUrl,
    provider: "smoke",
    model: "local-png",
    creditsConsumed: 0,
    status: "generated",
    createdAt: new Date().toISOString(),
  });

  console.log("[qc-smoke] running ONE live vision QC…");
  const result = await runPosterQcForSession({
    sessionId: "sess_qc_smoke",
    userId,
    generationId: "gen_qc_smoke",
    sessionService: service,
    evaluator: createGeminiPosterQcEvaluator(),
  });

  const ok =
    result.creditsCharged === 0 &&
    !!result.qc.id &&
    !!result.qc.status &&
    !!result.qc.checks &&
    result.session.assets[0]?.qc?.id === result.qc.id &&
    result.qc.generationId === "gen_qc_smoke";

  console.log(
    JSON.stringify(
      {
        ok,
        creditsCharged: result.creditsCharged,
        status: result.qc.status,
        failureType: result.qc.failureType,
        recommendedAction: result.qc.recommendedAction,
        summary: result.qc.summary,
        confidence: result.qc.confidence,
        issueCount: result.qc.issues.length,
        sessionStatus: result.session.status,
        checks: Object.fromEntries(
          Object.entries(result.qc.checks).map(([k, v]) => [k, v.status])
        ),
      },
      null,
      2
    )
  );

  if (!ok) {
    console.error("[qc-smoke] FAILED");
    process.exit(1);
  }
  console.log("[qc-smoke] PASS — Phase 7 live QC smoke succeeded (0 image credits)");
}

main().catch((e) => {
  console.error("[qc-smoke] error", e);
  process.exit(1);
});
