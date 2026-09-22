/**
 * Campaign Orchestrator Phase 6 tests — fully mocked Phase 2–5 providers.
 *
 * Run: npm run test:campaign-orchestrator
 */

import assert from "node:assert/strict";
import { clearKeyframeCache } from "../reference-engine/storage";
import { clearShotVideoCache } from "../video-executor/storage";
import { runCampaignProduction } from "./orchestrator";
import { buildShotDependencyGraph } from "./dependencies";
import { buildProductionManifest } from "./manifest";
import { validateProductionRun } from "./validate";
import { CampaignOrchestratorError } from "./types";
import {
  get15sFixture,
  get30sFixture,
  makeAvailableAssets,
  makeCircularDependencyPlan,
  makeIndependentShotsPlan,
  makeInvalidDurationPlan,
  makeMockDirector,
  makeMockPlanner,
  makeOrchestratorTestOptions,
  MockImageProvider,
  MockVideoProvider,
} from "./fixtures";
import type { ImageGenerationProvider } from "../reference-engine/types";
import { InMemoryProductionRunStore } from "./state";

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

function resetCaches(): void {
  clearKeyframeCache();
  clearShotVideoCache();
}

async function main() {
  console.log("\nCampaign Orchestrator tests\n");

  await test("15s campaign → production_ready + ready_for_composition", async () => {
    resetCaches();
    const { brief, blueprint, plan } = get15sFixture();
    const { options, imageProvider, videoProvider } = makeOrchestratorTestOptions({
      blueprint,
      plan,
    });
    const run = await runCampaignProduction(
      {
        brief,
        generationVersion: "v1_15",
        availableAssets: makeAvailableAssets(),
        skipDownload: true,
        skipStorage: true,
      },
      options
    );
    assert.ok(
      run.status === "composition_pending" || run.status === "production_ready",
      `status=${run.status}`
    );
    assert.ok(run.manifest);
    assert.equal(run.manifest!.productionStatus, "ready_for_composition");
    assert.equal(run.manifest!.campaign.durationSeconds, 15);
    assert.equal(run.manifest!.shots.length, plan.shots.length);
    // motion graphics deferred
    const deferred = run.manifest!.shots.find((s) => s.generationMode === "motion_graphics");
    assert.ok(deferred);
    assert.equal(deferred!.composition.eligible, true);
    assert.ok(!deferred!.video);
    // image_to_video has keyframe + video
    const i2v = run.manifest!.shots.find((s) => s.generationMode === "image_to_video");
    assert.ok(i2v?.keyframe?.assetId || i2v?.keyframe?.status === "approved");
    assert.ok(i2v?.video?.assetId);
    assert.ok(imageProvider.calls.length >= 1);
    assert.ok(videoProvider.generateCalls.length >= 1);
  });

  await test("30s campaign with dependencies → production_ready", async () => {
    resetCaches();
    const { brief, blueprint, plan } = get30sFixture();
    const { options } = makeOrchestratorTestOptions({ blueprint, plan });
    const run = await runCampaignProduction(
      {
        brief,
        generationVersion: "v1_30",
        availableAssets: makeAvailableAssets(),
        skipDownload: true,
        skipStorage: true,
      },
      options
    );
    assert.equal(run.manifest?.productionStatus, "ready_for_composition");
    assert.equal(run.manifest?.campaign.durationSeconds, 30);
    assert.equal(run.shots.length, plan.shots.length);
    // Editorial order preserved
    for (let i = 1; i < run.manifest!.shots.length; i++) {
      assert.ok(run.manifest!.shots[i].sequence >= run.manifest!.shots[i - 1].sequence);
    }
  });

  await test("keyframe dependency ordering: dependent waits for prior keyframe", async () => {
    resetCaches();
    const { brief, blueprint, plan } = get15sFixture();
    // shot-2 continues from shot-1; shot-3 from shot-2
    const order: string[] = [];
    const baseImage = new MockImageProvider();
    const trackingImage: ImageGenerationProvider = {
      id: baseImage.id,
      modelId: baseImage.modelId,
      checkAvailability: () => baseImage.checkAvailability(),
      async generateImage(req) {
        order.push(req.shotId);
        return baseImage.generateImage(req);
      },
    };
    const { options } = makeOrchestratorTestOptions({
      blueprint,
      plan,
      imageProvider: baseImage,
    });
    options.imageProvider = trackingImage;
    await runCampaignProduction(
      {
        brief,
        generationVersion: "v_dep",
        availableAssets: makeAvailableAssets(),
        skipDownload: true,
        skipStorage: true,
      },
      options
    );
    // keyframe-first shots only
    const kfShots = plan.shots
      .filter((s) => s.generationStrategy.id === "keyframe-first")
      .map((s) => s.id);
    for (let i = 1; i < kfShots.length; i++) {
      const a = order.indexOf(kfShots[i - 1]);
      const b = order.indexOf(kfShots[i]);
      assert.ok(a >= 0 && b >= 0 && a < b, `expected ${kfShots[i - 1]} before ${kfShots[i]}`);
    }
  });

  await test("independent shots: dependency graph has empty deps", async () => {
    const plan = makeIndependentShotsPlan();
    const graph = buildShotDependencyGraph(plan);
    for (const shot of plan.shots) {
      assert.equal((graph.dependencies.get(shot.id) || []).length, 0);
    }
    assert.equal(graph.topologicalOrder.length, plan.shots.length);
  });

  await test("reference failure → reference_generation_failed / incomplete, no video for that shot", async () => {
    resetCaches();
    const { brief, blueprint, plan } = get15sFixture();
    const failingImage = new MockImageProvider();
    failingImage.generateImage = async () => {
      throw new Error("nano banana mocked failure");
    };
    const videoProvider = new MockVideoProvider();
    const { options } = makeOrchestratorTestOptions({
      blueprint,
      plan,
      imageProvider: failingImage,
      videoProvider,
    });
    const run = await runCampaignProduction(
      {
        brief,
        generationVersion: "v_ref_fail",
        availableAssets: makeAvailableAssets(),
        skipDownload: true,
        skipStorage: true,
      },
      options
    );
    const failedKf = run.shots.filter(
      (s) =>
        plan.shots.find((p) => p.id === s.shotId)?.generationStrategy.id === "keyframe-first" &&
        (s.status === "failed" || s.status === "blocked")
    );
    assert.ok(failedKf.length >= 1);
    // text-to-video / deferred may still proceed
    assert.ok(
      run.status === "reference_generation_failed" ||
        run.status === "video_generation_failed" ||
        run.manifest?.productionStatus === "incomplete"
    );
  });

  await test("video failure → video_generation_failed + incomplete manifest", async () => {
    resetCaches();
    const { brief, blueprint, plan } = get15sFixture();
    const videoProvider = new MockVideoProvider();
    // Fail all video generates permanently
    const orig = videoProvider.generateVideo.bind(videoProvider);
    videoProvider.generateVideo = async (req) => {
      throw new Error("invalid request: mocked permanent failure");
    };
    void orig;
    const { options } = makeOrchestratorTestOptions({ blueprint, plan, videoProvider });
    const run = await runCampaignProduction(
      {
        brief,
        generationVersion: "v_vid_fail",
        availableAssets: makeAvailableAssets(),
        skipDownload: true,
        skipStorage: true,
      },
      options
    );
    assert.ok(
      run.status === "video_generation_failed" || run.manifest?.productionStatus === "incomplete"
    );
    assert.equal(run.manifest?.productionStatus, "incomplete");
    const videoShots = run.shots.filter((s) => s.status !== "deferred");
    assert.ok(videoShots.some((s) => s.status === "failed"));
  });

  await test("resume: completed shots are not regenerated", async () => {
    resetCaches();
    const { brief, blueprint, plan } = get15sFixture();
    const { options, imageProvider, videoProvider, runStore } = makeOrchestratorTestOptions({
      blueprint,
      plan,
    });
    const first = await runCampaignProduction(
      {
        brief,
        generationVersion: "v_resume",
        availableAssets: makeAvailableAssets(),
        skipDownload: true,
        skipStorage: true,
      },
      options
    );
    assert.equal(first.manifest?.productionStatus, "ready_for_composition");
    const imageCalls = imageProvider.calls.length;
    const videoCalls = videoProvider.generateCalls.length;

    const second = await runCampaignProduction(
      {
        brief,
        generationVersion: "v_resume",
        availableAssets: makeAvailableAssets(),
        skipDownload: true,
        skipStorage: true,
      },
      { ...options, runStore }
    );
    assert.equal(second.manifest?.productionStatus, "ready_for_composition");
    assert.equal(imageProvider.calls.length, imageCalls);
    assert.equal(videoProvider.generateCalls.length, videoCalls);
  });

  await test("force regenerate with new version preserves prior version", async () => {
    resetCaches();
    const { brief, blueprint, plan } = get15sFixture();
    const runStore = new InMemoryProductionRunStore();
    const { options, videoProvider } = makeOrchestratorTestOptions({ blueprint, plan });
    options.runStore = runStore;

    const v1 = await runCampaignProduction(
      {
        brief,
        generationVersion: "v1",
        availableAssets: makeAvailableAssets(),
        skipDownload: true,
        skipStorage: true,
      },
      options
    );
    const v1Job = v1.shots.find((s) => s.video)?.video?.providerJobId;
    const callsAfterV1 = videoProvider.generateCalls.length;

    const v2 = await runCampaignProduction(
      {
        brief,
        generationVersion: "v2",
        forceRegenerate: true,
        availableAssets: makeAvailableAssets(),
        skipDownload: true,
        skipStorage: true,
      },
      options
    );
    assert.equal(v2.generationVersion, "v2");
    assert.ok(videoProvider.generateCalls.length > callsAfterV1);
    const storedV1 = await runStore.get(brief.campaignId, "v1");
    assert.ok(storedV1);
    assert.equal(storedV1!.generationVersion, "v1");
    assert.equal(storedV1!.manifest?.generationVersion, "v1");
    // v1 assets still present
    assert.ok(v1Job);
  });

  await test("invalid duration → planning_failed before generation", async () => {
    resetCaches();
    const { brief, blueprint } = get15sFixture();
    const badPlan = makeInvalidDurationPlan();
    const imageProvider = new MockImageProvider();
    const videoProvider = new MockVideoProvider();
    const run = await runCampaignProduction(
      {
        brief,
        generationVersion: "v_bad_dur",
        availableAssets: makeAvailableAssets(),
        skipDownload: true,
        skipStorage: true,
      },
      {
        director: makeMockDirector(blueprint),
        shotPlanner: makeMockPlanner(badPlan),
        imageProvider,
        videoProvider,
        runStore: new InMemoryProductionRunStore(),
        log: () => undefined,
      }
    );
    assert.equal(run.status, "planning_failed");
    assert.equal(imageProvider.calls.length, 0);
    assert.equal(videoProvider.generateCalls.length, 0);
  });

  await test("circular dependency → dependency_graph_invalid before generation", async () => {
    resetCaches();
    const { brief, blueprint } = get15sFixture();
    const circular = makeCircularDependencyPlan();
    // Bypass ShotPlan validate by using planner that returns circular plan
    // validateShotPlan may still pass if durations ok — graph build fails
    const imageProvider = new MockImageProvider();
    const videoProvider = new MockVideoProvider();

    // validateShotPlan might fail on circular? It doesn't check cycles.
    // But durations must be valid — circular fixture keeps original durations.
    const run = await runCampaignProduction(
      {
        brief: { ...brief, campaignId: circular.campaignId },
        generationVersion: "v_circular",
        skipDownload: true,
        skipStorage: true,
      },
      {
        director: makeMockDirector({ ...blueprint, campaignId: circular.campaignId }),
        shotPlanner: makeMockPlanner(circular),
        imageProvider,
        videoProvider,
        runStore: new InMemoryProductionRunStore(),
        log: () => undefined,
      }
    );
    assert.equal(run.status, "dependency_graph_invalid");
    assert.equal(imageProvider.calls.length, 0);
    assert.equal(videoProvider.generateCalls.length, 0);
  });

  await test("buildShotDependencyGraph throws on cycle", async () => {
    const circular = makeCircularDependencyPlan();
    assert.throws(() => buildShotDependencyGraph(circular), CampaignOrchestratorError);
  });

  await test("manifest construction preserves editorial fields + QC honesty", async () => {
    resetCaches();
    const { brief, blueprint, plan } = get15sFixture();
    const { options } = makeOrchestratorTestOptions({ blueprint, plan });
    const run = await runCampaignProduction(
      {
        brief,
        generationVersion: "v_manifest",
        availableAssets: makeAvailableAssets(),
        skipDownload: true,
        skipStorage: true,
      },
      options
    );
    const manifest = buildProductionManifest(run);
    assert.ok(manifest.creative.selectedConcept);
    assert.ok(manifest.creative.visualTreatment);
    for (const s of manifest.shots) {
      assert.ok(s.shotWhy);
      assert.ok(Array.isArray(s.beatIds));
      assert.equal(typeof s.qc.visualInspectionAvailable, "boolean");
      // Must not claim visual QC passed
      assert.equal(s.qc.visualInspectionAvailable, false);
    }
    const validation = validateProductionRun(run);
    assert.equal(validation.ok, true);
  });

  await test("end-to-end mocked pipeline: Brief → Manifest", async () => {
    resetCaches();
    const { brief, blueprint, plan } = get30sFixture();
    const { options, imageProvider, videoProvider } = makeOrchestratorTestOptions({
      blueprint,
      plan,
    });
    const run = await runCampaignProduction(
      {
        brief,
        generationVersion: "v_e2e",
        availableAssets: makeAvailableAssets(),
        skipDownload: true,
        skipStorage: true,
      },
      options
    );
    assert.ok(run.blueprint);
    assert.ok(run.shotPlan);
    assert.ok(run.manifest);
    assert.equal(run.manifest!.campaignId, brief.campaignId);
    assert.equal(run.manifest!.generationVersion, "v_e2e");
    assert.equal(run.manifest!.productionStatus, "ready_for_composition");
    for (const s of run.manifest!.shots) {
      if (s.generationMode === "image_to_video") {
        assert.ok(s.keyframe);
        assert.ok(s.video);
        assert.equal(s.video!.provider, "runway");
        assert.equal(s.video!.model, "seedance2_5");
      } else if (s.generationMode === "text_to_video") {
        assert.ok(s.video);
      } else if (s.generationMode === "motion_graphics") {
        assert.equal(s.composition.eligible, true);
      }
    }
    assert.ok(imageProvider.calls.length >= 1);
    assert.ok(videoProvider.generateCalls.length >= 1);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
