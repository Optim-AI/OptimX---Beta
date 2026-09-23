/**
 * Phase 4 Marketing Strategist tests (mocked LLM — no live calls).
 * Run: node --import tsx lib/creative-studio/poster-generation/strategy/strategist.test.ts
 */

import type {
  StructuredGenerationRequest,
  StructuredGenerationResult,
  StructuredGenerator,
} from "@/lib/creative-studio/commercial-production/commercial-director/llm";
import type { BrandSnapshot, Product } from "@/app/web/src/components/creative-studio/types";
import { resolvePosterContext } from "../context";
import { createEmptyPosterSession } from "../guards";
import type { CreativeBrief, MarketingStrategy, PosterGenerationSession } from "../types";
import type { PosterGenerationSessionRepository } from "../session";
import { PosterGenerationSessionService } from "../session";
import { detectUserOverrides } from "./strategy-input";
import { generateMarketingStrategy } from "./strategist";
import {
  repairStrategyClaims,
  validateMarketingStrategy,
} from "./strategy-validation";
import { strategistInputFromBrief } from "./from-brief";
import { runMarketingStrategyForSession } from "./run-for-session";
import { PosterStrategyError } from "./strategy-errors";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

class MockGenerator implements StructuredGenerator {
  readonly modelId = "mock-strategist";
  constructor(private readonly payload: Record<string, unknown>) {}
  async generateJson<T>(
    _req: StructuredGenerationRequest
  ): Promise<StructuredGenerationResult<T>> {
    return {
      data: this.payload as T,
      model: this.modelId,
      rawText: JSON.stringify(this.payload),
    };
  }
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
    if (!cur || cur.version !== expectedVersion) {
      throw new Error("conflict");
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

function baseModelStrategy(overrides?: Record<string, unknown>) {
  return {
    objective: "product_launch",
    audience: "Fitness-conscious consumers",
    primaryMessage: "A convenient high-protein breakfast option",
    communicationAngle: "performance",
    valueProposition: "26g protein in everyday oats",
    emotionalDirection: "confidence",
    rationale:
      "Lead with the supported protein differentiator for the launch objective.",
    supportingMessages: ["Dark chocolate flavor"],
    copy: {
      headline: "26G PROTEIN",
      supporting: "Dark Chocolate Protein Oats",
      productLine: "Yoga Bar High Protein Oats",
      cta: "Discover now",
      badges: ["26g protein"],
    },
    informationHierarchy: [
      "Protein benefit",
      "Product name",
      "Flavor",
      "CTA",
    ],
    allowedClaims: ["26g protein"],
    forbiddenClaims: ["Clinically proven"],
    restrictedClaims: [],
    requiredDisclaimers: [],
    ...overrides,
  };
}

const product: Product = {
  product_name: "Yoga Bar High Protein Oats",
  price: "₹999",
  description: "Protein-packed oats",
  key_benefits: ["26g protein", "No added sugar"],
  product_images: ["https://cdn.example.com/oats.png"],
  target_audience: "Fitness adults",
  emotional_angles: [],
  use_cases: ["Breakfast"],
  short_benefit: "26g protein breakfast",
  category: "food",
};

const brand: BrandSnapshot = {
  name: "Yoga Bar",
  description: "Nutrition",
  audience: "Fitness-minded adults",
  offering: "Protein foods",
  tone: "energetic",
  primaryColors: ["#2D5A27"],
};

function makeBrief(userInstruction: string, extras?: Partial<CreativeBrief>): CreativeBrief {
  const resolved = resolvePosterContext({
    catalogProduct: product,
    brandSnapshot: brand,
  });
  return {
    id: "brief_1",
    createdAt: new Date().toISOString(),
    brand: {
      snapshot: brand,
      name: brand.name,
      logo: null,
      primaryColors: brand.primaryColors || [],
      fonts: null,
      tone: brand.tone,
      voice: null,
      industry: null,
      audience: brand.audience,
      tagline: null,
      coreValueProp: null,
      aestheticTags: [],
      values: [],
      guidelinesApplied: true,
    },
    product: {
      source: "catalog",
      name: product.product_name,
      description: product.description,
      shortBenefit: product.short_benefit,
      category: product.category,
      benefits: product.key_benefits,
      factualClaims: ["26g protein", "No added sugar"],
      features: [],
      price: product.price,
      productUrl: null,
      brandName: "Yoga Bar",
      targetAudience: product.target_audience,
      emotionalAngles: [],
      useCases: product.use_cases,
      images: resolved.productContext.images,
      catalogProduct: product,
    },
    userInstruction,
    visualDirection: "commercial",
    aspectRatio: "4:5",
    variantCount: 1,
    constraints: [],
    productReferences: [],
    designReferences: [],
    supportingReferences: [],
    ...extras,
  };
}

async function run() {
  // 1. product launch
  const launch = await generateMarketingStrategy(
    strategistInputFromBrief(
      makeBrief("Create a product launch poster for these protein oats.")
    ),
    { generator: new MockGenerator(baseModelStrategy()) }
  );
  assert(launch.objective === "product_launch", "launch objective");
  assert(launch.primaryMessage.length > 0, "primary message");
  assert(!/lighting|typography|composition/i.test(launch.rationale), "no visual leak");

  // 2. seasonal
  const seasonal = await generateMarketingStrategy(
    strategistInputFromBrief(
      makeBrief("Create a festive Christmas promotion for this protein oats product.")
    ),
    {
      generator: new MockGenerator(
        baseModelStrategy({
          objective: "seasonal_campaign",
          communicationAngle: "seasonal relevance",
          emotionalDirection: "delight",
          copy: {
            headline: "26G PROTEIN",
            supporting: "Holiday mornings, upgraded",
            productLine: "Yoga Bar High Protein Oats",
            cta: "Shop now",
            badges: ["26g protein"],
          },
        })
      ),
    }
  );
  assert(seasonal.objective === "seasonal_campaign", "seasonal objective");

  // 3. sale
  const sale = await generateMarketingStrategy(
    strategistInputFromBrief(makeBrief("Weekend sale — promote our new burger offer.")),
    {
      generator: new MockGenerator(
        baseModelStrategy({
          objective: "sale",
          communicationAngle: "urgency",
          primaryMessage: "Limited weekend burger promotion",
          copy: {
            headline: "WEEKEND SPECIAL",
            supporting: null,
            productLine: null,
            cta: "Order now",
            badges: [],
          },
          allowedClaims: [],
        })
      ),
    }
  );
  assert(sale.objective === "sale", "sale objective");
  assert(sale.copy.cta === "Order now", "sale cta");

  // 4. education / awareness — CTA may be null
  const edu = await generateMarketingStrategy(
    strategistInputFromBrief(
      makeBrief("Create an educational poster explaining the AI analytics feature.")
    ),
    {
      generator: new MockGenerator(
        baseModelStrategy({
          objective: "education",
          communicationAngle: "clarity",
          primaryMessage: "Understand the new AI analytics capability",
          copy: {
            headline: "AI ANALYTICS, EXPLAINED",
            supporting: "See what changed",
            productLine: null,
            cta: null,
            badges: [],
          },
          allowedClaims: [],
        })
      ),
    }
  );
  assert(edu.objective === "education", "education");
  assert(edu.copy.cta == null, "edu may omit CTA");

  // 5. explicit headline override
  const withHeadline = makeBrief(
    'Headline must say: "Fuel Your Morning." Create a launch poster.'
  );
  const overrides = detectUserOverrides(withHeadline);
  assert(overrides.headline === "Fuel Your Morning.", "detect headline");
  const forced = await generateMarketingStrategy(
    strategistInputFromBrief(withHeadline),
    {
      generator: new MockGenerator(
        baseModelStrategy({
          copy: {
            headline: "WRONG HEADLINE",
            supporting: null,
            productLine: null,
            cta: "Discover now",
            badges: ["26g protein"],
          },
        })
      ),
    }
  );
  assert(forced.copy.headline === "Fuel Your Morning.", "override preserved");
  assert(forced.userOverrides.headline === "Fuel Your Morning.", "override recorded");

  // 6. explicit CTA
  const withCta = makeBrief('CTA must say: "Try today" for this launch.');
  const ctaStrat = await generateMarketingStrategy(
    strategistInputFromBrief(withCta),
    {
      generator: new MockGenerator(
        baseModelStrategy({
          copy: {
            headline: "26G PROTEIN",
            supporting: null,
            productLine: null,
            cta: "Buy now",
            badges: [],
          },
        })
      ),
    }
  );
  assert(ctaStrat.copy.cta === "Try today", "cta override");

  // 7. unsupported claims stripped
  const dirty = repairStrategyClaims(
    {
      ...forced,
      allowedClaims: ["26g protein", "Clinically proven", "Build muscle faster"],
      copy: { ...forced.copy, badges: ["26g protein", "Clinically proven"] },
    },
    strategistInputFromBrief(makeBrief("x")).product
  );
  assert(!dirty.allowedClaims.includes("Clinically proven"), "strip clinical");
  assert(!dirty.allowedClaims.includes("Build muscle faster"), "strip muscle");
  assert(dirty.forbiddenClaims.some((f) => /clinically/i.test(f)), "forbidden list");

  // 8. inferred category must not become hard claim alone — repair leaves factual only
  assert(dirty.allowedClaims.includes("26g protein"), "keep factual");

  // 9. missing brand still works
  const noBrandBrief = makeBrief("Promote this face wash for summer.", {
    brand: {
      snapshot: null,
      primaryColors: [],
      aestheticTags: [],
      values: [],
      guidelinesApplied: false,
    },
  });
  const beauty = await generateMarketingStrategy(
    strategistInputFromBrief(noBrandBrief),
    {
      generator: new MockGenerator(
        baseModelStrategy({
          objective: "product_promotion",
          audience: "Skincare consumers",
          primaryMessage: "Summer-ready face wash promotion",
          communicationAngle: "seasonal relevance",
          allowedClaims: [],
          copy: {
            headline: "SUMMER SKIN READY",
            supporting: null,
            productLine: null,
            cta: "Shop now",
            badges: [],
          },
        })
      ),
    }
  );
  assert(beauty.objective === "product_promotion", "beauty promo");

  // 10. audience from brand when not overridden
  assert(launch.audience.toLowerCase().includes("fitness"), "audience grounded");

  // 11. audience hint from brief
  const audBrief = makeBrief("Promote oats", {
    audienceHint: "Busy professionals",
  });
  const aud = await generateMarketingStrategy(strategistInputFromBrief(audBrief), {
    generator: new MockGenerator(
      baseModelStrategy({ audience: "Wrong audience" })
    ),
  });
  assert(aud.audience === "Busy professionals", "audience hint wins");

  // 12. validation rejects visual leaks
  const visualLeak: MarketingStrategy = {
    ...forced,
    rationale: "Use cinematic lighting and centered product composition",
  };
  const v = validateMarketingStrategy(
    visualLeak,
    strategistInputFromBrief(makeBrief("x")).product
  );
  assert(!v.ok, "visual leak fails validation");

  // 13. malformed model → error
  let malformed = false;
  try {
    await generateMarketingStrategy(strategistInputFromBrief(makeBrief("x")), {
      generator: {
        modelId: "bad",
        async generateJson() {
          return { data: null as any, model: "bad", rawText: "null" };
        },
      },
    });
  } catch (e) {
    malformed = e instanceof PosterStrategyError;
  }
  assert(malformed, "malformed output throws");

  // 14–15. session persistence + idempotency
  const repo = new MemoryRepo();
  const sessionService = new PosterGenerationSessionService(repo);
  let session = createEmptyPosterSession({
    id: "sess_strat",
    userId: "user_1",
  });
  session = await sessionService.createSession({
    userId: "user_1",
    id: "sess_strat",
  });
  // manually attach brief via updateBrief
  session = await sessionService.updateBrief(
    session.id,
    "user_1",
    makeBrief("Create a product launch poster for these protein oats.")
  );

  const first = await runMarketingStrategyForSession({
    sessionId: session.id,
    userId: "user_1",
    sessionService,
    generator: new MockGenerator(baseModelStrategy()),
  });
  assert(first.reused === false, "first generation");
  assert(first.session.status === "strategy_ready", "status strategy_ready");
  assert(first.session.strategy?.id === first.strategy.id, "persisted");

  const second = await runMarketingStrategyForSession({
    sessionId: session.id,
    userId: "user_1",
    sessionService,
    generator: new MockGenerator(
      baseModelStrategy({ primaryMessage: "SHOULD NOT REPLACE" })
    ),
  });
  assert(second.reused === true, "idempotent reuse");
  assert(
    second.strategy.primaryMessage !== "SHOULD NOT REPLACE",
    "did not regenerate"
  );

  const forcedRegen = await runMarketingStrategyForSession({
    sessionId: session.id,
    userId: "user_1",
    forceRegenerate: true,
    sessionService,
    generator: new MockGenerator(
      baseModelStrategy({ primaryMessage: "Regenerated message" })
    ),
  });
  assert(forcedRegen.reused === false, "force regenerate");
  assert(
    forcedRegen.strategy.primaryMessage === "Regenerated message",
    "new strategy"
  );

  // 16. missing brief
  const emptySess = await sessionService.createSession({
    userId: "user_1",
    studioSessionId: "studio_empty_brief",
  });
  let missingBrief = false;
  try {
    await runMarketingStrategyForSession({
      sessionId: emptySess.id,
      userId: "user_1",
      sessionService,
      generator: new MockGenerator(baseModelStrategy()),
    });
  } catch (e) {
    missingBrief =
      e instanceof PosterStrategyError && e.code === "MISSING_BRIEF";
  }
  assert(missingBrief, "missing brief errors");

  // Cross-sector objectives differ
  assert(
    String(launch.objective) !== String(seasonal.objective),
    "launch ≠ seasonal"
  );
  assert(sale.communicationAngle === "urgency", "sale urgency angle");
  assert(edu.communicationAngle === "clarity", "edu clarity angle");

  console.log("poster-generation strategist.test.ts: PASS");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
