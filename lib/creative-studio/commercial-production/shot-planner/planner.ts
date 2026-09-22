/**
 * Default Shot Planner — Phase 3.
 *
 * CommercialBlueprintCore → CommercialShot[] / ShotPlan
 *
 * Does NOT call Runway, Seedance, image models (Nano Banana / Gemini image),
 * keyframe generation, FFmpeg, or timeline compositing.
 *
 * Reuses Phase 2 StructuredGenerator (Gemini JSON).
 */

import type { CommercialBlueprintCore } from "../commercial-director/types";
import { createDefaultStructuredGenerator } from "../commercial-director/gemini-structured";
import {
  StructuredGenerationError,
  type StructuredGenerator,
} from "../commercial-director/llm";
import { isCampaignDurationSeconds } from "../campaign/campaign-duration";
import { assembleShotPlanFromDraft, type ShotPlannerDraft } from "./assemble";
import {
  buildShotPlannerRepairPrompt,
  buildShotPlannerSystemPrompt,
  buildShotPlannerUserPrompt,
} from "./prompts";
import type { ShotPlan, ShotPlanner } from "./types";
import {
  formatShotPlanValidationIssues,
  validateShotPlan,
} from "./validate";

export interface DefaultShotPlannerOptions {
  generator?: StructuredGenerator;
  maxRepairAttempts?: number;
  log?: (event: string, payload: Record<string, unknown>) => void;
}

function defaultLog(event: string, payload: Record<string, unknown>): void {
  console.log(`[shot-planner] ${event}`, payload);
}

export class DefaultShotPlanner implements ShotPlanner {
  private readonly generator: StructuredGenerator;
  private readonly maxRepairAttempts: number;
  private readonly log: (event: string, payload: Record<string, unknown>) => void;

  constructor(options: DefaultShotPlannerOptions = {}) {
    this.generator = options.generator ?? createDefaultStructuredGenerator();
    this.maxRepairAttempts = options.maxRepairAttempts ?? 1;
    this.log = options.log ?? defaultLog;
  }

  async plan(blueprint: CommercialBlueprintCore): Promise<ShotPlan> {
    const started = Date.now();
    this.assertBlueprint(blueprint);

    this.log("plan.start", {
      campaignId: blueprint.campaignId,
      campaignDuration: blueprint.campaignDuration,
      beatCount: blueprint.visualBeats?.length ?? 0,
      concept: blueprint.selectedConcept?.title ?? null,
      model: this.generator.modelId,
    });

    let draft: ShotPlannerDraft;
    let model = this.generator.modelId;
    let repairAttempted = false;

    try {
      const first = await this.generator.generateJson<ShotPlannerDraft>({
        systemPrompt: buildShotPlannerSystemPrompt(),
        userPrompt: buildShotPlannerUserPrompt(blueprint),
        schemaName: "shot-plan",
        temperature: 0.75,
        maxOutputTokens: 65536,
      });
      draft = first.data;
      model = first.model;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.log("plan.failure", {
        campaignId: blueprint.campaignId,
        model: this.generator.modelId,
        generationDurationMs: Date.now() - started,
        validationPassed: false,
        failureReason: message,
      });
      throw e;
    }

    let { plan, durationNormalized } = assembleShotPlanFromDraft(blueprint, draft, {
      model,
      generationDurationMs: Date.now() - started,
      validationPassed: false,
      repairAttempted: false,
    });
    let validation = validateShotPlan(plan, blueprint.campaignDuration);

    if (!validation.ok && this.maxRepairAttempts > 0) {
      repairAttempted = true;
      this.log("plan.validation_failed_repairing", {
        campaignId: blueprint.campaignId,
        issueCount: validation.issues.length,
        issues: validation.issues.slice(0, 15),
      });

      try {
        const repaired = await this.generator.generateJson<ShotPlannerDraft>({
          systemPrompt: buildShotPlannerSystemPrompt(),
          userPrompt: buildShotPlannerRepairPrompt(
            blueprint,
            draft,
            formatShotPlanValidationIssues(validation.issues)
          ),
          schemaName: "shot-plan-repair",
          temperature: 0.45,
          maxOutputTokens: 65536,
        });
        draft = repaired.data;
        model = repaired.model;
        ({ plan, durationNormalized } = assembleShotPlanFromDraft(blueprint, draft, {
          model,
          generationDurationMs: Date.now() - started,
          validationPassed: false,
          repairAttempted: true,
        }));
        validation = validateShotPlan(plan, blueprint.campaignDuration);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        this.log("plan.repair_failure", {
          campaignId: blueprint.campaignId,
          failureReason: message,
        });
        throw new StructuredGenerationError(`Shot Planner repair failed: ${message}`, e);
      }
    }

    const generationDurationMs = Date.now() - started;

    if (!validation.ok) {
      const failureReason = formatShotPlanValidationIssues(validation.issues);
      this.log("plan.validation_failed", {
        campaignId: blueprint.campaignId,
        shotCount: plan.shots.length,
        totalDuration: plan.totalDurationSeconds,
        model,
        generationDurationMs,
        validationPassed: false,
        failureReason,
        repairAttempted,
      });
      throw new StructuredGenerationError(`Shot plan validation failed: ${failureReason}`);
    }

    // Refresh meta after success
    const successMeta = {
      campaignId: blueprint.campaignId,
      campaignDuration: blueprint.campaignDuration,
      shotCount: plan.shots.length,
      totalDurationSeconds: plan.totalDurationSeconds,
      referenceRequiredCount: plan.shots.filter((s) => s.referenceRequired).length,
      keyframeFirstCount: plan.shots.filter((s) => s.generationStrategy.id === "keyframe-first")
        .length,
      motionGraphicsCount: plan.shots.filter(
        (s) =>
          s.generationStrategy.id === "motion-graphics" || s.generationStrategy.id === "composited"
      ).length,
      textToVideoCount: plan.shots.filter((s) => s.generationStrategy.id === "text-to-video")
        .length,
      productReferenceCount: plan.shots.filter(
        (s) => s.referenceRequirements.productReferenceRequired
      ).length,
      model,
      generationDurationMs,
      validationPassed: true,
      durationNormalized,
      repairAttempted,
    };

    plan = { ...plan, meta: successMeta };

    this.log("plan.success", {
      campaignId: successMeta.campaignId,
      shotCount: successMeta.shotCount,
      totalDuration: successMeta.totalDurationSeconds,
      referenceRequiredCount: successMeta.referenceRequiredCount,
      keyframeFirstCount: successMeta.keyframeFirstCount,
      motionGraphicsCount: successMeta.motionGraphicsCount,
      textToVideoCount: successMeta.textToVideoCount,
      productReferenceCount: successMeta.productReferenceCount,
      model: successMeta.model,
      generationDurationMs: successMeta.generationDurationMs,
      validationPassed: true,
      durationNormalized,
      repairAttempted,
    });

    return plan;
  }

  private assertBlueprint(blueprint: CommercialBlueprintCore): void {
    if (!blueprint?.campaignId?.trim()) {
      throw new StructuredGenerationError("CommercialBlueprintCore.campaignId is required");
    }
    if (!isCampaignDurationSeconds(blueprint.campaignDuration)) {
      throw new StructuredGenerationError(
        "CommercialBlueprintCore.campaignDuration must be 15 or 30"
      );
    }
    if (!blueprint.selectedConcept?.title) {
      throw new StructuredGenerationError("CommercialBlueprintCore.selectedConcept is required");
    }
    if (!blueprint.visualTreatment) {
      throw new StructuredGenerationError("CommercialBlueprintCore.visualTreatment is required");
    }
    if (!Array.isArray(blueprint.visualBeats) || blueprint.visualBeats.length < 1) {
      throw new StructuredGenerationError("CommercialBlueprintCore.visualBeats are required");
    }
  }
}

export function createShotPlanner(options?: DefaultShotPlannerOptions): ShotPlanner {
  return new DefaultShotPlanner(options);
}
