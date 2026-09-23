/**
 * Phase 5 Creative Concept Engine tests (mocked StructuredGenerator).
 * Run: node --import tsx lib/creative-studio/poster-generation/concept/director.test.ts
 */

import type {
  StructuredGenerationRequest,
  StructuredGenerationResult,
  StructuredGenerator,
} from "@/lib/creative-studio/commercial-production/commercial-director/llm";
import { StructuredGenerationError } from "@/lib/creative-studio/commercial-production/commercial-director/llm";
import type {
  CreativeBrief,
  CreativeConcept,
  CreativeDNA,
  MarketingStrategy,
  PosterGenerationSession,
  PosterProductContext,
} from "../types";
import {
  PosterGenerationSessionService,
  type PosterGenerationSessionRepository,
} from "../session";
import { generateCreativeConcepts } from "./director";
import { validateConceptDiversity } from "./diversity";
import { PosterConceptError } from "./concept-errors";
import {
  runCreativeConceptsForSession,
  selectConceptForSession,
} from "./run-for-session";
import { directorInputFromSession } from "./from-session";
import { normalizeConceptsRaw, validateConceptSet } from "./concept-validation";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

class MockGenerator implements StructuredGenerator {
  readonly modelId = "mock-concept";
  private queue: Array<unknown | Error> = [];

  constructor(responses: Array<unknown | Error>) {
    this.queue = [...responses];
  }

  async generateJson<T>(
    _request: StructuredGenerationRequest
  ): Promise<StructuredGenerationResult<T>> {
    const next = this.queue.shift();
    if (next === undefined) {
      throw new StructuredGenerationError("No more mock responses");
    }
    if (next instanceof Error) throw next;
    return {
      data: next as T,
      model: this.modelId,
      rawText: JSON.stringify(next),
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

function sampleProduct(overrides: Partial<PosterProductContext> = {}): PosterProductContext {
  return {
    source: "catalog",
    name: "Dark Chocolate Protein Oats",
    description: "High-protein breakfast oats",
    shortBenefit: "26g protein breakfast",
    category: "Food & Beverage",
    benefits: ["Convenient breakfast"],
    factualClaims: ["26g protein", "Dark chocolate"],
    features: ["Oats"],
    emotionalAngles: [],
    useCases: ["Breakfast"],
    images: [],
    brandName: "FuelCo",
    ...overrides,
  };
}

function makeBrief(
  instruction: string,
  opts: Partial<CreativeBrief> = {}
): CreativeBrief {
  return {
    id: "brief_1",
    createdAt: new Date().toISOString(),
    brand: {
      snapshot: null,
      name: "FuelCo",
      primaryColors: ["#1a5"],
      aestheticTags: [],
      values: [],
      guidelinesApplied: false,
      audience: "Active breakfast consumers",
      industry: "Food",
    },
    product: sampleProduct(),
    userInstruction: instruction,
    visualDirection: "premium",
    aspectRatio: "4:5",
    variantCount: 3,
    constraints: [],
    productReferences: [],
    designReferences: [],
    supportingReferences: [],
    ...opts,
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
    valueProposition: "Indulgent-feeling breakfast with high protein content",
    emotionalDirection: "confidence",
    rationale: "Lead with protein differentiator for launch discovery",
    supportingMessages: ["Dark chocolate flavor"],
    copy: {
      headline: "26G PROTEIN",
      supporting: "Start your morning stronger",
      productLine: "Dark Chocolate Protein Oats",
      cta: "Discover now",
      badges: ["26g protein"],
    },
    informationHierarchy: ["Benefit", "Product", "CTA"],
    allowedClaims: ["26g protein", "Dark chocolate"],
    forbiddenClaims: ["Build muscle faster"],
    restrictedClaims: [],
    requiredDisclaimers: [],
    userOverrides: {},
    ...overrides,
  };
}

function conceptPayload(
  items: Array<{
    name: string;
    territory: string;
    humanPresence: string;
    productTreatment: string;
    composition: string;
    environment?: string;
    typographyTreatment?: string;
    subjectTreatment?: string;
  }>
) {
  return {
    concepts: items.map((item, i) => ({
      name: item.name,
      description: `${item.name} is a distinct creative idea for communicating the strategy through ${item.territory} storytelling.`,
      territory: item.territory,
      rationale: `Serves the strategy by framing ${item.name.toLowerCase()} around the primary message.`,
      visualStory: `Viewer understands the product through a ${item.name} narrative.`,
      composition: item.composition,
      subjectTreatment: item.subjectTreatment || `${item.name} subject focus`,
      productTreatment: item.productTreatment,
      environment: item.environment || "Contextual environment matching the idea",
      humanPresence: item.humanPresence,
      emotionalExpression: "Confidence",
      cameraDirection: "Natural vantage for the idea",
      typographyTreatment:
        item.typographyTreatment || "Clear headline with restrained support",
      colorTreatment: "Emerges from concept and brand accents",
      graphicLanguage: "Restrained marks with purpose",
      supportingElements: "Only elements that serve the idea",
      copyHierarchy: "Headline → product line → CTA",
      ctaTreatment: "Quiet lower CTA from strategy",
      visualDirectionExpression: "Premium as refined control, not black/gold cliché",
      differentiation: `${item.name}: unique ${item.territory} route`,
      dna: {
        composition: item.composition,
        subjectTreatment: item.subjectTreatment || `${item.name} subject`,
        productTreatment: item.productTreatment,
        photographyStyle: "Direction matching concept",
        lighting: "Supports mood",
        colorStrategy: "Brand-aware, concept-led",
        typographyStrategy: item.typographyTreatment || "Clear hierarchy",
        graphicLanguage: "Restrained",
        humanPresence: item.humanPresence,
        environment: item.environment || "Contextual",
        mood: "Confident",
        hierarchy: "Message → product → CTA",
        visualRhythm: "Clear primary beat",
        aspectAwareNotes: "4:5 aware stacking",
      },
    })),
  };
}

const DIVERSE_3 = conceptPayload([
  {
    name: "Morning Ritual",
    territory: "lifestyle",
    humanPresence: "hands only",
    productTreatment: "integrated into breakfast scene",
    composition: "asymmetric editorial breakfast",
    environment: "morning kitchen",
    subjectTreatment: "human ritual focus",
  },
  {
    name: "Protein Hero",
    territory: "product_hero",
    humanPresence: "none",
    productTreatment: "hero packshot dominant",
    composition: "centered hero with negative space",
    environment: "clean commercial studio",
    subjectTreatment: "product focus",
  },
  {
    name: "Editorial Breakfast",
    territory: "editorial",
    humanPresence: "implied",
    productTreatment: "contextual midground",
    composition: "typography-led asymmetric crop",
    environment: "magazine still-life table",
    typographyTreatment: "large editorial headline dominant",
    subjectTreatment: "type and still-life focus",
  },
]);

const SAMEY_3 = conceptPayload([
  {
    name: "Hero A",
    territory: "product_hero",
    humanPresence: "none",
    productTreatment: "hero packshot",
    composition: "centered product",
    environment: "blue gradient",
  },
  {
    name: "Hero B",
    territory: "product_hero",
    humanPresence: "none",
    productTreatment: "hero packshot",
    composition: "centered product",
    environment: "green gradient",
  },
  {
    name: "Hero C",
    territory: "product_hero",
    humanPresence: "none",
    productTreatment: "hero packshot",
    composition: "centered product",
    environment: "darker gradient",
  },
]);

async function run() {
  // --- Diversity unit tests (explicit fail / pass) ---
  const badNorm = normalizeConceptsRaw(SAMEY_3, {
    briefId: "brief_1",
    strategyId: "strat_1",
    createdAt: new Date().toISOString(),
    conceptCount: 3,
  });
  const badDiv = validateConceptDiversity(badNorm.concepts);
  assert(!badDiv.ok, "samey product-hero trio must fail diversity");

  const goodNorm = normalizeConceptsRaw(DIVERSE_3, {
    briefId: "brief_1",
    strategyId: "strat_1",
    createdAt: new Date().toISOString(),
    conceptCount: 3,
  });
  const goodDiv = validateConceptDiversity(goodNorm.concepts);
  assert(goodDiv.ok, "lifestyle / product_hero / editorial must pass diversity");

  // --- Count 1 / 2 / 3 ---
  const brief = makeBrief("Create a product launch poster for these protein oats.");
  const strategy = makeStrategy();

  const one = await generateCreativeConcepts(
    directorInputFromSession({ brief, strategy, conceptCount: 1 }),
    {
      generator: new MockGenerator([
        conceptPayload([
          {
            name: "Protein Hero",
            territory: "product_hero",
            humanPresence: "none",
            productTreatment: "hero packshot dominant",
            composition: "centered hero",
          },
        ]),
      ]),
    }
  );
  assert(one.concepts.length === 1, "one concept");
  assert(one.dnaByConceptId[one.concepts[0].id], "dna for one");

  const two = await generateCreativeConcepts(
    directorInputFromSession({ brief, strategy, conceptCount: 2 }),
    {
      generator: new MockGenerator([
        conceptPayload([
          {
            name: "Morning Ritual",
            territory: "lifestyle",
            humanPresence: "partial",
            productTreatment: "integrated",
            composition: "asymmetric lifestyle",
            environment: "kitchen",
          },
          {
            name: "Protein Hero",
            territory: "product_hero",
            humanPresence: "none",
            productTreatment: "hero",
            composition: "centered hero",
            environment: "studio",
          },
        ]),
      ]),
    }
  );
  assert(two.concepts.length === 2, "two concepts");
  assert(
    two.concepts[0].territory !== two.concepts[1].territory,
    "two territories differ"
  );

  const three = await generateCreativeConcepts(
    directorInputFromSession({ brief, strategy, conceptCount: 3 }),
    { generator: new MockGenerator([DIVERSE_3]) }
  );
  assert(three.concepts.length === 3, "three concepts");
  assert(
    new Set(three.concepts.map((c) => c.territory)).size === 3,
    "three unique territories"
  );

  // --- Territory flavors ---
  assert(
    three.concepts.some((c) => c.territory === "lifestyle"),
    "lifestyle present"
  );
  assert(
    three.concepts.some((c) => c.territory === "product_hero"),
    "product hero present"
  );
  assert(
    three.concepts.some((c) => c.territory === "editorial"),
    "editorial present"
  );

  // --- Graphic / seasonal ---
  const seasonalBrief = makeBrief(
    "Create a festive Christmas promotion for this protein oats product.",
    { visualDirection: "festive", variantCount: 2 }
  );
  const seasonalStrat = makeStrategy({
    id: "strat_seasonal",
    objective: "seasonal_campaign",
    communicationAngle: "seasonal relevance",
  });
  const seasonal = await generateCreativeConcepts(
    directorInputFromSession({
      brief: seasonalBrief,
      strategy: seasonalStrat,
      conceptCount: 2,
    }),
    {
      generator: new MockGenerator([
        conceptPayload([
          {
            name: "Christmas Morning Table",
            territory: "seasonal",
            humanPresence: "hands only",
            productTreatment: "integrated",
            composition: "asymmetric tabletop",
            environment: "festive breakfast table",
          },
          {
            name: "Gift of Protein",
            territory: "graphic",
            humanPresence: "none",
            productTreatment: "hero",
            composition: "typography-led graphic field",
            environment: "abstract festive graphic",
            typographyTreatment: "bold graphic offer headline",
          },
        ]),
      ]),
    }
  );
  assert(seasonal.concepts.some((c) => c.territory === "seasonal"), "seasonal");
  assert(seasonal.concepts.some((c) => c.territory === "graphic"), "graphic");

  // --- Beauty / SaaS / food prompts still produce concepts ---
  const beauty = await generateCreativeConcepts(
    directorInputFromSession({
      brief: makeBrief(
        "Promote this face wash for a summer skincare campaign.",
        {
          product: sampleProduct({
            name: "Glow Face Wash",
            category: "Beauty",
            factualClaims: ["Gentle cleanser"],
          }),
          visualDirection: "minimal",
          variantCount: 1,
        }
      ),
      strategy: makeStrategy({
        id: "strat_beauty",
        objective: "product_promotion",
        primaryMessage: "A gentle summer skincare cleanse",
        copy: {
          headline: "SUMMER SKIN READY",
          supporting: null,
          productLine: "Glow Face Wash",
          cta: "Shop now",
          badges: [],
        },
      }),
      conceptCount: 1,
    }),
    {
      generator: new MockGenerator([
        conceptPayload([
          {
            name: "Morning Skincare Ritual",
            territory: "lifestyle",
            humanPresence: "partial",
            productTreatment: "handheld",
            composition: "asymmetric bathroom ritual",
            environment: "bright bathroom vanity",
          },
        ]),
      ]),
    }
  );
  assert(beauty.concepts[0].environment.toLowerCase().includes("bathroom"), "beauty env");

  const saas = await generateCreativeConcepts(
    directorInputFromSession({
      brief: makeBrief("Announce our new AI analytics feature.", {
        product: sampleProduct({
          name: "Insight AI",
          category: "SaaS",
          factualClaims: ["AI analytics"],
        }),
        variantCount: 1,
      }),
      strategy: makeStrategy({
        id: "strat_saas",
        objective: "announcement",
        primaryMessage: "New AI analytics capability",
        copy: {
          headline: "AI ANALYTICS, NOW LIVE",
          supporting: null,
          productLine: "Insight AI",
          cta: "Learn more",
          badges: [],
        },
      }),
      conceptCount: 1,
    }),
    {
      generator: new MockGenerator([
        conceptPayload([
          {
            name: "Workflow Clarity",
            territory: "demonstration",
            humanPresence: "none",
            productTreatment: "contextual UI focal",
            composition: "typography-led with UI vignette",
            environment: "professional workflow desk",
            subjectTreatment: "feature/UI focus",
          },
        ]),
      ]),
    }
  );
  assert(saas.concepts[0].territory === "demonstration", "saas demo territory");

  // --- Missing brand / sparse product ---
  const sparse = await generateCreativeConcepts(
    directorInputFromSession({
      brief: makeBrief("Promote the product.", {
        brand: {
          snapshot: null,
          primaryColors: [],
          aestheticTags: [],
          values: [],
          guidelinesApplied: false,
        },
        product: {
          source: "upload",
          name: "",
          benefits: [],
          factualClaims: [],
          features: [],
          emotionalAngles: [],
          useCases: [],
          images: [{ url: "https://example.com/p.png" }],
        },
        variantCount: 1,
      }),
      strategy: makeStrategy({
        id: "strat_sparse",
        primaryMessage: "Discover the product",
        allowedClaims: [],
        copy: {
          headline: "DISCOVER",
          supporting: null,
          productLine: null,
          cta: null,
          badges: [],
        },
      }),
      conceptCount: 1,
    }),
    {
      generator: new MockGenerator([
        conceptPayload([
          {
            name: "Quiet Product Presence",
            territory: "product_hero",
            humanPresence: "none",
            productTreatment: "hero",
            composition: "negative-space centered",
            environment: "simple studio field",
          },
        ]),
      ]),
    }
  );
  assert(sparse.concepts.length === 1, "sparse product still generates");

  // --- Visual direction as modifier (premium preserved in expression) ---
  assert(
    three.concepts.every((c) => c.visualDirectionExpression.length > 0),
    "visual direction expression set"
  );
  assert(
    three.concepts.every(
      (c) => !/^(premium|minimal|bold)$/i.test(c.name.trim())
    ),
    "names are not style tags"
  );

  // --- Reference poster inspiration note path (still valid concepts) ---
  const withRef = await generateCreativeConcepts(
    directorInputFromSession({
      brief: makeBrief("Editorial launch with reference poster.", {
        designReferences: [
          {
            id: "ref_1",
            role: "design_inspiration",
            image: { url: "https://example.com/ref.jpg" },
            designAnalysis: {
              composition: "asymmetric magazine crop",
              layout: "type heavy top",
              typography: "editorial serif headline",
              colorStrategy: "muted earth",
              imagery: "still life",
              graphicLanguage: "thin rules",
              hierarchy: "type then product",
              spacing: "generous",
              visualTreatment: "matte",
              designMechanism: "crop + type",
              avoid: ["exact layout copy"],
            },
          },
        ],
        productReferences: [
          {
            id: "prod_ref",
            role: "product_packshot",
            image: { url: "https://example.com/pack.png" },
          },
        ],
        variantCount: 1,
      }),
      strategy: makeStrategy({ id: "strat_ref" }),
      conceptCount: 1,
    }),
    {
      generator: new MockGenerator([
        conceptPayload([
          {
            name: "Magazine Still",
            territory: "editorial",
            humanPresence: "none",
            productTreatment: "contextual",
            composition: "asymmetric editorial",
            typographyTreatment: "large editorial headline",
          },
        ]),
      ]),
    }
  );
  assert(withRef.concepts[0].territory === "editorial", "ref-informed editorial");

  // --- Quality validation ---
  const quality = validateConceptSet(
    three.concepts,
    three.dnaByConceptId,
    strategy
  );
  assert(quality.ok, "diverse set quality ok");

  // --- Insufficient diversity with retry then fail ---
  let diversityFailed = false;
  try {
    await generateCreativeConcepts(
      directorInputFromSession({ brief, strategy, conceptCount: 3 }),
      {
        generator: new MockGenerator([SAMEY_3, SAMEY_3, SAMEY_3]),
        maxDiversityRetries: 2,
      }
    );
  } catch (e) {
    diversityFailed =
      e instanceof PosterConceptError && e.code === "INSUFFICIENT_DIVERSITY";
  }
  assert(diversityFailed, "samey set eventually fails diversity");

  // --- Diversity repair succeeds on retry ---
  const repaired = await generateCreativeConcepts(
    directorInputFromSession({ brief, strategy, conceptCount: 3 }),
    {
      generator: new MockGenerator([SAMEY_3, DIVERSE_3]),
      maxDiversityRetries: 2,
    }
  );
  assert(repaired.concepts.length === 3, "repaired after diversity fail");

  // --- Malformed output ---
  let malformed = false;
  try {
    await generateCreativeConcepts(
      directorInputFromSession({ brief, strategy, conceptCount: 1 }),
      {
        generator: new MockGenerator([{ nope: true }, { nope: true }, { nope: true }]),
        maxDiversityRetries: 2,
      }
    );
  } catch (e) {
    malformed =
      e instanceof PosterConceptError &&
      (e.code === "MALFORMED_MODEL_OUTPUT" || e.code === "VALIDATION");
  }
  assert(malformed, "malformed model output errors");

  // --- Provider failure ---
  let providerFail = false;
  try {
    await generateCreativeConcepts(
      directorInputFromSession({ brief, strategy, conceptCount: 1 }),
      {
        generator: new MockGenerator([
          new StructuredGenerationError("provider down"),
        ]),
      }
    );
  } catch (e) {
    providerFail =
      e instanceof PosterConceptError && e.code === "PROVIDER";
  }
  assert(providerFail, "provider failure mapped");

  // --- Strategy mismatch ---
  let stale = false;
  try {
    await generateCreativeConcepts(
      directorInputFromSession({
        brief,
        strategy: makeStrategy({ id: "strat_x", briefId: "other_brief" }),
        conceptCount: 1,
      }),
      { generator: new MockGenerator([DIVERSE_3]) }
    );
  } catch (e) {
    stale = e instanceof PosterConceptError && e.code === "STALE_STRATEGY";
  }
  assert(stale, "strategy/brief mismatch");

  // --- Session persistence, selection, idempotency, force regen, stale strategy ---
  const repo = new MemoryRepo();
  const sessionService = new PosterGenerationSessionService(repo);
  let session = await sessionService.createSession({
    userId: "user_1",
    id: "sess_concepts",
  });
  session = await sessionService.updateBrief("sess_concepts", "user_1", brief);
  session = await sessionService.updateStrategy(
    "sess_concepts",
    "user_1",
    strategy
  );

  const firstRun = await runCreativeConceptsForSession({
    sessionId: "sess_concepts",
    userId: "user_1",
    conceptCount: 3,
    sessionService,
    generator: new MockGenerator([DIVERSE_3]),
  });
  assert(!firstRun.reused, "first generate not reused");
  assert(firstRun.session.status === "concepts_ready", "concepts_ready");
  assert(firstRun.concepts.length === 3, "persisted 3");

  const secondRun = await runCreativeConceptsForSession({
    sessionId: "sess_concepts",
    userId: "user_1",
    conceptCount: 3,
    sessionService,
    generator: new MockGenerator([
      // should not be called
      conceptPayload([
        {
          name: "Should Not Run",
          territory: "graphic",
          humanPresence: "none",
          productTreatment: "hero",
          composition: "centered",
        },
      ]),
    ]),
  });
  assert(secondRun.reused, "idempotent reuse");
  assert(
    secondRun.concepts[0].id === firstRun.concepts[0].id,
    "same concept ids on reuse"
  );

  const forced = await runCreativeConceptsForSession({
    sessionId: "sess_concepts",
    userId: "user_1",
    conceptCount: 3,
    forceRegenerate: true,
    sessionService,
    generator: new MockGenerator([
      conceptPayload([
        {
          name: "Ingredient Spotlight",
          territory: "ingredient_feature",
          humanPresence: "none",
          productTreatment: "ingredient-associated",
          composition: "split composition",
          environment: "ingredient table",
          subjectTreatment: "feature focus",
        },
        {
          name: "Social Proof Bowl",
          territory: "social_proof",
          humanPresence: "implied",
          productTreatment: "contextual",
          composition: "asymmetric",
          environment: "kitchen review moment",
        },
        {
          name: "Demo Pour",
          territory: "demonstration",
          humanPresence: "hands only",
          productTreatment: "handheld",
          composition: "action hierarchy",
          environment: "breakfast prep",
        },
      ]),
    ]),
  });
  assert(!forced.reused, "force regenerate");
  assert(
    forced.concepts[0].name === "Ingredient Spotlight",
    "new concepts after force"
  );

  const selected = await selectConceptForSession({
    sessionId: "sess_concepts",
    userId: "user_1",
    conceptIds: forced.concepts[1].id,
    sessionService,
  });
  assert(
    selected.selectedConceptIds[0] === forced.concepts[1].id,
    "select by stable id"
  );

  // Strategy change clears concepts
  const newStrat = makeStrategy({ id: "strat_2", objective: "sale" });
  session = await sessionService.updateStrategy(
    "sess_concepts",
    "user_1",
    newStrat
  );
  assert(session.concepts.length === 0, "concepts cleared on strategy change");
  assert(session.selectedConceptIds.length === 0, "selection cleared");

  const afterNewStrat = await runCreativeConceptsForSession({
    sessionId: "sess_concepts",
    userId: "user_1",
    conceptCount: 2,
    sessionService,
    generator: new MockGenerator([
      conceptPayload([
        {
          name: "Offer Urgency",
          territory: "graphic",
          humanPresence: "none",
          productTreatment: "hero",
          composition: "typography-led",
          typographyTreatment: "bold graphic offer headline",
        },
        {
          name: "Kitchen Deal Moment",
          territory: "lifestyle",
          humanPresence: "partial",
          productTreatment: "integrated",
          composition: "asymmetric",
          environment: "kitchen",
        },
      ]),
    ]),
  });
  assert(
    afterNewStrat.concepts.every((c) => c.strategyId === "strat_2"),
    "concepts bound to new strategy"
  );

  // Missing strategy error
  const emptyRepo = new MemoryRepo();
  const emptyService = new PosterGenerationSessionService(emptyRepo);
  let emptySess = await emptyService.createSession({
    userId: "user_1",
    id: "sess_empty",
  });
  emptySess = await emptyService.updateBrief(
    "sess_empty",
    "user_1",
    makeBrief("x", { variantCount: 1 })
  );
  let missingStrat = false;
  try {
    await runCreativeConceptsForSession({
      sessionId: emptySess.id,
      userId: "user_1",
      sessionService: emptyService,
      generator: new MockGenerator([DIVERSE_3]),
    });
  } catch (e) {
    missingStrat =
      e instanceof PosterConceptError && e.code === "MISSING_STRATEGY";
  }
  assert(missingStrat, "missing strategy errors");

  // DNA structure present
  for (const c of three.concepts) {
    const dna: CreativeDNA = three.dnaByConceptId[c.id];
    assert(dna.visualRhythm.length > 0, "visualRhythm set");
    assert(dna.visualTerritory === c.territory, "dna territory aligned");
  }

  // Concept fields present
  for (const c of three.concepts as CreativeConcept[]) {
    assert(c.description.length > 10, "description");
    assert(c.differentiation.length > 5, "differentiation");
    assert(c.emotionalExpression.length > 0, "emotionalExpression");
    assert(c.graphicLanguage.length > 0, "graphicLanguage");
    assert(c.subjectTreatment.length > 0, "subjectTreatment");
  }

  console.log("poster-generation director.test.ts: PASS");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
