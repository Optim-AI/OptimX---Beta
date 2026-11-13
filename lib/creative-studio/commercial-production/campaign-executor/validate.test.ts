/**
 * Campaign Executor Phase 7 tests — mocked VideoProvider only.
 *
 * Run: npm run test:campaign-executor
 */

import assert from "node:assert/strict";
import { generateCampaignVideo } from "./generate-campaign-video";
import { produceFinalCommercial, isModerationBlock, MODERATION_BLOCK_MESSAGE } from "./produce";
import { CampaignExecutorError } from "./types";
import { parseIsolationVerdict, cropRectForBox } from "../product-understanding/isolate-product";
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
import { buildCampaignPrompt } from "../campaign-compiler/prompt-builder";
import { mapStudioFormToCampaignBrief } from "../studio-mapper";

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

  await test("poll timeout after accept never resubmits the provider job", async () => {
    clearCampaignVideoCache();
    const provider = new MockVideoProvider();
    provider.timeoutOnce = true;
    const result = await generateCampaignVideo(
      { spec: makeNative15sSpec(), skipDownload: true, forceRegenerate: true },
      { videoProvider: provider, pollIntervalMs: 2, maxWaitMs: 30, maxRetries: 2, log: () => undefined }
    );
    assert.equal(result.status, "failed");
    assert.equal(provider.generateCalls.length, 1);
    assert.ok(result.providerJobId, "failed result keeps providerJobId for recovery");
    assert.equal(result.error?.code, "PROVIDER_STILL_RUNNING", "a timeout is resumable, not a failure");
  });

  await test("transient poll errors are tolerated without resubmitting", async () => {
    clearCampaignVideoCache();
    const provider = new MockVideoProvider();
    provider.transientPollErrors = 2;
    const result = await generateCampaignVideo(
      { spec: makeNative15sSpec(), skipDownload: true, forceRegenerate: true },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000, log: () => undefined }
    );
    assert.equal(result.status, "completed");
    assert.equal(provider.generateCalls.length, 1);
  });

  await test("transient submit failure (before accept) still retries", async () => {
    clearCampaignVideoCache();
    const provider = new MockVideoProvider();
    provider.failNextGenerate = true;
    const result = await generateCampaignVideo(
      { spec: makeNative15sSpec(), skipDownload: true, forceRegenerate: true },
      { videoProvider: provider, pollIntervalMs: 1, maxWaitMs: 5000, log: () => undefined }
    );
    assert.equal(result.status, "completed");
    assert.equal(provider.generateCalls.length, 2);
  });

  await test("expired deadline fails without submitting a provider job", async () => {
    clearCampaignVideoCache();
    const provider = new MockVideoProvider();
    const result = await generateCampaignVideo(
      { spec: makeNative15sSpec(), skipDownload: true, forceRegenerate: true },
      { videoProvider: provider, pollIntervalMs: 1, deadlineAt: Date.now() - 1, log: () => undefined }
    );
    assert.equal(result.status, "failed");
    assert.equal(provider.generateCalls.length, 0);
  });

  await test("product photo handling reaches the director and the video prompt", async () => {
    clearCampaignVideoCache();
    const input = make15sCompileInput();
    const base = makeValidBrief({ campaignId: input.blueprint.campaignId, campaignDuration: 15 });
    const brief = {
      ...base,
      product: {
        ...base.product,
        images: [
          { id: "p1", kind: "product_image" as const, url: "https://example.com/jar.png", mimeType: "image/png" },
        ],
      },
    };
    const { options, videoProvider } = makeExecutorTestOptions({
      blueprint: input.blueprint,
      plan: input.shotPlan,
    });
    let directorSawHandling = "";
    const director = options.director!;
    const final = await produceFinalCommercial(
      {
        brief,
        generationVersion: "v_handling",
        generationMode: "native_continuous",
        availableAssets: makeAvailableAssets(),
        shotPlan: input.shotPlan,
        skipDownload: true,
        forceRegenerate: true,
      },
      {
        ...options,
        director: {
          ...director,
          direct: async (b) => {
            directorSawHandling = b.product.handling || "";
            return director.direct(b);
          },
        },
        productAnalyzer: async () => ({
          containerType: "glass jar",
          closureType: "screw-top lid",
          openingAction: "twist the lid counter-clockwise and lift it off.",
          forbiddenInteractions: ["peeling a foil seal"],
        }),
      }
    );
    assert.ok(directorSawHandling.includes("screw-top lid"));
    const sentPrompt = videoProvider.generateCalls[0].prompt.promptText;
    assert.ok(sentPrompt.includes("PRODUCT HANDLING"));
    assert.ok(sentPrompt.includes("twist the lid counter-clockwise"));
    assert.ok(sentPrompt.includes("Never show: peeling a foil seal"));
    assert.equal(final.productionMode, "native_continuous");
  });

  await test("dubbed-language prompt asks for silent acting and a faceless product ending", () => {
    const input = make30sCompileInput();
    const blueprint = {
      ...input.blueprint,
      visualBeats: input.blueprint.visualBeats.map((b, i) =>
        i === input.blueprint.visualBeats.length - 1
          ? { ...b, purpose: "She speaks to camera about the taste" }
          : b
      ),
    };
    const { campaignPrompt } = buildCampaignPrompt({
      blueprint,
      shotPlan: input.shotPlan,
      suppressSpokenVoiceover: true,
    });
    assert.ok(campaignPrompt.includes("Nobody speaks on camera"));
    assert.ok(campaignPrompt.includes("no faces in frame"));
    assert.ok(!/speaks to camera/i.test(campaignPrompt));
    const english = buildCampaignPrompt({ blueprint, shotPlan: input.shotPlan });
    assert.ok(!english.campaignPrompt.includes("Nobody speaks on camera"));
  });

  await test("visual style decides structure; realism rule always present", () => {
    const input = make15sCompileInput();
    const showcase = buildCampaignPrompt({ ...input, creativeStyle: "product_showcase" }).campaignPrompt;
    assert.ok(showcase.includes("edited sequence of shots"));
    assert.ok(showcase.includes("Style: Product Showcase (4–6 shots)"));
    assert.ok(!showcase.includes("single unbroken take"));
    const ugc = buildCampaignPrompt({ ...input, creativeStyle: "ugc" }).campaignPrompt;
    assert.ok(ugc.includes("single unbroken take"));
    assert.ok(ugc.includes("Style: UGC"));
    for (const p of [showcase, ugc]) assert.ok(p.includes("no glowing light rays"));
    const withCard = buildCampaignPrompt({ ...input, endCard: true }).campaignPrompt;
    assert.ok(withCard.includes("lower third is plain, empty background"));
    assert.ok(!showcase.includes("lower third is plain"));
    // Words like "end card" make the video model draw (garbled) text.
    assert.ok(!/end card|closing line/i.test(withCard));
    for (const p of [showcase, ugc, withCard]) assert.ok(p.includes("NO WRITTEN WORDS"));
  });

  await test("Studio creative format and end card reach the brief", () => {
    const brief = mapStudioFormToCampaignBrief({
      campaignId: "c1",
      product: { product_name: "Oorgaa Pickle" },
      adSetup: { duration: 15, aspect_ratio: "9:16", creativeFormat: "Motion Graphics" },
      endCard: { enabled: true, offer: " Buy 2 get 1 ", cta: " இப்போவே வாங்குங்க ", contact: "" },
    });
    assert.equal(brief.creativeStyle, "motion_graphics");
    assert.deepEqual(brief.endCard, { enabled: true, offer: "Buy 2 get 1", cta: "இப்போவே வாங்குங்க", contact: undefined });
    const off = mapStudioFormToCampaignBrief({
      campaignId: "c2",
      product: { product_name: "X" },
      adSetup: { duration: 15, aspect_ratio: "9:16", creativeFormat: "Unknown" },
      endCard: { enabled: false },
    });
    assert.equal(off.creativeStyle, undefined);
    assert.equal(off.endCard, undefined);
  });

  await test("end card failure keeps the commercial", async () => {
    clearCampaignVideoCache();
    const input = make15sCompileInput();
    const brief = makeValidBrief({
      campaignId: input.blueprint.campaignId,
      campaignDuration: 15,
      endCard: { enabled: true, offer: "20% off" },
    });
    const { options } = makeExecutorTestOptions({ blueprint: input.blueprint, plan: input.shotPlan });
    const final = await produceFinalCommercial(
      {
        brief,
        generationVersion: "v_card",
        availableAssets: makeAvailableAssets(),
        blueprint: input.blueprint,
        shotPlan: input.shotPlan,
        skipDownload: true,
        forceRegenerate: true,
      },
      { ...options, endCardAttacher: async () => { throw new Error("ffmpeg exploded"); } }
    );
    assert.ok(final.videoUrl);
    assert.equal(final.productionMode, "native_continuous");
  });

  await test("planner text that asks for on-screen words is removed from the video prompt", () => {
    const input = make15sCompileInput();
    const blueprint = {
      ...input.blueprint,
      visualBeats: input.blueprint.visualBeats.map((b, i) =>
        i === input.blueprint.visualBeats.length - 1 ? { ...b, purpose: "End card with tagline appears over the jar" } : b
      ),
    };
    const { campaignPrompt } = buildCampaignPrompt({ blueprint, shotPlan: input.shotPlan, suppressSpokenVoiceover: true });
    assert.ok(!/end card|tagline/i.test(campaignPrompt), "end card / tagline wording stripped");
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
        productAnalyzer: null,
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


  await test("slow provider: produce hands over job id, blueprint and shot plan", async () => {
    clearCampaignVideoCache();
    const input = make15sCompileInput();
    const provider = new MockVideoProvider();
    provider.timeoutOnce = true;
    const { options } = makeExecutorTestOptions({ videoProvider: provider, blueprint: input.blueprint, plan: input.shotPlan });
    const brief = makeValidBrief({ campaignId: input.blueprint.campaignId, campaignDuration: 15 });
    let caught: unknown;
    try {
      await produceFinalCommercial(
        { brief, generationVersion: "v_slow", generationMode: "native_continuous", availableAssets: makeAvailableAssets(), skipDownload: true, forceRegenerate: true },
        { ...options, maxWaitMs: 20, pollIntervalMs: 2 }
      );
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof CampaignExecutorError);
    assert.equal(caught.code, "PROVIDER_STILL_RUNNING");
    const d = caught.details as { providerJobId?: string; blueprint?: unknown; shotPlan?: unknown };
    assert.ok(d.providerJobId && d.blueprint && d.shotPlan);
    assert.equal(provider.generateCalls.length, 1);
  });

  await test("resume waits on the existing job and never submits a new one", async () => {
    clearCampaignVideoCache();
    const input = make15sCompileInput();
    const provider = new MockVideoProvider();
    const { options } = makeExecutorTestOptions({ videoProvider: provider, blueprint: input.blueprint, plan: input.shotPlan });
    const brief = makeValidBrief({ campaignId: input.blueprint.campaignId, campaignDuration: 15 });
    const final = await produceFinalCommercial(
      {
        brief,
        generationVersion: "v_resume",
        generationMode: "native_continuous",
        availableAssets: makeAvailableAssets(),
        blueprint: input.blueprint,
        shotPlan: input.shotPlan,
        skipDownload: true,
        forceRegenerate: true,
      },
      { ...options, resumeProviderJobId: "runway-job-from-earlier" }
    );
    assert.equal(provider.generateCalls.length, 0, "no second provider charge");
    assert.ok(provider.getJobCalls.includes("runway-job-from-earlier"));
    assert.ok(final.videoUrl.includes("runway-job-from-earlier"));
  });

  await test("provider moderation block becomes a plain CONTENT_BLOCKED message", async () => {
    clearCampaignVideoCache();
    class BlockedProvider extends MockVideoProvider {
      async getJob(providerJobId: string) {
        return {
          providerJobId,
          state: "failed" as const,
          failureReason: "Your request was blocked by this model provider's content moderation system. SAFETY.OUTPUT.THIRD_PARTY",
        };
      }
    }
    const input = make15sCompileInput();
    const provider = new BlockedProvider();
    const { options } = makeExecutorTestOptions({ videoProvider: provider, blueprint: input.blueprint, plan: input.shotPlan });
    const brief = makeValidBrief({ campaignId: input.blueprint.campaignId, campaignDuration: 15 });
    let caught: unknown;
    try {
      await produceFinalCommercial(
        { brief, generationVersion: "v_blocked", generationMode: "native_continuous", availableAssets: makeAvailableAssets(), skipDownload: true, forceRegenerate: true },
        options
      );
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof CampaignExecutorError);
    assert.equal(caught.code, "CONTENT_BLOCKED");
    assert.equal(caught.message, MODERATION_BLOCK_MESSAGE);
    assert.ok(isModerationBlock("SAFETY.INPUT.IMAGE"));
    assert.ok(!isModerationBlock("Video job timed out after 720s"));
  });

  await test("product photo with other brands is swapped for the cropped copy", async () => {
    clearCampaignVideoCache();
    const input = make15sCompileInput();
    const { options, videoProvider } = makeExecutorTestOptions({ blueprint: input.blueprint, plan: input.shotPlan });
    const assets = makeAvailableAssets();
    const original = assets.productImages![0];
    const cropped = { ...original, url: "data:image/jpeg;base64,Q1JPUFBFRA==" };
    const brief = makeValidBrief({ campaignId: input.blueprint.campaignId, campaignDuration: 15 });
    brief.product = { ...brief.product, images: [original] };
    const seen: string[] = [];
    await produceFinalCommercial(
      {
        brief,
        generationVersion: "v_crop",
        generationMode: "native_continuous",
        availableAssets: assets,
        blueprint: input.blueprint,
        shotPlan: input.shotPlan,
        skipDownload: true,
        forceRegenerate: true,
      },
      {
        ...options,
        productIsolator: async ({ image }) => {
          seen.push(image.url);
          return { image: cropped, otherBrands: ["TUMBI"] };
        },
      }
    );
    assert.deepEqual(seen, [original.url]);
    const sent = JSON.stringify(videoProvider.generateCalls[0]);
    assert.ok(sent.includes(cropped.url), "cropped photo reaches the video provider");
    assert.ok(!sent.includes(original.url), "original busy photo is not sent");
  });

  await test("isolation verdict parsing and crop maths", () => {
    const v = parseIsolationVerdict('```json\n{"box_2d":[10,250,920,750],"otherBrandsVisible":true,"otherBrands":["TUMBI"]}\n```');
    assert.ok(v);
    assert.equal(v.otherBrandsVisible, true);
    assert.deepEqual(v.otherBrands, ["TUMBI"]);
    assert.equal(parseIsolationVerdict('{"box_2d":[0,0,10,10],"otherBrandsVisible":true}'), null, "tiny box rejected");
    assert.equal(parseIsolationVerdict("not json"), null);
    const rect = cropRectForBox([10, 250, 920, 750], 1000, 2000);
    assert.ok(rect.left >= 200 && rect.left < 250);
    assert.ok(rect.left + rect.width <= 1000 && rect.top >= 0 && rect.top + rect.height <= 2000);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
