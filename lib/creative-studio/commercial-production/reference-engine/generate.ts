/**
 * Commercial keyframe generation service — Phase 4.
 *
 * ShotPlan shot → Reference Strategy → Nano Banana → QC → Approved Keyframe
 * → PreparedShotForVideo (Phase 5 handoff).
 *
 * Does NOT import or call RunwayProvider / Seedance.
 */

import type { CommercialKeyframe } from "../keyframes/types";
import { createNanoBananaProvider } from "./nano-banana-provider";
import { prepareShotForVideo } from "./prepare";
import { buildKeyframeSpecification, refinePromptFromQc } from "./prompt-builder";
import { runDeterministicKeyframeQc, UnavailableVisualKeyframeQC } from "./qc";
import { resolveReferenceStrategy } from "./reference-strategy";
import { resolveKeyframeReferences } from "./resolve-references";
import {
  cacheApprovedKeyframe,
  getCachedApprovedKeyframe,
  keyframeIdempotencyKey,
  storeKeyframeBuffer,
} from "./storage";
import type {
  GenerateCommercialKeyframeInput,
  ImageGenerationProvider,
  KeyframeAttemptRecord,
  KeyframeResult,
  KeyframeVisualQC,
  PreparedShotForVideo,
  ReferenceAsset,
  ReferenceEngineOptions,
} from "./types";
import { ReferenceEngineError } from "./types";

export type { ReferenceEngineOptions };

function defaultLog(event: string, payload: Record<string, unknown>): void {
  console.log(`[reference-engine] ${event}`, payload);
}

function instructionForRef(type: ReferenceAsset["type"]): string {
  switch (type) {
    case "product":
      return "The image above is the PRODUCT REFERENCE. Preserve exact packaging, label, colors, and geometry. Do NOT regenerate or replace this product.";
    case "character":
      return "The image above is a CHARACTER REFERENCE. Preserve identity, face, hair, and wardrobe continuity.";
    case "previous_shot":
      return "The image above is the APPROVED PREVIOUS-SHOT KEYFRAME. Maintain continuity of wardrobe, environment, lighting, and subject identity.";
    case "brand":
      return "The image above is the BRAND LOGO reference. Do not invent alternate logos.";
    default:
      return "The image above is a visual reference for continuity/context.";
  }
}

export async function generateCommercialKeyframe(
  input: GenerateCommercialKeyframeInput,
  options: ReferenceEngineOptions = {}
): Promise<KeyframeResult> {
  const log = options.log ?? defaultLog;
  const provider = options.imageProvider ?? createNanoBananaProvider();
  const visualQc = options.visualQc ?? new UnavailableVisualKeyframeQC();
  const maxAttempts = input.maxAttempts ?? options.maxAttempts ?? 2;
  const { blueprint, shot } = input;

  if (!shot?.id || !blueprint?.campaignId) {
    throw new ReferenceEngineError("INVALID_SHOT", "campaignId and shot.id are required");
  }

  const plan = resolveReferenceStrategy(shot);
  const baseIdempotency = keyframeIdempotencyKey({
    campaignId: blueprint.campaignId,
    shotId: shot.id,
    generationVersion: "v1",
    attempt: 0,
  });

  log("keyframe.start", {
    campaignId: blueprint.campaignId,
    shotId: shot.id,
    strategy: plan.strategy,
    keyframeRequired: plan.keyframeRequired,
    callImageProvider: plan.callImageProvider,
    provider: provider.id,
    model: provider.modelId,
  });

  // Idempotency: reuse approved keyframe unless force
  if (!input.forceRegenerate) {
    const cached = getCachedApprovedKeyframe(blueprint.campaignId, shot.id);
    const fromAssets = input.availableAssets?.approvedKeyframesByShotId?.[shot.id];
    const existing =
      cached ||
      (fromAssets?.status === "approved" ? fromAssets : undefined);
    if (existing) {
      log("keyframe.reuse_approved", {
        campaignId: blueprint.campaignId,
        shotId: shot.id,
        keyframeId: existing.keyframeId,
      });
      return existing;
    }
  }

  // Bypass Nano Banana when not required
  if (!plan.callImageProvider) {
    const skipped: KeyframeResult = {
      shotId: shot.id,
      campaignId: blueprint.campaignId,
      keyframeId: `skip_${shot.id}`,
      status: "skipped",
      keyframeRequired: false,
      skippedReason: `Strategy ${plan.strategy}: ${plan.reasons.join("; ")}`,
      referenceAssetIds: [],
      metadata: {
        attempt: 0,
        idempotencyKey: baseIdempotency,
        visualInspectionAvailable: false,
        aspectRatio: blueprint.aspectRatio,
      },
      attempts: [],
    };
    log("keyframe.skipped", {
      campaignId: blueprint.campaignId,
      shotId: shot.id,
      strategy: plan.strategy,
      reason: skipped.skippedReason,
    });
    return skipped;
  }

  const availability = provider.checkAvailability();
  if (!availability.available) {
    throw new ReferenceEngineError("PROVIDER_UNAVAILABLE", availability.message);
  }

  let resolved = resolveKeyframeReferences({
    shot,
    plan,
    availableAssets: input.availableAssets,
    sessionKeyframes: input.availableAssets?.approvedKeyframesByShotId,
    strict: true,
  });

  const specification = buildKeyframeSpecification({
    blueprint,
    shot,
    plan,
    resolvedReferences: resolved.references,
  });

  if (!specification.imageGenerationPrompt) {
    throw new ReferenceEngineError("INVALID_SPECIFICATION", "Empty keyframe prompt");
  }

  const attempts: KeyframeAttemptRecord[] = [];
  let lastResult: KeyframeResult | undefined;
  let prompt = specification.imageGenerationPrompt;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const started = Date.now();
    const idempotencyKey = keyframeIdempotencyKey({
      campaignId: blueprint.campaignId,
      shotId: shot.id,
      generationVersion: "v1",
      attempt,
    });

    log("keyframe.attempt", {
      campaignId: blueprint.campaignId,
      shotId: shot.id,
      attempt,
      strategy: plan.strategy,
      referenceCount: resolved.references.length,
      productReference: resolved.references.some((r) => r.type === "product"),
      characterReference: resolved.references.some((r) => r.type === "character"),
      previousShotReference: resolved.references.some((r) => r.type === "previous_shot"),
      provider: provider.id,
      model: provider.modelId,
      idempotencyKey,
    });

    try {
      const image = await provider.generateImage({
        purpose: "commercial_keyframe",
        campaignId: blueprint.campaignId,
        shotId: shot.id,
        prompt,
        negativePrompt: specification.negativePrompt,
        aspectRatio: blueprint.aspectRatio,
        referenceImages: resolved.references.map((r) => ({
          type: r.type,
          assetId: r.assetId,
          url: r.url,
          dataUrl: r.dataUrl,
          instruction: instructionForRef(r.type),
        })),
        metadata: {
          strategy: plan.strategy,
          productReferenceRequired: plan.productReferenceRequired,
          keyframeRequired: plan.keyframeRequired,
          idempotencyKey,
          attempt,
        },
      });

      let url = image.dataUrl;
      let storagePath: string | undefined;
      let assetId = `kf_${blueprint.campaignId}_${shot.id}_a${attempt}`;

      if (!input.skipStorage) {
        const stored = await storeKeyframeBuffer({
          buffer: image.buffer,
          campaignId: blueprint.campaignId,
          shotId: shot.id,
          attempt,
          userId: input.userId,
        });
        if (stored) {
          url = stored.url;
          storagePath = stored.storagePath;
          assetId = stored.assetId;
        }
      }

      const durationMs = Date.now() - started;
      const provisional: KeyframeResult = {
        shotId: shot.id,
        campaignId: blueprint.campaignId,
        keyframeId: assetId,
        status: "generated",
        keyframeRequired: true,
        assetId,
        url,
        storagePath,
        provider: image.provider,
        model: image.model,
        generationPrompt: prompt,
        negativePrompt: specification.negativePrompt,
        referenceAssetIds: resolved.references.map((r) => r.assetId),
        specification: { ...specification, imageGenerationPrompt: prompt },
        metadata: {
          aspectRatio: image.aspectRatio || blueprint.aspectRatio,
          generationTimeMs: durationMs,
          attempt,
          idempotencyKey,
          visualInspectionAvailable: visualQc.available,
        },
        attempts,
      };

      const qc = runDeterministicKeyframeQc({
        shot,
        plan,
        specification: provisional.specification!,
        result: provisional,
        references: resolved.references,
        missingReferences: resolved.missing,
      });

      if (visualQc.available) {
        const visual = await visualQc.inspect(provisional, provisional.specification!);
        qc.issues.push(...visual.issues);
        qc.visualInspectionAvailable = true;
        const visualErrors = visual.issues.filter((i) => i.severity === "error");
        if (visualErrors.length) qc.passed = false;
      }

      provisional.qc = qc;
      provisional.status = qc.passed ? "approved" : "rejected";

      const commercialKeyframe: CommercialKeyframe = {
        id: assetId,
        campaignId: blueprint.campaignId,
        shotIds: [shot.id],
        purpose: shot.shotWhy,
        visualDescription: shot.visualDescription,
        establishes: {
          productAppearance: specification.product.state,
          composition: shot.composition,
          environment: shot.environment,
          lighting: shot.lighting,
          characterAppearance: specification.continuity.characterContinuity,
          cameraPosition: shot.framing,
          visualTreatment: blueprint.visualTreatment.visualStyle,
        },
        productReferences: (input.availableAssets?.productImages || []).filter((p) =>
          resolved.references.some((r) => r.assetId === p.id)
        ),
        image: url
          ? {
              id: assetId,
              kind: "keyframe",
              url,
              path: storagePath,
              bucket: "campaign-assets",
              mimeType: "image/png",
              campaignId: blueprint.campaignId,
              shotId: shot.id,
              keyframeId: assetId,
            }
          : undefined,
        status: provisional.status === "approved" ? "ready" : "rejected",
      };
      provisional.commercialKeyframe = commercialKeyframe;

      attempts.push({
        attempt,
        status: provisional.status,
        prompt,
        provider: image.provider,
        model: image.model,
        assetId,
        url,
        qc,
        generatedAt: new Date().toISOString(),
        durationMs,
      });
      provisional.attempts = [...attempts];
      lastResult = provisional;

      log("keyframe.qc", {
        campaignId: blueprint.campaignId,
        shotId: shot.id,
        attempt,
        qcStatus: provisional.status,
        passed: qc.passed,
        score: qc.score,
        durationMs,
      });

      if (qc.passed) {
        cacheApprovedKeyframe(provisional);
        log("keyframe.approved", {
          campaignId: blueprint.campaignId,
          shotId: shot.id,
          keyframeId: provisional.keyframeId,
          attempt,
        });
        return provisional;
      }

      // Repair prompt for next attempt
      prompt = refinePromptFromQc(
        specification.imageGenerationPrompt,
        qc.issues.filter((i) => i.severity === "error" || i.severity === "warning")
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      attempts.push({
        attempt,
        status: "failed",
        prompt,
        errors: [message],
        generatedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
      });
      if (attempt >= maxAttempts) {
        log("keyframe.failed", {
          campaignId: blueprint.campaignId,
          shotId: shot.id,
          attempt,
          failureReason: message,
        });
        if (e instanceof ReferenceEngineError) throw e;
        throw new ReferenceEngineError("IMAGE_GENERATION_FAILED", message);
      }
    }
  }

  if (lastResult) {
    lastResult.status = "rejected";
    lastResult.errors = ["Keyframe QC failed after max attempts"];
    throw new ReferenceEngineError(
      "KEYFRAME_QC_FAILED",
      `Keyframe QC failed for shot ${shot.id} after ${maxAttempts} attempts`,
      { lastResult }
    );
  }

  throw new ReferenceEngineError(
    "IMAGE_GENERATION_FAILED",
    `Keyframe generation failed for shot ${shot.id}`
  );
}

export function prepareCommercialShotForVideo(input: {
  shot: import("../shot-planner/types").CommercialShot;
  keyframe?: KeyframeResult;
  references?: ReferenceAsset[];
}): PreparedShotForVideo {
  return prepareShotForVideo(input);
}
