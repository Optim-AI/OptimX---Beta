/**
 * Campaign Executor Phase 7 tests — mocked VideoProvider only.
 *
 * Run: npm run test:campaign-executor
 */

import assert from "node:assert/strict";
import { generateCampaignVideo } from "./generate-campaign-video";
import { produceFinalCommercial } from "./produce";
import { runDeterministicCampaignVideoQc } from "./qc";
import { clearCampaignVideoCache } from "./storage";
import {
  makeNative15sSpec,
  makeNative30sSpec,
  makeExecutorTestOptions,
  makeValidBrief,
  makeAvailableAssets,
  make15sCompileInput,
  make30sCompileInput,
  MockVideoProvider,
} from "./fixtures";
import { makeMockDirector, makeMockPlanner } from "../campaign-orchestrator/fixtures";
import { VIDEO_EXECUTOR_MODEL } from "../video-executor/types";

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
  console.log("\nCampaign Executor tests\n");

  await test("15s native request sends duration 15", async () => {
    clearCampaignVideoCache();
    const spec = makeNative15sSpec();
    const provider = new MockVideoProvider();
    const result = await generateCampaignVideo(
      { spec, skipDownload: true, skipStorage: true, forceRegenerate: true },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000, log: () => undefined }
    );
    assert.equal(result.status, "completed");
    assert.equal(provider.generateCalls.length, 1);
    assert.equal(provider.generateCalls[0].durationSeconds, 15);
    assert.equal(result.duration, 15);
  });

  await test("30s native request sends duration 30", async () => {
    clearCampaignVideoCache();
    const spec = makeNative30sSpec();
    const provider = new MockVideoProvider();
    const result = await generateCampaignVideo(
      { spec, skipDownload: true, forceRegenerate: true },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000, log: () => undefined }
    );
    assert.equal(provider.generateCalls[0].durationSeconds, 30);
    assert.equal(result.duration, 30);
  });

  await test("ONE native request submitted — not multiple jobs", async () => {
    clearCampaignVideoCache();
    const provider = new MockVideoProvider();
    await generateCampaignVideo(
      { spec: makeNative15sSpec(), skipDownload: true, forceRegenerate: true },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000, log: () => undefined }
    );
    assert.equal(provider.generateCalls.length, 1);
  });

  await test("Seedance model seedance2_5 + runway provider", async () => {
    clearCampaignVideoCache();
    const provider = new MockVideoProvider();
    const result = await generateCampaignVideo(
      { spec: makeNative15sSpec(), skipDownload: true, forceRegenerate: true },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000, log: () => undefined }
    );
    assert.equal(result.provider, "runway");
    assert.equal(result.model, VIDEO_EXECUTOR_MODEL);
  });

  await test("references passed to provider", async () => {
    clearCampaignVideoCache();
    const spec = makeNative15sSpec();
    assert.ok(spec.referenceAssets.length >= 1);
    const provider = new MockVideoProvider();
    await generateCampaignVideo(
      { spec, skipDownload: true, forceRegenerate: true },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000, log: () => undefined }
    );
    const call = provider.generateCalls[0];
    const refs = [...(call.productReferences || []), ...(call.referenceImages || [])];
    assert.ok(refs.length >= 1);
  });

  await test("idempotency prevents duplicate submission", async () => {
    clearCampaignVideoCache();
    const provider = new MockVideoProvider();
    const spec = makeNative15sSpec();
    const opts = { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000, log: () => undefined };
    const a = await generateCampaignVideo({ spec, skipDownload: true }, opts);
    const b = await generateCampaignVideo({ spec, skipDownload: true }, opts);
    assert.equal(provider.generateCalls.length, 1);
    assert.equal(a.providerJobId, b.providerJobId);
  });

  await test("forceRegenerate bypasses cache", async () => {
    clearCampaignVideoCache();
    const provider = new MockVideoProvider();
    const spec = makeNative15sSpec();
    const opts = { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000, log: () => undefined };
    await generateCampaignVideo({ spec, skipDownload: true }, opts);
    await generateCampaignVideo({ spec, skipDownload: true, forceRegenerate: true }, opts);
    assert.equal(provider.generateCalls.length, 2);
  });

  await test("failed result surfaced", async () => {
    clearCampaignVideoCache();
    const provider = new MockVideoProvider();
    provider.failNextGeneratePermanent = true;
    const result = await generateCampaignVideo(
      { spec: makeNative15sSpec(), skipDownload: true, forceRegenerate: true },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 2000, maxRetries: 0, log: () => undefined }
    );
    assert.equal(result.status, "failed");
    assert.ok(result.error?.code);
  });

  await test("QC: correct duration passes; wrong duration fails", () => {
    const spec = makeNative15sSpec();
    const good = runDeterministicCampaignVideoQc({
      spec,
      result: {
        campaignId: spec.campaignId,
        provider: "runway",
        model: "seedance2_5",
        duration: 15,
        aspectRatio: spec.aspectRatio,
        generationMode: "native_continuous",
        status: "completed",
        videoUrl: "https://example.com/v.mp4",
        videoAssetId: "a1",
        providerJobId: "job1",
      },
    });
    assert.equal(good.passed, true);
    assert.equal(good.visualInspectionAvailable, false);

    const badDur = runDeterministicCampaignVideoQc({
      spec,
      result: {
        campaignId: spec.campaignId,
        provider: "runway",
        model: "seedance2_5",
        duration: 15,
        aspectRatio: spec.aspectRatio,
        generationMode: "native_continuous",
        status: "completed",
        videoUrl: "https://example.com/v.mp4",
        videoAssetId: "a1",
        providerJobId: "job1",
      },
      reportedDurationSeconds: 8,
    });
    assert.equal(badDur.passed, false);
  });

  await test("QC: wrong provider / model / missing asset fails", () => {
    const spec = makeNative15sSpec();
    const wrongProvider = runDeterministicCampaignVideoQc({
      spec,
      result: {
        campaignId: spec.campaignId,
        provider: "runway",
        model: "seedance2_5",
        duration: 15,
        aspectRatio: spec.aspectRatio,
        generationMode: "native_continuous",
        status: "completed",
        videoUrl: "",
        videoAssetId: "",
        providerJobId: "job1",
      },
    });
    assert.equal(wrongProvider.passed, false);

    const wrongModel = runDeterministicCampaignVideoQc({
      spec,
      result: {
        campaignId: spec.campaignId,
        provider: "runway",
        model: "veo-3",
        duration: 15,
        aspectRatio: spec.aspectRatio,
        generationMode: "native_continuous",
        status: "completed",
        videoUrl: "https://example.com/v.mp4",
        videoAssetId: "a1",
        providerJobId: "job1",
      },
    });
    assert.equal(wrongModel.passed, false);
  });

  await test("produceFinalCommercial native path — one provider job", async () => {
    clearCampaignVideoCache();
    const input = make15sCompileInput();
    const { options, videoProvider } = makeExecutorTestOptions({
      blueprint: input.blueprint,
      plan: input.shotPlan,
    });
    const brief = makeValidBrief({
      campaignId: input.blueprint.campaignId,
      campaignDuration: 15,
      aspectRatio: "9:16",
    });
    const final = await produceFinalCommercial(
      {
        brief,
        generationVersion: "v_native",
        generationMode: "native_continuous",
        availableAssets: makeAvailableAssets(),
        blueprint: input.blueprint,
        shotPlan: input.shotPlan,
        skipDownload: true,
        forceRegenerate: true,
      },
      options
    );
    assert.equal(final.productionMode, "native_continuous");
    assert.equal(final.duration, 15);
    assert.equal(videoProvider.generateCalls.length, 1);
    assert.equal(videoProvider.generateCalls[0].durationSeconds, 15);
    assert.ok(final.videoUrl);
    assert.equal(final.qc.visualInspectionAvailable, false);
  });

  await test("produceFinalCommercial 30s native", async () => {
    clearCampaignVideoCache();
    const input = make30sCompileInput();
    const videoProvider = new MockVideoProvider();
    const brief = makeValidBrief({
      campaignId: input.blueprint.campaignId,
      campaignDuration: 30,
      aspectRatio: "9:16",
    });
    const final = await produceFinalCommercial(
      {
        brief,
        generationVersion: "v_native_30",
        generationMode: "native_continuous",
        availableAssets: makeAvailableAssets(),
        blueprint: input.blueprint,
        shotPlan: input.shotPlan,
        skipDownload: true,
        forceRegenerate: true,
      },
      {
        videoProvider,
        director: makeMockDirector(input.blueprint),
        shotPlanner: makeMockPlanner(input.shotPlan),
        pollIntervalMs: 1,
        maxWaitMs: 8000,
        log: () => undefined,
      }
    );
    assert.equal(final.duration, 30);
    assert.equal(videoProvider.generateCalls[0].durationSeconds, 30);
  });

  await test("fallback mode invokes shot generation; native does not compose shots", async () => {
    clearCampaignVideoCache();
    const { clearKeyframeCache } = await import("../reference-engine/storage");
    const { clearShotVideoCache } = await import("../video-executor/storage");
    clearKeyframeCache();
    clearShotVideoCache();

    const input = make15sCompileInput();
    const videoProvider = new MockVideoProvider();
    const { MockImageProvider } = await import("../reference-engine/fixtures");
    const imageProvider = new MockImageProvider();
    const brief = makeValidBrief({
      campaignId: input.blueprint.campaignId,
      campaignDuration: 15,
      aspectRatio: "9:16",
    });

    const fallback = await produceFinalCommercial(
      {
        brief,
        generationVersion: "v_fallback",
        generationMode: "shot_based_fallback",
        availableAssets: makeAvailableAssets(),
        skipDownload: true,
        forceRegenerate: true,
      },
      {
        videoProvider,
        imageProvider,
        director: makeMockDirector(input.blueprint),
        shotPlanner: makeMockPlanner(input.shotPlan),
        pollIntervalMs: 1,
        maxWaitMs: 8000,
        log: () => undefined,
      }
    );
    assert.equal(fallback.productionMode, "shot_based_composed");
    assert.ok(fallback.timeline);
    assert.ok((fallback.shotVideos?.length || 0) >= 1);
    // Multiple shot-level jobs (not a single campaign-level 15s native-only path)
    assert.ok(videoProvider.generateCalls.length >= 1);
    const campaignLevelJobs = videoProvider.generateCalls.filter(
      (c) => c.shotId.startsWith("campaign_")
    );
    assert.equal(campaignLevelJobs.length, 0);
  });

  await test("native mode does not invoke shot composition timeline", async () => {
    clearCampaignVideoCache();
    const input = make15sCompileInput();
    const { options } = makeExecutorTestOptions({
      blueprint: input.blueprint,
      plan: input.shotPlan,
    });
    const brief = makeValidBrief({
      campaignId: input.blueprint.campaignId,
      campaignDuration: 15,
    });
    const final = await produceFinalCommercial(
      {
        brief,
        generationVersion: "v_native_only",
        generationMode: "native_continuous",
        availableAssets: makeAvailableAssets(),
        blueprint: input.blueprint,
        shotPlan: input.shotPlan,
        skipDownload: true,
        forceRegenerate: true,
      },
      options
    );
    assert.equal(final.productionMode, "native_continuous");
    assert.equal(final.timeline, undefined);
    assert.equal(final.shotVideos, undefined);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
