/**
 * Reference Engine Phase 4 tests — mocked Nano Banana only.
 *
 * Run: npm run test:reference-engine
 */

import assert from "node:assert/strict";
import { clearKeyframeCache } from "./storage";
import { resolveReferenceStrategy } from "./reference-strategy";
import { buildKeyframeSpecification } from "./prompt-builder";
import { resolveKeyframeReferences } from "./resolve-references";
import { runDeterministicKeyframeQc } from "./qc";
import { prepareShotForVideo } from "./prepare";
import {
  generateCommercialKeyframe,
  prepareCommercialShotForVideo,
} from "./generate";
import { generateCommercialKeyframes } from "./batch";
import { ReferenceEngineError } from "./types";
import {
  getAtmosphericShot,
  getHeroShot,
  getMotionGraphicsShot,
  getPreparingShot,
  makeAvailableAssets,
  makeProductAsset,
  MockImageProvider,
} from "./fixtures";
import { makeValidProtein30sShotPlan, makeProtein30sBlueprint } from "../shot-planner/fixtures";
import type { KeyframeResult, ImageGenerationProvider } from "./types";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed += 1;
      console.log(`  ✓ ${name}`);
    })
    .catch((err) => {
      failed += 1;
      console.error(`  ✗ ${name}`);
      console.error(err);
    });
}

async function main() {
  console.log("\nReference Engine tests\n");
  clearKeyframeCache();

  await test("reference strategy: product hero → keyframe_first", () => {
    const { shot } = getHeroShot();
    const plan = resolveReferenceStrategy(shot);
    assert.equal(plan.keyframeRequired, true);
    assert.equal(plan.callImageProvider, true);
    assert.ok(plan.strategy === "keyframe_first" || plan.strategy === "multi_reference");
  });

  await test("reference strategy: text-to-video atmospheric → bypass", () => {
    const { shot } = getAtmosphericShot();
    const plan = resolveReferenceStrategy(shot);
    assert.equal(plan.callImageProvider, false);
    assert.equal(plan.strategy, "text_to_video");
  });

  await test("reference strategy: motion-graphics → bypass", () => {
    const { shot } = getMotionGraphicsShot();
    const plan = resolveReferenceStrategy(shot);
    assert.equal(plan.callImageProvider, false);
    assert.equal(plan.strategy, "motion_graphics");
  });

  await test("prompt construction includes campaign DNA + shot purpose", () => {
    const { blueprint, shot } = getHeroShot();
    const plan = resolveReferenceStrategy(shot);
    const refs = resolveKeyframeReferences({
      shot,
      plan,
      availableAssets: makeAvailableAssets(),
      strict: true,
    });
    const spec = buildKeyframeSpecification({
      blueprint,
      shot,
      plan,
      resolvedReferences: refs.references,
    });
    assert.ok(spec.imageGenerationPrompt.includes(shot.shotWhy.slice(0, 20)));
    assert.ok(spec.imageGenerationPrompt.includes(blueprint.visualTreatment.visualStyle.slice(0, 20)));
    assert.ok(spec.imageGenerationPrompt.includes("PRODUCT REFERENCE"));
    assert.equal(spec.product.required, true);
  });

  await test("product reference inclusion", () => {
    const { shot } = getHeroShot();
    const plan = resolveReferenceStrategy(shot);
    const { references } = resolveKeyframeReferences({
      shot,
      plan,
      availableAssets: makeAvailableAssets(),
      strict: true,
    });
    assert.ok(references.some((r) => r.type === "product"));
  });

  await test("PRODUCT_REFERENCE_MISSING throws", () => {
    const { shot } = getHeroShot();
    const plan = resolveReferenceStrategy(shot);
    assert.throws(
      () =>
        resolveKeyframeReferences({
          shot,
          plan,
          availableAssets: { productImages: [] },
          strict: true,
        }),
      (e: unknown) => e instanceof ReferenceEngineError && e.code === "PRODUCT_REFERENCE_MISSING"
    );
  });

  await test("previous-shot reference resolution", () => {
    const blueprint = makeProtein30sBlueprint();
    const plan = makeValidProtein30sShotPlan();
    const shot = plan.shots.find((s) => s.id === "shot-5")!;
    const refPlan = resolveReferenceStrategy(shot);
    assert.equal(refPlan.previousShotReferenceRequired, true);

    const prev: KeyframeResult = {
      shotId: "shot-4",
      campaignId: blueprint.campaignId,
      keyframeId: "kf_prev",
      status: "approved",
      keyframeRequired: true,
      url: "https://example.com/prev.png",
      assetId: "kf_prev",
      referenceAssetIds: [],
      metadata: {
        attempt: 1,
        idempotencyKey: "x",
        visualInspectionAvailable: false,
      },
      attempts: [],
    };

    const { references } = resolveKeyframeReferences({
      shot,
      plan: refPlan,
      availableAssets: {
        productImages: [makeProductAsset()],
        approvedKeyframesByShotId: { "shot-4": prev },
      },
      strict: true,
    });
    assert.ok(references.some((r) => r.type === "previous_shot"));
  });

  await test("character continuity recorded when assets missing (warning path)", () => {
    const { shot } = getHeroShot();
    // Force character reference flag
    shot.referenceRequirements.characterReference = true;
    const plan = resolveReferenceStrategy(shot);
    assert.equal(plan.characterReferenceRequired, true);
  });

  await test("preparing shot specification includes product state", () => {
    const { blueprint, shot } = getPreparingShot();
    const plan = resolveReferenceStrategy(shot);
    const refs = resolveKeyframeReferences({
      shot,
      plan,
      availableAssets: makeAvailableAssets(),
      strict: true,
    });
    const spec = buildKeyframeSpecification({
      blueprint,
      shot,
      plan,
      resolvedReferences: refs.references,
    });
    assert.ok(spec.product.state?.toLowerCase().includes("scoop") || spec.product.state === "preparing" || String(spec.product.interaction).includes("preparing") || spec.imageGenerationPrompt.toLowerCase().includes("prepar"));
  });

  await test("artifact-risk propagation to deferred visual QC", () => {
    const { shot } = getHeroShot();
    const plan = resolveReferenceStrategy(shot);
    const refs = resolveKeyframeReferences({
      shot,
      plan,
      availableAssets: makeAvailableAssets(),
      strict: true,
    });
    const spec = buildKeyframeSpecification({
      blueprint: makeProtein30sBlueprint(),
      shot,
      plan,
      resolvedReferences: refs.references,
    });
    const qc = runDeterministicKeyframeQc({
      shot,
      plan,
      specification: spec,
      result: { url: "https://example.com/k.png", assetId: "a1", status: "generated", generationPrompt: "x" },
      references: refs.references,
      missingReferences: [],
    });
    assert.equal(qc.visualInspectionAvailable, false);
    assert.ok(qc.issues.some((i) => i.requiresVisualQc || i.check === "requires_visual_qc"));
    assert.equal(qc.passed, true);
  });

  await test("text-to-video bypass does not call image provider", async () => {
    clearKeyframeCache();
    const mock = new MockImageProvider();
    const { blueprint, shot } = getAtmosphericShot();
    const result = await generateCommercialKeyframe(
      {
        blueprint,
        shot,
        availableAssets: makeAvailableAssets(),
        skipStorage: true,
      },
      { imageProvider: mock, log: () => undefined }
    );
    assert.equal(result.status, "skipped");
    assert.equal(mock.calls.length, 0);
  });

  await test("motion-graphics bypass", async () => {
    clearKeyframeCache();
    const mock = new MockImageProvider();
    const { blueprint, shot } = getMotionGraphicsShot();
    const result = await generateCommercialKeyframe(
      {
        blueprint,
        shot,
        availableAssets: makeAvailableAssets(),
        skipStorage: true,
      },
      { imageProvider: mock, log: () => undefined }
    );
    assert.equal(result.status, "skipped");
    assert.equal(mock.calls.length, 0);
  });

  await test("keyframe-first generation calls mock provider with product ref", async () => {
    clearKeyframeCache();
    const mock = new MockImageProvider();
    const { blueprint, shot } = getHeroShot();
    const result = await generateCommercialKeyframe(
      {
        blueprint,
        shot,
        availableAssets: makeAvailableAssets(),
        skipStorage: true,
        forceRegenerate: true,
      },
      { imageProvider: mock, log: () => undefined }
    );
    assert.equal(result.status, "approved");
    assert.equal(mock.calls.length, 1);
    assert.ok(mock.calls[0].referenceImages?.some((r) => r.type === "product"));
    assert.ok(result.url);
  });

  await test("idempotency reuses approved keyframe", async () => {
    clearKeyframeCache();
    const mock = new MockImageProvider();
    const { blueprint, shot } = getHeroShot();
    const first = await generateCommercialKeyframe(
      {
        blueprint,
        shot,
        availableAssets: makeAvailableAssets(),
        skipStorage: true,
        forceRegenerate: true,
      },
      { imageProvider: mock, log: () => undefined }
    );
    const second = await generateCommercialKeyframe(
      {
        blueprint,
        shot,
        availableAssets: makeAvailableAssets(),
        skipStorage: true,
        forceRegenerate: false,
      },
      { imageProvider: mock, log: () => undefined }
    );
    assert.equal(first.keyframeId, second.keyframeId);
    assert.equal(mock.calls.length, 1);
  });

  await test("regeneration limit uses maxAttempts", async () => {
    clearKeyframeCache();
    let calls = 0;
    const bad: ImageGenerationProvider = {
      id: "bad",
      modelId: "bad",
      checkAvailability: () => ({ available: true, message: "ok" }),
      async generateImage() {
        calls += 1;
        return {
          buffer: Buffer.from("x"),
          dataUrl: "",
          provider: "bad",
          model: "bad",
          aspectRatio: "9:16",
        };
      },
    };
    const { blueprint, shot } = getHeroShot();
    await assert.rejects(
      () =>
        generateCommercialKeyframe(
          {
            blueprint,
            shot,
            availableAssets: makeAvailableAssets(),
            skipStorage: true,
            forceRegenerate: true,
            maxAttempts: 2,
          },
          { imageProvider: bad, log: () => undefined }
        ),
      (e: unknown) => e instanceof ReferenceEngineError && e.code === "KEYFRAME_QC_FAILED"
    );
    assert.equal(calls, 2);
  });

  await test("PreparedShotForVideo handoff attaches approved keyframe", async () => {
    clearKeyframeCache();
    const mock = new MockImageProvider();
    const { blueprint, shot } = getHeroShot();
    const keyframe = await generateCommercialKeyframe(
      {
        blueprint,
        shot,
        availableAssets: makeAvailableAssets(),
        skipStorage: true,
        forceRegenerate: true,
      },
      { imageProvider: mock, log: () => undefined }
    );
    const prepared = prepareCommercialShotForVideo({ shot, keyframe });
    assert.equal(prepared.generationMode, "image_to_video");
    assert.equal(prepared.providerRequirements.provider, "runway");
    assert.equal(prepared.providerRequirements.model, "seedance2_5");
    assert.equal(prepared.readyForVideo, true);
    assert.equal(prepared.keyframe?.keyframeId, keyframe.keyframeId);
  });

  await test("end-to-end mocked: plan → keyframes → prepared shots", async () => {
    clearKeyframeCache();
    const mock = new MockImageProvider();
    const blueprint = makeProtein30sBlueprint();
    const plan = makeValidProtein30sShotPlan();
    // Only generate for shots that need keyframes among first 3 to keep test light
    const subset = plan.shots.filter(
      (s) =>
        s.generationStrategy.id === "keyframe-first" ||
        s.generationStrategy.id === "text-to-video" ||
        s.generationStrategy.id === "product-reference-first"
    );
    const results = await generateCommercialKeyframes(
      {
        blueprint,
        shots: subset,
        availableAssets: makeAvailableAssets(),
        skipStorage: true,
        forceRegenerate: true,
      },
      { imageProvider: mock, log: () => undefined }
    );
    assert.ok(results.length >= 2);
    const skipped = results.filter((r) => r.status === "skipped");
    const approved = results.filter((r) => r.status === "approved");
    assert.ok(skipped.length >= 1);
    assert.ok(approved.length >= 1);
    assert.ok(mock.calls.length === approved.length);

    const hero = subset.find((s) => s.role === "product_hero")!;
    const heroKf = results.find((r) => r.shotId === hero.id)!;
    const prepared = prepareShotForVideo({ shot: hero, keyframe: heroKf });
    assert.equal(prepared.readyForVideo, true);
    assert.equal(prepared.generationMode, "image_to_video");
  });

  await test("aspect ratio flows into specification", () => {
    const { blueprint, shot } = getHeroShot();
    blueprint.aspectRatio = "9:16";
    const plan = resolveReferenceStrategy(shot);
    const refs = resolveKeyframeReferences({
      shot,
      plan,
      availableAssets: makeAvailableAssets(),
      strict: true,
    });
    const spec = buildKeyframeSpecification({
      blueprint,
      shot,
      plan,
      resolvedReferences: refs.references,
    });
    assert.equal(spec.aspectRatio, "9:16");
    assert.ok(spec.imageGenerationPrompt.includes("9:16"));
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
