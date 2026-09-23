/**
 * Phase 6 LIVE smoke — ONE variant, ONE provider call.
 * Run: node --import tsx --env-file=.env.local lib/creative-studio/poster-generation/generation/smoke-live.ts
 *
 * Uses real Nano Banana + campaign-assets storage.
 * Credits are tracked via a local meter (same deduct-after-success path as production);
 * does not touch a real user balance unless SMOKE_USER_ID + SMOKE_REAL_CREDITS=1.
 */

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
import { createNanoBananaImageProvider } from "./nano-banana-provider";
import { generatePostersForSession } from "./generate-poster";
import { storePosterGeneratedImage } from "./storage";
import { CreditsDAO } from "@/database/models/Credits.dao";

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
  const useRealCredits = process.env.SMOKE_REAL_CREDITS === "1";
  const userId = process.env.SMOKE_USER_ID || "smoke_poster_phase6";

  const brief: CreativeBrief = {
    id: "brief_smoke",
    createdAt: new Date().toISOString(),
    brand: {
      snapshot: null,
      name: "SmokeTest Co",
      primaryColors: ["#1a1a1a"],
      aestheticTags: [],
      values: [],
      guidelinesApplied: false,
    },
    product: {
      source: "manual",
      name: "Everyday Protein Oats",
      description: "Simple protein oats for breakfast",
      shortBenefit: "20g protein",
      category: "Food",
      benefits: ["Convenient breakfast"],
      factualClaims: ["20g protein"],
      features: ["Oats"],
      emotionalAngles: [],
      useCases: ["Breakfast"],
      images: [
        {
          // Public placeholder — solid product-like square for fidelity path
          url: "https://placehold.co/600x800/png?text=Protein+Oats",
        },
      ],
    },
    userInstruction: "Create a clean product launch poster for these protein oats.",
    visualDirection: "minimal",
    aspectRatio: "4:5",
    variantCount: 1,
    constraints: [],
    productReferences: [
      {
        id: "smoke_product",
        role: "product_packshot",
        image: {
          url: "https://placehold.co/600x800/png?text=Protein+Oats",
        },
      },
    ],
    designReferences: [],
    supportingReferences: [],
  };

  const strategy: MarketingStrategy = {
    id: "strat_smoke",
    briefId: "brief_smoke",
    createdAt: new Date().toISOString(),
    objective: "product_launch",
    audience: "Breakfast consumers",
    primaryMessage: "A convenient high-protein breakfast option",
    communicationAngle: "discovery",
    valueProposition: "20g protein oats",
    emotionalDirection: "confidence",
    rationale: "Lead with protein for launch discovery",
    supportingMessages: [],
    copy: {
      headline: "20G PROTEIN",
      supporting: "Everyday Protein Oats",
      productLine: "Everyday Protein Oats",
      cta: "Discover now",
      badges: ["20g protein"],
    },
    informationHierarchy: ["Benefit", "Product", "CTA"],
    allowedClaims: ["20g protein"],
    forbiddenClaims: [],
    restrictedClaims: [],
    requiredDisclaimers: [],
    userOverrides: {},
  };

  const concept: CreativeConcept = {
    id: "concept_smoke",
    briefId: "brief_smoke",
    strategyId: "strat_smoke",
    createdAt: new Date().toISOString(),
    name: "Quiet Product Hero",
    description:
      "A clean product-hero launch composition that puts protein oats at center stage with restrained typography.",
    territory: "product_hero",
    rationale: "Discovery launch benefits from clear product focus",
    visualStory: "Product dominates a calm field; headline states protein benefit",
    composition: "Centered hero with negative space",
    subjectTreatment: "Product as primary subject",
    productTreatment: "hero",
    environment: "Simple studio field",
    humanPresence: "none",
    emotionalExpression: "Clean confidence",
    cameraDirection: "Straight-on pack",
    typographyTreatment: "Large restrained headline",
    colorTreatment: "Neutral field with quiet accent",
    graphicLanguage: "Minimal",
    supportingElements: "None beyond product and type",
    copyHierarchy: "Headline → product line → CTA",
    ctaTreatment: "Quiet lower CTA",
    visualDirectionExpression: "Minimal as calm restraint",
    differentiation: "Product-led commercial hero",
  };

  const dna: CreativeDNA = {
    id: "dna_concept_smoke",
    conceptId: "concept_smoke",
    visualTerritory: "product_hero",
    composition: "Centered hero with negative space",
    subjectTreatment: "Product primary",
    productTreatment: "hero",
    photographyStyle: "Clean commercial product photography",
    lighting: "Soft even studio light",
    colorStrategy: "Neutral field",
    typographyStrategy: "Large restrained headline",
    graphicLanguage: "Minimal",
    humanPresence: "none",
    environment: "Simple studio field",
    mood: "Clean confidence",
    hierarchy: "Headline → product → CTA",
    visualRhythm: "Quiet primary beat",
    aspectAwareNotes: "4:5 portrait stack",
  };

  const repo = new MemoryRepo();
  const service = new PosterGenerationSessionService(repo);
  await service.createSession({ userId, id: "sess_smoke_phase6" });
  await service.updateBrief("sess_smoke_phase6", userId, brief);
  await service.updateStrategy("sess_smoke_phase6", userId, strategy);
  await service.setConcepts("sess_smoke_phase6", userId, [concept], {
    concept_smoke: dna,
  });
  await service.selectConcept("sess_smoke_phase6", userId, "concept_smoke");

  let meter = 0;
  const credits = useRealCredits
    ? {
        getBalance: async (uid: string) => {
          const b = await CreditsDAO.getFullBalance(uid);
          return b?.imageCredits.total ?? 0;
        },
        deduct: async (uid: string, amount: number) => {
          const r = await CreditsDAO.deductImageCredits(uid, amount);
          if (r.success) meter += amount;
          return !!r.success;
        },
      }
    : {
        getBalance: async () => 10,
        deduct: async (_u: string, amount: number) => {
          meter += amount;
          return true;
        },
      };

  console.log("[smoke] starting ONE live Nano Banana generation…");
  const result = await generatePostersForSession({
    sessionId: "sess_smoke_phase6",
    userId,
    variantCount: 1,
    conceptId: "concept_smoke",
    sessionService: service,
    provider: createNanoBananaImageProvider(),
    storeImage: storePosterGeneratedImage,
    credits,
    maxProviderRetries: 1,
  });

  const asset = result.outcomes[0]?.asset;
  const ok =
    result.successfulVariants === 1 &&
    result.creditsCharged === 1 &&
    meter === 1 &&
    !!asset?.imageUrl &&
    asset.status === "generated" &&
    result.session.specifications.length >= 1 &&
    result.session.status === "qc";

  console.log(
    JSON.stringify(
      {
        ok,
        provider: asset?.provider,
        model: asset?.model,
        status: result.session.status,
        creditsCharged: result.creditsCharged,
        meter,
        useRealCredits,
        imageUrlPrefix: asset?.imageUrl?.slice(0, 80),
        storagePath: asset?.storagePath,
        generationId: asset?.generationId,
        variantId: asset?.variantId,
        specificationId: asset?.specificationId,
        compiledPromptChars:
          result.session.specifications[0]?.compiledPrompt?.length || 0,
        durationMs: asset?.durationMs,
      },
      null,
      2
    )
  );

  if (!ok) {
    console.error("[smoke] FAILED", result.outcomes[0]?.asset?.errorMessage);
    process.exit(1);
  }
  console.log("[smoke] PASS — Phase 6 live smoke succeeded");
}

main().catch((e) => {
  console.error("[smoke] error", e);
  process.exit(1);
});
