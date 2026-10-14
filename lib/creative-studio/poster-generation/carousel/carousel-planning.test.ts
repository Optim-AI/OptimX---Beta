/**
 * Carousel planning tests: slide count, story validation/repair, shared visual
 * system, per-slide specs, campaign checks, zip format.
 * Run: node --import tsx lib/creative-studio/poster-generation/carousel/carousel-planning.test.ts
 */

import { buildImageGenerationRequest } from "../generation/nano-banana-prompt";
import { assertValidGenerationSpecification } from "../generation/specification-validation";
import { strategistInputFromBrief } from "../strategy/from-brief";
import { runCarouselCampaignChecks } from "./campaign-checks";
import { parseCarouselSlideCount } from "./guards";
import { planCarouselStory, slideIdFor } from "./story-planner";
import { validateCarouselDraft } from "./story-validation";
import { buildSlideSpecification, PRODUCT_IDENTITY_LOCK } from "./visual-system";
import { slugifyRole } from "./text-analysis";
import { createZip, crc32, readStoredZip } from "./zip";
import {
  assert,
  expectReject,
  makeBrief,
  makeConcept,
  makeDna,
  makePlanRaw,
  makeStrategy,
  ScriptedGenerator,
} from "./test-fixtures";
import { StructuredGenerationError } from "@/lib/creative-studio/commercial-production/commercial-director/llm";

const CAMPAIGN_ID = "44444444-4444-4444-8444-444444444444";

function plannerInput(n: number, extra: { strategy?: Parameters<typeof makeStrategy>[0]; brief?: Parameters<typeof makeBrief>[0]; direction?: boolean } = {}) {
  const brief = makeBrief(extra.brief);
  const ctx = strategistInputFromBrief(brief);
  return {
    campaignId: CAMPAIGN_ID,
    slideCount: n,
    brief,
    strategy: makeStrategy(extra.strategy),
    product: ctx.product,
    brand: ctx.brand,
    references: ctx.references,
    direction: extra.direction === false ? null : { concept: makeConcept(), dna: makeDna() },
  };
}

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

async function run() {
  console.log("carousel planning");

  await test("slide count parser accepts 2..10 integers only", () => {
    for (const n of [2, 5, 10]) assert(parseCarouselSlideCount(n).ok, `accepts ${n}`);
    for (const bad of [1, 11, 0, -3, 2.5, "4", null, undefined, NaN, Infinity, [3], {}]) {
      assert(!parseCarouselSlideCount(bad).ok, `rejects ${JSON.stringify(bad)}`);
    }
  });

  for (const n of [2, 3, 5, 10]) {
    await test(`plans exactly ${n} ordered slides with distinct roles and ids`, async () => {
      const gen = new ScriptedGenerator([makePlanRaw(n)]);
      const plan = await planCarouselStory(plannerInput(n), { generator: gen });
      assert(plan.slides.length === n, "slide count");
      assert(plan.slides.every((s, i) => s.index === i && s.slideId === slideIdFor(CAMPAIGN_ID, i)), "stable ids + order");
      assert(new Set(plan.slides.map((s) => s.role)).size === n, "distinct roles");
      assert(new Set(plan.slides.map((s) => s.concept.id)).size === n, "distinct concepts");
      assert(new Set(plan.slides.map((s) => s.dna.id)).size === n, "distinct DNA");
      assert(plan.slides.every((s) => s.status === "planned" && s.creditsCharged === 0), "planned, 0 credits");
      assert(plan.story.coreMessage === "A convenient high-protein breakfast option", "core message comes from strategy");
      assert(plan.story.objective === "product_launch", "objective comes from strategy, not LLM");
      assert(gen.calls[0].userPrompt.includes(`EXACTLY ${n}`), "prompt requests exact count");
    });
  }

  await test("only the closing slide carries a CTA; strategy CTA applied", async () => {
    const raw = makePlanRaw(4, (r) => {
      r.slides[1].cta = "Buy today";
      r.slides[3].cta = null;
    });
    const plan = await planCarouselStory(plannerInput(4), { generator: new ScriptedGenerator([raw]) });
    assert(plan.slides.slice(0, 3).every((s) => !s.copy.cta), "non-final CTAs stripped");
    assert(plan.slides[3].copy.cta === "Discover now", "closing CTA = strategy CTA");
  });

  await test("user headline / CTA / offer overrides are preserved exactly", async () => {
    const plan = await planCarouselStory(
      plannerInput(3, { strategy: { userOverrides: { headline: "MORNINGS, SOLVED", cta: "Shop the launch", offer: "Dark chocolate" } } }),
      { generator: new ScriptedGenerator([makePlanRaw(3)]) }
    );
    assert(plan.slides[0].copy.headline === "MORNINGS, SOLVED", "headline override on slide 1");
    assert(plan.slides[2].copy.cta === "Shop the launch", "CTA override on closing slide");
    assert(plan.slides[2].copy.badges.includes("Dark chocolate"), "offer on closing slide");
  });

  await test("invented claims (numbers, awards, prices) are rejected, then repaired via re-ask", async () => {
    const bad = makePlanRaw(3, (r) => {
      r.slides[1].headline = "Award-winning taste, 40g protein";
      r.slides[1].supporting = "Now only $2.99 — rated 5 stars";
    });
    const gen = new ScriptedGenerator([bad, makePlanRaw(3)]);
    const plan = await planCarouselStory(plannerInput(3), { generator: gen });
    assert(gen.calls.length === 2, "re-asked once");
    assert(gen.calls[1].userPrompt.includes("FAILED VALIDATION"), "repair hint sent");
    assert(!/40g|\$2\.99|award/i.test(JSON.stringify(plan.slides.map((s) => s.copy))), "no invented claims survive");
  });

  await test("unrepairable stories fail with STORY_INVALID (no silent acceptance)", async () => {
    const bad = makePlanRaw(3, (r) => {
      r.slides[1].headline = "Clinically proven 50% more energy";
    });
    await expectReject(
      () => planCarouselStory(plannerInput(3), { generator: new ScriptedGenerator([bad]), maxRepairAttempts: 1 }),
      "STORY_INVALID",
      "invalid story rejected"
    );
  });

  await test("wrong slide count and repeated slides are validation issues", async () => {
    const tooFew = makePlanRaw(3);
    (tooFew.slides as unknown[]).pop();
    await expectReject(
      () => planCarouselStory(plannerInput(3), { generator: new ScriptedGenerator([tooFew]), maxRepairAttempts: 0 }),
      "STORY_INVALID",
      "count mismatch"
    );
    const repeated = makePlanRaw(3, (r) => {
      r.slides[1].headline = r.slides[0].headline;
      r.slides[1].supporting = r.slides[0].supporting;
    });
    await expectReject(
      () => planCarouselStory(plannerInput(3), { generator: new ScriptedGenerator([repeated]), maxRepairAttempts: 0 }),
      "STORY_INVALID",
      "repetition"
    );
  });

  await test("social proof role without evidence is rejected", async () => {
    const raw = makePlanRaw(3, (r) => {
      r.slides[1].role = "social_proof";
    });
    await expectReject(
      () => planCarouselStory(plannerInput(3), { generator: new ScriptedGenerator([raw]), maxRepairAttempts: 0 }),
      "STORY_INVALID",
      "proof without evidence"
    );
  });

  await test("forbidden strategy claims are rejected", async () => {
    const raw = makePlanRaw(3, (r) => {
      r.slides[1].supporting = "Build muscle faster every morning";
    });
    await expectReject(
      () => planCarouselStory(plannerInput(3), { generator: new ScriptedGenerator([raw]), maxRepairAttempts: 0 }),
      "STORY_INVALID",
      "forbidden claim"
    );
  });

  await test("identical layouts on every slide are flagged as template collapse", async () => {
    const raw = makePlanRaw(4, (r) => {
      for (const s of r.slides) {
        s.concept.composition = "Centered product hero on plain background";
        s.concept.productTreatment = "hero";
        s.concept.territory = "product_hero";
      }
    });
    await expectReject(
      () => planCarouselStory(plannerInput(4), { generator: new ScriptedGenerator([raw]), maxRepairAttempts: 0 }),
      "STORY_INVALID",
      "template collapse"
    );
  });

  await test("planner LLM failure → PROVIDER; stale strategy → STALE_STRATEGY", async () => {
    await expectReject(
      () => planCarouselStory(plannerInput(3), { generator: new ScriptedGenerator([new StructuredGenerationError("gemini 500 key=abc")]) }),
      "PROVIDER",
      "provider error mapped"
    );
    await expectReject(
      () => planCarouselStory(plannerInput(3, { strategy: { briefId: "brief_other" } }), { generator: new ScriptedGenerator([makePlanRaw(3)]) }),
      "STALE_STRATEGY",
      "stale strategy"
    );
  });

  await test("shared visual system derives from the direction and locks product identity", async () => {
    const raw = makePlanRaw(3, (r) => {
      delete r.sharedVisualSystem.palette;
    });
    const plan = await planCarouselStory(plannerInput(3), { generator: new ScriptedGenerator([raw]) });
    assert(plan.sharedDNA.directionConceptId === "concept_1", "direction recorded");
    assert(plan.sharedDNA.palette === makeDna().colorStrategy, "palette falls back to direction DNA");
    assert(plan.sharedDNA.productRepresentation.includes("SAME exact"), "product lock");
    assert(plan.slides.every((s) => s.dna.colorStrategy === plan.sharedDNA.palette), "slide DNA shares palette");
    assert(plan.slides.every((s) => s.dna.photographyStyle === plan.sharedDNA.photographyStyle), "slide DNA shares photography");
    assert(new Set(plan.slides.map((s) => s.dna.composition)).size === 3, "compositions vary");
  });

  await test("per-slide GenerationSpecification is valid, slide-scoped, and compiles via Nano Banana adapter", async () => {
    const input = plannerInput(3, { strategy: { userOverrides: { headline: "MORNINGS, SOLVED", cta: "Shop the launch" } } });
    const plan = await planCarouselStory(input, { generator: new ScriptedGenerator([makePlanRaw(3)]) });
    const campaign = { slideCount: 3, story: plan.story, sharedDNA: plan.sharedDNA };
    const specs = plan.slides.map((slide, i) =>
      buildSlideSpecification({
        sessionId: "sess",
        brief: input.brief,
        strategy: input.strategy,
        campaign,
        slide,
        product: input.product,
        brand: input.brand,
        references: input.references,
        generationId: `gen_${i}`,
      })
    );
    specs.forEach(({ specification, slideStrategy }, i) => {
      assertValidGenerationSpecification(specification, slideStrategy);
      assert(specification.renderCopy.headline === plan.slides[i].copy.headline, `slide ${i + 1} headline in spec`);
      assert(specification.variantId === plan.slides[i].slideId, "variantId = slideId");
      assert(specification.conceptId === plan.slides[i].concept.id, "slide concept");
      const req = buildImageGenerationRequest({ specification, userId: "u" });
      assert(req.prompt.toLowerCase().includes(`slide ${i + 1} of 3`), "prompt carries slide position");
      assert(req.prompt.includes(PRODUCT_IDENTITY_LOCK.slice(0, 40)), "prompt carries product lock");
      assert(req.referenceImages?.some((r) => r.url === "https://cdn.example.com/oats.png") ?? true, "product reference forwarded");
    });
    assert(specs[0].specification.renderCopy.headline === "MORNINGS, SOLVED", "override on slide 1 only");
    assert(specs[1].specification.renderCopy.headline !== "MORNINGS, SOLVED", "slide 2 keeps its own headline");
    assert(!specs[0].specification.renderCopy.cta, "no CTA on slide 1");
    assert(specs[2].specification.renderCopy.cta === "Shop the launch", "CTA override on closing slide");
  });

  await test("campaign checks: pre-generation pass; detect order/duplication problems", async () => {
    const input = plannerInput(3);
    const plan = await planCarouselStory(input, { generator: new ScriptedGenerator([makePlanRaw(3)]) });
    const campaign = { slideCount: 3, story: plan.story, sharedDNA: plan.sharedDNA, aspectRatio: "4:5" as const };
    const ok = runCarouselCampaignChecks(campaign, plan.slides, { afterGeneration: false });
    assert(ok.every((c) => c.status !== "fail"), `no failures: ${JSON.stringify(ok.filter((c) => c.status === "fail"))}`);
    const broken = structuredClone(plan.slides);
    broken[2].index = 1;
    broken[1].copy = { ...broken[0].copy };
    const bad = runCarouselCampaignChecks(campaign, broken, { afterGeneration: false });
    assert(bad.find((c) => c.code === "slide_order")?.status === "fail", "order failure");
    assert(bad.find((c) => c.code === "repeated_content")?.status !== "pass", "repetition flagged");
    const post = runCarouselCampaignChecks(campaign, plan.slides, { afterGeneration: true });
    assert(post.find((c) => c.code === "assets_present")?.status !== "pass", "missing assets flagged after generation");
  });

  await test("validateCarouselDraft repairs without inventing", async () => {
    const input = plannerInput(2);
    const plan = await planCarouselStory(input, { generator: new ScriptedGenerator([makePlanRaw(2)]) });
    const draft = structuredClone({ story: plan.story, sharedDNA: plan.sharedDNA, slides: plan.slides });
    draft.slides[0].copy.badges = ["Best seller", "26g protein"];
    const res = validateCarouselDraft(draft, { slideCount: 2, strategy: input.strategy, brief: input.brief, product: input.product });
    assert(res.ok, `valid after repair: ${res.issues.join("; ")}`);
    assert(!res.draft.slides[0].copy.badges.includes("Best seller"), "unapproved badge dropped");
    assert(res.repairs.length > 0, "repair recorded");
  });

  await test("role slugs truncate on word boundaries for file names", () => {
    assert(slugifyRole("Product Reveal And Call To Action") === "product_reveal_and_call_to", "33 chars → cut at word boundary");
    assert(slugifyRole("Hook And Benefit Introduction") === "hook_and_benefit_introduction", "short roles kept whole");
    const long = slugifyRole("Everyday Morning Routine With The Whole Family Together");
    assert(long.length <= 32 && !long.endsWith("_") && long.split("_").every((w) => w.length > 0), `clean cut: ${long}`);
    assert("everyday_morning_routine_with_the_whole".startsWith(long), "cut at a word boundary");
    assert(slugifyRole("") === "slide", "fallback");
  });

  await test("zip writer: valid CRCs, ordered entries, deterministic bytes", () => {
    assert(crc32(Buffer.from("123456789")) === 0xcbf43926, "crc32 check value");
    const entries = [
      { name: "01-hook.png", data: Buffer.from("a") },
      { name: "02-close.png", data: Buffer.from("bb") },
      { name: "manifest.json", data: Buffer.from("{}") },
    ];
    const a = createZip(entries);
    const b = createZip(entries);
    assert(a.equals(b), "deterministic");
    const back = readStoredZip(a);
    assert(back.map((e) => e.name).join(",") === "01-hook.png,02-close.png,manifest.json", "order");
    assert(back[1].data.toString() === "bb", "content");
    assert(a.readUInt32LE(a.length - 22) === 0x06054b50, "end of central directory");
  });

  console.log(`\n${passed} carousel planning tests passed`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
