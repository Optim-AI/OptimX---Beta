/**
 * Produce final commercial — Phase 7 entry.
 *
 * Default: native continuous Seedance 2.5 (ONE 15s/30s generation).
 * Explicit fallback: shot-based Phase 6 path + minimal timeline.
 */

import { createCommercialDirector } from "../commercial-director/director";
import { validateCommercialBlueprint } from "../commercial-director/validate";
import { createShotPlanner } from "../shot-planner/planner";
import { validateShotPlan } from "../shot-planner/validate";
import { compileCampaignGeneration } from "../campaign-compiler";
import { runCommercialQC, attachQcToManifest } from "../commercial-qc/evaluate";
import { buildCreativePlanSummary } from "../studio-mapper";
import { generateCampaignVideo } from "./generate-campaign-video";
import { produceShotBasedFallback } from "./fallback";
import {
  CampaignExecutorError,
  type CampaignExecutorOptions,
  type FinalCommercial,
  type ProduceFinalCommercialInput,
} from "./types";
import {
  VIDEO_EXECUTOR_MODEL,
  VIDEO_EXECUTOR_PROVIDER,
} from "../video-executor/types";
import { usesGeminiTts } from "../audio/voiceover-languages";
import { attachEndCardIfNeeded } from "../finishing/attach-end-card";
import {
  analyzeProductPhysicalProfile,
  productProfileToHandlingText,
  type ProductAnalyzer,
} from "../product-understanding/analyze-product";
import {
  isolateProductPhoto,
  type ProductPhotoIsolator,
} from "../product-understanding/isolate-product";
import type { CampaignBrief, CampaignProductInput } from "../campaign/types";
import type { AvailableCampaignAssets } from "../reference-engine/types";
import type { StoredAssetRef } from "../assets";
import { getAdTypePlaybook } from "../campaign/ad-type";
import {
  attachGeminiVoiceoverIfNeeded,
  VoiceoverPipelineError,
} from "../audio/attach-gemini-voiceover";
import { creatorPhotoGoesToVideo, usesExternalVoiceover } from "../campaign/ugc";
import { describeCreatorPhoto } from "../ugc/creator";

/** Shown to customers when the video provider's safety check refuses the video. */
export const MODERATION_BLOCK_MESSAGE =
  "Our video partner's safety check stopped this video. This usually happens when the product photo also shows other brands' packs, posters or logos. Please use a photo that shows only your product and try again. No Video Credits were used.";

export function isModerationBlock(message: string | undefined): boolean {
  return /content moderation|SAFETY\.(?:INPUT|OUTPUT)|moderation system/i.test(message || "");
}

function defaultLog(event: string, payload: Record<string, unknown>): void {
  console.log(`[campaign-executor] ${event}`, payload);
}

/** Primary + additional products, in reference-image order. */
export function allBriefProducts(brief: CampaignBrief): CampaignProductInput[] {
  return [brief.product, ...(brief.additionalProducts || [])];
}

/**
 * Analyse each product photo (in parallel) and attach handling facts.
 * Per-product failures are logged and skipped — generation continues without them.
 */
async function withProductHandling(
  brief: CampaignBrief,
  analyzer: ProductAnalyzer,
  log: (event: string, payload: Record<string, unknown>) => void
): Promise<CampaignBrief> {
  const products = await Promise.all(
    allBriefProducts(brief).map(async (product) => {
      if (product.handling || !product.images?.length) return product;
      try {
        const profile = await analyzer({
          productName: product.name,
          category: product.category,
          description: product.description,
          images: product.images,
        });
        if (!profile) return product;
        log("produce.product_profile", {
          campaignId: brief.campaignId,
          product: product.name,
          closureType: profile.closureType,
          containerType: profile.containerType,
        });
        return { ...product, handling: productProfileToHandlingText(profile) };
      } catch (err) {
        log("produce.product_profile_failed", {
          campaignId: brief.campaignId,
          product: product.name,
          message: err instanceof Error ? err.message : String(err),
        });
        return product;
      }
    })
  );
  const [primary, ...additional] = products;
  return {
    ...brief,
    product: primary,
    additionalProducts: brief.additionalProducts ? additional : undefined,
  };
}

/**
 * Crop each product's first photo to the product when other brands show around it.
 * Returns the brief and the available assets with the cleaned photos swapped in.
 */
async function withIsolatedProductPhotos(
  brief: CampaignBrief,
  available: AvailableCampaignAssets | undefined,
  isolator: ProductPhotoIsolator,
  log: (event: string, payload: Record<string, unknown>) => void
): Promise<{ brief: CampaignBrief; availableAssets: AvailableCampaignAssets | undefined }> {
  const swaps = new Map<string, StoredAssetRef>();
  const products = await Promise.all(
    allBriefProducts(brief).map(async (product) => {
      const first = product.images?.[0];
      if (!first?.url) return product;
      try {
        const result = await isolator({ productName: product.name, image: first });
        if (!result) return product;
        swaps.set(first.url, result.image);
        log("produce.product_photo_cropped", {
          campaignId: brief.campaignId,
          product: product.name,
          otherBrands: result.otherBrands,
        });
        return { ...product, images: [result.image, ...product.images.slice(1)] };
      } catch (err) {
        log("produce.product_photo_crop_failed", {
          campaignId: brief.campaignId,
          product: product.name,
          message: err instanceof Error ? err.message : String(err),
        });
        return product;
      }
    })
  );
  if (!swaps.size) return { brief, availableAssets: available };
  const [primary, ...additional] = products;
  const swap = (img: StoredAssetRef) => swaps.get(img.url) ?? img;
  return {
    brief: { ...brief, product: primary, additionalProducts: brief.additionalProducts ? additional : undefined },
    availableAssets: available
      ? { ...available, productImages: available.productImages?.map(swap) }
      : available,
  };
}

/** Handling facts for every product, labelled when there is more than one. */
export function combinedProductHandling(brief: CampaignBrief): string | undefined {
  const products = allBriefProducts(brief).filter((p) => p.handling);
  if (products.length <= 1) return products[0]?.handling;
  return products.map((p) => `${p.name} — ${p.handling}`).join(" | ");
}

/** Product photos for every product in the ad, deduplicated by URL, primary first. */
export function mergeProductAssets(
  brief: CampaignBrief,
  available: AvailableCampaignAssets | undefined
): AvailableCampaignAssets {
  const seen = new Set<string>();
  const productImages = [
    ...(available?.productImages || []),
    ...(brief.additionalProducts || []).flatMap((p) => p.images.slice(0, 1)),
  ].filter((img) => {
    if (!img.url || seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  });
  // UGC animals / mascots: the photo rides along as a character reference, after the products.
  // Realistic people are described in words instead (Runway refuses real faces).
  const creator = creatorPhotoGoesToVideo(brief.ugc?.creator) ? brief.ugc?.creator.image : undefined;
  const characterReferences = [
    ...(creator?.url ? [creator] : []),
    ...(available?.characterReferences || []),
  ];
  return { ...available, productImages, characterReferences: characterReferences.length ? characterReferences : undefined };
}


/**
 * Full Phase 7 production:
 * Brief → (Director → Planner) → CampaignGenerationSpec → native Seedance OR shot fallback.
 */
export async function produceFinalCommercial(
  input: ProduceFinalCommercialInput,
  options: CampaignExecutorOptions = {}
): Promise<FinalCommercial> {
  const log = options.log ?? defaultLog;
  const generationVersion = input.generationVersion || "v1";
  const generationMode = input.generationMode || "native_continuous";
  let brief = input.brief;

  if (!brief?.campaignId) {
    throw new CampaignExecutorError("INVALID_SPEC", "brief.campaignId is required");
  }

  log("produce.start", {
    campaignId: brief.campaignId,
    generationVersion,
    generationMode,
    duration: brief.campaignDuration,
  });

  // Explicit fallback — never silently switch from native failure
  if (generationMode === "shot_based_fallback") {
    log("produce.fallback_explicit", { campaignId: brief.campaignId });
    return produceShotBasedFallback(
      {
        brief,
        generationVersion,
        forceRegenerate: input.forceRegenerate,
        availableAssets: input.availableAssets,
        skipDownload: input.skipDownload,
        skipStorage: input.skipStorage,
        concurrency: input.concurrency,
        userId: input.userId,
      },
      options
    );
  }

  // Native continuous path
  // Strip other brands' packs / posters out of product photos first: the video
  // model copies them and provider moderation then blocks the whole video.
  let availableAssetsIn = input.availableAssets;
  const isolator =
    options.productIsolator !== undefined
      ? options.productIsolator
      : options.productAnalyzer === undefined
        ? isolateProductPhoto
        : null;
  if (isolator) {
    ({ brief, availableAssets: availableAssetsIn } = await withIsolatedProductPhotos(
      brief,
      availableAssetsIn,
      isolator,
      log
    ));
  }

  // Read how the real packaging is handled before anyone plans interactions with it.
  const analyzer =
    options.productAnalyzer === undefined ? analyzeProductPhysicalProfile : options.productAnalyzer;
  if (analyzer) {
    brief = await withProductHandling(brief, analyzer, log);
  }

  // A person from an uploaded photo has no description yet — write one so the
  // video can show them without sending the face itself.
  const creator = brief.ugc?.creator;
  if (creator?.kind === "person" && creator.image && !creator.description) {
    const describe = options.creatorDescriber === undefined ? describeCreatorPhoto : options.creatorDescriber;
    if (describe) {
      try {
        const description = await describe(creator.image);
        if (description) brief = { ...brief, ugc: { ...brief.ugc!, creator: { ...creator, description } } };
        log("produce.creator_described", { campaignId: brief.campaignId, described: Boolean(description) });
      } catch (err) {
        log("produce.creator_describe_failed", { campaignId: brief.campaignId, message: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  let blueprint = input.blueprint;
  let shotPlan = input.shotPlan;

  if (!blueprint) {
    const director = options.director ?? createCommercialDirector();
    const output = await director.direct(brief);
    const validation = validateCommercialBlueprint(output.blueprint);
    if (!validation.ok) {
      throw new CampaignExecutorError(
        "INVALID_SPEC",
        `Blueprint validation failed: ${validation.issues.map((i) => i.message).join("; ")}`
      );
    }
    blueprint = output.blueprint;
  }

  if (!shotPlan) {
    const planner = options.shotPlanner ?? createShotPlanner();
    const plan = await planner.plan(blueprint);
    const validation = validateShotPlan(plan);
    if (!validation.ok) {
      throw new CampaignExecutorError(
        "INVALID_SPEC",
        `ShotPlan validation failed: ${validation.issues.map((i) => i.message).join("; ")}`
      );
    }
    shotPlan = plan;
  }

  const suppressSpokenVoiceover = usesExternalVoiceover(brief);

  const availableAssets = mergeProductAssets(brief, availableAssetsIn);
  const hasProductPhotos = Boolean(availableAssets.productImages?.length);
  const spec = compileCampaignGeneration({
    blueprint,
    shotPlan,
    availableAssets,
    generationVersion,
    generationMode: "native_continuous",
    suppressSpokenVoiceover,
    productHandling: combinedProductHandling(brief),
    creativeStyle: brief.creativeStyle,
    endCard: Boolean(brief.endCard?.enabled),
    adType: brief.adType,
    productNames: allBriefProducts(brief).map((p) => p.name),
    occasion: brief.occasion,
    shopDetails: brief.shopDetails,
    adDirection: brief.adDirection,
    ugc: brief.ugc,
    // Brand / shop / festival ads may have no product photo at all.
    requireProductReference: hasProductPhotos || !getAdTypePlaybook(brief.adType).productPhotoOptional,
  });

  log("produce.compiled", {
    campaignId: spec.campaignId,
    duration: spec.duration,
    referenceCount: spec.referenceAssets.length,
    promptLength: spec.campaignPrompt.length,
    suppressSpokenVoiceover,
    voiceoverLanguage: brief.voiceover?.language || "english",
  });

  // Default: download + store in our bucket. Provider output URLs are signed and
  // expire, so they must never be the URL a customer keeps.
  // Gemini TTS path must always download the Seedance MP4 so we can remux audio.
  const skipDownload = suppressSpokenVoiceover
    ? false
    : (input.skipDownload ?? false);
  const skipStorage = suppressSpokenVoiceover
    ? false
    : (input.skipStorage ?? false);

  const native = await generateCampaignVideo(
    {
      spec,
      forceRegenerate: input.forceRegenerate,
      skipDownload,
      skipStorage,
      userId: input.userId,
    },
    options
  );

  if (native.status !== "completed") {
    const raw = native.error?.message || "Native campaign generation failed";
    if (native.error?.code === "PROVIDER_STILL_RUNNING") {
      throw new CampaignExecutorError(
        "PROVIDER_STILL_RUNNING",
        "Your video is taking longer than usual. We're still making it — please keep this page open.",
        { providerJobId: native.providerJobId || undefined, blueprint, shotPlan },
        false
      );
    }
    if (isModerationBlock(raw)) {
      throw new CampaignExecutorError(
        "CONTENT_BLOCKED",
        MODERATION_BLOCK_MESSAGE,
        { error: native.error, providerJobId: native.providerJobId || undefined },
        false
      );
    }
    throw new CampaignExecutorError(
      "NATIVE_GENERATION_FAILED",
      raw,
      { error: native.error, providerJobId: native.providerJobId || undefined },
      true
    );
  }

  let final: FinalCommercial = {
    campaignId: native.campaignId,
    generationVersion: native.generationVersion,
    duration: native.duration,
    aspectRatio: native.aspectRatio,
    productionMode: "native_continuous",
    videoAssetId: native.videoAssetId,
    videoUrl: native.videoUrl,
    provider: VIDEO_EXECUTOR_PROVIDER,
    model: native.model || VIDEO_EXECUTOR_MODEL,
    qc: native.qc,
    compositionStatus: "completed",
    audioTracks: [],
    nativeResult: native,
    // Silent / pre-voice video, kept so a voice-over ad can be re-voiced in another language.
    baseVideoUrl: native.videoUrl,
    creativePlan: buildCreativePlanSummary(blueprint),
    createdAt: new Date().toISOString(),
  };

  if (suppressSpokenVoiceover) {
    try {
      const attached = await attachGeminiVoiceoverIfNeeded(brief, final, { log });
      if (attached) {
        final = attached.final;
        log("produce.gemini_tts", {
          campaignId: final.campaignId,
          language: attached.language,
          voice: attached.voice,
          model: attached.model,
        });
      }
    } catch (ttsErr) {
      if (ttsErr instanceof VoiceoverPipelineError) {
        throw new CampaignExecutorError(
          "NATIVE_GENERATION_FAILED",
          ttsErr.message,
          { phase: ttsErr.phase, error: String(ttsErr.cause ?? ttsErr.message) },
          false
        );
      }
      throw new CampaignExecutorError(
        "NATIVE_GENERATION_FAILED",
        ttsErr instanceof Error
          ? `Gemini voiceover pipeline failed: ${ttsErr.message}`
          : "Gemini voiceover pipeline failed",
        { phase: "VOICEOVER_PIPELINE", error: String(ttsErr) },
        false
      );
    }
  }

  // Finishing: brand end card (offer / CTA / contact / logo) drawn in post.
  // Polish only — if it fails, the commercial ships without it.
  if (brief.endCard?.enabled) {
    try {
      const withCard = await (options.endCardAttacher ?? attachEndCardIfNeeded)(brief, final, { log });
      if (withCard) final = withCard;
    } catch (err) {
      log("produce.end_card_failed", {
        campaignId: final.campaignId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Phase 8 — Commercial QC (deterministic always; visual when analyzer injected / live flag)
  if (input.runCommercialQc !== false) {
    const report = await runCommercialQC(
      {
        campaignBrief: brief,
        blueprint,
        shotPlan,
        finalCommercial: final,
        availableAssets: availableAssetsIn,
        visualAnalyzer: options.visualAnalyzer,
        maxAutoRegenerations: options.maxAutoRegenerations,
      },
      {
        visualAnalyzer: options.visualAnalyzer,
        maxAutoRegenerations: options.maxAutoRegenerations,
        log,
      }
    );
    final = { ...final, commercialQC: report };
    if (final.manifest) {
      final = {
        ...final,
        manifest: attachQcToManifest(final.manifest, report),
      };
    }
    log("produce.qc", {
      campaignId: final.campaignId,
      decision: report.decision,
      deterministicPassed: report.deterministic.passed,
      visualAvailable: report.visual.available,
    });
  }

  log("produce.complete", {
    campaignId: final.campaignId,
    productionMode: final.productionMode,
    duration: final.duration,
    providerJobId: native.providerJobId,
  });

  return final;
}
