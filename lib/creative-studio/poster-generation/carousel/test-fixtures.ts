/**
 * Test fixtures for carousel tests (not imported by production code).
 */

import sharp from "sharp";
import type {
  StructuredGenerationRequest,
  StructuredGenerationResult,
  StructuredGenerator,
} from "@/lib/creative-studio/commercial-production/commercial-director/llm";
import {
  PosterGenerationSessionService,
  type PosterGenerationSessionRepository,
} from "../session";
import type {
  CreativeBrief,
  CreativeConcept,
  CreativeDNA,
  ImageGenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
  MarketingStrategy,
  PosterGeneratedAsset,
  PosterGenerationSession,
  PosterQcResult,
} from "../types";
import type { PosterQcInput } from "../qc/qc-input";
import { InMemoryCarouselRepository } from "./repository";
import { PosterCarouselService, type CarouselServiceDeps } from "./service";

export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

export async function expectReject(
  fn: () => Promise<unknown>,
  code: string,
  msg: string
): Promise<void> {
  try {
    await fn();
  } catch (e) {
    const got = (e as { code?: string }).code;
    assert(got === code, `${msg} (expected ${code}, got ${got}: ${(e as Error).message})`);
    return;
  }
  throw new Error(`FAIL: ${msg} (expected rejection ${code})`);
}

export const USER = "11111111-1111-4111-8111-111111111111";
export const OTHER_USER = "22222222-2222-4222-8222-222222222222";
export const SESSION_ID = "33333333-3333-4333-8333-333333333333";

class MemorySessionRepo implements PosterGenerationSessionRepository {
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
    const next = { ...structuredClone(session), version: expectedVersion + 1, updatedAt: new Date().toISOString() };
    this.store.set(session.id, next);
    return structuredClone(next);
  }
}

export function makeBrief(overrides: Partial<CreativeBrief> = {}): CreativeBrief {
  return {
    id: "brief_1",
    createdAt: new Date().toISOString(),
    brand: {
      snapshot: null,
      name: "FuelCo",
      primaryColors: ["#113355"],
      aestheticTags: [],
      values: [],
      guidelinesApplied: false,
      logo: { url: "https://cdn.example.com/logo.png" },
    },
    product: {
      source: "catalog",
      name: "Dark Chocolate Protein Oats",
      description: "High-protein oats with real dark chocolate",
      shortBenefit: "26g protein",
      category: "Food",
      benefits: ["Keeps you full through the morning", "Ready in three minutes"],
      factualClaims: ["26g protein", "Dark chocolate"],
      features: ["Resealable pouch", "Whole grain oats"],
      emotionalAngles: [],
      useCases: ["Breakfast", "Post-workout"],
      images: [{ url: "https://cdn.example.com/oats.png" }],
      brandName: "FuelCo",
    },
    userInstruction: "Create a product launch carousel for our new oats",
    visualDirection: "premium",
    aspectRatio: "4:5",
    variantCount: 1,
    constraints: [],
    productReferences: [
      { id: "pref_1", role: "product_packshot", image: { url: "https://cdn.example.com/oats.png" } },
    ],
    designReferences: [],
    supportingReferences: [],
    ...overrides,
  };
}

export function makeStrategy(overrides: Partial<MarketingStrategy> = {}): MarketingStrategy {
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
    allowedClaims: ["26g protein", "Dark chocolate"],
    forbiddenClaims: ["Build muscle faster"],
    restrictedClaims: [],
    requiredDisclaimers: [],
    userOverrides: {},
    ...overrides,
  };
}

export function makeConcept(id = "concept_1"): CreativeConcept {
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

export function makeDna(conceptId = "concept_1"): CreativeDNA {
  return {
    id: `dna_${conceptId}`,
    conceptId,
    visualTerritory: "lifestyle",
    composition: "Asymmetric breakfast",
    subjectTreatment: "Hands",
    productTreatment: "integrated",
    photographyStyle: "Natural light still life",
    lighting: "Window soft",
    colorStrategy: "Warm neutrals + brand navy accent",
    typographyStrategy: "Large editorial headline",
    graphicLanguage: "Minimal thin rules",
    humanPresence: "hands only",
    environment: "Kitchen",
    mood: "Calm confidence",
    hierarchy: "Story → product → type",
    visualRhythm: "Steady beat",
    aspectAwareNotes: "4:5 stack",
  };
}

export async function seedSession(opts: {
  strategy?: Partial<MarketingStrategy>;
  brief?: Partial<CreativeBrief>;
  userId?: string;
} = {}) {
  const repo = new MemorySessionRepo();
  const sessions = new PosterGenerationSessionService(repo);
  const userId = opts.userId ?? USER;
  await sessions.createSession({ userId, id: SESSION_ID });
  await sessions.updateBrief(SESSION_ID, userId, makeBrief(opts.brief));
  await sessions.updateStrategy(SESSION_ID, userId, makeStrategy(opts.strategy));
  const concept = makeConcept();
  await sessions.setConcepts(SESSION_ID, userId, [concept], { [concept.id]: makeDna(concept.id) });
  await sessions.selectConcept(SESSION_ID, userId, [concept.id]);
  return { repo, sessions, concept };
}

const ROLE_BANK = [
  { role: "hook", headline: "Breakfast just levelled up", supporting: "Meet the oats built for busy mornings.", composition: "Extreme close crop on the pouch corner with bold type block", territory: "editorial", product: "foreground" },
  { role: "protein_payoff", headline: "26g protein per bowl", supporting: "Fuel that keeps pace with your morning.", composition: "Centered bowl, overhead, large numeral typography", territory: "product_hero", product: "hero" },
  { role: "flavor_focus", headline: "Real dark chocolate taste", supporting: "Rich cocoa notes without the guilt trip.", composition: "Macro texture of oats and cocoa shavings, product off-axis", territory: "ingredient_feature", product: "ingredient-associated" },
  { role: "quick_prep", headline: "Ready in three minutes", supporting: "Stir, wait, enjoy — even on rushed days.", composition: "Split-frame sequence of kettle, spoon and bowl", territory: "demonstration", product: "contextual" },
  { role: "everyday_moment", headline: "Desk, gym bag or kitchen", supporting: "A pouch that goes where your day goes.", composition: "Wide environmental shot, product small in a tote bag", territory: "environment_story", product: "background" },
  { role: "whole_grain", headline: "Whole grain goodness inside", supporting: "Simple oats you can recognise.", composition: "Flat lay grid of grains and spoon, product lower third", territory: "graphic", product: "integrated" },
  { role: "resealable_pouch", headline: "Seal it, stash it", supporting: "The resealable pouch keeps every scoop fresh.", composition: "Hand pinching the zip seal, diagonal framing", territory: "demonstration", product: "handheld" },
  { role: "post_workout", headline: "Recovery breakfast sorted", supporting: "Post-workout bowls that actually taste good.", composition: "Gym bench still life with towel and bowl, low angle", territory: "lifestyle", product: "contextual" },
  { role: "routine_recap", headline: "One bowl, many mornings", supporting: "Protein, flavour and speed in one pouch.", composition: "Asymmetric typographic recap with small packshot", territory: "typography_led", product: "foreground" },
  { role: "close", headline: "Your new morning staple", supporting: null, composition: "Calm hero packshot, generous negative space, CTA lower right", territory: "product_hero", product: "hero" },
];

export function makePlanRaw(n: number, mutate?: (raw: any) => void): Record<string, unknown> {
  const middle = ROLE_BANK.slice(0, ROLE_BANK.length - 1).slice(0, n - 1);
  const picks = [...middle, ROLE_BANK[ROLE_BANK.length - 1]];
  const raw: any = {
    story: {
      objective: "launch",
      audience: "breakfast people",
      coreMessage: "A convenient high-protein breakfast option",
      narrativeStructure: "product_launch",
      narrativeRationale: "Introduce, prove the benefit, show life fit, close.",
      copyProgression: "Curiosity → benefit → use → action",
      ctaIntent: "drive discovery of the product",
    },
    sharedVisualSystem: {
      brandIdentity: "FuelCo wordmark top-left, never redrawn",
      palette: "Warm neutrals with a navy accent",
      typography: "Condensed editorial sans for headlines",
      photographyStyle: "Natural window light still life",
      graphicLanguage: "Thin navy rules and small caps labels",
      productRepresentation: "Exact pouch packshot",
      mood: "Calm confidence",
      visualHierarchy: "Headline, product, supporting",
      lighting: "Soft morning window light",
      recurringElements: ["Navy rule under headline", "Wordmark top-left"],
      consistencyRules: ["Same palette and type family on every slide"],
      permittedVariation: ["Composition", "Product scale"],
    },
    slides: picks.map((p, i) => ({
      role: p.role,
      objective: `Advance the launch story: ${p.headline.toLowerCase()}`,
      headline: p.headline,
      supporting: p.supporting,
      cta: i === picks.length - 1 ? "Discover now" : null,
      badges: [],
      claimsUsed: p.role === "protein_payoff" ? ["26g protein"] : [],
      concept: {
        name: `${p.role} idea`,
        description: `Slide concept for ${p.role}`,
        territory: p.territory,
        visualStory: `Visual story for ${p.role}`,
        composition: p.composition,
        subjectTreatment: `Subject treatment ${i}`,
        productTreatment: p.product,
        environment: `Environment ${i}`,
        humanPresence: i % 2 ? "hands only" : "none",
        cameraDirection: `Camera ${i}`,
        typographyTreatment: "Condensed editorial sans",
        copyHierarchy: "Headline → product",
        differentiation: `Differs by ${p.composition}`,
      },
    })),
  };
  mutate?.(raw);
  return raw;
}

export class ScriptedGenerator implements StructuredGenerator {
  readonly modelId = "scripted";
  calls: StructuredGenerationRequest[] = [];
  constructor(private responses: Array<Record<string, unknown> | Error>) {}
  async generateJson<T>(request: StructuredGenerationRequest): Promise<StructuredGenerationResult<T>> {
    this.calls.push(request);
    const next = this.responses.length > 1 ? this.responses.shift()! : this.responses[0];
    if (next instanceof Error) throw next;
    return { data: structuredClone(next) as T, model: this.modelId, rawText: JSON.stringify(next) };
  }
}

let pngCache: Buffer | null = null;
export async function tinyPng(): Promise<Buffer> {
  if (!pngCache) {
    pngCache = await sharp({ create: { width: 8, height: 10, channels: 3, background: "#ddeeff" } }).png().toBuffer();
  }
  return pngCache;
}

export type ProviderStep = "ok" | "fail" | "rate_limited" | "throw" | { delayMs: number };

export class MockCarouselProvider implements ImageGenerationProvider {
  readonly id = "mock_provider";
  modelId = "mock-model";
  calls: ImageGenerationRequest[] = [];
  available = true;
  inFlight = 0;
  maxInFlight = 0;
  constructor(private png: Buffer, private script: (call: number, req: ImageGenerationRequest) => ProviderStep = () => "ok", private delayMs = 0) {}
  getCapabilities() {
    return {
      supportsGenerate: true,
      supportsEdit: false,
      supportedAspectRatios: ["1:1", "4:5", "9:16", "1.91:1"] as Array<"1:1" | "4:5" | "9:16" | "1.91:1">,
      maxReferenceImages: 4,
      supportsReferenceImages: true,
      supportsInpainting: false,
    };
  }
  async checkAvailability() {
    return { available: this.available };
  }
  estimateCost() {
    return 1;
  }
  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    this.calls.push(request);
    const step = this.script(this.calls.length, request);
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      const delay = typeof step === "object" ? step.delayMs : this.delayMs;
      if (delay) await new Promise((r) => setTimeout(r, delay));
      if (step === "throw") throw new Error("provider exploded with secret sk-test-123");
      if (step === "fail" || step === "rate_limited") {
        return {
          ok: false,
          provider: this.id,
          model: this.modelId,
          estimatedCostCredits: 0,
          errorCode: step === "rate_limited" ? "RATE_LIMITED" : "PROVIDER_FAILED",
          errorMessage: "raw provider says: quota project-xyz",
          durationMs: 5,
        };
      }
      return {
        ok: true,
        imageDataUrl: `data:image/png;base64,${this.png.toString("base64")}`,
        imageBuffer: this.png,
        mimeType: "image/png",
        provider: this.id,
        model: this.modelId,
        durationMs: 5,
        estimatedCostCredits: 1,
        compiledPrompt: request.prompt,
      };
    } finally {
      this.inFlight -= 1;
    }
  }
  async edit(): Promise<ImageGenerationResult> {
    return { ok: false, provider: this.id, model: this.modelId, estimatedCostCredits: 0, errorCode: "UNSUPPORTED", errorMessage: "no edit" };
  }
}

export function passingQc(input: PosterQcInput, passed = true): PosterQcResult {
  return {
    id: `qc_${input.asset.generationId}`,
    generationId: input.asset.generationId,
    assetId: input.asset.id,
    createdAt: new Date().toISOString(),
    passed,
    decision: passed ? "accept" : "regenerate",
    status: passed ? "pass" : "fail",
    recommendedAction: passed ? "accept" : "regenerate",
    summary: passed ? "Looks good" : "Product label is distorted",
    confidence: 0.9,
    failureType: passed ? "none" : "generation_execution",
    checks: {} as PosterQcResult["checks"],
    score: null,
    issues: passed
      ? []
      : [{ id: "i1", category: "product", severity: "critical", code: "LABEL", message: "Product label is distorted" }],
    warnings: [],
    recommendedFixes: passed ? [] : ["Regenerate this slide"],
  } as PosterQcResult;
}

export async function makeHarness(opts: {
  balance?: number;
  generator?: StructuredGenerator;
  slideCountForPlan?: number;
  provider?: MockCarouselProvider;
  qc?: (input: PosterQcInput) => Promise<PosterQcResult>;
  failStorage?: (generationId: string) => boolean;
  deps?: Partial<CarouselServiceDeps>;
  strategy?: Partial<MarketingStrategy>;
  brief?: Partial<CreativeBrief>;
} = {}) {
  const png = await tinyPng();
  const seeded = await seedSession({ strategy: opts.strategy, brief: opts.brief });
  const repo = new InMemoryCarouselRepository({ [USER]: opts.balance ?? 20, [OTHER_USER]: 20 });
  const provider = opts.provider ?? new MockCarouselProvider(png);
  const stored = new Map<string, Buffer>();
  const qcCalls: PosterQcInput[] = [];
  const generator = opts.generator ?? new ScriptedGenerator([makePlanRaw(opts.slideCountForPlan ?? 3)]);
  const service = new PosterCarouselService({
    repo,
    sessions: seeded.sessions,
    provider,
    generator,
    runQc: async (input) => {
      qcCalls.push(input);
      return opts.qc ? opts.qc(input) : passingQc(input);
    },
    storeImage: async ({ userId, sessionId, generationId, buffer }) => {
      if (opts.failStorage?.(generationId)) throw new Error("storage down");
      const storagePath = `${userId}/poster/${sessionId}/${generationId}.png`;
      stored.set(storagePath, buffer);
      return { publicUrl: `https://storage.test/${storagePath}`, storagePath };
    },
    loadImage: async (asset: PosterGeneratedAsset) => (asset.storagePath ? stored.get(asset.storagePath) ?? null : null),
    getBalance: async (userId) => repo.balanceOf(userId),
    concurrency: 2,
    ...opts.deps,
  });
  return { service, repo, provider, stored, qcCalls, generator, png, sessions: seeded.sessions, concept: seeded.concept };
}
