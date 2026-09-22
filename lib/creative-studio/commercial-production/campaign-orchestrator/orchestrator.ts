/**
 * Campaign Production Orchestrator — Phase 6.
 *
 * CampaignBrief → Director → ShotPlan → Keyframes → Videos → ProductionManifest
 *
 * Creative logic stays in Phase 2–5. This module only sequences them.
 * Does NOT implement compositor / FFmpeg / final 15s|30s render.
 */

import { createCommercialDirector } from "../commercial-director/director";
import { validateCommercialBlueprint } from "../commercial-director/validate";
import { createShotPlanner } from "../shot-planner/planner";
import { validateShotPlan } from "../shot-planner/validate";
import {
  generateCommercialKeyframe,
  prepareShotForVideo,
} from "../reference-engine";
import { resolveReferenceStrategy } from "../reference-engine/reference-strategy";
import { generateCommercialShotVideo } from "../video-executor";
import type { CommercialShot } from "../shot-planner/types";
import type { KeyframeResult, PreparedShotForVideo } from "../reference-engine/types";
import { ReferenceEngineError } from "../reference-engine/types";
import { VideoExecutorError } from "../video-executor/types";
import { buildShotDependencyGraph, collectShotDependencies } from "./dependencies";
import { buildProductionManifest } from "./manifest";
import { defaultManifestStore, defaultRunStore } from "./state";
import { validateProductionRun } from "./validate";
import {
  CampaignOrchestratorError,
  type CampaignOrchestratorOptions,
  type CampaignProductionRun,
  type CampaignShotProductionState,
  type ProductionError,
  type RunCampaignProductionInput,
} from "./types";

function defaultLog(event: string, payload: Record<string, unknown>): void {
  console.log(`[campaign-orchestrator] ${event}`, payload);
}

function touch(run: CampaignProductionRun): void {
  run.updatedAt = new Date().toISOString();
}

function initShotStates(
  shots: CommercialShot[],
  depMap: Map<string, string[]>
): CampaignShotProductionState[] {
  return [...shots]
    .sort((a, b) => a.sequence - b.sequence)
    .map((shot, index) => ({
      shotId: shot.id,
      index,
      sequence: shot.sequence,
      generationStrategy: shot.generationStrategy.id,
      status: "pending" as const,
      dependencies: depMap.get(shot.id) || collectShotDependencies(shot),
    }));
}

function findShotState(
  run: CampaignProductionRun,
  shotId: string
): CampaignShotProductionState {
  const state = run.shots.find((s) => s.shotId === shotId);
  if (!state) {
    throw new CampaignOrchestratorError(
      "MANIFEST_VALIDATION_FAILED",
      `Missing shot state ${shotId}`,
      "shot_state"
    );
  }
  return state;
}

async function persist(
  run: CampaignProductionRun,
  options: CampaignOrchestratorOptions
): Promise<void> {
  touch(run);
  const store = options.runStore ?? defaultRunStore;
  await store.save(run);
}

/**
 * Execute (or resume) a full campaign production run through Phase 2–5.
 */
export async function runCampaignProduction(
  input: RunCampaignProductionInput,
  options: CampaignOrchestratorOptions = {}
): Promise<CampaignProductionRun> {
  const log = options.log ?? defaultLog;
  const runStore = options.runStore ?? defaultRunStore;
  const manifestStore = options.manifestStore ?? defaultManifestStore;
  const generationVersion = input.generationVersion || "v1";
  const brief = input.brief;

  if (!brief?.campaignId) {
    throw new CampaignOrchestratorError(
      "INVALID_CAMPAIGN_INPUT",
      "CampaignBrief.campaignId is required",
      "validate_input"
    );
  }
  if (brief.campaignDuration !== 15 && brief.campaignDuration !== 30) {
    throw new CampaignOrchestratorError(
      "INVALID_CAMPAIGN_INPUT",
      "CampaignBrief.campaignDuration must be 15 or 30",
      "validate_input"
    );
  }

  let run =
    !input.forceRegenerate
      ? await runStore.get(brief.campaignId, generationVersion)
      : null;

  if (!run) {
    run = {
      campaignId: brief.campaignId,
      generationVersion,
      status: "draft",
      startedAt: new Date().toISOString(),
      brief,
      shots: [],
      errors: [],
    };
  } else {
    run.brief = brief;
    run.errors = run.errors || [];
  }

  log("run.start", {
    campaignId: brief.campaignId,
    generationVersion,
    forceRegenerate: Boolean(input.forceRegenerate),
    resumeStatus: run.status,
  });

  try {
    // ── Stage 1: Commercial Director ─────────────────────────────────────
    if (!run.blueprint || input.forceRegenerate) {
      run.status = "planning";
      await persist(run, options);

      const director = options.director ?? createCommercialDirector();
      try {
        const output = await director.direct(brief);
        const validation = validateCommercialBlueprint(output.blueprint);
        if (!validation.ok) {
          throw new CampaignOrchestratorError(
            "DIRECTOR_FAILED",
            `Blueprint validation failed: ${validation.issues.map((i) => i.message).join("; ")}`,
            "commercial_director",
            { issues: validation.issues }
          );
        }
        run.blueprint = output.blueprint;
        run.status = "blueprint_ready";
        await persist(run, options);
        log("stage.blueprint_ready", { campaignId: brief.campaignId });
      } catch (e) {
        if (e instanceof CampaignOrchestratorError) throw e;
        const message = e instanceof Error ? e.message : String(e);
        throw new CampaignOrchestratorError(
          "DIRECTOR_FAILED",
          message,
          "commercial_director",
          undefined,
          true
        );
      }
    } else {
      run.status = "blueprint_ready";
      log("stage.blueprint_reuse", { campaignId: brief.campaignId, generationVersion });
    }

    // ── Stage 2: Shot Planner ────────────────────────────────────────────
    if (!run.shotPlan || input.forceRegenerate) {
      run.status = "planning";
      await persist(run, options);

      const planner = options.shotPlanner ?? createShotPlanner();
      try {
        const plan = await planner.plan(run.blueprint!);
        const validation = validateShotPlan(plan);
        if (!validation.ok) {
          throw new CampaignOrchestratorError(
            "SHOT_PLANNER_FAILED",
            `ShotPlan validation failed: ${validation.issues.map((i) => i.message).join("; ")}`,
            "shot_planner",
            { issues: validation.issues }
          );
        }
        run.shotPlan = plan;
        run.status = "shot_plan_ready";

        const graph = buildShotDependencyGraph(plan);
        run.shots = initShotStates(plan.shots, graph.dependencies);
        await persist(run, options);
        log("stage.shot_plan_ready", {
          campaignId: brief.campaignId,
          shotCount: plan.shots.length,
          totalDuration: plan.totalDurationSeconds,
        });
      } catch (e) {
        if (e instanceof CampaignOrchestratorError) throw e;
        const message = e instanceof Error ? e.message : String(e);
        throw new CampaignOrchestratorError(
          "SHOT_PLANNER_FAILED",
          message,
          "shot_planner",
          undefined,
          true
        );
      }
    } else if (!run.shots.length && run.shotPlan) {
      const graph = buildShotDependencyGraph(run.shotPlan);
      run.shots = initShotStates(run.shotPlan.shots, graph.dependencies);
      run.status = "shot_plan_ready";
      await persist(run, options);
    } else {
      // Resume: validate existing graph still valid
      buildShotDependencyGraph(run.shotPlan!);
      run.status = "shot_plan_ready";
      log("stage.shot_plan_reuse", { campaignId: brief.campaignId, generationVersion });
    }

    const plan = run.shotPlan!;
    const blueprint = run.blueprint!;
    const graph = buildShotDependencyGraph(plan);
    const shotById = new Map(plan.shots.map((s) => [s.id, s]));

    // ── Stage 3: Reference / Keyframe generation ─────────────────────────
    run.status = "references_generating";
    await persist(run, options);

    const approvedKeyframes: Record<string, KeyframeResult> = {
      ...(input.availableAssets?.approvedKeyframesByShotId || {}),
    };
    for (const s of run.shots) {
      if (s.keyframe?.status === "approved") {
        approvedKeyframes[s.shotId] = s.keyframe;
      }
    }

    for (const shotId of graph.topologicalOrder) {
      const shot = shotById.get(shotId)!;
      const state = findShotState(run, shotId);
      const refPlan = resolveReferenceStrategy(shot);

      // Deferred compositor shots
      if (refPlan.strategy === "motion_graphics" || refPlan.strategy === "composited") {
        state.generationMode =
          refPlan.strategy === "motion_graphics" ? "motion_graphics" : "composited";
        state.status = "deferred";
        state.preparedShot = prepareShotForVideo({ shot });
        continue;
      }

      // Resume: already have approved keyframe or skip
      if (
        !input.forceRegenerate &&
        state.keyframe?.status === "approved" &&
        (state.status === "reference_ready" ||
          state.status === "video_ready" ||
          state.status === "video_pending")
      ) {
        approvedKeyframes[shotId] = state.keyframe;
        continue;
      }

      if (!refPlan.callImageProvider && !refPlan.keyframeRequired) {
        state.generationMode =
          shot.generationStrategy.id === "product-reference-first"
            ? "text_to_video"
            : "text_to_video";
        state.status = "reference_skipped";
        const refs =
          input.availableAssets?.productImages?.map((p) => ({
            type: "product" as const,
            assetId: p.id,
            url: p.url,
            mimeType: p.mimeType,
          })) || [];
        state.preparedShot = prepareShotForVideo({
          shot,
          references: refPlan.productReferenceRequired ? refs : undefined,
        });
        continue;
      }

      // Dependency gate for previous-shot references
      for (const depId of state.dependencies) {
        const dep = findShotState(run, depId);
        if (dep.status === "failed" || dep.status === "blocked") {
          state.status = "blocked";
          const err: ProductionError = {
            code: "DEPENDENCY_BLOCKED",
            message: `Blocked by failed dependency ${depId}`,
            stage: "reference_generation",
            campaignId: brief.campaignId,
            shotId,
            retryable: false,
          };
          state.errors = [...(state.errors || []), err];
          run.errors = [...(run.errors || []), err];
          break;
        }
        if (
          refPlan.previousShotReferenceRequired &&
          !approvedKeyframes[depId] &&
          dep.status !== "reference_skipped" &&
          dep.status !== "deferred"
        ) {
          // If dep needed a keyframe and doesn't have one yet — should not happen in topo order
          if (dep.status !== "reference_ready" && dep.status !== "video_ready") {
            state.status = "blocked";
            const err: ProductionError = {
              code: "DEPENDENCY_BLOCKED",
              message: `Previous-shot reference ${depId} not ready`,
              stage: "reference_generation",
              campaignId: brief.campaignId,
              shotId,
              retryable: true,
            };
            state.errors = [...(state.errors || []), err];
            run.errors = [...(run.errors || []), err];
          }
        }
      }
      if (state.status === "blocked") continue;

      state.status = "references_pending";
      try {
        const keyframe = await generateCommercialKeyframe(
          {
            blueprint,
            shot,
            availableAssets: {
              ...input.availableAssets,
              approvedKeyframesByShotId: approvedKeyframes,
            },
            forceRegenerate: input.forceRegenerate,
            skipStorage: input.skipStorage ?? true,
            userId: input.userId,
          },
          {
            imageProvider: options.imageProvider,
            log: (event, payload) => log(`keyframe.${event}`, payload),
          }
        );
        state.keyframe = keyframe;
        if (keyframe.status === "approved") {
          approvedKeyframes[shotId] = keyframe;
          state.status = "reference_ready";
          state.generationMode = "image_to_video";
          state.preparedShot = prepareShotForVideo({
            shot,
            keyframe,
            references: (keyframe.referenceAssetIds || []).map((assetId) => ({
              type: "product" as const,
              assetId,
              url:
                input.availableAssets?.productImages?.find((p) => p.id === assetId)?.url ||
                keyframe.url ||
                "",
            })).filter((r) => r.url),
          });
          // Ensure product refs from available assets
          if (input.availableAssets?.productImages?.length) {
            const refs = [
              ...(state.preparedShot.references || []),
              ...input.availableAssets.productImages.map((p) => ({
                type: "product" as const,
                assetId: p.id,
                url: p.url,
                mimeType: p.mimeType,
              })),
            ];
            state.preparedShot = prepareShotForVideo({
              shot,
              keyframe,
              references: refs,
            });
          }
        } else if (keyframe.status === "skipped") {
          state.status = "reference_skipped";
          state.generationMode = "text_to_video";
          state.preparedShot = prepareShotForVideo({ shot });
        } else {
          state.status = "failed";
          const err: ProductionError = {
            code: "REFERENCE_GENERATION_FAILED",
            message: `Keyframe status=${keyframe.status}`,
            stage: "reference_generation",
            campaignId: brief.campaignId,
            shotId,
            retryable: true,
          };
          state.errors = [...(state.errors || []), err];
          run.errors = [...(run.errors || []), err];
        }
      } catch (e) {
        state.status = "failed";
        const message = e instanceof Error ? e.message : String(e);
        const code =
          e instanceof ReferenceEngineError ? e.code : "REFERENCE_GENERATION_FAILED";
        const err: ProductionError = {
          code,
          message,
          stage: "reference_generation",
          campaignId: brief.campaignId,
          shotId,
          retryable: code === "RATE_LIMITED" || code === "IMAGE_GENERATION_FAILED",
        };
        state.errors = [...(state.errors || []), err];
        run.errors = [...(run.errors || []), err];
        log("stage.reference_failed", { campaignId: brief.campaignId, shotId, code, message });
      }
      await persist(run, options);
    }

    const refFailed = run.shots.some((s) => s.status === "failed" || s.status === "blocked");
    if (refFailed && run.shots.every((s) => s.status === "failed" || s.status === "blocked" || s.status === "deferred")) {
      run.status = "reference_generation_failed";
      await persist(run, options);
      run.manifest = buildProductionManifest(run);
      await manifestStore.save(run.manifest);
      return run;
    }

    // Mark references ready when all keyframe-needed shots succeeded or skipped/deferred
    const refsOk = run.shots.every(
      (s) =>
        s.status === "reference_ready" ||
        s.status === "reference_skipped" ||
        s.status === "deferred" ||
        s.status === "video_ready" ||
        s.status === "video_pending" ||
        // failed/blocked stop video for those shots only
        s.status === "failed" ||
        s.status === "blocked"
    );
    if (!refsOk) {
      run.status = "reference_generation_failed";
      await persist(run, options);
      return run;
    }
    run.status = "references_ready";
    await persist(run, options);
    log("stage.references_ready", { campaignId: brief.campaignId });

    // Ensure prepared shots exist
    for (const state of run.shots) {
      if (state.preparedShot) continue;
      const shot = shotById.get(state.shotId)!;
      if (state.status === "failed" || state.status === "blocked") continue;
      state.preparedShot = prepareShotForVideo({
        shot,
        keyframe: state.keyframe,
      });
      state.generationMode = state.preparedShot.generationMode;
    }

    // ── Stage 4–5: Video generation ──────────────────────────────────────
    run.status = "videos_generating";
    await persist(run, options);

    for (const shotId of graph.topologicalOrder) {
      const state = findShotState(run, shotId);
      if (state.status === "deferred") continue;
      if (state.status === "failed" || state.status === "blocked") continue;

      if (!input.forceRegenerate && state.status === "video_ready" && state.video?.status === "completed") {
        continue;
      }

      // Block if dependency failed
      let blocked = false;
      for (const depId of state.dependencies) {
        const dep = findShotState(run, depId);
        if (dep.status === "failed" || dep.status === "blocked") {
          state.status = "blocked";
          const err: ProductionError = {
            code: "DEPENDENCY_BLOCKED",
            message: `Video blocked by failed dependency ${depId}`,
            stage: "video_generation",
            campaignId: brief.campaignId,
            shotId,
            retryable: false,
          };
          state.errors = [...(state.errors || []), err];
          run.errors = [...(run.errors || []), err];
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      const prepared = state.preparedShot as PreparedShotForVideo;
      if (prepared.generationMode === "motion_graphics" || prepared.generationMode === "composited") {
        state.status = "deferred";
        state.generationMode = prepared.generationMode;
        continue;
      }

      // Skip video when prepared shot is not ready (e.g. missing keyframe)
      if (!prepared.readyForVideo && prepared.generationMode === "image_to_video") {
        state.status = "failed";
        const err: ProductionError = {
          code: "KEYFRAME_REQUIRED",
          message: prepared.blockedReason || `Shot ${shotId} not ready for image_to_video`,
          stage: "video_generation",
          campaignId: brief.campaignId,
          shotId,
          retryable: false,
        };
        state.errors = [...(state.errors || []), err];
        run.errors = [...(run.errors || []), err];
        continue;
      }

      state.status = "video_generating";
      state.generationMode = prepared.generationMode;
      try {
        const video = await generateCommercialShotVideo(
          {
            blueprint,
            prepared,
            generationVersion,
            forceRegenerate: input.forceRegenerate,
            skipDownload: input.skipDownload ?? true,
            skipStorage: input.skipStorage ?? true,
            userId: input.userId,
          },
          {
            videoProvider: options.videoProvider,
            pollIntervalMs: 1,
            maxWaitMs: 60_000,
            log: (event, payload) => log(`video.${event}`, payload),
          }
        );
        state.video = video;
        if (video.status === "completed") {
          state.status = "video_ready";
        } else if (video.status === "deferred") {
          state.status = "deferred";
        } else {
          state.status = "failed";
          const err: ProductionError = {
            code: video.error?.code || "VIDEO_GENERATION_FAILED",
            message: video.error?.message || `Video status=${video.status}`,
            stage: "video_generation",
            campaignId: brief.campaignId,
            shotId,
            retryable: true,
          };
          state.errors = [...(state.errors || []), err];
          run.errors = [...(run.errors || []), err];
        }
      } catch (e) {
        state.status = "failed";
        const message = e instanceof Error ? e.message : String(e);
        const code =
          e instanceof VideoExecutorError ? e.code : "VIDEO_GENERATION_FAILED";
        const err: ProductionError = {
          code,
          message,
          stage: "video_generation",
          campaignId: brief.campaignId,
          shotId,
          retryable: e instanceof VideoExecutorError ? e.retryable : true,
        };
        state.errors = [...(state.errors || []), err];
        run.errors = [...(run.errors || []), err];
        log("stage.video_failed", { campaignId: brief.campaignId, shotId, code, message });
      }
      await persist(run, options);
    }

    const videoFailed = run.shots.some((s) => s.status === "failed" || s.status === "blocked");
    const allTerminal = run.shots.every(
      (s) => s.status === "video_ready" || s.status === "deferred" || s.status === "failed" || s.status === "blocked"
    );

    if (videoFailed) {
      run.status = "video_generation_failed";
    } else if (allTerminal) {
      run.status = "videos_ready";
    } else {
      run.status = "video_generation_failed";
    }
    await persist(run, options);

    // ── Stage 6: Production validation + manifest ────────────────────────
    const validation = validateProductionRun(run);
    if (!validation.ok && run.status === "videos_ready") {
      // Soft: if only incomplete shots, mark appropriately
      run.status = "manifest_validation_failed";
      run.errors = [...(run.errors || []), ...validation.issues];
    }

    const productionReady = run.shots.every(
      (s) => s.status === "video_ready" || s.status === "deferred"
    );

    if (productionReady) {
      run.status = "production_ready";
    }

    run.manifest = buildProductionManifest({
      ...run,
      status: productionReady ? "composition_pending" : run.status,
    });
    if (productionReady) {
      run.status = "composition_pending";
      run.manifest.runStatus = "composition_pending";
      run.manifest.productionStatus = "ready_for_composition";
    }

    run.completedAt = new Date().toISOString();
    await persist(run, options);
    await manifestStore.save(run.manifest);

    log("run.complete", {
      campaignId: brief.campaignId,
      generationVersion,
      status: run.status,
      productionStatus: run.manifest.productionStatus,
      shotCount: run.shots.length,
    });

    return run;
  } catch (e) {
    if (e instanceof CampaignOrchestratorError) {
      if (e.code === "DIRECTOR_FAILED" || e.code === "SHOT_PLANNER_FAILED" || e.code === "DURATION_MISMATCH") {
        run.status = "planning_failed";
      } else if (e.code === "DEPENDENCY_GRAPH_INVALID") {
        run.status = "dependency_graph_invalid";
      } else if (e.code === "REFERENCE_GENERATION_FAILED") {
        run.status = "reference_generation_failed";
      } else if (e.code === "VIDEO_GENERATION_FAILED") {
        run.status = "video_generation_failed";
      } else if (e.code === "MANIFEST_VALIDATION_FAILED") {
        run.status = "manifest_validation_failed";
      } else {
        run.status = "failed";
      }
      run.errors = [...(run.errors || []), e.toProductionError(brief.campaignId)];
      run.completedAt = new Date().toISOString();
      await persist(run, options);
      if (run.blueprint && run.shotPlan && run.shots.length) {
        try {
          run.manifest = buildProductionManifest(run);
          await manifestStore.save(run.manifest);
        } catch {
          /* ignore */
        }
      }
      return run;
    }
    throw e;
  }
}
