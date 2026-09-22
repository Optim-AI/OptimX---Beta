/**
 * Video Executor Phase 5 tests — mocked VideoProvider only (no live Runway).
 *
 * Run: npm run test:video-executor
 */

import assert from "node:assert/strict";
import { clearShotVideoCache } from "./storage";
import { generateCommercialShotVideo } from "./executor";
import { generateCommercialShotVideos } from "./batch";
import { buildVideoGenerationPrompt } from "./prompt-builder";
import { buildVideoExecutionRequest, adaptProviderDuration } from "./request-builder";
import { resolveVideoReferences } from "./reference-resolver";
import { VIDEO_EXECUTOR_MODEL, VIDEO_EXECUTOR_PROVIDER, VideoExecutorError } from "./types";
import {
  MockVideoProvider,
  getImageToVideoMissingKeyframe,
  getKeyframeFirstPrepared,
  getMotionGraphicsPrepared,
  getTextToVideoPrepared,
  makeApprovedKeyframe,
} from "./fixtures";
import { prepareShotForVideo } from "../reference-engine/prepare";
import { makeValidProtein30sShotPlan } from "../shot-planner/fixtures";

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
  console.log("\nVideo Executor tests\n");
  clearShotVideoCache();

  await test("keyframe-first: provider called with start frame + seedance2_5", async () => {
    clearShotVideoCache();
    const { blueprint, prepared } = getKeyframeFirstPrepared();
    const provider = new MockVideoProvider();
    const result = await generateCommercialShotVideo(
      { blueprint, prepared, skipDownload: true, skipStorage: true },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000 }
    );
    assert.equal(result.status, "completed");
    assert.equal(provider.generateCalls.length, 1);
    assert.equal(provider.generateCalls[0].mode, "image-to-video");
    assert.ok(provider.generateCalls[0].startFrame?.url);
    assert.equal(result.provider, VIDEO_EXECUTOR_PROVIDER);
    assert.equal(result.model, VIDEO_EXECUTOR_MODEL);
    assert.equal(result.generationMode, "image_to_video");
    assert.ok(result.sourceKeyframeAssetId);
    assert.ok(result.videoAsset?.url);
  });

  await test("text-to-video: no keyframe, provider called", async () => {
    clearShotVideoCache();
    const { blueprint, prepared } = getTextToVideoPrepared();
    const provider = new MockVideoProvider();
    assert.equal(prepared.generationMode, "text_to_video");
    assert.ok(!prepared.keyframe);
    const result = await generateCommercialShotVideo(
      { blueprint, prepared, skipDownload: true },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000 }
    );
    assert.equal(result.status, "completed");
    assert.equal(provider.generateCalls.length, 1);
    assert.equal(provider.generateCalls[0].mode, "text-to-video");
    assert.ok(!provider.generateCalls[0].startFrame);
  });

  await test("missing keyframe: KEYFRAME_REQUIRED and provider NOT called", async () => {
    clearShotVideoCache();
    const { blueprint, prepared } = getImageToVideoMissingKeyframe();
    const provider = new MockVideoProvider();
    let threw = false;
    try {
      await generateCommercialShotVideo(
        { blueprint, prepared, skipDownload: true },
        { videoProvider: provider, pollIntervalMs: 1 }
      );
    } catch (e) {
      threw = true;
      assert.ok(e instanceof VideoExecutorError);
      assert.equal(e.code, "KEYFRAME_REQUIRED");
    }
    assert.equal(threw, true);
    assert.equal(provider.generateCalls.length, 0);
  });

  await test("wrong provider requirement fails validation", async () => {
    clearShotVideoCache();
    const { blueprint, prepared } = getKeyframeFirstPrepared();
    const provider = new MockVideoProvider();
    const bad = {
      ...prepared,
      providerRequirements: { provider: "veo" as "runway", model: "seedance2_5" as const },
    };
    let threw = false;
    try {
      await generateCommercialShotVideo(
        { blueprint, prepared: bad, skipDownload: true },
        { videoProvider: provider }
      );
    } catch (e) {
      threw = true;
      assert.ok(e instanceof VideoExecutorError);
      assert.equal(e.code, "VIDEO_PROVIDER_UNAVAILABLE");
    }
    assert.equal(threw, true);
    assert.equal(provider.generateCalls.length, 0);
  });

  await test("Seedance model seedance2_5 passed through", async () => {
    clearShotVideoCache();
    const { blueprint, prepared } = getKeyframeFirstPrepared();
    assert.equal(prepared.providerRequirements.model, "seedance2_5");
    const provider = new MockVideoProvider();
    const result = await generateCommercialShotVideo(
      { blueprint, prepared, skipDownload: true },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000 }
    );
    assert.equal(result.model, "seedance2_5");
    assert.equal(provider.generateCalls[0] && VIDEO_EXECUTOR_MODEL, "seedance2_5");
  });

  await test("duration maps shot.durationSeconds to provider request", async () => {
    clearShotVideoCache();
    const { blueprint, prepared } = getKeyframeFirstPrepared();
    const provider = new MockVideoProvider();
    await generateCommercialShotVideo(
      { blueprint, prepared, skipDownload: true },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000 }
    );
    const expected = adaptProviderDuration(
      prepared.shot.durationSeconds,
      provider.getCapabilities()
    );
    assert.equal(provider.generateCalls[0].durationSeconds, expected);
  });

  await test("aspect ratio propagates from blueprint", async () => {
    clearShotVideoCache();
    const { blueprint, prepared } = getKeyframeFirstPrepared();
    const provider = new MockVideoProvider();
    await generateCommercialShotVideo(
      { blueprint, prepared, skipDownload: true },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000 }
    );
    assert.equal(provider.generateCalls[0].aspectRatio, blueprint.aspectRatio);
  });

  await test("previous-shot reference resolution on prepared shot", async () => {
    const { blueprint, prepared } = getKeyframeFirstPrepared();
    const withPrev = {
      ...prepared,
      references: [
        ...prepared.references,
        {
          type: "previous_shot" as const,
          assetId: "kf_prev",
          url: "https://example.com/keyframes/prev.png",
        },
      ],
    };
    const refs = resolveVideoReferences(withPrev);
    // I2V does not duplicate previous-shot as provider refs (keyframe is start frame)
    assert.ok(refs.startFrame);
    assert.equal(refs.previousShotReferences.length, 1);
  });

  await test("idempotency: second call does not create another provider job", async () => {
    clearShotVideoCache();
    const { blueprint, prepared } = getKeyframeFirstPrepared();
    const provider = new MockVideoProvider();
    const first = await generateCommercialShotVideo(
      { blueprint, prepared, skipDownload: true, generationVersion: "v1" },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000 }
    );
    const second = await generateCommercialShotVideo(
      { blueprint, prepared, skipDownload: true, generationVersion: "v1" },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000 }
    );
    assert.equal(provider.generateCalls.length, 1);
    assert.equal(first.providerJobId, second.providerJobId);
    assert.equal(second.status, "completed");
  });

  await test("existing in-flight job returned instead of duplicate submit", async () => {
    clearShotVideoCache();
    const { blueprint, prepared } = getKeyframeFirstPrepared();
    const provider = new MockVideoProvider();
    provider.jobDelayPolls = 5;

    const p1 = generateCommercialShotVideo(
      { blueprint, prepared, skipDownload: true, generationVersion: "v_inflight" },
      { videoProvider: provider, pollIntervalMs: 5, maxWaitMs: 5000 }
    );
    // Allow first to mark in-flight
    await new Promise((r) => setTimeout(r, 10));
    const mid = await generateCommercialShotVideo(
      { blueprint, prepared, skipDownload: true, generationVersion: "v_inflight" },
      { videoProvider: provider, pollIntervalMs: 5, maxWaitMs: 5000 }
    );
    assert.ok(mid.status === "processing" || mid.status === "completed" || mid.status === "queued");
    const done = await p1;
    assert.equal(done.status, "completed");
    // Only one generate call despite overlapping requests
    assert.equal(provider.generateCalls.length, 1);
  });

  await test("retryable provider failure retries then succeeds", async () => {
    clearShotVideoCache();
    const { blueprint, prepared } = getTextToVideoPrepared();
    const provider = new MockVideoProvider();
    provider.failNextGenerate = true;
    const result = await generateCommercialShotVideo(
      { blueprint, prepared, skipDownload: true, generationVersion: "v_retry" },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000, maxRetries: 2 }
    );
    assert.equal(result.status, "completed");
    assert.ok(provider.generateCalls.length >= 2);
  });

  await test("permanent provider failure does not loop forever", async () => {
    clearShotVideoCache();
    const { blueprint, prepared } = getTextToVideoPrepared();
    const provider = new MockVideoProvider();
    provider.failNextGeneratePermanent = true;
    const result = await generateCommercialShotVideo(
      { blueprint, prepared, skipDownload: true, generationVersion: "v_perm" },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 2000, maxRetries: 3 }
    );
    assert.equal(result.status, "failed");
    assert.equal(result.error?.code, "VIDEO_REQUEST_INVALID");
    assert.equal(provider.generateCalls.length, 1);
  });

  await test("provider timeout → VIDEO_JOB_TIMEOUT / failed", async () => {
    clearShotVideoCache();
    const { blueprint, prepared } = getTextToVideoPrepared();
    const provider = new MockVideoProvider();
    provider.timeoutOnce = true;
    const result = await generateCommercialShotVideo(
      { blueprint, prepared, skipDownload: true, generationVersion: "v_timeout" },
      { videoProvider: provider, pollIntervalMs: 5, maxWaitMs: 40, maxRetries: 0 }
    );
    assert.equal(result.status, "failed");
    assert.equal(result.error?.code, "VIDEO_JOB_TIMEOUT");
  });

  await test("completed video has stored asset metadata", async () => {
    clearShotVideoCache();
    const { blueprint, prepared } = getKeyframeFirstPrepared();
    const provider = new MockVideoProvider();
    const result = await generateCommercialShotVideo(
      { blueprint, prepared, skipDownload: true, generationVersion: "v_asset" },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000 }
    );
    assert.equal(result.status, "completed");
    assert.ok(result.videoAsset?.assetId);
    assert.ok(result.videoAsset?.url);
    assert.equal(result.videoAsset?.mimeType, "video/mp4");
    assert.ok(result.qc?.passed);
  });

  await test("failed generation normalizes error", async () => {
    clearShotVideoCache();
    const { blueprint, prepared } = getTextToVideoPrepared();
    const provider = new MockVideoProvider();
    provider.failNextGeneratePermanent = true;
    const result = await generateCommercialShotVideo(
      { blueprint, prepared, skipDownload: true, generationVersion: "v_fail" },
      { videoProvider: provider, maxRetries: 0 }
    );
    assert.equal(result.status, "failed");
    assert.ok(result.error?.code);
    assert.ok(result.error?.message);
  });

  await test("motion graphics: Runway NOT called, status deferred", async () => {
    clearShotVideoCache();
    const { blueprint, prepared } = getMotionGraphicsPrepared();
    const provider = new MockVideoProvider();
    const result = await generateCommercialShotVideo(
      { blueprint, prepared, skipDownload: true },
      { videoProvider: provider }
    );
    assert.equal(result.status, "deferred");
    assert.equal(result.metadata.handledByCompositor, true);
    assert.equal(provider.generateCalls.length, 0);
  });

  await test("motion-first I2V prompt preserves starting frame, does not redefine scene", async () => {
    const { blueprint, prepared } = getKeyframeFirstPrepared();
    const prompt = buildVideoGenerationPrompt({
      blueprint,
      shot: prepared.shot,
      generationMode: "image_to_video",
    });
    assert.match(prompt.promptText, /starting frame/i);
    assert.match(prompt.promptText, /Motion|Camera|preserve/i);
  });

  await test("end-to-end mocked: PreparedShot → executor → completed ShotVideoResult", async () => {
    clearShotVideoCache();
    const blueprint = getKeyframeFirstPrepared().blueprint;
    const plan = makeValidProtein30sShotPlan();
    const provider = new MockVideoProvider();

    const preparedShots = plan.shots.map((shot) => {
      const productRefs = [
        { type: "product" as const, assetId: "product-1", url: "https://example.com/product.png" },
      ];
      const prepared = prepareShotForVideo({
        shot,
        references: productRefs,
      });
      if (prepared.generationMode === "image_to_video") {
        return prepareShotForVideo({
          shot,
          keyframe: makeApprovedKeyframe(shot.id, blueprint.campaignId),
          references: productRefs,
        });
      }
      return prepareShotForVideo({
        shot,
        references: shot.referenceRequirements.productReferenceRequired
          ? productRefs
          : undefined,
      });
    });

    const results = await generateCommercialShotVideos(
      {
        blueprint,
        preparedShots,
        skipDownload: true,
        generationVersion: "v_e2e",
        concurrency: 2,
      },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 8000 }
    );

    assert.equal(results.length, preparedShots.length);
    for (const r of results) {
      assert.equal(r.campaignId, blueprint.campaignId);
      assert.ok(r.shotId);
      assert.equal(r.provider, "runway");
      if (r.generationMode === "motion_graphics" || r.generationMode === "composited") {
        assert.equal(r.status, "deferred");
      } else {
        assert.equal(r.status, "completed");
        assert.equal(r.model, "seedance2_5");
        assert.ok(r.prompt);
        assert.ok(r.videoAsset?.url);
        if (r.generationMode === "image_to_video") {
          assert.ok(r.sourceKeyframeAssetId);
        }
      }
    }
    assert.ok(provider.generateCalls.length > 0);
  });

  await test("buildVideoExecutionRequest capability validation", async () => {
    const { blueprint, prepared } = getKeyframeFirstPrepared();
    const provider = new MockVideoProvider();
    const req = buildVideoExecutionRequest({
      blueprint,
      prepared,
      capabilities: provider.getCapabilities(),
    });
    assert.equal(req.providerMode, "image-to-video");
    assert.equal(req.aspectRatio, blueprint.aspectRatio);
    assert.ok(req.startFrame);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
